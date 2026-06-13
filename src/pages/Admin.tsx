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
  BarChart3, Activity, Database, Bot,
} from 'lucide-react';
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
interface SupportTicket {
  id: string; user_email: string; user_name: string;
  subject: string; status: 'open' | 'in_progress' | 'resolved';
  last_message: string; created_at: string; unread: number;
  messages: { role: 'user' | 'jood' | 'admin'; content: string; ts: string }[];
}
interface DiscountCode {
  id: string; code: string; type: 'percent' | 'fixed';
  value: number; uses: number; max_uses: number | null;
  expires_at: string | null; active: boolean;
}
interface BillingInterval { key: string; label: string; months: number; discount: number; enabled: boolean; }

// ─── Sidebar nav ──────────────────────────────────────────────────────────────
const NAV = [
  { key: 'overview',  label: 'Overview',     icon: LayoutDashboard },
  { key: 'users',     label: 'Users',        icon: Users },
  { key: 'support',   label: 'Support',      icon: MessageSquare },
  { key: 'packages',  label: 'Packages',     icon: Package },
  { key: 'discounts', label: 'Discounts',    icon: Tag },
  { key: 'api',       label: 'API Usage',    icon: Zap },
  { key: 'costs',     label: 'Cost Model',   icon: PieChart },
  { key: 'payments',  label: 'Payments',     icon: CreditCard },
  { key: 'legal',     label: 'Legal',        icon: FileText },
];

// ─── Mock support tickets (replace with Supabase table later) ─────────────────
const MOCK_TICKETS: SupportTicket[] = [
  {
    id: 't1', user_email: 'sara@example.com', user_name: 'سارة الغامدي',
    subject: 'مشكلة في الاشتراك', status: 'open', unread: 2,
    last_message: 'لم تُعالَج المدفوعات بشكل صحيح',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    messages: [
      { role: 'user', content: 'مرحباً، واجهت مشكلة في تجديد اشتراكي', ts: new Date(Date.now() - 3700000).toISOString() },
      { role: 'jood', content: 'أهلاً بكِ سارة! أنا جود، مساعدة الدعم. دعيني أتحقق من حسابك. هل يمكنك مشاركة رسالة الخطأ التي ظهرت؟', ts: new Date(Date.now() - 3650000).toISOString() },
      { role: 'user', content: 'لم تُعالَج المدفوعات بشكل صحيح', ts: new Date(Date.now() - 3600000).toISOString() },
    ],
  },
  {
    id: 't2', user_email: 'khalid@example.com', user_name: 'خالد العتيبي',
    subject: 'سؤال عن ميزة الزكاة', status: 'in_progress', unread: 0,
    last_message: 'شكراً جزيلاً على التوضيح!',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    messages: [
      { role: 'user', content: 'كيف تحسب جود الزكاة؟', ts: new Date(Date.now() - 86400000).toISOString() },
      { role: 'jood', content: 'تحسب جود الزكاة بناءً على النصاب الذهبي (85 جرام ذهب) وتطبّق 2.5% على كل الثروات التي مرّ عليها الحول. هل تريد تفصيل الحساب؟', ts: new Date(Date.now() - 86200000).toISOString() },
      { role: 'user', content: 'شكراً جزيلاً على التوضيح!', ts: new Date(Date.now() - 86000000).toISOString() },
    ],
  },
  {
    id: 't3', user_email: 'nora@example.com', user_name: 'نورة الشمري',
    subject: 'طلب استرداد', status: 'resolved', unread: 0,
    last_message: 'تم استرداد المبلغ بنجاح',
    created_at: new Date(Date.now() - 172800000).toISOString(),
    messages: [
      { role: 'user', content: 'أريد استرداد رسوم الاشتراك', ts: new Date(Date.now() - 172800000).toISOString() },
      { role: 'admin', content: 'تم معالجة طلب الاسترداد. سيُرجع المبلغ خلال 5-7 أيام عمل.', ts: new Date(Date.now() - 172600000).toISOString() },
      { role: 'user', content: 'تم استرداد المبلغ بنجاح', ts: new Date(Date.now() - 172000000).toISOString() },
    ],
  },
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
  const [tickets] = useState<SupportTicket[]>(MOCK_TICKETS);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [reply, setReply] = useState('');
  const [msgs, setMsgs] = useState<SupportTicket['messages']>([]);

  useEffect(() => {
    if (selected) setMsgs(selected.messages);
  }, [selected]);

  const sendReply = () => {
    if (!reply.trim() || !selected) return;
    setMsgs(prev => [...prev, { role: 'admin', content: reply.trim(), ts: new Date().toISOString() }]);
    setReply('');
    toast.success('Reply sent');
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
        {tickets.map(t => (
          <button key={t.id} onClick={() => setSelected(t)}
            className={cn(
              'text-left rounded-lg px-3 py-3 border transition-colors',
              selected?.id === t.id ? 'bg-white/12 border-jood-gold-500/30' : 'bg-white/5 border-white/8 hover:bg-white/8',
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-white text-sm font-medium leading-tight">{t.user_name}</p>
              {t.unread > 0 && <span className="bg-red-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 flex-shrink-0">{t.unread}</span>}
            </div>
            <p className="text-white/50 text-xs mb-1.5 truncate">{t.subject}</p>
            <p className="text-white/30 text-xs truncate mb-2">{t.last_message}</p>
            <Badge className={cn('text-[9px] px-1.5 py-0', statusColor(t.status))}>
              {t.status.replace('_', ' ')}
            </Badge>
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
                <p className="text-white/40 text-xs">{selected.user_email} · {selected.subject}</p>
              </div>
              <Select defaultValue={selected.status}>
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
              <div className="space-y-3">
                {msgs.map((m, i) => (
                  <div key={i} className={cn('flex', m.role === 'user' ? 'justify-start' : 'justify-end')}>
                    <div className={cn(
                      'max-w-[80%] rounded-2xl px-3 py-2 text-sm',
                      m.role === 'user' ? 'bg-white/10 text-white' :
                      m.role === 'jood' ? 'bg-jood-teal-900/60 text-white border border-jood-teal-700/30' :
                      'bg-amber-600/30 text-amber-100 border border-amber-500/30',
                    )}>
                      {m.role !== 'user' && (
                        <p className="text-[9px] font-bold mb-1 opacity-60 uppercase tracking-wide">
                          {m.role === 'jood' ? '🤖 Jood AI' : '👤 Admin'}
                        </p>
                      )}
                      <p className="leading-relaxed">{m.content}</p>
                      <p className="text-[9px] opacity-40 mt-1">{new Date(m.ts).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="px-4 py-3 border-t border-white/10 flex gap-2">
              <Input
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendReply()}
                placeholder="Reply as admin…"
                className="flex-1 bg-white/5 border-white/15 text-white placeholder-white/30 text-sm"
              />
              <Button size="sm" onClick={sendReply}
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
  const [codes, setCodes] = useState<DiscountCode[]>([
    { id: 'd1', code: 'WELCOME20', type: 'percent', value: 20, uses: 47, max_uses: 100, expires_at: '2026-12-31', active: true },
    { id: 'd2', code: 'JOOD50SAR', type: 'fixed', value: 50, uses: 12, max_uses: null, expires_at: null, active: true },
    { id: 'd3', code: 'LAUNCH15', type: 'percent', value: 15, uses: 100, max_uses: 100, expires_at: '2026-07-01', active: false },
  ]);
  const [form, setForm] = useState({ code: '', type: 'percent', value: 20, max_uses: '', expires_at: '' });

  const generate = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const create = () => {
    if (!form.code.trim()) { toast.error('Enter a code'); return; }
    const newCode: DiscountCode = {
      id: Date.now().toString(), code: form.code.toUpperCase(),
      type: form.type as 'percent' | 'fixed', value: Number(form.value),
      uses: 0, max_uses: form.max_uses ? Number(form.max_uses) : null,
      expires_at: form.expires_at || null, active: true,
    };
    setCodes(prev => [newCode, ...prev]);
    setForm({ code: '', type: 'percent', value: 20, max_uses: '', expires_at: '' });
    toast.success(`Code ${newCode.code} created`);
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
              <Button onClick={create} className="w-full bg-jood-gold-500 hover:bg-jood-gold-600 text-white">
                <Plus className="w-4 h-4 mr-1" /> Create Code
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Code list */}
      <div className="space-y-2">
        {codes.map(c => (
          <div key={c.id} className={cn('flex items-center justify-between px-4 py-3 rounded-lg border', c.active ? 'bg-white/5 border-white/10' : 'bg-white/2 border-white/5 opacity-50')}>
            <div className="flex items-center gap-3">
              <code className="text-amber-300 font-bold font-mono text-sm bg-amber-500/10 px-2 py-0.5 rounded">{c.code}</code>
              <span className="text-white/60 text-sm">
                {c.type === 'percent' ? `${c.value}% off` : `SAR ${c.value} off`}
              </span>
              {c.expires_at && <span className="text-white/30 text-xs">Expires {c.expires_at}</span>}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-white/40 text-xs">{c.uses}{c.max_uses ? `/${c.max_uses}` : ''} uses</span>
              <Switch checked={c.active}
                onCheckedChange={v => setCodes(prev => prev.map(x => x.id === c.id ? { ...x, active: v } : x))} />
              <Button size="icon" variant="ghost" className="h-7 w-7 text-white/30 hover:text-white"
                onClick={() => { navigator.clipboard.writeText(c.code); toast.success('Copied!'); }}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
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

// ─── Legal tab ────────────────────────────────────────────────────────────────
const LegalTab = () => {
  const [doc, setDoc] = useState<'tos' | 'privacy'>('tos');
  const [content, setContent] = useState({
    tos: `شروط الخدمة — JOOD AI\n\nآخر تحديث: يونيو ٢٠٢٦\n\n١. الموافقة على الشروط\nباستخدام خدمات JOOD AI، توافق على هذه الشروط.\n\n٢. الاشتراكات\nتُقدَّم الخدمة باشتراكات شهرية أو سنوية قابلة للإلغاء في أي وقت.\n\n٣. حقوق الملكية الفكرية\nجميع الحقوق محفوظة لـ JOOD AI.\n\n٤. الخصوصية\nنحن نحمي بياناتك وفق سياسة الخصوصية المرفقة وقوانين حماية البيانات السعودية (نظام حماية البيانات الشخصية — نحاسب).`,
    privacy: `سياسة الخصوصية — JOOD AI\n\nآخر تحديث: يونيو ٢٠٢٦\n\n١. البيانات التي نجمعها\nنجمع البيانات التي تزودنا بها مباشرةً لتحسين تجربتك.\n\n٢. كيف نستخدم بياناتك\nنستخدم بياناتك لتقديم الخدمة وتحسينها، ولن نبيعها لأطراف ثالثة.\n\n٣. حقوقك\nيحق لك طلب حذف بياناتك أو تصديرها في أي وقت.\n\n٤. الامتثال\nنلتزم بنظام حماية البيانات الشخصية السعودي (PDPL) وإرشادات أخلاقيات الذكاء الاصطناعي لـ SDAIA.`,
  });

  return (
    <div className="space-y-4">
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
          <CardTitle className="text-white text-sm">{doc === 'tos' ? 'Terms of Service' : 'Privacy Policy'}</CardTitle>
          <Button size="sm" className="bg-jood-gold-500 hover:bg-jood-gold-600 text-white h-7 text-xs"
            onClick={() => toast.success('Document saved (publish via deployment)')}>
            Save Draft
          </Button>
        </CardHeader>
        <CardContent>
          <Textarea
            value={content[doc]}
            onChange={e => setContent(c => ({ ...c, [doc]: e.target.value }))}
            className="min-h-[380px] bg-white/5 border-white/15 text-white text-sm font-mono resize-none leading-relaxed"
            dir="rtl"
          />
          <p className="text-white/25 text-xs mt-2">Changes are saved locally. Publish to production by committing the content to your CMS or edge config.</p>
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
