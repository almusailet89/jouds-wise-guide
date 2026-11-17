"""Probe HUMAIN Voice: list voices, synthesize a Saudi line with each Saudi female voice."""
import asyncio, os, time, wave
from pathlib import Path
from humain_voice import tts

API_URL = os.environ.get("HUMAIN_API_URL", "https://api.voice.humain.com")
KEY = os.environ["HUMAIN_VOICE_API_KEY"]
LINE = "هلا والله، صباح النور. عندك اليوم اجتماع الساعة عشر، وصرفت ميتين وخمسين ريال على الغدا. وش ودك نسوي بعدها؟"

async def main():
    async with tts.TTSClient(api_url=API_URL, api_key=KEY) as client:
        voices = await client.list_voices(timeout_seconds=8.0)
        for v in voices:
            p = v.get("profile") or {}
            print(v["label"], p.get("speaker", {}).get("gender"), p.get("speaker", {}).get("dialect"), p.get("emotions"), p.get("styles"))
        Path("out").mkdir(exist_ok=True)
        for v in voices:
            p = v.get("profile") or {}
            if p.get("speaker", {}).get("dialect") == "ars" and p.get("speaker", {}).get("gender") == "female":
                t0 = time.time()
                pcm = await client.synthesize("[conversational] " + LINE, voice_id=v["id"], model=tts.TtsModel.Nebula)
                path = Path(f"out/humain_{v['label']}.wav")
                with wave.open(str(path), "wb") as w:
                    w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)
                print(f"saved {path} — {len(pcm)/48000:.1f}s audio in {time.time()-t0:.1f}s")

asyncio.run(main())
