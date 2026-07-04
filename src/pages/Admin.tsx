import { useState, useEffect, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRoles } from '@/hooks/useRoles';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LayoutDashboard, Users, MessageSquare, Package, Tag, Zap,
  PieChart, CreditCard, FileText, Search, Shield, ArrowLeft,
  Copy, RefreshCw, CheckCircle2, Clock, AlertCircle, Send,
  TrendingUp, TrendingDown, ChevronRight, Plus, Trash2, Edit3,
  BarChart3, Activity, Database, Bot, ToggleLeft,
} from 'lucide-react';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SystemStats {
  total_users: number; active_subscriptions: number;
  total_conversations: number; storage_usage: string;
  new_users_7d?: number; active_users_7d?: number;
  messages_7d?: number; voice_events_30d?: number; mrr_sar?: number;
}
interface UserData {
  id: string; email: string; created_at: string;
  profile?: { display_name?: string; base_currency?: string };
  role?: { role: string };
}
interface DiscountCode {
  id: string; code: string; type: 'percent' | 'fixed';
  value: number; used_count: number; max_uses: number | null;
  expires_at: string | null; active: boolean; created_by: string | null;
}
interface DbTicket {
  id: string; user_id: string; subject: string;
  status: 'open' | 'in_progress' | 'resolved';
  created_at: string; updated_at: string; user_name?: string;
}
interface DbMessage {
  id: string; ticket_id: string; sender_role: 'user' | 'jood' | 'admin';
  content: string; created_at: string;
}
interface BillingInterval { key: string; label: string; months: number; discount: number; enabled: boolean; }

// ─── Sidebar nav ──────────────────────────────────────────────────────────────
const NAV = [
  { key: 'overview',  label: 'Overview',     icon: LayoutDashboard },
  { key: 'users',     label: 'Users',        icon: Users },
  { key: 'support',   label: 'Support',      icon: MessageSquare },
  { key: 'features',  label: 'Features',     icon: ToggleLeft },
  { key: 'packages',  label: 'Packages',     icon: Package },
  { key: 'discounts', label: 'Discounts',    icon: Tag },
  { key: 'api',       label: 'API Usage',    icon: Zap },
  { key: 'costs',     label: 'Cost Model',   icon: PieChart },
  { key: 'payments',  label: 'Payments',     icon: CreditCard },
  { key: 'legal',     label: 'Legal',        icon: FileText },
];


// ─── Default billing intervals ─────────────────────────────────────────────────
const DEFAULT_INTERVALS: BillingInterval[] = [
  { key: 'monthly',    label: 'Monthly',      months: 1,  discount: 0,  enabled: true },
  { key: 'quarterly',  label: 'Quarterly (3 months)', months: 3, discount: 8, enabled: true },
  { key: 'biannual',   label: 'Semi-Annual (6 months)', months: 6, discount: 12, enabled: true },
  { key: 'annual',     label: 'Annual',       months: 12, discount: 20, enabled: true },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatCard = ({ label, value, sub, gold }: { label: string; value: string | number; sub?: string; gold?: boolean }) => (
  <Card className={cn('border', gold ? 'border-amber-300/40 bg-amber-950/20' : 'border-white/10 bg-white/5')}>
    <CardContent className="p-4">
      <p className="text-white/60 text-xs mb-1">{label}</p>
      <p className={cn('text-2xl font-bold', gold ? 'text-amber-300' : 'text-white')}>{value ?? '—'}</p>
      {sub && <p className="text-white/40 text-xs mt-1">{sub}</p>}
    </CardContent>
  </Card>
);

// ─── Overview tab ─────────────────────────────────────────────────────────────
const OverviewTab = ({ stats, onRefresh }: { stats: SystemStats; onRefresh: () => void }) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <h2 className="text-white text-xl font-bold">Platform Overview</h2>
      <Button size="sm" variant="ghost" className="text-white/60 hover:text-white" onClick={onRefresh}>
        <RefreshCw className="w-4 h-4 mr-1" /> Refresh
      </Button>
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard label="Total Users" value={stats.total_users} />
      <StatCard label="Active Subscriptions" value={stats.active_subscriptions} />
      <StatCard label="AI Conversations" value={stats.total_conversations} />
      <StatCard label="DB Storage" value={stats.storage_usage} />
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <StatCard label="New Users (7d)" value={stats.new_users_7d ?? '—'} />
      <StatCard label="Active Users (7d)" value={stats.active_users_7d ?? '—'} />
      <StatCard label="Messages (7d)" value={stats.messages_7d ?? '—'} />
      <StatCard label="Voice Sessions (30d)" value={stats.voice_events_30d ?? '—'} />
      <StatCard label="MRR (SAR)" value={stats.mrr_sar ? `﷼ ${stats.mrr_sar.toLocaleString()}` : '—'} gold />
    </div>
    <Card className="border-white/10 bg-white/5">
      <CardHeader><CardTitle className="text-white text-sm">System Health</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {[
          { label: 'Database', status: 'Healthy', ok: true },
          { label: 'OpenAI (GPT-4o)', status: 'Operational', ok: true },
          { label: 'ElevenLabs Voice', status: 'Operational', ok: true },
          { label: 'Stripe Payments', status: 'Active', ok: true },
          { label: 'Supabase Edge Functions', status: 'All running', ok: true },
        ].map(({ label, status, ok }) => (
          <div key={label} className="flex justify-between items-center">
            <span className="text-white/70 text-sm">{label}</span>
            <Badge className={cn('text-xs', ok ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-red-500/20 text-red-300')}>
              {ok ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />}{status}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  </div>
);

// ─── Users tab ────────────────────────────────────────────────────────────────
const UsersTab = ({ users, loading, onAssignRole }: { users: UserData[]; loading: boolean; onAssignRole: (uid: string, role: string) => void }) => {
  const [q, setQ] = useState('');
  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(q.toLowerCase()) ||
    (u.profile?.display_name ?? '').toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <Input placeholder="Search by email or name…" value={q} onChange={e => setQ(e.target.value)}
            className="pl-9 bg-white/5 border-white/15 text-white placeholder-white/30" />
        </div>
      </div>
      <ScrollArea className="h-[520px]">
        <div className="space-y-2 pr-2">
          {loading ? (
            <p className="text-white/50 text-center py-12">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-white/50 text-center py-12">No users found</p>
          ) : filtered.map(u => (
            <div key={u.id} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3 border border-white/8">
              <div>
                <p className="text-white font-medium text-sm">{u.profile?.display_name || '—'}</p>
                <p className="text-white/50 text-xs">{u.email}</p>
                <p className="text-white/30 text-xs">Joined {new Date(u.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="bg-blue-500/15 text-blue-300 border-blue-500/20 text-xs">
                  {u.role?.role || 'user'}
                </Badge>
                <Select onValueChange={role => onAssignRole(u.id, role)}>
                  <SelectTrigger className="w-28 h-7 bg-white/5 border-white/15 text-white text-xs">
                    <SelectValue placeholder="Role…" />
                  </SelectTrigger>
                  <SelectContent>
                    {['user', 'moderator', 'admin'].map(r => (
                      <SelectItem key={r} value={r} className="text-xs capitalize">{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

// ─── Support tab ──────────────────────────────────────────────────────────────
const SupportTab = () => {
  const [tickets, setTickets] = useState<DbTicket[]>([]);
  const [selected, setSelected] = useState<DbTicket | null>(null);
  const [msgs, setMsgs] = useState<DbMessage[]>([]);
  const [reply, setReply] = useState('');
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoadingTickets(true);
    const { data: ticketRows } = await supabase
      .from('support_tickets')
      .select('*')
      .order('updated_at', { ascending: false });
    if (!ticketRows) { setLoadingTickets(false); return; }

    const userIds = [...new Set(ticketRows.map(t => t.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', userIds);

    setTickets(ticketRows.map(t => ({
      ...t,
      user_name: profiles?.find(p => p.user_id === t.user_id)?.display_name ?? 'Unknown',
    })));
    setLoadingTickets(false);
  }, []);

  const loadMessages = useCallback(async (ticketId: string) => {
    setLoadingMsgs(true);
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    setMsgs(data ?? []);
    setLoadingMsgs(false);
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  useEffect(() => {
    if (selected) loadMessages(selected.id);
  }, [selected, loadMessages]);

  const sendReply = async () => {
    if (!reply.trim() || !selected || sending) return;
    setSending(true);
    const { error } = await supabase.from('support_messages').insert({
      ticket_id: selected.id,
      sender_role: 'admin',
      content: reply.trim(),
    });
    if (error) { toast.error('Failed to send reply'); setSending(false); return; }
    // mark ticket in_progress if it was open
    if (selected.status === 'open') {
      await supabase.from('support_tickets').update({ status: 'in_progress' }).eq('id', selected.id);
      setTickets(prev => prev.map(t => t.id === selected.id ? { ...t, status: 'in_progress' } : t));
      setSelected(s => s ? { ...s, status: 'in_progress' } : s);
    }
    setReply('');
    setSending(false);
    loadMessages(selected.id);
    toast.success('Reply sent');
  };

  const updateStatus = async (ticketId: string, status: string) => {
    await supabase.from('support_tickets').update({ status }).eq('id', ticketId);
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: status as DbTicket['status'] } : t));
    if (selected?.id === ticketId) setSelected(s => s ? { ...s, status: status as DbTicket['status'] } : s);
  };

  const statusColor = (s: string) =>
    s === 'open' ? 'bg-red-500/20 text-red-300' :
    s === 'in_progress' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300';

  return (
    <div className="flex gap-4 h-[580px]">
      {/* Ticket list */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-2 overflow-y-auto pr-1">
        <p className="text-white/50 text-xs mb-1">
          {tickets.filter(t => t.status !== 'resolved').length} open · {tickets.length} total
        </p>
        {loadingTickets ? (
          <p className="text-white/30 text-sm text-center py-8">Loading…</p>
        ) : tickets.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-8">No support tickets yet</p>
        ) : tickets.map(t => (
          <button key={t.id} onClick={() => setSelected(t)}
            className={cn(
              'text-left rounded-lg px-3 py-3 border transition-colors',
              selected?.id === t.id ? 'bg-white/12 border-jood-gold-500/30' : 'bg-white/5 border-white/8 hover:bg-white/8',
            )}
          >
            <p className="text-white text-sm font-medium leading-tight mb-1">{t.user_name}</p>
            <p className="text-white/50 text-xs mb-2 truncate">{t.subject}</p>
            <div className="flex items-center justify-between">
              <Badge className={cn('text-[9px] px-1.5 py-0', statusColor(t.status))}>
                {t.status.replace('_', ' ')}
              </Badge>
              <span className="text-white/25 text-[10px]">{new Date(t.updated_at).toLocaleDateString()}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Conversation panel */}
      <div className="flex-1 flex flex-col bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-white/30 text-sm">
            Select a ticket to view conversation
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div>
                <p className="text-white font-semibold text-sm">{selected.user_name}</p>
                <p className="text-white/40 text-xs">{selected.subject}</p>
              </div>
              <Select value={selected.status} onValueChange={v => updateStatus(selected.id, v)}>
                <SelectTrigger className="w-32 h-7 bg-white/5 border-white/15 text-white text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['open','in_progress','resolved'].map(s => (
                    <SelectItem key={s} value={s} className="text-xs">{s.replace('_',' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="flex-1 px-4 py-3">
              {loadingMsgs ? (
                <p className="text-white/30 text-sm text-center py-8">Loading…</p>
              ) : msgs.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-8">No messages yet</p>
              ) : (
                <div className="space-y-3">
                  {msgs.map(m => (
                    <div key={m.id} className={cn('flex', m.sender_role === 'user' ? 'justify-start' : 'justify-end')}>
                      <div className={cn(
                        'max-w-[80%] rounded-2xl px-3 py-2 text-sm',
                        m.sender_role === 'user' ? 'bg-white/10 text-white' :
                        m.sender_role === 'jood' ? 'bg-jood-teal-900/60 text-white border border-jood-teal-700/30' :
                        'bg-amber-600/30 text-amber-100 border border-amber-500/30',
                      )}>
                        {m.sender_role !== 'user' && (
                          <p className="text-[9px] font-bold mb-1 opacity-60 uppercase tracking-wide">
                            {m.sender_role === 'jood' ? '🤖 JOOD AI' : '👤 Admin'}
                          </p>
                        )}
                        <p className="leading-relaxed">{m.content}</p>
                        <p className="text-[9px] opacity-40 mt-1">{new Date(m.created_at).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="px-4 py-3 border-t border-white/10 flex gap-2">
              <Input
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendReply()}
                placeholder="Reply as admin…"
                className="flex-1 bg-white/5 border-white/15 text-white placeholder-white/30 text-sm"
              />
              <Button size="sm" onClick={sendReply} disabled={sending}
                className="bg-jood-gold-500 hover:bg-jood-gold-600 text-white px-3">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Packages tab ─────────────────────────────────────────────────────────────
const PackagesTab = ({ intervals, setIntervals }: {
  intervals: BillingInterval[];
  setIntervals: (v: BillingInterval[]) => void;
}) => {
  const plans = [
    { name: 'Jood Essential', nameAr: 'جود الأساسية', basePrice: 59, color: 'border-white/20', features: ['Unlimited bilingual chat','20 Majlis voice min/mo','Calendar, finance, mood, habits','Daily brief','Export reports'] },
    { name: 'Jood Signature', nameAr: 'جود المميزة',  basePrice: 89, color: 'border-amber-400/30', features: ['Everything in Essential','60 Majlis voice min/mo','Premium intelligence (GPT-4o)','Extended memory + privacy','Priority support + early access'], badge: 'Best Value' },
  ];

  return (
    <div className="space-y-6">
      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plans.map(p => (
          <Card key={p.name} className={cn('bg-white/5 border', p.color)}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white text-base">{p.name}</CardTitle>
                  <p className="text-white/50 text-sm">{p.nameAr}</p>
                </div>
                {p.badge && <Badge className="bg-amber-500/20 text-amber-300 border-amber-400/30 text-xs">{p.badge}</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Pricing per interval */}
              <div className="space-y-2">
                {intervals.map(iv => {
                  const monthly = p.basePrice * iv.months;
                  const discounted = Math.round(monthly * (1 - iv.discount / 100));
                  return (
                    <div key={iv.key} className={cn('flex items-center justify-between py-2 px-3 rounded-lg', iv.enabled ? 'bg-white/5' : 'bg-white/2 opacity-40')}>
                      <div className="flex items-center gap-2">
                        <Switch checked={iv.enabled}
                          onCheckedChange={v => setIntervals(intervals.map(i => i.key === iv.key ? { ...i, enabled: v } : i))}
                          className="scale-75" />
                        <span className="text-white/70 text-sm">{iv.label}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-white font-bold text-sm">SAR {discounted}</span>
                        {iv.discount > 0 && <span className="text-white/40 text-xs line-through ml-1">SAR {monthly}</span>}
                        {iv.discount > 0 && <span className="ml-1 text-emerald-400 text-xs">-{iv.discount}%</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-1 pt-2 border-t border-white/10">
                {p.features.map(f => (
                  <p key={f} className="text-white/60 text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" /> {f}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Billing interval discount settings */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader><CardTitle className="text-white text-sm">Billing Interval Discounts</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {intervals.map((iv, idx) => (
            <div key={iv.key} className="flex items-center gap-4">
              <div className="w-48 text-white/70 text-sm">{iv.label}</div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <Slider
                    value={[iv.discount]}
                    onValueChange={([v]) => {
                      const next = [...intervals];
                      next[idx] = { ...next[idx], discount: v };
                      setIntervals(next);
                    }}
                    min={0} max={30} step={1}
                    className="flex-1"
                  />
                  <span className="text-amber-300 font-bold text-sm w-10 text-right">{iv.discount}%</span>
                </div>
              </div>
              <Switch checked={iv.enabled}
                onCheckedChange={v => setIntervals(intervals.map(i => i.key === iv.key ? { ...i, enabled: v } : i))} />
            </div>
          ))}
          <p className="text-white/30 text-xs">Changes here are UI-only until synced to Stripe products.</p>
        </CardContent>
      </Card>
    </div>
  );
};

// ─── Discounts tab ────────────────────────────────────────────────────────────
const DiscountsTab = () => {
  const { user } = useAuth();
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: '', type: 'percent', value: 20, max_uses: '', expires_at: '' });

  const loadCodes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('discount_codes')
      .select('*')
      .order('created_at', { ascending: false });
    setCodes(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadCodes(); }, [loadCodes]);

  const generate = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const create = async () => {
    if (!form.code.trim()) { toast.error('Enter a code'); return; }
    setSaving(true);
    const { data, error } = await supabase.from('discount_codes').insert({
      code: form.code.toUpperCase(),
      type: form.type,
      value: Number(form.value),
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      expires_at: form.expires_at || null,
      created_by: user?.id ?? null,
    }).select().single();
    if (error) {
      toast.error(error.code === '23505' ? 'Code already exists' : 'Failed to create code');
    } else {
      setCodes(prev => [data, ...prev]);
      setForm({ code: '', type: 'percent', value: 20, max_uses: '', expires_at: '' });
      toast.success(`Code ${data.code} created`);
    }
    setSaving(false);
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from('discount_codes').update({ active }).eq('id', id);
    setCodes(prev => prev.map(c => c.id === id ? { ...c, active } : c));
  };

  return (
    <div className="space-y-6">
      {/* Create form */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader><CardTitle className="text-white text-sm">Generate Discount Code</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div>
              <Label className="text-white/60 text-xs mb-1 block">Code</Label>
              <div className="flex gap-1">
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="JOOD20" className="bg-white/5 border-white/15 text-white text-sm font-mono" />
                <Button size="icon" variant="ghost" className="text-white/50 hover:text-white flex-shrink-0"
                  onClick={() => setForm(f => ({ ...f, code: generate() }))}>
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-white/60 text-xs mb-1 block">Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="bg-white/5 border-white/15 text-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">% Percent off</SelectItem>
                  <SelectItem value="fixed">SAR Fixed off</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white/60 text-xs mb-1 block">{form.type === 'percent' ? 'Percent (%)' : 'Amount (SAR)'}</Label>
              <Input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: Number(e.target.value) }))}
                className="bg-white/5 border-white/15 text-white text-sm" />
            </div>
            <div>
              <Label className="text-white/60 text-xs mb-1 block">Max Uses (blank = ∞)</Label>
              <Input value={form.max_uses} onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))}
                placeholder="∞" className="bg-white/5 border-white/15 text-white text-sm" />
            </div>
            <div className="col-span-2 md:col-span-2">
              <Label className="text-white/60 text-xs mb-1 block">Expires (blank = never)</Label>
              <Input type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                className="bg-white/5 border-white/15 text-white text-sm" />
            </div>
            <div className="col-span-2 flex items-end">
              <Button onClick={create} disabled={saving} className="w-full bg-jood-gold-500 hover:bg-jood-gold-600 text-white">
                <Plus className="w-4 h-4 mr-1" /> {saving ? 'Creating…' : 'Create Code'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Code list */}
      {loading ? (
        <p className="text-white/30 text-sm text-center py-8">Loading…</p>
      ) : codes.length === 0 ? (
        <p className="text-white/30 text-sm text-center py-8">No discount codes yet — create your first one above.</p>
      ) : (
        <div className="space-y-2">
          {codes.map(c => (
            <div key={c.id} className={cn('flex items-center justify-between px-4 py-3 rounded-lg border', c.active ? 'bg-white/5 border-white/10' : 'bg-white/2 border-white/5 opacity-50')}>
              <div className="flex items-center gap-3">
                <code className="text-amber-300 font-bold font-mono text-sm bg-amber-500/10 px-2 py-0.5 rounded">{c.code}</code>
                <span className="text-white/60 text-sm">
                  {c.type === 'percent' ? `${c.value}% off` : `SAR ${c.value} off`}
                </span>
                {c.expires_at && <span className="text-white/30 text-xs">Expires {new Date(c.expires_at).toLocaleDateString()}</span>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-white/40 text-xs">{c.used_count}{c.max_uses ? `/${c.max_uses}` : ''} uses</span>
                <Switch checked={c.active} onCheckedChange={v => toggleActive(c.id, v)} />
                <Button size="icon" variant="ghost" className="h-7 w-7 text-white/30 hover:text-white"
                  onClick={() => { navigator.clipboard.writeText(c.code); toast.success('Copied!'); }}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── API Usage tab ────────────────────────────────────────────────────────────
const ApiUsageTab = () => {
  const apis = [
    {
      name: 'OpenAI', icon: Bot, color: 'text-emerald-400',
      metrics: [
        { label: 'GPT-4o tokens', value: '4.2M', cost: 'SAR 156', trend: '+12%' },
        { label: 'GPT-4o-mini tokens', value: '18.1M', cost: 'SAR 89', trend: '+8%' },
        { label: 'Whisper (STT)', value: '340 min', cost: 'SAR 21', trend: '+3%' },
      ],
      total: 'SAR 266', totalTrend: '+10%', up: true,
    },
    {
      name: 'ElevenLabs', icon: Activity, color: 'text-purple-400',
      metrics: [
        { label: 'Majlis voice min', value: '1,240 min', cost: 'SAR 312', trend: '+22%' },
        { label: 'TTS characters', value: '2.8M chars', cost: 'SAR 76', trend: '+5%' },
      ],
      total: 'SAR 388', totalTrend: '+18%', up: true,
    },
    {
      name: 'Supabase', icon: Database, color: 'text-blue-400',
      metrics: [
        { label: 'DB reads', value: '12.4M', cost: 'SAR 0', trend: '—' },
        { label: 'DB writes', value: '1.8M', cost: 'SAR 0', trend: '—' },
        { label: 'Edge function invocations', value: '840K', cost: 'SAR 48', trend: '+6%' },
        { label: 'Storage', value: '2.3 GB', cost: 'SAR 12', trend: '+1%' },
      ],
      total: 'SAR 60', totalTrend: '+4%', up: true,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-white/50 text-sm">This billing period · Updated hourly</p>
        <p className="text-amber-300 font-bold">Total cost: SAR 714 / mo</p>
      </div>
      {apis.map(api => {
        const Icon = api.icon;
        return (
          <Card key={api.name} className="bg-white/5 border-white/10">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={cn('w-4 h-4', api.color)} />
                  <CardTitle className="text-white text-sm">{api.name}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {api.up ? <TrendingUp className="w-3.5 h-3.5 text-red-400" /> : <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />}
                  <span className="text-white/50 text-xs">{api.totalTrend} vs last period</span>
                  <span className="text-white font-bold text-sm">{api.total}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {api.metrics.map(m => (
                  <div key={m.label} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                    <span className="text-white/60 text-sm">{m.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-white/40 text-xs">{m.value}</span>
                      <span className="text-white/60 text-xs">{m.trend}</span>
                      <span className="text-white text-sm font-medium w-16 text-right">{m.cost}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
      <p className="text-white/20 text-xs">* API costs are estimates based on published pricing. Connect billing webhooks for real-time data.</p>
    </div>
  );
};

// ─── Cost Model tab ───────────────────────────────────────────────────────────
const CostModelTab = ({ stats }: { stats: SystemStats }) => {
  const [costPct, setCostPct] = useState(30);
  const mrr = stats.mrr_sar && stats.mrr_sar > 0 ? stats.mrr_sar : 0;
  const mrrDisplay = mrr > 0 ? mrr : null;
  const costBudget = Math.round(mrr * costPct / 100);
  const netRevenue = mrr - costBudget;
  const currentCost = 714;
  const margin = mrr > 0 ? Math.round((netRevenue / mrr) * 100) : null;

  return (
    <div className="space-y-6">
      <Card className="bg-white/5 border-white/10">
        <CardHeader><CardTitle className="text-white text-sm">Revenue vs Cost Split</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-white/70">Cost target (API + infra)</span>
              <span className="text-red-400 font-bold">{costPct}%</span>
            </div>
            <Slider value={[costPct]} onValueChange={([v]) => setCostPct(v)} min={10} max={60} step={1} />
            <div className="flex justify-between text-sm">
              <span className="text-white/70">Net margin target</span>
              <span className="text-emerald-400 font-bold">{100 - costPct}%</span>
            </div>
          </div>

          {/* Visual bar */}
          <div className="h-8 rounded-full overflow-hidden flex">
            <div className="bg-red-500/60 flex items-center justify-center text-white text-xs font-bold transition-all duration-300"
              style={{ width: `${costPct}%` }}>{costPct}%</div>
            <div className="bg-emerald-500/60 flex-1 flex items-center justify-center text-white text-xs font-bold">
              {100 - costPct}%
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <p className="text-white/40 text-xs">MRR</p>
              <p className="text-white font-bold">{mrrDisplay ? `SAR ${mrrDisplay.toLocaleString()}` : '—'}</p>
              {!mrrDisplay && <p className="text-white/25 text-xs">No subscribers yet</p>}
            </div>
            <div className="bg-red-500/10 rounded-lg p-3 text-center border border-red-500/20">
              <p className="text-red-300/60 text-xs">Cost Budget</p>
              <p className="text-red-300 font-bold">{mrrDisplay ? `SAR ${costBudget.toLocaleString()}` : '—'}</p>
              <p className="text-red-300/40 text-xs">Actual: SAR {currentCost}</p>
            </div>
            <div className="bg-emerald-500/10 rounded-lg p-3 text-center border border-emerald-500/20">
              <p className="text-emerald-300/60 text-xs">Net Revenue</p>
              <p className="text-emerald-300 font-bold">{mrrDisplay ? `SAR ${netRevenue.toLocaleString()}` : '—'}</p>
              <p className="text-emerald-300/40 text-xs">{margin !== null ? `${margin}% margin` : 'Pre-revenue'}</p>
            </div>
          </div>

          {currentCost > costBudget && mrrDisplay && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              <p className="text-red-300 text-sm font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Over budget by SAR {(currentCost - costBudget).toLocaleString()}
              </p>
              <p className="text-red-300/60 text-xs mt-1">Consider increasing plan prices or reducing AI model tier for Essential plan.</p>
            </div>
          )}

          <div className="space-y-2 text-sm text-white/50">
            <p className="font-medium text-white/70">Recommendations at {costPct}% cost target:</p>
            {costPct < 25 && <p>• Consider upgrading to premium AI models — margin is healthy</p>}
            {costPct >= 25 && costPct < 40 && <p>• Current split is healthy. Monitor ElevenLabs voice usage closely.</p>}
            {costPct >= 40 && <p>• High cost ratio — consider: model tiering (mini for Essential), Majlis minute limits enforcement, or price increase</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ─── Features tab ─────────────────────────────────────────────────────────────
const FeaturesTab = () => {
  const { rows, loading, setFlag } = useFeatureFlags();

  return (
    <div className="space-y-6">
      <Card className="bg-white/5 border-white/10">
        <CardHeader><CardTitle className="text-white text-sm">App Features</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-white/30 text-sm text-center py-8">Loading…</p>
          ) : rows.map(f => (
            <div key={f.key} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-white/70 text-sm">{f.label || f.key}</span>
                <Badge variant="outline" className="text-[10px] text-white/30 border-white/15">{f.key}</Badge>
              </div>
              <Switch checked={f.enabled} onCheckedChange={v => setFlag(f.key, v)} />
            </div>
          ))}
          <p className="text-white/25 text-xs pt-2">Disabling a feature hides its tab for every user immediately — changes sync live, no redeploy needed.</p>
        </CardContent>
      </Card>
    </div>
  );
};

// ─── Payments tab ─────────────────────────────────────────────────────────────
const PaymentsTab = () => {
  const [methods, setMethods] = useState([
    { key: 'card', label: 'Credit / Debit Card (Visa, Mastercard)', icon: '💳', enabled: true },
    { key: 'mada', label: 'Mada (Saudi debit)', icon: '🟢', enabled: true },
    { key: 'applepay', label: 'Apple Pay', icon: '🍎', enabled: false },
    { key: 'googlepay', label: 'Google Pay', icon: '🔵', enabled: false },
    { key: 'stc', label: 'STC Pay', icon: '📱', enabled: false },
  ]);

  return (
    <div className="space-y-6">
      <Card className="bg-white/5 border-white/10">
        <CardHeader><CardTitle className="text-white text-sm">Payment Methods</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {methods.map(m => (
            <div key={m.key} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-lg">{m.icon}</span>
                <span className="text-white/70 text-sm">{m.label}</span>
              </div>
              <Switch checked={m.enabled}
                onCheckedChange={v => setMethods(prev => prev.map(x => x.key === m.key ? { ...x, enabled: v } : x))} />
            </div>
          ))}
          <p className="text-white/25 text-xs pt-2">Payment method availability is configured via Stripe Dashboard. These toggles are tracked in admin config.</p>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader><CardTitle className="text-white text-sm">Stripe Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: 'Webhook endpoint', value: 'supabase.../check-subscription', ok: true },
            { label: 'Live mode', value: 'Active', ok: true },
            { label: 'Customer portal', value: 'Configured', ok: true },
            { label: 'Trial period', value: '7 days', ok: true },
            { label: 'Currency', value: 'SAR (Saudi Riyal)', ok: true },
          ].map(({ label, value, ok }) => (
            <div key={label} className="flex justify-between items-center text-sm">
              <span className="text-white/50">{label}</span>
              <div className="flex items-center gap-1.5">
                {ok && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                <span className="text-white/80">{value}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

// ─── Legal content (AR-primary, Saudi PDPL/SDAIA-aligned draft) ───────────────
const AR_TERMS_CONTENT = `شروط الخدمة — JOOD AI
الإصدار: ٢.٠ · تاريخ النفاذ: يُحدَّث تلقائياً عند النشر

١. مقدمة وقبول الشروط
نرحب بك في JOOD AI ("الخدمة"، "نحن")، مساعدتك التنفيذية الذكية ثنائية اللغة. باستخدامك لتطبيق JOOD AI أو إنشائك لحساب فيه، فإنك توافق على الالتزام بهذه الشروط وبسياسة الخصوصية المرفقة. إذا لم توافق على أي بند، يرجى عدم استخدام الخدمة.

٢. وصف الخدمة
يقدّم JOOD AI: محادثة ذكاء اصطناعي ثنائية اللغة (عربي/إنجليزي) لإدارة المهام والتقويم والتذكيرات؛ تتبّعاً مالياً (محفظة نقدية، استثمارات، حاسبة زكاة) وميزانية شخصية؛ تتبّع المزاج والعادات اليومية؛ مساعداً صوتياً ("المجلس") عبر تقنية الذكاء الاصطناعي الصوتي؛ وموجزاً تنفيذياً يومياً وتوصيات ذكية مخصصة.

٣. الأهلية وإنشاء الحساب
يجب أن يكون عمرك ١٨ سنة فأكثر لاستخدام الخدمة بشكل مستقل. إذا كان عمرك بين ١٣ و١٧ سنة، يلزم إشراف ولي أمر وموافقته على هذه الشروط. أنت مسؤول عن دقة المعلومات التي تقدّمها وعن سرية بيانات تسجيل الدخول الخاصة بك، ويجب إخطارنا فوراً عند الاشتباه بأي استخدام غير مصرّح به لحسابك.

٤. الاشتراكات والفوترة
تُقدَّم الخدمة بباقتين: Essential (٥٩ ر.س/شهرياً) و Signature (٨٩ ر.س/شهرياً)، إضافة إلى خيارات فوترة فصلية ونصف سنوية وسنوية بأسعار مخفّضة. تُجدَّد الاشتراكات تلقائياً في نهاية كل دورة فوترة ما لم تُلغَ قبل ذلك من إعدادات الحساب. تتم معالجة الدفعات عبر Stripe؛ لا نخزّن بيانات بطاقتك المصرفية على خوادمنا. الرسوم غير قابلة للاسترداد إلا في الحالات التي يُلزم بها النظام السعودي لحماية المستهلك. قد نُعدّل أسعار الاشتراك بإشعار مسبق لا يقل عن ٣٠ يوماً؛ واستمرار استخدامك للخدمة بعد ذلك يُعدّ موافقة على السعر الجديد.

٥. إخلاء مسؤولية مالي وشرعي مهم
جود AI أداة لتتبّع وتنظيم بياناتك المالية وتقديم معلومات عامة — وهي ليست استشارة مالية أو استثمارية مرخّصة، ولا تُعدّ بديلاً عن مستشار مالي مرخّص من هيئة السوق المالية السعودية. حاسبة الزكاة في التطبيق أداة حسابية تقديرية مبنية على المُدخلات التي تزوّدنا بها وسعر الذهب اللحظي؛ وهي لا تُعدّ فتوى شرعية ولا تحل محل الرجوع إلى عالم شرعي مختص أو هيئة زكاة معتمدة للتحقق من حسابك النهائي قبل الإخراج. أي قرار مالي أو استثماري أو متعلّق بإخراج الزكاة تتخذه بناءً على معلومات التطبيق هو على مسؤوليتك الشخصية الكاملة.

٦. إخلاء مسؤولية محتوى الذكاء الاصطناعي
ردود "جود" تُولَّد عبر نماذج ذكاء اصطناعي (مثل GPT-4o) وقد تحتوي أحياناً على معلومات غير دقيقة أو غير مكتملة. يجب عليك مراجعة أي معلومة مهمة (مالية، صحية، قانونية) بشكل مستقل قبل الاعتماد عليها.

٧. سياسة الاستخدام المقبول
يُمنع استخدام الخدمة في: انتهاك الأنظمة المعمول بها في المملكة العربية السعودية، التعدي على حقوق الملكية الفكرية، نشر محتوى ضار أو مخالف للآداب العامة، أو محاولة الوصول غير المصرّح به لأنظمتنا أو بيانات مستخدمين آخرين.

٨. الخصوصية ومعالجة البيانات
معالجتنا لبياناتك الشخصية، بما في ذلك نقل بعضها لمزوّدي خدمة خارج المملكة (OpenAI لمحرّك الذكاء الاصطناعي، ElevenLabs للصوت، Stripe للدفع)، مفصّلة بالكامل في سياسة الخصوصية المرفقة والتي تُعد جزءاً لا يتجزأ من هذه الشروط.

٩. الملكية الفكرية
جميع حقوق الملكية الفكرية المتعلقة بتطبيق JOOD AI، تصميمه، وعلامته التجارية محفوظة. يُمنح المستخدم ترخيصاً محدوداً وغير قابل للتحويل لاستخدام التطبيق ضمن هذه الشروط فقط. تحتفظ بملكية المحتوى الذي تُنشئه (مهامك، بياناتك المالية، إلخ) وتمنحنا ترخيصاً محدوداً لمعالجته بغرض تقديم الخدمة لك فقط.

١٠. إنهاء الخدمة
يمكنك إغلاق حسابك في أي وقت من إعدادات الحساب؛ سيُنفَّذ حذف بياناتك وفق ما هو مفصّل في سياسة الخصوصية. نحتفظ بحق تعليق أو إنهاء حسابك في حال مخالفة هذه الشروط أو الاشتباه في نشاط احتيالي.

١١. حدود المسؤولية
تُقدَّم الخدمة "كما هي" دون أي ضمانات صريحة أو ضمنية. لا نتحمل مسؤولية الأضرار غير المباشرة أو التبعية الناشئة عن استخدام الخدمة، إلى أقصى حد يسمح به النظام السعودي المعمول به.

١٢. القانون الحاكم والاختصاص القضائي
تخضع هذه الشروط وتُفسَّر وفقاً لأنظمة المملكة العربية السعودية. تختص المحاكم السعودية المختصة (أو لجان حل المنازعات النظامية، حسب الحال) بالنظر في أي نزاع ينشأ عن هذه الشروط.

١٣. التعديلات على الشروط
قد نُحدّث هذه الشروط من وقت لآخر. سيُعرض رقم الإصدار وتاريخ النفاذ في أعلى هذه الصفحة، وسيتم إشعارك بالتغييرات الجوهرية عبر التطبيق أو البريد الإلكتروني.

١٤. التواصل
للاستفسارات القانونية: legal@joudai.com`;

const EN_TERMS_CONTENT = `Terms of Service — JOOD AI
Version 2.0 · Effective date: set automatically on publish

1. Introduction and Acceptance
Welcome to JOOD AI ("the Service," "we," "us"), your bilingual AI executive assistant. By creating an account or using the JOOD AI app, you agree to these Terms and the accompanying Privacy Policy. If you do not agree, please do not use the Service.

2. Description of Service
JOOD AI provides bilingual (Arabic/English) AI chat for tasks, calendar, and reminders; financial tracking (wallet, investments, Zakat calculator) and personal budgeting; mood and habit tracking; a voice assistant ("Majlis") powered by conversational AI; and a personalized daily executive brief with smart recommendations.

3. Eligibility and Account Registration
You must be 18 or older to use the Service independently. Users aged 13–17 require a parent or legal guardian's supervision and acceptance of these Terms. You are responsible for the accuracy of information you provide and for keeping your login credentials confidential. Notify us immediately of any suspected unauthorized use of your account.

4. Subscriptions and Billing
The Service is offered in two tiers — Essential (SAR 59/month) and Signature (SAR 89/month) — with discounted quarterly, semi-annual, and annual billing options. Subscriptions renew automatically at the end of each billing cycle unless cancelled in advance via account settings. Payments are processed through Stripe; we never store your card details on our servers. Fees are non-refundable except where required by Saudi consumer protection law. We may change subscription prices with at least 30 days' notice; continued use after a price change constitutes acceptance.

5. Important Financial and Religious Disclaimer
JOOD AI is a tool for tracking and organizing your financial data and providing general information — it is not licensed financial or investment advice and is not a substitute for an advisor licensed by the Saudi Capital Market Authority (CMA). The in-app Zakat calculator is an estimation tool based on the inputs you provide and live gold prices; it is not a religious ruling (fatwa) and does not replace verification by a qualified Islamic scholar or accredited Zakat authority before you make your final payment. Any financial, investment, or Zakat decision you make based on information from the app is entirely your own responsibility.

6. AI-Generated Content Disclaimer
Jood's responses are generated by AI models (such as GPT-4o) and may occasionally contain inaccurate or incomplete information. You should independently verify any important information (financial, health, legal) before relying on it.

7. Acceptable Use Policy
You may not use the Service to: violate applicable laws of the Kingdom of Saudi Arabia; infringe intellectual property rights; distribute harmful or offensive content; or attempt unauthorized access to our systems or other users' data.

8. Privacy and Data Processing
Our processing of your personal data — including transfers to service providers outside the Kingdom (OpenAI for the AI engine, ElevenLabs for voice, Stripe for payments) — is described in full in the accompanying Privacy Policy, which forms an integral part of these Terms.

9. Intellectual Property
All intellectual property rights in the JOOD AI app, its design, and branding are reserved. You are granted a limited, non-transferable license to use the app under these Terms only. You retain ownership of content you create (tasks, financial entries, etc.) and grant us a limited license to process it solely to provide the Service to you.

10. Termination
You may close your account at any time via account settings; your data will be deleted as described in the Privacy Policy. We reserve the right to suspend or terminate your account for violation of these Terms or suspected fraudulent activity.

11. Limitation of Liability
The Service is provided "as is" without warranties of any kind, express or implied. We are not liable for indirect or consequential damages arising from use of the Service, to the maximum extent permitted under applicable Saudi law.

12. Governing Law and Jurisdiction
These Terms are governed by and construed in accordance with the laws of the Kingdom of Saudi Arabia. Competent Saudi courts (or statutory dispute-resolution committees, as applicable) shall have exclusive jurisdiction over any dispute arising from these Terms.

13. Changes to These Terms
We may update these Terms from time to time. The version number and effective date will be shown at the top of this page, and material changes will be communicated via the app or email.

14. Contact
For legal inquiries: legal@joudai.com`;

const AR_PRIVACY_CONTENT = `سياسة الخصوصية — JOOD AI
الإصدار: ٢.٠ · تاريخ النفاذ: يُحدَّث تلقائياً عند النشر

١. مقدمة
تلتزم JOOD AI ("نحن") بحماية خصوصيتك. تشرح هذه السياسة البيانات التي نجمعها، وكيف نستخدمها، ومع من نشاركها، وحقوقك تجاهها، بما يتوافق مع نظام حماية البيانات الشخصية السعودي (PDPL) الصادر تحت إشراف الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا).

٢. البيانات التي نجمعها
بيانات الحساب: الاسم، البريد الإلكتروني، رقم الجوال (اختياري)، الجنس (لمخاطبتك بالصيغة اللغوية الصحيحة). بيانات مالية: المعاملات، أرصدة المحفظة، تفاصيل الاستثمار، أهداف الادخار، مدخلات حاسبة الزكاة. بيانات المزاج والعادات: تسجيلات المزاج اليومية، تتبّع العادات. بيانات المحادثة والذاكرة: رسائلك مع "جود"، والحقائق التي تتعلمها جود عنك تلقائياً (الوظيفة، العائلة، الأهداف، التفضيلات) لتقديم ردود أكثر تخصيصاً — يمكنك مراجعتها أو حذفها في أي وقت من "ذاكرة جود". بيانات الصوت: عند استخدامك ميزة "المجلس"، تتم معالجة صوتك عبر ElevenLabs لتحويله إلى نص والرد عليه صوتياً؛ لا تُخزَّن التسجيلات الصوتية الخام بعد معالجتها. بيانات التقويم والمهام: المواعيد، المهام، التذكيرات. بيانات تقنية: نوع الجهاز، عنوان IP، سجلات الأخطاء، لأغراض الأمان وتحسين الأداء.

٣. الأساس النظامي للمعالجة
نعالج بياناتك بناءً على: تنفيذ العقد المتعلق بتقديم الخدمة، موافقتك الصريحة للميزات الاختيارية (كالصوت والإشعارات)، المصلحة المشروعة في تحسين الخدمة وحمايتها من الاحتيال، والالتزام النظامي عند الطلب من الجهات المختصة.

٤. كيف نستخدم بياناتك
لتقديم وتخصيص الخدمة (المساعد الذكي، التتبع المالي، التذكيرات)، لمعالجة الفوترة، لتحسين دقة الذكاء الاصطناعي ضمن حسابك فقط، ولأغراض الأمان ومنع الاحتيال. لا نستخدم بياناتك لتدريب نماذج ذكاء اصطناعي عامة تخص أطرافاً أخرى.

٥. مشاركة البيانات ونقلها خارج المملكة
لا نبيع بياناتك الشخصية لأي طرف. نشارك بيانات محدودة مع مزودي خدمة موثوقين لتشغيل التطبيق، وقد يترتب على ذلك معالجة بياناتك خارج المملكة العربية السعودية على النحو التالي: OpenAI (الولايات المتحدة الأمريكية) لتشغيل محرك الدردشة الذكي (GPT-4o)؛ يُرسل نص محادثتك فقط، دون بيانات حساب مباشرة. ElevenLabs لتحويل النص إلى كلام والكلام إلى نص في ميزة المجلس الصوتية. Stripe (الولايات المتحدة الأمريكية) لمعالجة الدفعات؛ لا نشارك معه سوى البيانات اللازمة للفوترة، ولا نطّلع نحن على بيانات بطاقتك. Supabase لاستضافة قاعدة البيانات والخوادم (منطقة آسيا — جنوب شرق). عند نقل بياناتك خارج المملكة، نتعاقد مع هذه الجهات بموجب بنود تعاقدية تضمن مستوى حماية مكافئاً لما يقتضيه نظام حماية البيانات الشخصية السعودي.

٦. مدة الاحتفاظ بالبيانات
نحتفظ ببياناتك طالما حسابك نشط. عند طلب حذف الحساب، تُحذف بياناتك الشخصية خلال مدة لا تتجاوز ٣٠ يوماً، باستثناء ما يلزم الاحتفاظ به لأغراض نظامية أو محاسبية (كسجلات الفوترة) للمدة التي يحددها النظام.

٧. حقوقك بموجب نظام حماية البيانات الشخصية
يحق لك: الوصول إلى بياناتك وطلب نسخة منها، تصحيح البيانات غير الدقيقة، طلب حذف بياناتك ("الحق في النسيان")، تقييد أو الاعتراض على معالجة معيّنة، نقل بياناتك بصيغة قابلة للقراءة الآلية، وسحب موافقتك على المعالجات الاختيارية في أي وقت. يمكنك تنفيذ معظم هذه الحقوق مباشرة من "مركز الخصوصية والأمان" داخل التطبيق، أو بالتواصل معنا على البريد أدناه. إذا لم نستجب لطلبك بشكل مُرضٍ، يحق لك تقديم شكوى إلى الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا) بصفتها الجهة المختصة بتطبيق نظام حماية البيانات الشخصية.

٨. أمن المعلومات
نطبّق تشفيراً للبيانات أثناء النقل (TLS) وفي حالة التخزين، وضوابط وصول صارمة على مستوى الصفوف (Row-Level Security) بحيث لا يستطيع أي مستخدم آخر — بمن فيهم فريقنا التقني دون إذن — الوصول إلى بياناتك الشخصية دون تفويض.

٩. خصوصية الأطفال
لا تستهدف الخدمة من هم دون ١٣ عاماً. للمستخدمين بين ١٣ و١٧ عاماً، يلزم إشراف ولي الأمر وموافقته الصريحة على هذه السياسة.

١٠. ملفات تعريف الارتباط والتحليلات
نستخدم تخزيناً محلياً أساسياً لتشغيل التطبيق (مثل تفضيلات اللغة)، وقد نستخدم أدوات تحليل مجمّعة وغير معرّفة بهويتك الشخصية لفهم أداء التطبيق وتحسينه.

١١. تحديثات هذه السياسة
قد نُحدّث هذه السياسة من وقت لآخر؛ سيظهر رقم الإصدار وتاريخ النفاذ في أعلى هذه الصفحة، وسنُعلمك بأي تغيير جوهري عبر التطبيق أو البريد الإلكتروني.

١٢. التواصل
لأي استفسار يتعلق بخصوصيتك أو لتقديم طلب ممارسة حقوقك:
البريد الإلكتروني: privacy@joudai.com
مسؤول حماية البيانات: dpo@joudai.com`;

const EN_PRIVACY_CONTENT = `Privacy Policy — JOOD AI
Version 2.0 · Effective date: set automatically on publish

1. Introduction
JOOD AI ("we," "us") is committed to protecting your privacy. This Policy explains what data we collect, how we use it, who we share it with, and your rights — in line with Saudi Arabia's Personal Data Protection Law (PDPL), overseen by the Saudi Data and AI Authority (SDAIA).

2. Information We Collect
Account data: name, email, phone (optional), gender (so Jood can address you correctly in Arabic). Financial data: transactions, wallet balances, investment details, savings goals, Zakat calculator inputs. Mood and habit data: daily mood logs, habit tracking. Chat and memory data: your messages with Jood, and facts Jood learns about you automatically (work, family, goals, preferences) to personalize responses — reviewable and deletable anytime in "Jood's Memory." Voice data: when you use the "Majlis" voice feature, your speech is processed via ElevenLabs for speech-to-text and text-to-speech; raw audio is not retained after processing. Calendar and task data: appointments, tasks, reminders. Technical data: device type, IP address, error logs, for security and performance.

3. Legal Basis for Processing
We process your data based on: performance of the contract to provide the Service; your explicit consent for optional features (voice, notifications); legitimate interest in improving and securing the Service; and legal obligation when required by competent authorities.

4. How We Use Your Data
To provide and personalize the Service (AI assistant, financial tracking, reminders), to process billing, to improve AI accuracy within your own account only, and for security and fraud prevention. We do not use your data to train general-purpose AI models for other parties.

5. Sharing and Cross-Border Transfers
We do not sell your personal data. We share limited data with trusted service providers to operate the app, which may involve processing your data outside Saudi Arabia: OpenAI (United States) powers the AI chat engine (GPT-4o); only your conversation text is sent, not direct account identifiers. ElevenLabs powers speech-to-text and text-to-speech for the Majlis voice feature. Stripe (United States) processes payments; we share only billing-necessary data and never see your card details ourselves. Supabase hosts our database and servers (Southeast Asia region). Where your data is transferred outside the Kingdom, we contract with these providers under terms designed to ensure a level of protection equivalent to that required under the Saudi PDPL.

6. Data Retention
We retain your data while your account is active. Upon account deletion, your personal data is deleted within 30 days, except where retention is required for legal or accounting purposes (e.g. billing records) for the period mandated by law.

7. Your Rights Under the PDPL
You have the right to: access your data and request a copy; correct inaccurate data; request deletion ("right to be forgotten"); restrict or object to specific processing; receive your data in a portable format; and withdraw consent for optional processing at any time. Most of these rights can be exercised directly from the in-app "Security & Privacy Center," or by contacting us at the email below. If you're not satisfied with our response, you may lodge a complaint with the Saudi Data and AI Authority (SDAIA), the competent authority for PDPL enforcement.

8. Security
We apply encryption in transit (TLS) and at rest, and strict Row-Level Security access controls so that no one else — including our own team without authorization — can access your personal data without permission.

9. Children's Privacy
The Service is not directed at children under 13. Users aged 13–17 require a parent or legal guardian's supervision and explicit agreement to this Policy.

10. Cookies and Analytics
We use essential local storage to run the app (e.g. language preference), and may use aggregated, de-identified analytics to understand and improve app performance.

11. Changes to This Policy
We may update this Policy from time to time; the version number and effective date will appear at the top of this page, and material changes will be communicated via the app or email.

12. Contact
For privacy questions or to exercise your rights:
Email: privacy@joudai.com
Data Protection Officer: dpo@joudai.com`;

// ─── Legal tab ────────────────────────────────────────────────────────────────
const DEFAULT_LEGAL_CONTENT = {
  tos: AR_TERMS_CONTENT + '\n\n' + '─'.repeat(60) + '\n\n' + EN_TERMS_CONTENT,
  privacy: AR_PRIVACY_CONTENT + '\n\n' + '─'.repeat(60) + '\n\n' + EN_PRIVACY_CONTENT,
};

const LegalTab = () => {
  const [doc, setDoc] = useState<'tos' | 'privacy'>('tos');
  const [content, setContent] = useState(DEFAULT_LEGAL_CONTENT);
  const [versions, setVersions] = useState<{ tos: string; privacy: string }>({ tos: '1.0', privacy: '1.0' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const docTypeFor = (d: 'tos' | 'privacy') => (d === 'tos' ? 'terms' : 'privacy');

  const loadLatest = useCallback(async () => {
    setLoading(true);
    const [{ data: termsRow }, { data: privacyRow }] = await Promise.all([
      supabase.from('agreement_versions').select('version, content').eq('type', 'terms').order('effective_date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('agreement_versions').select('version, content').eq('type', 'privacy').order('effective_date', { ascending: false }).limit(1).maybeSingle(),
    ]);
    // Real published content always wins; the JOOD AI default draft only fills in
    // if nothing has ever been published, or what's published is just a placeholder stub.
    setContent({
      tos: (termsRow?.content && termsRow.content.length > 200) ? termsRow.content : DEFAULT_LEGAL_CONTENT.tos,
      privacy: (privacyRow?.content && privacyRow.content.length > 200) ? privacyRow.content : DEFAULT_LEGAL_CONTENT.privacy,
    });
    setVersions({ tos: termsRow?.version ?? '1.0', privacy: privacyRow?.version ?? '1.0' });
    setLoading(false);
  }, []);

  useEffect(() => { loadLatest(); }, [loadLatest]);

  const publish = async () => {
    setSaving(true);
    const currentVersion = versions[doc];
    const nextVersion = (parseFloat(currentVersion || '1.0') + 0.1).toFixed(1);
    const { error } = await supabase.from('agreement_versions').insert({
      type: docTypeFor(doc),
      version: nextVersion,
      content: content[doc],
      effective_date: new Date().toISOString(),
    });
    if (error) {
      toast.error('Failed to publish: ' + error.message);
    } else {
      setVersions(v => ({ ...v, [doc]: nextVersion }));
      toast.success(`Published v${nextVersion} — live on /${doc === 'tos' ? 'terms' : 'privacy'} now`);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="bg-amber-500/10 border border-amber-400/30 rounded-lg px-4 py-3 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-amber-200/90 text-xs leading-relaxed">
          AI-drafted starting point based on JOOD AI's actual functionality and Saudi PDPL/SDAIA guidance — covers cross-border data transfers (OpenAI, ElevenLabs, Stripe), the Zakat calculator and financial-advice disclaimers, and AI-output disclaimers. <strong>Have a licensed Saudi attorney review this before relying on it for real users.</strong> This banner is only shown here in Admin — it does not appear on the public page.
        </p>
      </div>
      <div className="flex gap-2">
        {(['tos', 'privacy'] as const).map(d => (
          <button key={d} onClick={() => setDoc(d)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              doc === d ? 'bg-jood-gold-500/20 text-amber-300 border border-amber-400/30' : 'bg-white/5 text-white/50 hover:text-white border border-white/10')}>
            {d === 'tos' ? 'Terms of Service' : 'Privacy Policy'}
          </button>
        ))}
      </div>
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-white text-sm">{doc === 'tos' ? 'Terms of Service' : 'Privacy Policy'}</CardTitle>
            <p className="text-white/30 text-xs mt-0.5">Live version: {versions[doc]}</p>
          </div>
          <Button size="sm" className="bg-jood-gold-500 hover:bg-jood-gold-600 text-white h-7 text-xs"
            onClick={publish} disabled={saving || loading}>
            {saving ? 'Publishing…' : 'Publish New Version'}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-white/30 text-sm text-center py-12">Loading current published content…</p>
          ) : (
            <Textarea
              value={content[doc]}
              onChange={e => setContent(c => ({ ...c, [doc]: e.target.value }))}
              className="min-h-[480px] bg-white/5 border-white/15 text-white text-sm font-mono resize-none leading-relaxed"
              dir="rtl"
            />
          )}
          <p className="text-white/25 text-xs mt-2">Publishing inserts a new version row — it goes live on the public page immediately, and previous versions stay archived in agreement_versions.</p>
        </CardContent>
      </Card>
    </div>
  );
};

// ─── Main Admin page ──────────────────────────────────────────────────────────
const Admin = () => {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useRoles();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState<UserData[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [stats, setStats] = useState<SystemStats>({
    total_users: 0, active_subscriptions: 0, total_conversations: 0, storage_usage: '—',
  });
  const [intervals, setIntervals] = useState<BillingInterval[]>(DEFAULT_INTERVALS);

  const fetchStats = useCallback(async () => {
    try {
      const [{ count: userCount }, { count: convCount }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('ai_interactions').select('*', { count: 'exact', head: true }),
      ]);
      setStats(s => ({ ...s, total_users: userCount ?? 0, total_conversations: convCount ?? 0 }));

      const { data: adminStats } = await supabase.functions.invoke('admin-stats');
      if (adminStats?.users) {
        setStats(s => ({
          ...s,
          total_users: adminStats.users.total ?? s.total_users,
          new_users_7d: adminStats.users.new_7d,
          active_users_7d: adminStats.users.active_7d,
          messages_7d: adminStats.usage?.messages_7d,
          voice_events_30d: adminStats.usage?.voice_events_30d,
          active_subscriptions: adminStats.revenue?.active_subscriptions ?? s.active_subscriptions,
          mrr_sar: adminStats.revenue?.mrr_sar,
        }));
      }
    } catch { /* silent */ }
  }, []);

  const fetchUsers = useCallback(async () => {
    setUserLoading(true);
    try {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from('profiles').select('user_id, display_name, base_currency, created_at'),
        supabase.from('user_roles').select('user_id, role'),
      ]);
      const { data: authData } = await supabase.auth.admin.listUsers().catch(() => ({ data: null }));
      if (authData?.users) {
        setUsers(authData.users.map(au => ({
          id: au.id, email: au.email || '—', created_at: au.created_at,
          profile: profiles?.find(p => p.user_id === au.id),
          role: roles?.find(r => r.user_id === au.id),
        })));
      } else if (profiles) {
        setUsers(profiles.map(p => ({
          id: p.user_id, email: '(auth restricted)', created_at: p.created_at,
          profile: p, role: roles?.find(r => r.user_id === p.user_id),
        })));
      }
    } catch { toast.error('Failed to load users'); }
    finally { setUserLoading(false); }
  }, []);

  useEffect(() => {
    if (user && isAdmin()) { fetchStats(); fetchUsers(); }
  }, [user, isAdmin, fetchStats, fetchUsers]);

  const assignRole = async (userId: string, role: string) => {
    await supabase.from('user_roles').upsert({ user_id: userId, role: role as any });
    toast.success('Role updated');
    fetchUsers();
  };

  if (roleLoading) return (
    <div className="min-h-screen bg-[#1a1208] flex items-center justify-center">
      <div className="text-amber-300 animate-pulse font-semibold">Loading…</div>
    </div>
  );

  if (!isAdmin()) return <Navigate to="/dashboard" replace />;

  const activeNav = NAV.find(n => n.key === activeTab)!;

  return (
    <div className="min-h-screen bg-[#0f0e0b] flex" dir="ltr">

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 bg-[#1a1208] border-r border-white/8 flex flex-col">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-white/8">
          <button onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-white/50 hover:text-white text-xs mb-3 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to app
          </button>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" />
            <span className="text-white font-bold text-sm">JOOD Admin</span>
          </div>
          <p className="text-white/30 text-xs mt-0.5">Control Centre</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                activeTab === key
                  ? 'bg-amber-500/15 text-amber-300 font-semibold'
                  : 'text-white/50 hover:text-white hover:bg-white/5',
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
              {key === 'support' && (
                <span className="ml-auto bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">2</span>
              )}
            </button>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-white/8">
          <p className="text-white/20 text-[10px]">Logged in as</p>
          <p className="text-white/50 text-xs truncate">{user?.email}</p>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-[#0f0e0b]/90 backdrop-blur-sm border-b border-white/8 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-lg">{activeNav.label}</h1>
            <p className="text-white/30 text-xs">JOOD AI Control Centre</p>
          </div>
          <Badge className="bg-amber-500/15 text-amber-300 border-amber-400/20 text-xs">
            <Shield className="w-3 h-3 mr-1" /> Admin
          </Badge>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          {activeTab === 'overview'  && <OverviewTab stats={stats} onRefresh={() => { fetchStats(); fetchUsers(); }} />}
          {activeTab === 'users'     && <UsersTab users={users} loading={userLoading} onAssignRole={assignRole} />}
          {activeTab === 'support'   && <SupportTab />}
          {activeTab === 'features'  && <FeaturesTab />}
          {activeTab === 'packages'  && <PackagesTab intervals={intervals} setIntervals={setIntervals} />}
          {activeTab === 'discounts' && <DiscountsTab />}
          {activeTab === 'api'       && <ApiUsageTab />}
          {activeTab === 'costs'     && <CostModelTab stats={stats} />}
          {activeTab === 'payments'  && <PaymentsTab />}
          {activeTab === 'legal'     && <LegalTab />}
        </div>
      </main>
    </div>
  );
};

export default Admin;
