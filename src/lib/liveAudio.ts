// Browser audio plumbing for Gemini Live.
//   Mic → AudioWorklet → 16 kHz mono PCM16 chunks (base64)
//   24 kHz PCM16 chunks (base64) → gapless playback queue with instant flush on barge-in

const CAPTURE_WORKLET = `
class JoodCapture extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.ratio = sampleRate / 16000;
    this.chunk = new Int16Array(options.processorOptions.chunkSamples);
    this.fill = 0;
    this.pos = 0;
    this.level = 0;
  }
  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;
    let peak = 0;
    // Linear-interpolated resample from the context rate to 16 kHz.
    while (this.pos < input.length) {
      const i = Math.floor(this.pos);
      const frac = this.pos - i;
      const a = input[i];
      const b = i + 1 < input.length ? input[i + 1] : a;
      const s = Math.max(-1, Math.min(1, a + (b - a) * frac));
      if (Math.abs(s) > peak) peak = Math.abs(s);
      this.chunk[this.fill++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.fill === this.chunk.length) {
        this.port.postMessage({ pcm: this.chunk.buffer.slice(0), level: this.level });
        this.fill = 0;
      }
      this.pos += this.ratio;
    }
    this.pos -= input.length;
    this.level = this.level * 0.8 + peak * 0.2;
    return true;
  }
}
registerProcessor('jood-capture', JoodCapture);
`;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + step)));
  }
  return btoa(binary);
}

function base64ToInt16(b64: string): Int16Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
}

type AudioContextCtor = typeof AudioContext;
const getAudioContextCtor = (): AudioContextCtor =>
  window.AudioContext ?? (window as unknown as { webkitAudioContext: AudioContextCtor }).webkitAudioContext;

export class MicCapture {
  private ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  level = 0;
  muted = false;

  /** Construct inside the user's tap so Safari lets the context run. */
  constructor(private onChunk: (base64Pcm: string) => void) {
    const Ctor = getAudioContextCtor();
    this.ctx = new Ctor();
  }

  async start(stream: MediaStream) {
    if (!this.ctx) throw new Error('MicCapture already stopped');
    this.stream = stream;
    const url = URL.createObjectURL(new Blob([CAPTURE_WORKLET], { type: 'application/javascript' }));
    try {
      await this.ctx.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    this.source = this.ctx.createMediaStreamSource(stream);
    // ~64 ms per chunk at 16 kHz: low latency without flooding the socket.
    this.node = new AudioWorkletNode(this.ctx, 'jood-capture', { processorOptions: { chunkSamples: 1024 } });
    this.node.port.onmessage = (e: MessageEvent<{ pcm: ArrayBuffer; level: number }>) => {
      this.level = this.muted ? 0 : e.data.level;
      if (this.muted) return;
      this.onChunk(bytesToBase64(new Uint8Array(e.data.pcm)));
    };
    this.source.connect(this.node);
    // The worklet must be pulled by the graph; route it through a silent gain.
    const sink = this.ctx.createGain();
    sink.gain.value = 0;
    this.node.connect(sink).connect(this.ctx.destination);
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  async stop() {
    try { this.source?.disconnect(); } catch { /* already gone */ }
    try { this.node?.disconnect(); } catch { /* already gone */ }
    this.stream?.getTracks().forEach(t => t.stop());
    if (this.ctx && this.ctx.state !== 'closed') await this.ctx.close().catch(() => undefined);
    this.ctx = null; this.node = null; this.source = null; this.stream = null;
    this.level = 0;
  }
}

export class PcmPlayer {
  private ctx: AudioContext;
  private analyser: AnalyserNode;
  private gain: GainNode;
  private nextTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private levelBuf: Uint8Array;
  onIdle: (() => void) | null = null;

  constructor(private sampleRate = 24000) {
    const Ctor = getAudioContextCtor();
    // Creating this inside the user's tap keeps Safari from blocking playback.
    this.ctx = new Ctor({ sampleRate });
    this.gain = this.ctx.createGain();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.levelBuf = new Uint8Array(this.analyser.fftSize);
    this.gain.connect(this.analyser).connect(this.ctx.destination);
  }

  async resume() {
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  get playing() {
    return this.sources.size > 0;
  }

  enqueue(base64Pcm: string) {
    const pcm = base64ToInt16(base64Pcm);
    if (!pcm.length) return;
    const buffer = this.ctx.createBuffer(1, pcm.length, this.sampleRate);
    const ch = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 0x8000;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.gain);
    const startAt = Math.max(this.nextTime, this.ctx.currentTime + 0.03);
    src.start(startAt);
    this.nextTime = startAt + buffer.duration;
    this.sources.add(src);
    src.onended = () => {
      this.sources.delete(src);
      if (this.sources.size === 0) this.onIdle?.();
    };
  }

  /** Stop everything at once — the user started talking over Jood. */
  flush() {
    this.sources.forEach(s => { try { s.stop(); } catch { /* not started */ } });
    this.sources.clear();
    this.nextTime = 0;
  }

  level(): number {
    if (!this.sources.size) return 0;
    this.analyser.getByteTimeDomainData(this.levelBuf);
    let peak = 0;
    for (let i = 0; i < this.levelBuf.length; i++) peak = Math.max(peak, Math.abs(this.levelBuf[i] - 128) / 128);
    return peak;
  }

  async close() {
    this.flush();
    if (this.ctx.state !== 'closed') await this.ctx.close().catch(() => undefined);
  }
}
