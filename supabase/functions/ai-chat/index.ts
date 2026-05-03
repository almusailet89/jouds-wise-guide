import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DIRECT_EXECUTE = new Set([
  'add_task', 'add_habit', 'log_mood', 'remember_about_user',
  'update_task', 'update_event', 'update_habit',
  'delete_task', 'delete_event', 'delete_habit',
  // financial
  'update_financial_entry', 'delete_financial_entry',
  'add_goal', 'update_goal', 'delete_goal',
  'update_portfolio_holding', 'delete_portfolio_holding',
]);

const MEMORY_CATEGORIES = [
  'identity','work','family','financial','health','religion',
  'routine','goals','interests','relationships','preferences','pain_points',
];

// ─── Function tool definitions ────────────────────────────────────────────────
const functionTools = [
  { type: "function", function: { name: "add_task", description: "Add a task/reminder. Trigger: 'أضيفي مهمة', 'ذكّريني', 'remind me to', 'add to my list'.", parameters: { type: "object", properties: { title: { type: "string" }, due_date: { type: "string", description: "ISO date YYYY-MM-DD. ALWAYS set this — default to TODAY_ISO if no date mentioned. Use TODAY_ISO from system context as base; year is ALWAYS TODAY_ISO's year unless user explicitly says otherwise. 'بكرة/tomorrow' = TODAY+1, 'نهاية الأسبوع' = next Fri/Sat, 'الأسبوع الجاي' = same weekday next week. Never schedule more than 3 months ahead unless user specifically requests it." }, priority: { type: "string", enum: ["low","medium","high"] }, notes: { type: "string" } }, required: ["title", "due_date"] } } },
  { type: "function", function: { name: "add_habit", description: "Add a recurring habit. Trigger: 'عوّدني', 'أبي أتعود', 'حطّي عادة', 'track my habit'. For specific weekdays (e.g. 'من الأحد إلى الأربعاء' = Sun-Wed), set frequency='weekly' and provide target_days array (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat).", parameters: { type: "object", properties: { name: { type: "string" }, frequency: { type: "string", enum: ["daily","weekly"] }, target_days: { type: "array", items: { type: "integer", minimum: 0, maximum: 6 }, description: "Weekday indices when frequency=weekly. 0=Sunday … 6=Saturday." }, time_of_day: { type: "string", description: "Optional time HH:MM (24h)" }, icon: { type: "string" } }, required: ["name"] } } },
  { type: "function", function: { name: "log_mood", description: "Log mood/energy. Trigger: 'أنا متعب', 'مزاجي ممتاز', 'feeling stressed/great', 'سجّلي مزاجي'.", parameters: { type: "object", properties: { score: { type: "number" }, label: { type: "string" }, note: { type: "string" } }, required: ["score","label"] } } },
  { type: "function", function: { name: "create_calendar_event", description: "Create calendar event/meeting. Trigger: 'احجزي', 'اجتماع', 'موعد', 'حطّي في التقويم', 'book'.", parameters: { type: "object", properties: { title: { type: "string" }, starts_at: { type: "string" }, ends_at: { type: "string" }, location: { type: "string" }, description: { type: "string" }, all_day: { type: "boolean" }, category: { type: "string" } }, required: ["title","starts_at"] } } },
  { type: "function", function: { name: "compose_email", description: "Draft email. Trigger: 'راسلي', 'أرسلي إيميل', 'draft email'.", parameters: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, required: ["to","subject","body"] } } },
  { type: "function", function: { name: "draft_whatsapp", description: "Draft WhatsApp. Trigger: 'واتساب', 'راسل فلان'.", parameters: { type: "object", properties: { recipient: { type: "string" }, message: { type: "string" } }, required: ["recipient","message"] } } },
  { type: "function", function: { name: "add_financial_entry", description: "Record financial transaction. Trigger: amount stated (صرفت، دخلي، X ريال).", parameters: { type: "object", properties: { type: { type: "string", enum: ["expense","income","savings","investment"] }, amount: { type: "number" }, currency: { type: "string" }, category: { type: "string" }, description: { type: "string" } }, required: ["type","amount","currency"] } } },
  // ── Financial edit/delete tools ─────────────────────────────────────────────
  { type: "function", function: { name: "update_financial_entry", description: "Edit an existing financial transaction — change amount, category, type, or description. Trigger: 'عدّلي مصروف', 'غيّري المبلغ', 'صحّحي الدخل', 'بدّلي الفئة', 'change expense', 'edit transaction'.", parameters: { type: "object", properties: { search_desc: { type: "string", description: "Key words from the description, note, category, or label to find it." }, new_amount: { type: "number", description: "New amount (omit if not changing)." }, new_type: { type: "string", enum: ["expense","income","savings","investment"], description: "Omit if not changing." }, new_category: { type: "string", description: "Omit if not changing." }, new_description: { type: "string", description: "Omit if not changing." } }, required: ["search_desc"] } } },

  { type: "function", function: { name: "delete_financial_entry", description: "Permanently delete a financial transaction. Trigger: 'احذفي المصروف', 'امسحي الدخل', 'delete transaction', 'remove expense'.", parameters: { type: "object", properties: { search_desc: { type: "string", description: "Key words from the description, note, category, or label to find it." } }, required: ["search_desc"] } } },

  { type: "function", function: { name: "add_goal", description: "Create a new savings goal. Trigger: 'أبي أدّخر', 'حطّي هدف توفير', 'أضيفي هدف مالي', 'add savings goal', 'new financial goal'.", parameters: { type: "object", properties: { title: { type: "string", description: "Goal name, e.g. سيارة, سفر, شقة." }, target_amount: { type: "number", description: "Target amount in SAR." }, target_date: { type: "string", description: "ISO date YYYY-MM-DD for target completion. Use TODAY_ISO year." }, saved_amount: { type: "number", description: "Amount already saved. Default 0." } }, required: ["title","target_amount"] } } },

  { type: "function", function: { name: "update_goal", description: "Edit an existing savings goal — rename, change target amount or date, mark complete. Trigger: 'عدّلي الهدف', 'غيّري المبلغ المستهدف', 'خلّص الهدف', 'update savings goal'.", parameters: { type: "object", properties: { search_title: { type: "string", description: "Key words from the goal title." }, new_title: { type: "string", description: "Omit if not changing." }, target_amount: { type: "number", description: "Omit if not changing." }, target_date: { type: "string", description: "New date YYYY-MM-DD (omit if not changing). Use TODAY_ISO year." }, saved_amount: { type: "number", description: "Update amount already saved (omit if not changing)." }, status: { type: "string", enum: ["open","completed","paused"], description: "Omit if not changing." } }, required: ["search_title"] } } },

  { type: "function", function: { name: "delete_goal", description: "Permanently delete a savings goal. Trigger: 'احذفي الهدف', 'ما أبي هدف', 'remove goal'.", parameters: { type: "object", properties: { search_title: { type: "string", description: "Key words from the goal title." } }, required: ["search_title"] } } },

  { type: "function", function: { name: "update_portfolio_holding", description: "Edit an investment holding — update quantity, average price, or current price. Trigger: 'عدّلي استثماري', 'غيّري الكمية', 'حدّثي سعر السهم', 'update holding', 'edit investment'.", parameters: { type: "object", properties: { search_symbol: { type: "string", description: "Symbol or partial name of the asset to find it, e.g. 'ARAMCO', '2222', 'BTC'." }, quantity: { type: "number", description: "New quantity (omit if not changing)." }, avg_price: { type: "number", description: "New average purchase price (omit if not changing)." }, current_price: { type: "number", description: "New current price (omit if not changing)." } }, required: ["search_symbol"] } } },

  { type: "function", function: { name: "delete_portfolio_holding", description: "Permanently remove an investment holding from portfolio. Trigger: 'احذفي استثماري', 'بعت', 'مو عندي', 'sold my', 'remove holding'.", parameters: { type: "object", properties: { search_symbol: { type: "string", description: "Symbol or partial name of the asset, e.g. 'ARAMCO', 'BTC'." } }, required: ["search_symbol"] } } },

  { type: "function", function: { name: "remember_about_user", description: "Save a durable fact about the user to long-term memory. Call this when the user reveals something stable about themselves (name, job, family, goals, preferences, health, religious practice, daily routine, etc.). DO NOT call for transient state like 'I'm tired today'. The fact should be third-person and concise.", parameters: { type: "object", properties: { category: { type: "string", enum: ["identity","work","family","financial","health","religion","routine","goals","interests","relationships","preferences","pain_points"], description: "Which life-area this fact belongs to." }, content: { type: "string", description: "Short third-person fact, e.g. 'يعمل مديراً تقنياً في أرامكو' or 'يصلي الفجر في المسجد كل يوم'." }, importance: { type: "number", minimum: 0, maximum: 1, description: "0.0–1.0; how foundational this is. Default 0.6." } }, required: ["category","content"] } } },

  // ── Edit & Delete tools ──────────────────────────────────────────────────────
  { type: "function", function: { name: "update_task", description: "Edit an existing task — reschedule, rename, change priority, or mark done. Trigger: 'غيّري مهمة', 'بدّلي تاريخ', 'عدّلي', 'خلّيها غداً', 'انتهيت من', 'reschedule', 'change task'.", parameters: { type: "object", properties: { search_title: { type: "string", description: "Key words from the task title to find it." }, new_title: { type: "string", description: "New title (omit if not changing)." }, due_date: { type: "string", description: "New due date YYYY-MM-DD (use TODAY_ISO year). Omit if not changing." }, priority: { type: "string", enum: ["low","medium","high"], description: "Omit if not changing." }, status: { type: "string", enum: ["pending","completed"], description: "Use 'completed' when user says they finished it." }, notes: { type: "string", description: "Omit if not changing." } }, required: ["search_title"] } } },

  { type: "function", function: { name: "delete_task", description: "Permanently delete a task. Trigger: 'احذفي مهمة', 'امسحي', 'مو محتاجها', 'cancel task', 'remove task'.", parameters: { type: "object", properties: { search_title: { type: "string", description: "Key words from the task title to find it." } }, required: ["search_title"] } } },

  { type: "function", function: { name: "update_event", description: "Edit an existing calendar event — reschedule, rename, change location. Trigger: 'غيّري الموعد', 'بدّلي وقت', 'عدّلي الاجتماع', 'reschedule meeting', 'change appointment'.", parameters: { type: "object", properties: { search_title: { type: "string", description: "Key words from the event title to find it." }, new_title: { type: "string", description: "New title (omit if not changing)." }, starts_at: { type: "string", description: "New start ISO datetime (omit if not changing). Use TODAY_ISO year." }, ends_at: { type: "string", description: "New end ISO datetime (omit if not changing)." }, location: { type: "string", description: "New location (omit if not changing)." } }, required: ["search_title"] } } },

  { type: "function", function: { name: "delete_event", description: "Permanently delete a calendar event. Trigger: 'احذفي الموعد', 'امسحي الاجتماع', 'cancel appointment', 'remove event', 'مو رايح', 'إلغاء الموعد'.", parameters: { type: "object", properties: { search_title: { type: "string", description: "Key words from the event title to find it." } }, required: ["search_title"] } } },

  { type: "function", function: { name: "update_habit", description: "Edit an existing habit — rename, change schedule, time, or pause/resume it. Trigger: 'غيّري العادة', 'بدّلي وقت العادة', 'أوقفي عادة', 'pause habit', 'change habit schedule'.", parameters: { type: "object", properties: { search_name: { type: "string", description: "Key words from the habit name to find it." }, new_name: { type: "string", description: "New name (omit if not changing)." }, frequency: { type: "string", enum: ["daily","weekly"], description: "Omit if not changing." }, target_days: { type: "array", items: { type: "integer", minimum: 0, maximum: 6 }, description: "New weekday indices (omit if not changing)." }, time_of_day: { type: "string", description: "New time HH:MM (omit if not changing)." }, is_active: { type: "boolean", description: "false = pause, true = resume." } }, required: ["search_name"] } } },

  { type: "function", function: { name: "delete_habit", description: "Permanently delete a habit. Trigger: 'احذفي العادة', 'مو أبي أتعود', 'remove habit', 'stop tracking habit'.", parameters: { type: "object", properties: { search_name: { type: "string", description: "Key words from the habit name to find it." } }, required: ["search_name"] } } },
];

async function executeFunction(functionCall: any, userId: string, supabase: any) {
  const { name } = functionCall;
  const args = typeof functionCall.arguments === 'string' ? JSON.parse(functionCall.arguments) : functionCall.arguments;
  const fmt = (n: number) => new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 }).format(n);

  switch (name) {
    case 'add_task': {
      const { error } = await supabase.from('tasks').insert({ user_id: userId, title: args.title, due_date: args.due_date || null, priority: args.priority || 'medium', description: args.notes || null, status: 'pending', category: 'general' });
      if (error) throw new Error(`add_task: ${error.message}`);
      const taskDateFmt = args.due_date
        ? new Date(args.due_date + 'T12:00:00').toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        : 'اليوم';
      return { kind: 'task', summary: `✓ سجّلت مهمة "${args.title}" ليوم ${taskDateFmt}`, data: args };
    }
    case 'add_habit': {
      const freq = args.frequency || 'daily';
      const targetDays = Array.isArray(args.target_days) && args.target_days.length ? args.target_days : null;
      const { error } = await supabase.from('habits').insert({ user_id: userId, name: args.name, frequency: freq, target_days: targetDays, icon: args.icon || '⭐', color: '#0E4E4E', is_active: true });
      if (error) throw new Error(`add_habit: ${error.message}`);
      const dayNames = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
      let detailAr = freq === 'weekly' ? 'أسبوعية' : 'يومية';
      if (targetDays && targetDays.length) {
        detailAr = targetDays.map((d: number) => dayNames[d] ?? '').filter(Boolean).join('، ');
      }
      const timeNote = args.time_of_day ? ` الساعة ${args.time_of_day}` : '';
      return { kind: 'task', summary: `✓ سجّلت عادة "${args.name}" — ${detailAr}${timeNote}`, data: args };
    }
    case 'log_mood': {
      const score = Math.max(1, Math.min(10, Math.round(Number(args.score))));
      const { error } = await supabase.from('mood_logs').insert({ user_id: userId, mood_score: score, mood_label: args.label, note: args.note || null });
      if (error) throw new Error(`log_mood: ${error.message}`);
      const emoji = score >= 8 ? '😊' : score >= 5 ? '😐' : '😔';
      return { kind: 'task', summary: `✓ مزاجك "${args.label}" ${emoji} سُجِّل`, data: args };
    }
    case 'create_calendar_event': {
      const startsAt = args.starts_at || new Date().toISOString();
      const endsAt = args.ends_at || new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from('events').insert({ user_id: userId, title: args.title, description: args.description || null, starts_at: startsAt, ends_at: endsAt, start_at: startsAt, end_at: endsAt, all_day: args.all_day ?? false, category: args.category || 'personal', location: args.location || null, source: 'jood_ai' });
      if (error) throw new Error(`create_calendar_event: ${error.message}`);
      const evtFmt = new Date(startsAt).toLocaleString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      return { kind: 'event', summary: `✓ سجّلت موعد "${args.title}" يوم ${evtFmt}`, data: args };
    }
    case 'compose_email':
      return { kind: 'email_draft', summary: `مسودة إيميل لـ ${args.to} جاهزة`, data: { to: args.to, subject: args.subject, body: args.body } };
    case 'draft_whatsapp':
      return { kind: 'whatsapp_draft', summary: `رسالة لـ ${args.recipient} جاهزة`, data: { recipient: args.recipient, message: args.message } };
    case 'add_financial_entry': {
      const { error } = await supabase.from('financial_data').insert({ user_id: userId, type: args.type, amount: args.amount, currency: args.currency, category: args.category || null, note: args.description || null, label: args.category || args.type });
      if (error) throw new Error(`add_financial_entry: ${error.message}`);
      const typeAr = args.type === 'income' ? 'دخل' : args.type === 'savings' ? 'ادخار' : args.type === 'investment' ? 'استثمار' : 'مصروف';
      return { kind: 'finance', summary: `✓ ${typeAr} ${fmt(args.amount)} ${args.currency} سُجِّل`, data: args };
    }
    case 'remember_about_user': {
      const cat = MEMORY_CATEGORIES.includes(args.category) ? args.category : 'identity';
      const importance = Math.max(0, Math.min(1, Number(args.importance) || 0.6));
      const { error } = await supabase.from('user_memories').insert({
        user_id: userId,
        kind: 'fact',
        category: cat,
        content: String(args.content).slice(0, 400),
        importance,
        confidence: 0.85,
        is_template: false,
        active: true,
      });
      if (error) throw new Error(`remember_about_user: ${error.message}`);
      // Silent — no user-facing summary; Jood continues her natural reply.
      return { kind: 'memory', summary: '', data: args, silent: true };
    }
    // ── Update Task ────────────────────────────────────────────────────────────
    case 'update_task': {
      const { data: found } = await supabase.from('tasks')
        .select('id, title, due_date').eq('user_id', userId)
        .ilike('title', `%${args.search_title}%`)
        .order('created_at', { ascending: false }).limit(1);
      if (!found?.length) throw new Error(`ما لقيت مهمة تحتوي على "${args.search_title}"`);
      const task = found[0];
      const updates: any = { updated_at: new Date().toISOString() };
      if (args.new_title)  updates.title       = args.new_title;
      if (args.due_date)   updates.due_date     = args.due_date;
      if (args.priority)   updates.priority     = args.priority;
      if (args.status)     updates.status       = args.status;
      if (args.notes !== undefined) updates.description = args.notes;
      const { error } = await supabase.from('tasks').update(updates).eq('id', task.id);
      if (error) throw new Error(`update_task: ${error.message}`);
      const changes: string[] = [];
      if (args.new_title) changes.push(`الاسم: "${args.new_title}"`);
      if (args.due_date)  changes.push(`التاريخ: ${new Date(args.due_date + 'T12:00:00').toLocaleDateString('ar-SA', { weekday: 'long', month: 'long', day: 'numeric' })}`);
      if (args.priority)  changes.push(`الأولوية: ${args.priority}`);
      if (args.status === 'completed') changes.push('تم الإنجاز ✓');
      const summary = changes.length
        ? `✓ عدّلت مهمة "${task.title}" — ${changes.join('، ')}`
        : `✓ عدّلت مهمة "${task.title}"`;
      return { kind: 'task_update', summary, data: args };
    }

    // ── Delete Task ────────────────────────────────────────────────────────────
    case 'delete_task': {
      const { data: found } = await supabase.from('tasks')
        .select('id, title').eq('user_id', userId)
        .ilike('title', `%${args.search_title}%`)
        .order('created_at', { ascending: false }).limit(1);
      if (!found?.length) throw new Error(`ما لقيت مهمة تحتوي على "${args.search_title}"`);
      const task = found[0];
      const { error } = await supabase.from('tasks').delete().eq('id', task.id);
      if (error) throw new Error(`delete_task: ${error.message}`);
      return { kind: 'task_delete', summary: `✓ حذفت مهمة "${task.title}"`, data: args };
    }

    // ── Update Event ───────────────────────────────────────────────────────────
    case 'update_event': {
      const { data: found } = await supabase.from('events')
        .select('id, title, starts_at').eq('user_id', userId)
        .ilike('title', `%${args.search_title}%`)
        .order('created_at', { ascending: false }).limit(1);
      if (!found?.length) throw new Error(`ما لقيت موعد يحتوي على "${args.search_title}"`);
      const ev = found[0];
      const updates: any = { updated_at: new Date().toISOString() };
      if (args.new_title) { updates.title = args.new_title; }
      if (args.starts_at) { updates.starts_at = args.starts_at; updates.start_at = args.starts_at; }
      if (args.ends_at)   { updates.ends_at = args.ends_at;   updates.end_at   = args.ends_at; }
      if (args.location)  updates.location = args.location;
      const { error } = await supabase.from('events').update(updates).eq('id', ev.id);
      if (error) throw new Error(`update_event: ${error.message}`);
      const changes: string[] = [];
      if (args.new_title) changes.push(`الاسم: "${args.new_title}"`);
      if (args.starts_at) changes.push(`الوقت: ${new Date(args.starts_at).toLocaleString('ar-SA', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
      if (args.location)  changes.push(`المكان: ${args.location}`);
      const summary = changes.length
        ? `✓ عدّلت موعد "${ev.title}" — ${changes.join('، ')}`
        : `✓ عدّلت موعد "${ev.title}"`;
      return { kind: 'event_update', summary, data: args };
    }

    // ── Delete Event ───────────────────────────────────────────────────────────
    case 'delete_event': {
      const { data: found } = await supabase.from('events')
        .select('id, title').eq('user_id', userId)
        .ilike('title', `%${args.search_title}%`)
        .order('created_at', { ascending: false }).limit(1);
      if (!found?.length) throw new Error(`ما لقيت موعد يحتوي على "${args.search_title}"`);
      const ev = found[0];
      const { error } = await supabase.from('events').delete().eq('id', ev.id);
      if (error) throw new Error(`delete_event: ${error.message}`);
      return { kind: 'event_delete', summary: `✓ حذفت موعد "${ev.title}"`, data: args };
    }

    // ── Update Habit ───────────────────────────────────────────────────────────
    case 'update_habit': {
      const { data: found } = await supabase.from('habits')
        .select('id, name').eq('user_id', userId)
        .ilike('name', `%${args.search_name}%`)
        .order('created_at', { ascending: false }).limit(1);
      if (!found?.length) throw new Error(`ما لقيت عادة تحتوي على "${args.search_name}"`);
      const habit = found[0];
      const updates: any = { updated_at: new Date().toISOString() };
      if (args.new_name !== undefined)  updates.name        = args.new_name;
      if (args.frequency !== undefined) updates.frequency   = args.frequency;
      if (args.target_days !== undefined) updates.target_days = args.target_days;
      if (args.time_of_day !== undefined) updates.time_of_day = args.time_of_day;
      if (args.is_active !== undefined)   updates.is_active   = args.is_active;
      const { error } = await supabase.from('habits').update(updates).eq('id', habit.id);
      if (error) throw new Error(`update_habit: ${error.message}`);
      const changes: string[] = [];
      if (args.new_name)    changes.push(`الاسم: "${args.new_name}"`);
      if (args.frequency)   changes.push(args.frequency === 'daily' ? 'يومية' : 'أسبوعية');
      if (args.time_of_day) changes.push(`الساعة ${args.time_of_day}`);
      if (args.is_active === false) changes.push('موقوفة مؤقتاً ⏸');
      if (args.is_active === true)  changes.push('مفعّلة مجدداً ▶');
      const dayNames = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
      if (Array.isArray(args.target_days) && args.target_days.length) {
        changes.push(args.target_days.map((d: number) => dayNames[d]).filter(Boolean).join('، '));
      }
      const summary = changes.length
        ? `✓ عدّلت عادة "${habit.name}" — ${changes.join('، ')}`
        : `✓ عدّلت عادة "${habit.name}"`;
      return { kind: 'habit_update', summary, data: args };
    }

    // ── Delete Habit ───────────────────────────────────────────────────────────
    case 'delete_habit': {
      const { data: found } = await supabase.from('habits')
        .select('id, name').eq('user_id', userId)
        .ilike('name', `%${args.search_name}%`)
        .order('created_at', { ascending: false }).limit(1);
      if (!found?.length) throw new Error(`ما لقيت عادة تحتوي على "${args.search_name}"`);
      const habit = found[0];
      const { error } = await supabase.from('habits').delete().eq('id', habit.id);
      if (error) throw new Error(`delete_habit: ${error.message}`);
      return { kind: 'habit_delete', summary: `✓ حذفت عادة "${habit.name}"`, data: args };
    }

    // ── Update Financial Entry ─────────────────────────────────────────────────
    case 'update_financial_entry': {
      const { data: found } = await supabase.from('financial_data')
        .select('id, type, amount, currency, category, note, label, description')
        .eq('user_id', userId)
        .or(`note.ilike.%${args.search_desc}%,category.ilike.%${args.search_desc}%,label.ilike.%${args.search_desc}%,description.ilike.%${args.search_desc}%`)
        .order('created_at', { ascending: false }).limit(1);
      if (!found?.length) throw new Error(`ما لقيت معاملة تحتوي على "${args.search_desc}"`);
      const entry = found[0];
      const updates: any = { updated_at: new Date().toISOString() };
      if (args.new_amount !== undefined)   updates.amount      = args.new_amount;
      if (args.new_type)                   updates.type        = args.new_type;
      if (args.new_category)               updates.category    = args.new_category;
      if (args.new_description !== undefined) { updates.note = args.new_description; updates.description = args.new_description; }
      const { error } = await supabase.from('financial_data').update(updates).eq('id', entry.id);
      if (error) throw new Error(`update_financial_entry: ${error.message}`);
      const changes: string[] = [];
      const typeAr = (t: string) => t === 'income' ? 'دخل' : t === 'savings' ? 'ادخار' : t === 'investment' ? 'استثمار' : 'مصروف';
      const entryLabel = entry.note || entry.category || entry.label || typeAr(entry.type);
      if (args.new_amount !== undefined) changes.push(`المبلغ: ${fmt(args.new_amount)} ${entry.currency || 'ريال'}`);
      if (args.new_type)                 changes.push(`النوع: ${typeAr(args.new_type)}`);
      if (args.new_category)             changes.push(`الفئة: ${args.new_category}`);
      if (args.new_description)          changes.push(`الوصف: ${args.new_description}`);
      const summary = changes.length
        ? `✓ عدّلت "${entryLabel}" — ${changes.join('، ')}`
        : `✓ عدّلت "${entryLabel}"`;
      return { kind: 'finance_update', summary, data: args };
    }

    // ── Delete Financial Entry ─────────────────────────────────────────────────
    case 'delete_financial_entry': {
      const { data: found } = await supabase.from('financial_data')
        .select('id, type, amount, currency, note, category, label')
        .eq('user_id', userId)
        .or(`note.ilike.%${args.search_desc}%,category.ilike.%${args.search_desc}%,label.ilike.%${args.search_desc}%,description.ilike.%${args.search_desc}%`)
        .order('created_at', { ascending: false }).limit(1);
      if (!found?.length) throw new Error(`ما لقيت معاملة تحتوي على "${args.search_desc}"`);
      const entry = found[0];
      const { error } = await supabase.from('financial_data').delete().eq('id', entry.id);
      if (error) throw new Error(`delete_financial_entry: ${error.message}`);
      const typeAr2 = entry.type === 'income' ? 'دخل' : entry.type === 'savings' ? 'ادخار' : entry.type === 'investment' ? 'استثمار' : 'مصروف';
      const entryName = entry.note || entry.category || entry.label || typeAr2;
      return { kind: 'finance_delete', summary: `✓ حذفت "${entryName}" (${fmt(entry.amount)} ${entry.currency || 'ريال'})`, data: args };
    }

    // ── Add Goal ───────────────────────────────────────────────────────────────
    case 'add_goal': {
      const { error } = await supabase.from('goals').insert({
        user_id: userId,
        title: args.title,
        target_amount: args.target_amount,
        saved_amount: args.saved_amount || 0,
        progress: args.saved_amount ? Math.min(100, Math.round((args.saved_amount / args.target_amount) * 100)) : 0,
        target_date: args.target_date || null,
        status: 'open',
      });
      if (error) throw new Error(`add_goal: ${error.message}`);
      const datePart = args.target_date
        ? ` · الهدف: ${new Date(args.target_date + 'T12:00:00').toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' })}`
        : '';
      return { kind: 'goal', summary: `✓ سجّلت هدف توفير "${args.title}" — ${fmt(args.target_amount)} ريال${datePart}`, data: args };
    }

    // ── Update Goal ────────────────────────────────────────────────────────────
    case 'update_goal': {
      const { data: found } = await supabase.from('goals')
        .select('id, title, target_amount, saved_amount, status')
        .eq('user_id', userId)
        .ilike('title', `%${args.search_title}%`)
        .order('created_at', { ascending: false }).limit(1);
      if (!found?.length) throw new Error(`ما لقيت هدف توفير يحتوي على "${args.search_title}"`);
      const goal = found[0];
      const updates: any = { updated_at: new Date().toISOString() };
      if (args.new_title !== undefined)   updates.title         = args.new_title;
      if (args.target_amount !== undefined) { updates.target_amount = args.target_amount; }
      if (args.saved_amount !== undefined) {
        updates.saved_amount = args.saved_amount;
        const ta = args.target_amount ?? goal.target_amount;
        updates.progress = ta > 0 ? Math.min(100, Math.round((args.saved_amount / ta) * 100)) : 0;
      }
      if (args.target_date !== undefined) updates.target_date   = args.target_date;
      if (args.status !== undefined)      updates.status        = args.status;
      const { error } = await supabase.from('goals').update(updates).eq('id', goal.id);
      if (error) throw new Error(`update_goal: ${error.message}`);
      const changes: string[] = [];
      if (args.new_title)        changes.push(`الاسم: "${args.new_title}"`);
      if (args.target_amount !== undefined) changes.push(`المستهدف: ${fmt(args.target_amount)} ريال`);
      if (args.saved_amount !== undefined)  changes.push(`المدّخر: ${fmt(args.saved_amount)} ريال`);
      if (args.target_date)      changes.push(`الموعد: ${new Date(args.target_date + 'T12:00:00').toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' })}`);
      if (args.status === 'completed') changes.push('مكتمل 🎉');
      if (args.status === 'paused')    changes.push('موقوف مؤقتاً ⏸');
      const summary = changes.length
        ? `✓ عدّلت هدف "${goal.title}" — ${changes.join('، ')}`
        : `✓ عدّلت هدف "${goal.title}"`;
      return { kind: 'goal_update', summary, data: args };
    }

    // ── Delete Goal ────────────────────────────────────────────────────────────
    case 'delete_goal': {
      const { data: found } = await supabase.from('goals')
        .select('id, title, target_amount')
        .eq('user_id', userId)
        .ilike('title', `%${args.search_title}%`)
        .order('created_at', { ascending: false }).limit(1);
      if (!found?.length) throw new Error(`ما لقيت هدف توفير يحتوي على "${args.search_title}"`);
      const goal = found[0];
      const { error } = await supabase.from('goals').delete().eq('id', goal.id);
      if (error) throw new Error(`delete_goal: ${error.message}`);
      return { kind: 'goal_delete', summary: `✓ حذفت هدف "${goal.title}" (${fmt(goal.target_amount)} ريال)`, data: args };
    }

    // ── Update Portfolio Holding ───────────────────────────────────────────────
    case 'update_portfolio_holding': {
      const { data: found } = await supabase.from('portfolio_holdings')
        .select('id, symbol, market, quantity, avg_price, currency')
        .eq('user_id', userId)
        .ilike('symbol', `%${args.search_symbol}%`)
        .order('created_at', { ascending: false }).limit(1);
      if (!found?.length) throw new Error(`ما لقيت استثمار بالرمز "${args.search_symbol}"`);
      const holding = found[0];
      const updates: any = { updated_at: new Date().toISOString() };
      if (args.quantity !== undefined)      updates.quantity      = args.quantity;
      if (args.avg_price !== undefined)     updates.avg_price     = args.avg_price;
      if (args.current_price !== undefined) updates.current_price = args.current_price;
      const { error } = await supabase.from('portfolio_holdings').update(updates).eq('id', holding.id);
      if (error) throw new Error(`update_portfolio_holding: ${error.message}`);
      const changes: string[] = [];
      if (args.quantity !== undefined)      changes.push(`الكمية: ${args.quantity}`);
      if (args.avg_price !== undefined)     changes.push(`متوسط الشراء: ${fmt(args.avg_price)} ${holding.currency}`);
      if (args.current_price !== undefined) changes.push(`السعر الحالي: ${fmt(args.current_price)} ${holding.currency}`);
      const summary = changes.length
        ? `✓ عدّلت ${holding.symbol} — ${changes.join('، ')}`
        : `✓ عدّلت ${holding.symbol}`;
      return { kind: 'holding_update', summary, data: args };
    }

    // ── Delete Portfolio Holding ───────────────────────────────────────────────
    case 'delete_portfolio_holding': {
      const { data: found } = await supabase.from('portfolio_holdings')
        .select('id, symbol, quantity, currency')
        .eq('user_id', userId)
        .ilike('symbol', `%${args.search_symbol}%`)
        .order('created_at', { ascending: false }).limit(1);
      if (!found?.length) throw new Error(`ما لقيت استثمار بالرمز "${args.search_symbol}"`);
      const holding = found[0];
      const { error } = await supabase.from('portfolio_holdings').delete().eq('id', holding.id);
      if (error) throw new Error(`delete_portfolio_holding: ${error.message}`);
      return { kind: 'holding_delete', summary: `✓ حذفت ${holding.symbol} من المحفظة (${holding.quantity} وحدة)`, data: args };
    }

    default: throw new Error(`Unknown function: ${name}`);
  }
}

function buildPreview(name: string, args: any, voiceMode: boolean): string {
  let preview = '';
  switch (name) {
    case 'create_calendar_event': {
      const dt = args.starts_at ? new Date(args.starts_at).toLocaleString('ar-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      preview = `موعد: "${args.title}" · ${dt}${args.location ? ` · 📍${args.location}` : ''}`; break;
    }
    case 'compose_email': preview = `إيميل لـ ${args.to}: "${args.subject}"`; break;
    case 'draft_whatsapp': preview = `واتساب لـ ${args.recipient}`; break;
    case 'add_financial_entry': {
      const typeAr = args.type === 'income' ? 'دخل' : args.type === 'savings' ? 'ادخار' : 'مصروف';
      preview = `${typeAr}: ${args.amount} ${args.currency || 'ريال'}`; break;
    }
    default: preview = name;
  }
  return voiceMode ? `${preview}. تأكيدي؟` : `سأنفّذ: **${preview}**\n\nتأكيدي؟ قولي **نعم** أو **لا**.`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  let stage = 'init';
  try {
    stage = 'parse_body';
    const { message, context, mode, pendingFunction, voice_mode = false, detected_language = "ar" } = await req.json();
    if (!message) throw new Error('Message is required');

    stage = 'env_check';
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) throw new Error('OpenAI API key not configured');

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Auth
    stage = 'auth';
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      try {
        const { data: userData } = await supabaseClient.auth.getUser(token);
        if (userData?.user) userId = userData.user.id;
      } catch { /* anon */ }
    }

    // Profile + memory taxonomy (parallel for speed) — non-fatal
    stage = 'profile';
    let userContext = "مستخدم سعودي";
    let workingDays: number[] = [0,1,2,3,4]; // Sun-Thu (Saudi default)
    let weekendDays: number[] = [5,6];       // Fri-Sat
    let knownFacts = "";
    let missingCategories: string[] = [];
    let genderForPrompt: string | null = null;
    if (userId) {
      try {
        const [profileRes, taxonomyRes] = await Promise.all([
          supabaseClient.from('profiles')
            .select('display_name, gender, phone, city, date_of_birth, bio, base_currency, working_days, weekend_days')
            .eq('user_id', userId).maybeSingle(),
          supabaseClient.rpc('get_memory_taxonomy', { p_user_id: userId })
            .then((r: any) => r).catch(() => ({ data: [] })),
        ]);
        const profile = profileRes?.data;
        genderForPrompt = profile?.gender ?? null;
        if (profile) {
          const genderAr = profile.gender === 'female' ? 'أنثى' : profile.gender === 'male' ? 'ذكر' : '';
          userContext = [
            profile.display_name ? `الاسم: ${profile.display_name}` : '',
            genderAr                ? `الجنس: ${genderAr}` : '',
            profile.city            ? `المدينة: ${profile.city}` : '',
            profile.bio             ? `نبذة: ${profile.bio}` : '',
            `العملة: ${profile.base_currency || 'SAR'}`,
          ].filter(Boolean).join(' · ');
          if (Array.isArray(profile.working_days) && profile.working_days.length) workingDays = profile.working_days;
          if (Array.isArray(profile.weekend_days) && profile.weekend_days.length) weekendDays = profile.weekend_days;
        }
        const taxonomy: any[] = Array.isArray(taxonomyRes?.data) ? taxonomyRes.data : [];
        const CAT_AR: Record<string, string> = {
          identity: "الهوية", work: "العمل", family: "العائلة",
          financial: "المالية", health: "الصحة", religion: "الالتزام الديني",
          routine: "الروتين اليومي", goals: "الأهداف", interests: "الاهتمامات",
          relationships: "العلاقات", preferences: "التفضيلات", pain_points: "التحديات",
        };
        const filled: string[] = [];
        for (const row of taxonomy) {
          if (row.filled_count > 0 && row.latest_real_content) {
            filled.push(`• ${CAT_AR[row.category] ?? row.category}: ${row.latest_real_content}`);
          } else {
            missingCategories.push(CAT_AR[row.category] ?? row.category);
          }
        }
        if (filled.length) knownFacts = "\n\nما تعرفينه عن المستخدم:\n" + filled.join('\n');
      } catch { /* non-fatal */ }
    }
    const dayNamesAr = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    const workDaysAr = workingDays.map(d => dayNamesAr[d]).filter(Boolean).join('، ');
    const weekendAr  = weekendDays.map(d => dayNamesAr[d]).filter(Boolean).join('، ');
    const missingHint = missingCategories.length
      ? `\nمعلومات لم تُجمع بعد عن المستخدم — اسأليها بشكل طبيعي ضمن السياق فقط (لا تستجوبيها ولا تطرحي أكثر من سؤال واحد لكل رد): ${missingCategories.slice(0, 4).join('، ')}`
      : "";

    // Flow detection
    stage = 'flow_detect';
    const CONFIRM_WORDS = ['yes','confirm','ok','sure','نعم','تأكيد','تمام','ماشي','صح','أكيد'];
    const CANCEL_WORDS = ['no','cancel','لا','إلغاء','الغي'];
    const msgLower = String(message).toLowerCase().trim();
    const isConfirmation = CONFIRM_WORDS.includes(msgLower);
    const isCancel = CANCEL_WORDS.includes(msgLower);
    const shouldCommit = mode === 'commit' || (isConfirmation && pendingFunction);

    const respondInEnglish = detected_language === "en";
    const respondMixed = detected_language === "mixed";

    // Model routing
    const SIMPLE_RE = /^(كيف حال|how are you|مرحب|hello|هلا|أهلا|شكراً|thank|^ok$|^تمام$|صباح|مساء|السلام)/i;
    const isSimple = !voice_mode && SIMPLE_RE.test(String(message).trim()) && !pendingFunction;
    const model = isSimple ? "gpt-4o-mini" : "gpt-4o";
    const trimmedContext = Array.isArray(context) ? context.slice(-8).filter((m: any) => m && m.role && m.content).map((m: any) => ({ role: m.role, content: String(m.content) })) : [];

    // System prompt
    stage = 'build_prompt';
    const _now = new Date();
    const TODAY = _now.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const TODAY_ISO = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
    const langRule = respondInEnglish ? "User spoke English — reply in English." : respondMixed ? "المستخدم يخلط عربي-إنجليزي — رديّ بنفس المزيج." : "";
    const modeRules = voice_mode
      ? `وضع صوتي: جملة واحدة (≤15 كلمة). ممنوع markdown.`
      : `وضع نص: يمكنكِ markdown وقوائم. ردودك موجزة.`;

    // Gender-aware grammar rule
    const genderRule = (() => {
      const g = genderForPrompt;
      if (g === 'female') return `
قاعدة الجنس: المستخدمة أنثى — استخدمي دائماً صيغة المؤنث في كل ردودك.
أمثلة صحيحة: "زيني، قولي، أخبريني، حسناً أنتِ، أهلاً بكِ، تفضّلي".
لا تستخدمي صيغة المذكر أبداً معها.`;
      if (g === 'male') return `
قاعدة الجنس: المستخدم ذكر — استخدمي دائماً صيغة المذكر في كل ردودك.
أمثلة صحيحة: "زيد، قل، أخبرني، حسناً أنتَ، أهلاً بك، تفضّل".
لا تستخدمي صيغة المؤنث أبداً معه.`;
      return `قاعدة الجنس: الجنس غير محدد — استخدمي صيغة محايدة أو اسألي المستخدم عن جنسه.`;
    })();

    const SYSTEM = `أنتِ جود — سكرتيرة تنفيذية سعودية ذكية من الرياض.

الشخصية:
- لهجة سعودية أصيلة (نجدية/خليجية): الحين، بكرة، زين، تمام، وش، أبي، خلاص، عاد، بس، مو، كذا، يلا
- مباشرة وذكية — لا تبدئين بـ "بالطبع" — ابدئي بالمضمون
- ترديّن على Arabizi والمزيج عربي-إنجليزي بنفس أسلوب المستخدم
- كل رد ينتهي بسؤال متابعة أو اقتراح واحد
${genderRule}

قدراتك:
✓ مهام وتذكيرات — إضافة / تعديل / حذف — مباشرة
✓ عادات يومية وأسبوعية — إضافة / تعديل / إيقاف / حذف — مباشرة
✓ تسجيل المزاج — مباشرة
✓ مواعيد التقويم — إضافة / تعديل / حذف — مع تأكيد للإضافة فقط
✓ مصاريف ودخل — إضافة (مع تأكيد) / تعديل / حذف — مباشرة
✓ أهداف التوفير — إضافة / تعديل / حذف — مباشرة
✓ المحفظة الاستثمارية — تعديل / حذف الأسهم والأصول — مباشرة
✓ إيميل وواتساب — مع تأكيد

السياق: اليوم ${TODAY} (${TODAY_ISO}) · ${userContext}
أسبوع العمل: ${workDaysAr} · الإجازة: ${weekendAr}
عند جدولة المهام والمواعيد، احترمي أيام العمل والإجازة. لا تقترحي اجتماعات في الإجازة إلا لو طلبها المستخدم صراحةً.${knownFacts}${missingHint}
${langRule}
${modeRules}

ذكاء التاريخ والوقت (قواعد صارمة):
• نحن الآن في ${TODAY} — السنة هي ${TODAY_ISO.slice(0,4)} دائماً
• إذا لم يذكر المستخدم تاريخاً → استخدمي TODAY_ISO تلقائياً (اليوم)
• "بكرة" / "غداً" → ${TODAY_ISO} + يوم واحد
• "نهاية الأسبوع" → أقرب جمعة أو سبت
• "الأسبوع الجاي" → نفس اليوم من الأسبوع القادم
• "الشهر الجاي" → نفس اليوم من الشهر القادم
• السنة دائماً ${TODAY_ISO.slice(0,4)} ما لم يذكر المستخدم سنة مختلفة صراحةً
• لا تجدولي مهام أو أحداث بعد 3 أشهر من اليوم إلا إذا طلب المستخدم ذلك صراحةً
• المستخدم يخطط للأمور القريبة — فكّري باليوم والأسبوع القادم كأولوية

قواعد الأدوات:
• إضافة مهام/عادات/مزاج/تعديل/حذف أي منها: نفّذي فوراً وأخبري المستخدم بما فعلتِ
• تعديل/حذف المواعيد: نفّذي فوراً (لا تطلبي تأكيداً لأن المستخدم طلب ذلك صراحةً)
• إضافة مواعيد تقويم جديدة/إيميل/واتساب: اعرضي ملخصاً واطلبي نعم/لا
• إضافة معاملات مالية (add_financial_entry): اعرضي ملخصاً واطلبي نعم/لا
• تعديل أو حذف معاملات/أهداف/محفظة: نفّذي فوراً وأخبري المستخدم بالتغيير بالتفصيل
• عند التعديل أو الحذف: ابحثي عن العنصر بالاسم وأخبري المستخدم بالتغيير بالضبط
• إذا طلب المستخدم عدة عناصر دفعة وحدة (مثلاً "ذكّريني بكل الصلوات الخمس" أو "أضيفي ثلاث مهام")، استدعي الأداة لكل عنصر — مهمة واحدة لكل صلاة (الفجر، الظهر، العصر، المغرب، العشاء)
• للعادات بأيام محددة (مثلاً "من الأحد إلى الأربعاء")، استخدمي frequency=weekly مع target_days=[0,1,2,3] حيث 0=الأحد و6=السبت
• إذا ذكر المستخدم وقتاً للعادة (مثلاً "الساعة 6 صباحاً")، أضيفي time_of_day بصيغة HH:MM
• لا تخمّني التفاصيل المفقودة — إذا الوقت أو اليوم غير واضح، اسألي قبل التنفيذ`;

    let systemPrompt = SYSTEM;
    if (shouldCommit) systemPrompt += `\n\nالمستخدم أكّد — نفّذي فوراً.`;
    if (isCancel) systemPrompt += `\n\nالمستخدم ألغى — ردّي بلطف.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...trimmedContext,
      { role: 'user', content: String(message) },
    ];

    // OpenAI call
    stage = 'openai_call';
    const requestBody: any = {
      model,
      messages,
      max_tokens: voice_mode ? 150 : isSimple ? 350 : 800,
      temperature: 0.7,
      tools: functionTools,
      tool_choice: shouldCommit ? 'required' : 'auto',
      parallel_tool_calls: true,
    };

    const openAIRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openAIApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!openAIRes.ok) {
      const errText = await openAIRes.text().catch(() => '');
      throw new Error(`OpenAI ${openAIRes.status}: ${errText.slice(0, 200)}`);
    }

    stage = 'openai_parse';
    const oaiData = await openAIRes.json();
    const choice = oaiData?.choices?.[0];
    if (!choice) throw new Error('No choices in OpenAI response');

    let assistantMessage = choice.message?.content || '';
    let functionResults: any = null;
    let actionCard: any = null;

    stage = 'tool_handling';
    if (isCancel) {
      assistantMessage = "تمام، ما سجّلت شيء. وش تبي الحين؟";
    } else if (choice.message?.tool_calls?.length) {
      const toolCalls = choice.message.tool_calls;

      // Split into direct (execute now) vs preview-required tools.
      const directCalls = toolCalls.filter((tc: any) => DIRECT_EXECUTE.has(tc.function.name));
      const previewCalls = toolCalls.filter((tc: any) => !DIRECT_EXECUTE.has(tc.function.name));

      // Execute all direct tool calls in sequence (tasks/habits/mood — no confirmation).
      const summaries: string[] = [];
      const results: any[] = [];
      if (userId && directCalls.length) {
        for (const tc of directCalls) {
          try {
            const result = await executeFunction(tc.function, userId, supabaseClient);
            results.push(result);
            // Silent tools (e.g. remember_about_user) don't add a visible line;
            // they just persist data in the background.
            if (!result.silent && result.summary) summaries.push(result.summary);
          } catch (err: any) {
            console.error('[executeFunction]', err?.message);
            summaries.push(`✗ ${tc.function.name}: ${err?.message || 'فشل'}`);
          }
        }
      }

      // If user already confirmed and there's a pendingFunction, execute that too.
      if (shouldCommit && pendingFunction && userId) {
        try {
          const result = await executeFunction(pendingFunction, userId, supabaseClient);
          results.push(result);
          summaries.push(result.summary);
        } catch (err: any) {
          summaries.push(`✗ ${err?.message || 'فشل التنفيذ'}`);
        }
      }

      // Handle preview-required tool calls — only honour the first (UI shows one confirmation card).
      if (previewCalls.length && !shouldCommit) {
        const fnCall = previewCalls[0].function;
        try {
          const parsedArgs = JSON.parse(fnCall.arguments || '{}');
          const previewText = buildPreview(fnCall.name, parsedArgs, voice_mode);
          summaries.push(previewText);
          functionResults = { function_call: fnCall, preview_mode: true };
        } catch {
          summaries.push("ما قدرت أفهم التفاصيل. تكتبيها بشكل ثاني؟");
        }
      }

      if (results.length) {
        // actionCard should be the last NON-silent result.
        const visibleResults = results.filter((r: any) => !r.silent);
        if (visibleResults.length) actionCard = visibleResults[visibleResults.length - 1];
        if (!functionResults && visibleResults.length) {
          functionResults = visibleResults.length === 1 ? visibleResults[0] : { multi: true, items: visibleResults };
        }
      }

      // If we have summaries (visible tool actions), those form the message.
      // If ONLY silent tools fired (e.g. remember_about_user), keep the model's natural reply.
      const naturalReply = choice.message?.content || '';
      if (summaries.length) {
        assistantMessage = naturalReply ? `${naturalReply}\n\n${summaries.join('\n')}` : summaries.join('\n');
      } else if (naturalReply) {
        assistantMessage = naturalReply;
      }
    } else if (shouldCommit && pendingFunction && userId) {
      try {
        const result = await executeFunction(pendingFunction, userId, supabaseClient);
        functionResults = result;
        actionCard = result;
        assistantMessage = result.summary;
      } catch (err: any) {
        assistantMessage = `صار خطأ: ${err?.message || 'غير معروف'}.`;
      }
    }

    if (!assistantMessage) {
      assistantMessage = "هلا، وش أقدر أسوي لك الحين؟";
    }

    // Emotion hint
    stage = 'emotion';
    let suggestedEmotion = "neutral";
    if (/متوتر|ضغط|قلق|stressed|تعبان/i.test(assistantMessage)) suggestedEmotion = "empathetic";
    else if (/ممتاز|رائع|great|excellent|يلا/i.test(assistantMessage)) suggestedEmotion = "warm";
    else if (/استثمار|محفظة|invest|portfolio/i.test(assistantMessage)) suggestedEmotion = "confident";

    return new Response(JSON.stringify({
      message: assistantMessage,
      function_results: functionResults,
      action_card: actionCard,
      mode: shouldCommit ? 'commit' : 'conversation',
      voice_mode,
      detected_language,
      suggested_emotion: suggestedEmotion,
      model_used: model,
      timestamp: new Date().toISOString(),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    const errMsg = error?.message || String(error) || 'Unknown error';
    console.error(`[ai-chat] FATAL at stage=${stage}:`, errMsg);
    // Return 200 with friendly fallback so the UI never shows the connection-failed toast.
    // Real error in `debug` for inspection.
    return new Response(
      JSON.stringify({
        message: "آسفة، صار شي بسيط عندي. عيدي السؤال مرة ثانية لو سمحتي.",
        function_results: null,
        action_card: null,
        mode: 'conversation',
        suggested_emotion: 'empathetic',
        debug: { stage, error: errMsg },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
