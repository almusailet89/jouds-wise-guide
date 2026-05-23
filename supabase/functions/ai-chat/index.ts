import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DIRECT_EXECUTE = new Set([
  'add_task', 'add_habit', 'log_mood', 'remember_about_user', 'update_user_preferences',
  'navigate_to_section', 'create_recurring_task', 'multi_step_workflow',
  'update_task', 'update_event', 'update_habit',
  'delete_task', 'delete_event', 'delete_habit',
  // financial
  'update_financial_entry', 'delete_financial_entry',
  'add_goal', 'update_goal', 'delete_goal',
  'update_portfolio_holding', 'delete_portfolio_holding',
  // read tools — Jood sees everything in the app
  'get_portfolio', 'get_financial_summary', 'get_tasks',
  'get_upcoming_events', 'get_habits', 'get_goals',
  'get_wallet_balance', 'get_recent_moods', 'get_daily_plan',
]);

const MEMORY_CATEGORIES = [
  'identity','work','family','financial','health','religion',
  'routine','goals','interests','relationships','preferences','pain_points',
];

// ─── Function tool definitions ────────────────────────────────────────────────
const functionTools = [
  { type: "function", function: { name: "add_task", description: "Add a task/reminder/to-do/follow-up/deadline. Trigger: 'أضيفي مهمة', 'ذكّريني', 'سوّي لي تاسك', 'ضيفي', 'حطّي في قائمتي', 'متابعة مع', 'لازم أسوي', 'لا تنسيني', 'ديدلاين', 'remind me to', 'add to my list', 'follow up with', 'set a deadline', 'I need to', 'don't let me forget', 'todo', 'schedule a reminder', 'put on my plate', 'add action item'. Also for recurring reminders: 'ذكّريني كل شهر', 'remind me every month' → add task with note about recurrence.", parameters: { type: "object", properties: { title: { type: "string" }, due_date: { type: "string", description: "ISO date YYYY-MM-DD. ALWAYS set this — default to TODAY_ISO if no date mentioned. Use TODAY_ISO from system context as base; year is ALWAYS TODAY_ISO's year unless user explicitly says otherwise. 'بكرة/tomorrow' = TODAY+1, 'نهاية الأسبوع' = next Fri/Sat, 'الأسبوع الجاي' = same weekday next week. Never schedule more than 3 months ahead unless user specifically requests it." }, priority: { type: "string", enum: ["low","medium","high"] }, notes: { type: "string" } }, required: ["title", "due_date"] } } },
  { type: "function", function: { name: "add_habit", description: "Add a recurring habit/routine/daily practice. Trigger: 'عوّدني', 'أبي أتعود', 'حطّي عادة', 'أبي روتين', 'سوّي لي جدول يومي', 'أبي ألتزم بـ', 'track my habit', 'daily routine', 'I want to start doing', 'build a habit', 'track my workout/reading/water/prayer'. For specific weekdays (e.g. 'من الأحد إلى الأربعاء' = Sun-Wed), set frequency='weekly' and provide target_days array (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat).", parameters: { type: "object", properties: { name: { type: "string" }, frequency: { type: "string", enum: ["daily","weekly"] }, target_days: { type: "array", items: { type: "integer", minimum: 0, maximum: 6 }, description: "Weekday indices when frequency=weekly. 0=Sunday … 6=Saturday." }, time_of_day: { type: "string", description: "Optional time HH:MM (24h)" }, icon: { type: "string" } }, required: ["name"] } } },
  { type: "function", function: { name: "log_mood", description: "Log mood/energy/stress/wellbeing. Trigger: 'أنا متعب', 'مزاجي ممتاز', 'يومي كان صعب', 'مبسوط', 'منهك', 'حاسس بضغط', 'مرتاح', 'قلقان', 'حماسي عالي', 'feeling stressed/great/anxious/tired/happy/excited', 'سجّلي مزاجي', 'today was rough/amazing', 'log how I feel', 'I'm burned out', 'best day ever'.", parameters: { type: "object", properties: { score: { type: "number" }, label: { type: "string" }, note: { type: "string" } }, required: ["score","label"] } } },
  { type: "function", function: { name: "create_calendar_event", description: "Create calendar event/meeting/appointment/block time. Trigger: 'احجزي', 'اجتماع', 'موعد', 'حطّي في التقويم', 'جدولي', 'حطّي بلوك', 'عندي لقاء', 'موعد دكتور', 'رحلة', 'حفلة', 'مناسبة', 'book', 'schedule a meeting', 'block time for', 'set up a call', 'board meeting', 'doctor appointment', 'dinner reservation', 'flight', 'conference', 'interview'. Also for personal: 'عزيمة', 'زيارة', 'مشوار'.", parameters: { type: "object", properties: { title: { type: "string" }, starts_at: { type: "string" }, ends_at: { type: "string" }, location: { type: "string" }, description: { type: "string" }, all_day: { type: "boolean" }, category: { type: "string" } }, required: ["title","starts_at"] } } },
  { type: "function", function: { name: "compose_email", description: "Draft email — formal, informal, follow-up, apology, request, report. Trigger: 'راسلي', 'أرسلي إيميل', 'اكتبي إيميل رسمي', 'إيميل اعتذار', 'إيميل متابعة', 'رد على الإيميل', 'draft email', 'write a formal email', 'send an apology email', 'follow-up email', 'compose a message to', 'email my team/boss/client'.", parameters: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, required: ["to","subject","body"] } } },
  { type: "function", function: { name: "draft_whatsapp", description: "Draft WhatsApp message — professional, casual, apology, invitation. Trigger: 'واتساب', 'راسل فلان', 'اكتبي رسالة لـ', 'ابعثي واتساب', 'رسالة اعتذار', 'دعوة', 'WhatsApp', 'text', 'message to', 'send a WhatsApp to', 'invite via WhatsApp'.", parameters: { type: "object", properties: { recipient: { type: "string" }, message: { type: "string" } }, required: ["recipient","message"] } } },
  { type: "function", function: { name: "add_financial_entry", description: "Record financial transaction — expense, income, salary, savings deposit, investment. Trigger: 'صرفت', 'دخلي', 'راتبي', 'X ريال', 'دفعت', 'اشتريت', 'فاتورة', 'سجّلي مصروف', 'إيداع', 'حوّلت', 'I spent', 'I earned', 'salary', 'paid', 'bought', 'bill', 'deposit', 'transferred', 'log expense/income', amount stated with currency.", parameters: { type: "object", properties: { type: { type: "string", enum: ["expense","income","savings","investment"] }, amount: { type: "number" }, currency: { type: "string" }, category: { type: "string" }, description: { type: "string" } }, required: ["type","amount","currency"] } } },
  // ── Financial edit/delete tools ─────────────────────────────────────────────
  { type: "function", function: { name: "update_financial_entry", description: "Edit an existing financial transaction — change amount, category, type, or description. Trigger: 'عدّلي مصروف', 'غيّري المبلغ', 'صحّحي الدخل', 'بدّلي الفئة', 'change expense', 'edit transaction'.", parameters: { type: "object", properties: { search_desc: { type: "string", description: "Key words from the description, note, category, or label to find it." }, new_amount: { type: "number", description: "New amount (omit if not changing)." }, new_type: { type: "string", enum: ["expense","income","savings","investment"], description: "Omit if not changing." }, new_category: { type: "string", description: "Omit if not changing." }, new_description: { type: "string", description: "Omit if not changing." } }, required: ["search_desc"] } } },

  { type: "function", function: { name: "delete_financial_entry", description: "Permanently delete a financial transaction. Trigger: 'احذفي المصروف', 'امسحي الدخل', 'delete transaction', 'remove expense'.", parameters: { type: "object", properties: { search_desc: { type: "string", description: "Key words from the description, note, category, or label to find it." } }, required: ["search_desc"] } } },

  { type: "function", function: { name: "add_goal", description: "Create a new savings goal. Trigger: 'أبي أدّخر', 'حطّي هدف توفير', 'أضيفي هدف مالي', 'add savings goal', 'new financial goal'.", parameters: { type: "object", properties: { title: { type: "string", description: "Goal name, e.g. سيارة, سفر, شقة." }, target_amount: { type: "number", description: "Target amount in SAR." }, target_date: { type: "string", description: "ISO date YYYY-MM-DD for target completion. Use TODAY_ISO year." }, saved_amount: { type: "number", description: "Amount already saved. Default 0." } }, required: ["title","target_amount"] } } },

  { type: "function", function: { name: "update_goal", description: "Edit an existing savings goal — rename, change target amount or date, mark complete. Trigger: 'عدّلي الهدف', 'غيّري المبلغ المستهدف', 'خلّص الهدف', 'update savings goal'.", parameters: { type: "object", properties: { search_title: { type: "string", description: "Key words from the goal title." }, new_title: { type: "string", description: "Omit if not changing." }, target_amount: { type: "number", description: "Omit if not changing." }, target_date: { type: "string", description: "New date YYYY-MM-DD (omit if not changing). Use TODAY_ISO year." }, saved_amount: { type: "number", description: "Update amount already saved (omit if not changing)." }, status: { type: "string", enum: ["open","completed","paused"], description: "Omit if not changing." } }, required: ["search_title"] } } },

  { type: "function", function: { name: "delete_goal", description: "Permanently delete a savings goal. Trigger: 'احذفي الهدف', 'ما أبي هدف', 'remove goal'.", parameters: { type: "object", properties: { search_title: { type: "string", description: "Key words from the goal title." } }, required: ["search_title"] } } },

  { type: "function", function: { name: "update_portfolio_holding", description: "Edit an investment holding — update quantity, average price, or current price. Trigger: 'عدّلي استثماري', 'غيّري الكمية', 'حدّثي سعر السهم', 'update holding', 'edit investment'.", parameters: { type: "object", properties: { search_symbol: { type: "string", description: "Symbol or partial name of the asset to find it, e.g. 'ARAMCO', '2222', 'BTC'." }, quantity: { type: "number", description: "New quantity (omit if not changing)." }, avg_price: { type: "number", description: "New average purchase price (omit if not changing)." }, current_price: { type: "number", description: "New current price (omit if not changing)." } }, required: ["search_symbol"] } } },

  { type: "function", function: { name: "delete_portfolio_holding", description: "Permanently remove an investment holding from portfolio. Trigger: 'احذفي استثماري', 'بعت', 'مو عندي', 'sold my', 'remove holding'.", parameters: { type: "object", properties: { search_symbol: { type: "string", description: "Symbol or partial name of the asset, e.g. 'ARAMCO', 'BTC'." } }, required: ["search_symbol"] } } },

  { type: "function", function: { name: "remember_about_user", description: "Save a durable fact about the user to long-term memory. Call this when the user reveals something stable about themselves (name, job, family, goals, preferences, health, religious practice, daily routine, etc.). DO NOT call for transient state like 'I'm tired today'. The fact should be third-person and concise.", parameters: { type: "object", properties: { category: { type: "string", enum: ["identity","work","family","financial","health","religion","routine","goals","interests","relationships","preferences","pain_points"], description: "Which life-area this fact belongs to." }, content: { type: "string", description: "Short third-person fact, e.g. 'يعمل مديراً تقنياً في أرامكو' or 'يصلي الفجر في المسجد كل يوم'." }, importance: { type: "number", minimum: 0, maximum: 1, description: "0.0–1.0; how foundational this is. Default 0.6." } }, required: ["category","content"] } } },
  { type: "function", function: { name: "update_user_preferences", description: "Update the user's Jood preferences when they say things like 'كلميني بالتفصيل', 'أبي ردود قصيرة', 'خلّي ردودك مختصرة', 'I prefer detailed responses', 'call me Abu Mohammed', 'ناديني أبو محمد'. Only call when user explicitly requests a change.", parameters: { type: "object", properties: { response_style: { type: "string", enum: ["concise","balanced","detailed"], description: "How verbose Jood should be." }, jood_nickname: { type: "string", description: "What the user wants to call Jood (e.g. جودي, حبيبتي, etc.)." }, voice_language: { type: "string", enum: ["ar","en","auto"], description: "Preferred voice response language." } }, required: [] } } },
  // ── Phase 4: Jarvis-like Control ────────────────────────────────────────────
  { type: "function", function: { name: "navigate_to_section", description: "Navigate the user to a specific app section/tab. Trigger: 'وديني للمالية', 'فتحي الجدول', 'ابي أشوف المهام', 'فتحي الإعدادات', 'go to finance', 'open settings', 'show me tasks', 'open planning', 'show dashboard'. Call this when user asks to GO SOMEWHERE in the app, not when they ask to SEE data (use get_* tools for data).", parameters: { type: "object", properties: { section: { type: "string", enum: ["home","chat","financial","planning","mood","settings"], description: "Dashboard tab to navigate to." } }, required: ["section"] } } },
  { type: "function", function: { name: "create_recurring_task", description: "Create a task that automatically repeats — daily, weekly, or monthly. Trigger: 'كل يوم ذكرني', 'كل أسبوع سوّي', 'مهمة متكررة', 'روتين أسبوعي', 'every day remind', 'weekly task', 'monthly recurring', 'repeat task'. Use for tasks that happen on a schedule.", parameters: { type: "object", properties: { title: { type: "string", description: "Task name." }, recurrence: { type: "string", enum: ["daily","weekly","monthly"], description: "How often it repeats." }, recurrence_day: { type: "integer", description: "Day of week (0=Sun..6=Sat) for weekly, or day of month (1-28) for monthly. Omit for daily." }, time: { type: "string", description: "Time in HH:MM format, e.g. '09:00'." }, priority: { type: "string", enum: ["high","medium","low"], description: "Default medium." }, category: { type: "string", description: "Task category." } }, required: ["title","recurrence"] } } },
  { type: "function", function: { name: "multi_step_workflow", description: "Execute a multi-step workflow that chains multiple actions together. Trigger: 'رتّبي كل شي لبكرة', 'جهّزي اجتماع وارسلي إيميل', 'plan everything for tomorrow and send invites', 'do X then Y then Z'. Use when user asks for 2+ connected actions that should happen in sequence.", parameters: { type: "object", properties: { description: { type: "string", description: "Brief description of the workflow." }, steps: { type: "array", items: { type: "object", properties: { action: { type: "string", description: "Tool name to call." }, args: { type: "object", description: "Arguments for the tool." }, needs_approval: { type: "boolean", description: "If true, pause and ask before executing this step." } }, required: ["action","args"] }, description: "Ordered list of steps." } }, required: ["description","steps"] } } },

  // ── Edit & Delete tools ──────────────────────────────────────────────────────
  { type: "function", function: { name: "update_task", description: "Edit an existing task — reschedule, rename, change priority, or mark done. Trigger: 'غيّري مهمة', 'بدّلي تاريخ', 'عدّلي', 'خلّيها غداً', 'انتهيت من', 'reschedule', 'change task'.", parameters: { type: "object", properties: { search_title: { type: "string", description: "Key words from the task title to find it." }, new_title: { type: "string", description: "New title (omit if not changing)." }, due_date: { type: "string", description: "New due date YYYY-MM-DD (use TODAY_ISO year). Omit if not changing." }, priority: { type: "string", enum: ["low","medium","high"], description: "Omit if not changing." }, status: { type: "string", enum: ["pending","completed"], description: "Use 'completed' when user says they finished it." }, notes: { type: "string", description: "Omit if not changing." } }, required: ["search_title"] } } },

  { type: "function", function: { name: "delete_task", description: "Permanently delete a task. Trigger: 'احذفي مهمة', 'امسحي', 'مو محتاجها', 'cancel task', 'remove task'.", parameters: { type: "object", properties: { search_title: { type: "string", description: "Key words from the task title to find it." } }, required: ["search_title"] } } },

  { type: "function", function: { name: "update_event", description: "Edit an existing calendar event — reschedule, rename, change location. Trigger: 'غيّري الموعد', 'بدّلي وقت', 'عدّلي الاجتماع', 'reschedule meeting', 'change appointment'.", parameters: { type: "object", properties: { search_title: { type: "string", description: "Key words from the event title to find it." }, new_title: { type: "string", description: "New title (omit if not changing)." }, starts_at: { type: "string", description: "New start ISO datetime (omit if not changing). Use TODAY_ISO year." }, ends_at: { type: "string", description: "New end ISO datetime (omit if not changing)." }, location: { type: "string", description: "New location (omit if not changing)." } }, required: ["search_title"] } } },

  { type: "function", function: { name: "delete_event", description: "Permanently delete a calendar event. Trigger: 'احذفي الموعد', 'امسحي الاجتماع', 'cancel appointment', 'remove event', 'مو رايح', 'إلغاء الموعد'.", parameters: { type: "object", properties: { search_title: { type: "string", description: "Key words from the event title to find it." } }, required: ["search_title"] } } },

  { type: "function", function: { name: "update_habit", description: "Edit an existing habit — rename, change schedule, time, or pause/resume it. Trigger: 'غيّري العادة', 'بدّلي وقت العادة', 'أوقفي عادة', 'pause habit', 'change habit schedule'.", parameters: { type: "object", properties: { search_name: { type: "string", description: "Key words from the habit name to find it." }, new_name: { type: "string", description: "New name (omit if not changing)." }, frequency: { type: "string", enum: ["daily","weekly"], description: "Omit if not changing." }, target_days: { type: "array", items: { type: "integer", minimum: 0, maximum: 6 }, description: "New weekday indices (omit if not changing)." }, time_of_day: { type: "string", description: "New time HH:MM (omit if not changing)." }, is_active: { type: "boolean", description: "false = pause, true = resume." } }, required: ["search_name"] } } },

  { type: "function", function: { name: "delete_habit", description: "Permanently delete a habit. Trigger: 'احذفي العادة', 'مو أبي أتعود', 'remove habit', 'stop tracking habit'.", parameters: { type: "object", properties: { search_name: { type: "string", description: "Key words from the habit name to find it." } }, required: ["search_name"] } } },

  // ── Composite tools — smarter aggregation ────────────────────────────────────
  { type: "function", function: { name: "get_daily_plan", description: "Get a complete daily plan: today's tasks + events + active habits + recent mood in one call. Trigger: 'رتبي يومي', 'برنامجي اليوم', 'وش عندي اليوم', 'يومي', 'خلّيني أعرف يومي', 'plan my day', 'what's my day', 'daily plan', 'morning briefing', 'صباح الخير وش عندي'. ALWAYS use this instead of calling get_tasks+get_upcoming_events separately when user asks about their day.", parameters: { type: "object", properties: { include_mood: { type: "boolean", description: "Include recent mood context. Default true." } }, required: [] } } },

  // ── READ tools — Jood sees everything ──────────────────────────────────────
  { type: "function", function: { name: "get_portfolio", description: "Show the user's investment portfolio — stocks, crypto, real estate holdings, P&L. Trigger: 'اعرضي محفظتي', 'وش عندي استثمارات', 'كم سعر السهم', 'أسهمي', 'كريبتو', 'أرباحي', 'خسائري', 'كم ربحت', 'وش وضع الأسهم', 'show my portfolio', 'my investments', 'المحفظة', 'how are my stocks', 'crypto holdings', 'P&L', 'returns', 'asset allocation'. Also when user asks 'وش وضعي المالي بالكامل' call this + get_financial_summary.", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function", function: { name: "get_financial_summary", description: "Show financial summary — income, expenses, savings totals, recent transactions, budget status. Trigger: 'كم صرفت', 'وش وضعي المالي', 'ملخص مالي', 'المصاريف', 'الدخل', 'ميزانيتي', 'هل أنا ماشي زين مالياً', 'كم باقي من راتبي', 'تقرير مالي', 'فين تروح فلوسي', 'my finances', 'spending summary', 'how much did I spend', 'budget report', 'where is my money going', 'am I on budget', 'monthly report', 'expense breakdown', 'financial report'.", parameters: { type: "object", properties: { period: { type: "string", enum: ["week","month","year","all"], description: "Time period. Default 'month'." } }, required: [] } } },
  { type: "function", function: { name: "get_tasks", description: "Show user's tasks — pending, completed, overdue, or all. Trigger: 'وش مهامي', 'وش عندي اليوم', 'مهامي', 'أولوياتي', 'التاسكات', 'وش اللي لازم أسويه', 'عندي شي معلّق؟', 'وش ضاغطني', 'my tasks', 'to-do list', 'what do I have to do', 'my priorities', 'what's on my plate', 'pending items', 'action items', 'overdue tasks', 'what's left'. Also for morning briefing: 'وش برنامجي اليوم' → call get_tasks + get_upcoming_events.", parameters: { type: "object", properties: { status: { type: "string", enum: ["pending","completed","all"], description: "Filter. Default 'pending'." } }, required: [] } } },
  { type: "function", function: { name: "get_upcoming_events", description: "Show upcoming calendar events, meetings, appointments. Trigger: 'وش مواعيدي', 'اجتماعاتي', 'التقويم', 'جدولي', 'عندي شي بكرة؟', 'هل عندي تعارض', 'وش برنامج الأسبوع', 'فاضية متى؟', 'my events', 'my schedule', 'upcoming meetings', 'am I free on', 'what's my day look like', 'any conflicts', 'calendar this week', 'do I have anything tomorrow'.", parameters: { type: "object", properties: { days_ahead: { type: "number", description: "How many days ahead to look. Default 7." } }, required: [] } } },
  { type: "function", function: { name: "get_habits", description: "Show user's active habits, streaks, and today's tracking status. Trigger: 'عاداتي', 'وش عاداتي', 'التزامي', 'هل سويت عاداتي اليوم', 'نسبة التزامي', 'my habits', 'habit tracker', 'how consistent am I', 'did I complete my habits', 'daily routine check'.", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function", function: { name: "get_goals", description: "Show savings/financial goals with progress bars and percentages. Trigger: 'أهدافي', 'كم وصلت', 'التوفير', 'نسبة الإنجاز', 'كم باقي على الهدف', 'تقدمي', 'هل أنا على المسار', 'my goals', 'savings progress', 'how close am I', 'goal tracking', 'am I on track'.", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function", function: { name: "get_wallet_balance", description: "Show wallet/cash/account balance. Trigger: 'رصيدي', 'كم عندي', 'المحفظة النقدية', 'كم فلوسي', 'كم باقي عندي', 'الكاش', 'my balance', 'wallet', 'how much cash do I have', 'available funds', 'account balance'.", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function", function: { name: "get_recent_moods", description: "Show recent mood logs, trends, and patterns. Trigger: 'مزاجي', 'كيف كان مزاجي', 'وش مزاجي آخر فترة', 'هل أنا تعبان كثير', 'وضعي النفسي', 'mood history', 'how have I been feeling', 'mood trend', 'stress levels', 'emotional wellbeing', 'am I doing okay'.", parameters: { type: "object", properties: { days: { type: "number", description: "How many days to look back. Default 7." } }, required: [] } } },
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
    // ── Navigate to Section (Phase 4) ───────────────────────────────────────
    case 'navigate_to_section': {
      const sectionAr: Record<string, string> = {
        home: 'الرئيسية', chat: 'المحادثة', financial: 'المالية',
        planning: 'التخطيط', mood: 'المزاج', settings: 'الإعدادات',
      };
      const label = sectionAr[args.section] || args.section;
      return {
        kind: 'navigate' as any,
        summary: `تم، فتحت لك ${label} 📱`,
        data: { navigate_to: args.section },
      };
    }

    // ── Create Recurring Task (Phase 4) ───────────────────────────────────────
    case 'create_recurring_task': {
      const { error } = await supabase.from('tasks').insert({
        user_id: userId,
        title: args.title,
        priority: args.priority || 'medium',
        category: args.category || 'routine',
        status: 'pending',
        is_recurring: true,
        recurrence: args.recurrence,
        recurrence_day: args.recurrence_day ?? null,
        recurrence_time: args.time ?? null,
      });
      if (error) {
        // If is_recurring column doesn't exist, fall back to regular task with note
        const { error: fallbackErr } = await supabase.from('tasks').insert({
          user_id: userId,
          title: `🔄 ${args.title}`,
          priority: args.priority || 'medium',
          category: args.category || 'routine',
          status: 'pending',
          description: `متكررة: ${args.recurrence}${args.recurrence_day !== undefined ? ` يوم ${args.recurrence_day}` : ''}${args.time ? ` الساعة ${args.time}` : ''}`,
        });
        if (fallbackErr) throw new Error(`create_recurring_task: ${fallbackErr.message}`);
      }
      const freqAr = args.recurrence === 'daily' ? 'يومياً' : args.recurrence === 'weekly' ? 'أسبوعياً' : 'شهرياً';
      const timeNote = args.time ? ` الساعة ${args.time}` : '';
      return { kind: 'task', summary: `✓ سجّلت مهمة متكررة "${args.title}" — ${freqAr}${timeNote}`, data: args };
    }

    // ── Multi-Step Workflow (Phase 4) ─────────────────────────────────────────
    case 'multi_step_workflow': {
      const stepResults: string[] = [];
      const stepData: any[] = [];
      let needsApproval = false;
      let pendingSteps: any[] = [];

      for (const step of (args.steps || [])) {
        if (step.needs_approval) {
          // Queue remaining steps for approval
          needsApproval = true;
          pendingSteps = args.steps.slice(args.steps.indexOf(step));
          stepResults.push(`⏸ ${step.action}: يحتاج تأكيدك`);
          break;
        }
        try {
          const result = await executeFunction(
            { name: step.action, arguments: JSON.stringify(step.args) },
            userId,
            supabase,
          );
          if (!result.silent && result.summary) stepResults.push(result.summary);
          stepData.push(result);
        } catch (err: any) {
          stepResults.push(`✗ ${step.action}: ${err?.message || 'فشل'}`);
        }
      }

      const workflowSummary = `سير العمل: ${args.description}\n\n${stepResults.join('\n')}`;

      if (needsApproval) {
        return {
          kind: 'task',
          summary: workflowSummary + '\n\nنكمّل الباقي؟',
          data: { workflow: true, completed_steps: stepData, pending_steps: pendingSteps },
        };
      }

      return {
        kind: 'task',
        summary: workflowSummary,
        data: { workflow: true, completed_steps: stepData, all_done: true },
      };
    }

    // ── Update User Preferences (Phase 3) ────────────────────────────────────
    case 'update_user_preferences': {
      const updates: any = {};
      const changes: string[] = [];
      if (args.response_style) {
        updates.preferred_response_style = args.response_style;
        const styleAr: Record<string, string> = { concise: 'مختصر', balanced: 'متوازن', detailed: 'مفصّل' };
        changes.push(`أسلوب الرد: ${styleAr[args.response_style] || args.response_style}`);
      }
      if (args.jood_nickname) {
        updates.jood_nickname = args.jood_nickname;
        changes.push(`أناديك: ${args.jood_nickname}`);
      }
      if (args.voice_language) {
        updates.preferred_voice_language = args.voice_language;
        changes.push(`لغة الصوت: ${args.voice_language === 'ar' ? 'عربي' : args.voice_language === 'en' ? 'إنجليزي' : 'تلقائي'}`);
      }
      if (Object.keys(updates).length) {
        const { error } = await supabase.from('profiles').update(updates).eq('user_id', userId);
        if (error) throw new Error(`update_user_preferences: ${error.message}`);
      }
      return { kind: 'memory', summary: changes.length ? `✓ حدّثت تفضيلاتك: ${changes.join('، ')}` : 'ما فيه شي جديد.', data: args, silent: false };
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

    // ═════════════════════════════════════════════════════════════════════════
    // READ tools — Jood sees ALL user data
    // ═════════════════════════════════════════════════════════════════════════

    // ═══ COMPOSITE: Daily Plan (Phase 2) ═════════════════════════════════════
    case 'get_daily_plan': {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2).toISOString();
      const todayISO = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

      // Parallel fetch: tasks, events, habits, mood
      const [tasksRes, eventsRes, habitsRes, moodRes, overdueRes] = await Promise.all([
        supabase.from('tasks').select('title, status, priority, due_date, category')
          .eq('user_id', userId).eq('status', 'pending')
          .lte('due_date', todayISO)
          .order('priority', { ascending: false }).limit(10),
        supabase.from('events').select('title, starts_at, ends_at, location, category, all_day')
          .eq('user_id', userId).gte('starts_at', todayStart).lt('starts_at', tomorrowEnd)
          .order('starts_at', { ascending: true }).limit(10),
        supabase.from('habits').select('name, frequency, target_days, icon, time_of_day')
          .eq('user_id', userId).eq('is_active', true).order('time_of_day', { ascending: true }),
        args?.include_mood !== false
          ? supabase.from('mood_logs').select('mood_score, mood_label, created_at')
              .eq('user_id', userId).gte('created_at', new Date(now.getTime() - 3*24*60*60*1000).toISOString())
              .order('created_at', { ascending: false }).limit(3)
          : Promise.resolve({ data: [] }),
        supabase.from('tasks').select('title, due_date, priority')
          .eq('user_id', userId).eq('status', 'pending')
          .lt('due_date', todayISO)
          .order('due_date', { ascending: true }).limit(5),
      ]);

      const tasks = tasksRes.data || [];
      const events = eventsRes.data || [];
      const habits = habitsRes.data || [];
      const moods  = moodRes.data || [];
      const overdue = overdueRes.data || [];

      // Filter habits for today's day-of-week
      const todayDow = now.getDay(); // 0=Sun
      const todayHabits = habits.filter((h: any) => {
        if (h.frequency === 'daily') return true;
        if (h.frequency === 'weekly' && Array.isArray(h.target_days)) return h.target_days.includes(todayDow);
        return true;
      });

      const priorityIcon: any = { high: '🔴', medium: '🟡', low: '🟢' };
      const sections: string[] = [];

      // Overdue warning
      if (overdue.length) {
        sections.push(`⚠️ متأخر (${overdue.length}):\n` + overdue.map((t: any) => `${priorityIcon[t.priority]||'⚪'} ${t.title}`).join('\n'));
      }

      // Events timeline
      if (events.length) {
        const evLines = events.map((e: any) => {
          if (e.all_day) return `📅 ${e.title} (طول اليوم)${e.location ? ` 📍${e.location}` : ''}`;
          const time = new Date(e.starts_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
          return `📅 ${time} — ${e.title}${e.location ? ` 📍${e.location}` : ''}`;
        });
        sections.push(`مواعيدك اليوم:\n${evLines.join('\n')}`);
      }

      // Today's tasks
      if (tasks.length) {
        const taskLines = tasks.map((t: any) => `${priorityIcon[t.priority]||'⚪'} ${t.title}`);
        sections.push(`مهامك اليوم (${tasks.length}):\n${taskLines.join('\n')}`);
      }

      // Habits
      if (todayHabits.length) {
        const habLines = todayHabits.map((h: any) => {
          const time = h.time_of_day ? ` (${h.time_of_day})` : '';
          return `${h.icon||'⭐'} ${h.name}${time}`;
        });
        sections.push(`عاداتك اليوم:\n${habLines.join('\n')}`);
      }

      // Mood context
      let moodNote = '';
      if (moods.length) {
        const avg = moods.reduce((s: number, m: any) => s + Number(m.mood_score), 0) / moods.length;
        if (avg <= 4) moodNote = '\n💙 مزاجك كان منخفض مؤخراً — خذها بالراحة اليوم.';
        else if (avg >= 8) moodNote = '\n✨ مزاجك ممتاز — يوم موفّق إن شاء الله!';
      }

      if (!sections.length) {
        return { kind: 'task', summary: `يومك فاضي الحين — ما عندك مهام ولا مواعيد. تبي نضيف شي؟${moodNote}`, data: { tasks: [], events: [], habits: [], overdue: [] } };
      }

      return {
        kind: 'task',
        summary: `خل نشوف يومك:\n\n${sections.join('\n\n')}${moodNote}`,
        data: { tasks, events, habits: todayHabits, moods, overdue, counts: { tasks: tasks.length, events: events.length, habits: todayHabits.length, overdue: overdue.length } },
      };
    }

    case 'get_portfolio': {
      const { data: holdings } = await supabase.from('portfolio_holdings')
        .select('symbol, market, quantity, avg_price, current_price, currency, asset_type, is_crypto')
        .eq('user_id', userId).order('created_at', { ascending: false });
      if (!holdings?.length) return { kind: 'portfolio', summary: 'محفظتك الاستثمارية فاضية حالياً. تبي تضيف استثمار؟', data: { holdings: [] } };
      let totalValue = 0;
      const lines = holdings.map((h: any) => {
        const price = Number(h.current_price || h.avg_price || 0);
        const qty = Number(h.quantity || 0);
        const value = qty * price;
        totalValue += value;
        const pnl = h.current_price && h.avg_price ? ((h.current_price - h.avg_price) / h.avg_price * 100).toFixed(1) : null;
        const typeLabel = h.is_crypto ? 'كريبتو' : (h.asset_type === 'real_estate' ? 'عقار' : 'سهم');
        return `• ${h.symbol} (${typeLabel}): ${qty} × ${fmt(price)} ${h.currency} = ${fmt(value)} ${h.currency}${pnl ? ` (${Number(pnl) >= 0 ? '+' : ''}${pnl}%)` : ''}`;
      });
      return { kind: 'portfolio', summary: `محفظتك الاستثمارية:\n${lines.join('\n')}\n\nإجمالي القيمة: ${fmt(totalValue)} ريال`, data: { holdings, total_value: totalValue } };
    }

    case 'get_financial_summary': {
      const period = args?.period || 'month';
      const now = new Date();
      let startDate: string;
      if (period === 'week') { const d = new Date(now); d.setDate(d.getDate() - 7); startDate = d.toISOString(); }
      else if (period === 'year') { startDate = new Date(now.getFullYear(), 0, 1).toISOString(); }
      else if (period === 'all') { startDate = '2000-01-01T00:00:00Z'; }
      else { startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString(); }

      // Fetch current period + previous period for trend analysis (parallel)
      const prevStart = period === 'month'
        ? new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
        : period === 'week'
          ? new Date(now.getTime() - 14*24*60*60*1000).toISOString()
          : null;

      const [currentRes, prevRes] = await Promise.all([
        supabase.from('financial_data')
          .select('type, amount, currency, category, note, label, created_at')
          .eq('user_id', userId).gte('created_at', startDate)
          .order('created_at', { ascending: false }).limit(50),
        prevStart
          ? supabase.from('financial_data')
              .select('type, amount')
              .eq('user_id', userId).gte('created_at', prevStart).lt('created_at', startDate)
          : Promise.resolve({ data: [] }),
      ]);

      const entries = currentRes.data || [];
      if (!entries?.length) return { kind: 'finance', summary: 'ما عندك معاملات مالية في هالفترة.', data: { totals: {}, entries: [] } };
      const totals: any = { income: 0, expense: 0, savings: 0, investment: 0 };
      entries.forEach((e: any) => { const t = e.type as string; if (totals[t] !== undefined) totals[t] += Number(e.amount); });
      const net = totals.income - totals.expense;
      const periodAr = period === 'week' ? 'هالأسبوع' : period === 'year' ? 'هالسنة' : period === 'all' ? 'الكل' : 'هالشهر';

      // Category breakdown (top 3 expense categories)
      const catTotals: Record<string, number> = {};
      entries.filter((e: any) => e.type === 'expense').forEach((e: any) => {
        const cat = e.category || e.label || e.note || 'أخرى';
        catTotals[cat] = (catTotals[cat] || 0) + Number(e.amount);
      });
      const topCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 3);
      const catBreakdown = topCats.length
        ? '\n\n📊 أعلى المصاريف:\n' + topCats.map(([cat, amt]) => `• ${cat}: ${fmt(amt)} ريال`).join('\n')
        : '';

      // Trend analysis vs previous period
      let trendNote = '';
      const prevEntries = prevRes.data || [];
      if (prevEntries.length && (period === 'month' || period === 'week')) {
        const prevTotals: any = { income: 0, expense: 0 };
        prevEntries.forEach((e: any) => { if (prevTotals[e.type] !== undefined) prevTotals[e.type] += Number(e.amount); });
        if (prevTotals.expense > 0) {
          const expChange = ((totals.expense - prevTotals.expense) / prevTotals.expense * 100).toFixed(0);
          const prevPeriodAr = period === 'week' ? 'الأسبوع اللي قبل' : 'الشهر اللي قبل';
          if (Number(expChange) > 10) trendNote = `\n\n📈 مصاريفك زادت ${expChange}% مقارنة بـ${prevPeriodAr}`;
          else if (Number(expChange) < -10) trendNote = `\n\n📉 مصاريفك نقصت ${Math.abs(Number(expChange))}% عن ${prevPeriodAr} — ممتاز!`;
        }
      }

      const recent = entries.slice(0, 5).map((e: any) => {
        const typeAr = e.type === 'income' ? '💰 دخل' : e.type === 'savings' ? '🏦 ادخار' : e.type === 'investment' ? '📈 استثمار' : '💸 مصروف';
        return `${typeAr}: ${fmt(Number(e.amount))} ${e.currency} — ${e.category || e.label || e.note || ''}`;
      }).join('\n');
      return { kind: 'finance', summary: `ملخصك المالي ${periodAr}:\n💰 دخل: ${fmt(totals.income)} ريال\n💸 مصاريف: ${fmt(totals.expense)} ريال\n🏦 ادخار: ${fmt(totals.savings)} ريال\n📈 استثمار: ${fmt(totals.investment)} ريال\n📊 صافي: ${fmt(net)} ريال${catBreakdown}${trendNote}\n\nآخر المعاملات:\n${recent}`, data: { totals, entries: entries.slice(0, 10), period, top_categories: topCats, trend: trendNote ? 'changed' : 'stable' } };
    }

    case 'get_tasks': {
      const statusFilter = args?.status || 'pending';
      let query = supabase.from('tasks').select('title, status, priority, due_date, category, description, created_at').eq('user_id', userId);
      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      const { data: tasks } = await query.order('due_date', { ascending: true }).limit(20);
      if (!tasks?.length) return { kind: 'task', summary: statusFilter === 'pending' ? 'ما عندك مهام معلّقة الحين 🎉' : 'ما لقيت مهام.', data: { tasks: [] } };
      const priorityIcon: any = { high: '🔴', medium: '🟡', low: '🟢' };
      const lines = tasks.map((t: any) => {
        const icon = priorityIcon[t.priority] || '⚪';
        const dateStr = t.due_date ? new Date(t.due_date + 'T12:00:00').toLocaleDateString('ar-SA', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
        const done = t.status === 'completed' ? ' ✅' : '';
        return `${icon} ${t.title}${dateStr ? ` — ${dateStr}` : ''}${done}`;
      }).join('\n');
      return { kind: 'task', summary: `مهامك (${statusFilter === 'pending' ? 'معلّقة' : statusFilter === 'completed' ? 'مكتملة' : 'الكل'}):\n${lines}`, data: { tasks, count: tasks.length } };
    }

    case 'get_upcoming_events': {
      const daysAhead = args?.days_ahead || 7;
      const now = new Date();
      const end = new Date(now); end.setDate(end.getDate() + daysAhead);
      const { data: events } = await supabase.from('events')
        .select('title, starts_at, ends_at, location, category, all_day, description')
        .eq('user_id', userId).gte('starts_at', now.toISOString()).lte('starts_at', end.toISOString())
        .order('starts_at', { ascending: true }).limit(15);
      if (!events?.length) return { kind: 'event', summary: `ما عندك مواعيد قادمة خلال ${daysAhead} أيام.`, data: { events: [] } };
      const lines = events.map((e: any) => {
        const dt = new Date(e.starts_at).toLocaleDateString('ar-SA', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const loc = e.location ? ` 📍 ${e.location}` : '';
        return `📅 ${e.title} — ${dt}${loc}`;
      }).join('\n');
      return { kind: 'event', summary: `مواعيدك القادمة:\n${lines}`, data: { events, count: events.length } };
    }

    case 'get_habits': {
      const { data: habits } = await supabase.from('habits')
        .select('name, frequency, target_days, icon, is_active, time_of_day')
        .eq('user_id', userId).eq('is_active', true).order('created_at', { ascending: true });
      if (!habits?.length) return { kind: 'task', summary: 'ما عندك عادات مسجّلة. تبي تضيف عادة جديدة؟', data: { habits: [] } };
      const dayNames = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
      const lines = habits.map((h: any) => {
        const freq = h.frequency === 'weekly' && h.target_days?.length ? h.target_days.map((d: number) => dayNames[d]).join('، ') : (h.frequency === 'daily' ? 'يومياً' : 'أسبوعياً');
        const time = h.time_of_day ? ` الساعة ${h.time_of_day}` : '';
        return `${h.icon || '⭐'} ${h.name} — ${freq}${time}`;
      }).join('\n');
      return { kind: 'task', summary: `عاداتك النشطة:\n${lines}`, data: { habits, count: habits.length } };
    }

    case 'get_goals': {
      const { data: goals } = await supabase.from('goals')
        .select('title, target_amount, saved_amount, progress, target_date, status')
        .eq('user_id', userId).order('created_at', { ascending: false });
      if (!goals?.length) return { kind: 'goal', summary: 'ما عندك أهداف توفير مسجّلة. تبي تحط هدف؟', data: { goals: [] } };
      const lines = goals.map((g: any) => {
        const saved = Number(g.saved_amount || 0);
        const target = Number(g.target_amount || 1);
        const pct = Math.round((saved / target) * 100);
        const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
        const statusIcon = g.status === 'completed' ? '✅' : g.status === 'paused' ? '⏸️' : '🎯';
        const dateStr = g.target_date ? ` — بحلول ${new Date(g.target_date).toLocaleDateString('ar-SA', { month: 'short', year: 'numeric' })}` : '';
        return `${statusIcon} ${g.title}: ${fmt(saved)}/${fmt(target)} ريال [${bar}] ${pct}%${dateStr}`;
      }).join('\n');
      return { kind: 'goal', summary: `أهدافك:\n${lines}`, data: { goals, count: goals.length } };
    }

    case 'get_wallet_balance': {
      const { data: wallets } = await supabase.from('wallets')
        .select('balance, currency').eq('user_id', userId);
      if (!wallets?.length) return { kind: 'finance', summary: 'ما لقيت محفظة نقدية. رصيدك الحالي: 0 ريال.', data: { balance: 0 } };
      const lines = wallets.map((w: any) => `💳 ${fmt(Number(w.balance))} ${w.currency}`).join('\n');
      const total = wallets.reduce((s: number, w: any) => s + Number(w.balance), 0);
      return { kind: 'finance', summary: `رصيدك النقدي:\n${lines}\nالإجمالي: ${fmt(total)} ريال`, data: { wallets, total } };
    }

    case 'get_recent_moods': {
      const daysBack = args?.days || 7;
      const since = new Date(); since.setDate(since.getDate() - daysBack);
      const { data: moods } = await supabase.from('mood_logs')
        .select('mood_score, mood_label, note, created_at')
        .eq('user_id', userId).gte('created_at', since.toISOString())
        .order('created_at', { ascending: false }).limit(14);
      if (!moods?.length) return { kind: 'task', summary: `ما سجّلت مزاجك خلال آخر ${daysBack} أيام. كيف حالك اليوم؟`, data: { moods: [] } };
      const avg = moods.reduce((s: number, m: any) => s + Number(m.mood_score), 0) / moods.length;
      const lines = moods.slice(0, 5).map((m: any) => {
        const dt = new Date(m.created_at).toLocaleDateString('ar-SA', { weekday: 'short', day: 'numeric' });
        return `${m.mood_label} (${m.mood_score}/10) — ${dt}${m.note ? `: ${m.note}` : ''}`;
      }).join('\n');
      return { kind: 'task', summary: `مزاجك آخر ${daysBack} أيام (المعدل: ${avg.toFixed(1)}/10):\n${lines}`, data: { moods, average: avg } };
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
  return voiceMode ? `${preview}. نمشي فيها؟` : `حاب أسجّل لك: **${preview}**\n\nنمشي؟ قول **تمام** أو **لا**.`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  let stage = 'init';
  try {
    stage = 'parse_body';
    const { message, context, mode, pendingFunction, voice_mode = false, detected_language = "ar" } = await req.json();
    if (!message) throw new Error('Message is required');

    // ── Input length guard — prevent abuse / prompt stuffing ─────────────
    if (typeof message === 'string' && message.length > 4000) {
      return new Response(
        JSON.stringify({ error: 'Message too long (max 4000 chars)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    stage = 'env_check';
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) throw new Error('OpenAI API key not configured');

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Auth — require valid user; reject unauthenticated calls
    stage = 'auth';
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const token = authHeader.replace("Bearer ", "");
    try {
      const { data: userData } = await supabaseClient.auth.getUser(token);
      if (userData?.user) userId = userData.user.id;
    } catch { /* token invalid */ }
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Profile + memory taxonomy (parallel for speed) — non-fatal
    stage = 'profile';
    let userContext = "مستخدم سعودي";
    let workingDays: number[] = [0,1,2,3,4]; // Sun-Thu (Saudi default)
    let weekendDays: number[] = [5,6];       // Fri-Sat
    let knownFacts = "";
    let missingCategories: string[] = [];
    let genderForPrompt: string | null = null;
    let preferredStyle = 'balanced'; // concise | balanced | detailed
    let joodNickname = '';
    if (userId) {
      try {
        const [profileRes, taxonomyRes] = await Promise.all([
          supabaseClient.from('profiles')
            .select('display_name, gender, phone, city, date_of_birth, bio, base_currency, working_days, weekend_days, preferred_response_style, preferred_voice_language, jood_nickname')
            .eq('user_id', userId).maybeSingle(),
          supabaseClient.rpc('get_memory_taxonomy', { p_user_id: userId })
            .then((r: any) => r).catch(() => ({ data: [] })),
        ]);
        const profile = profileRes?.data;
        genderForPrompt = profile?.gender ?? null;
        preferredStyle = profile?.preferred_response_style || 'balanced';
        joodNickname = profile?.jood_nickname || '';
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
        const ALL_CATS = Object.keys(CAT_AR);
        const filledCats = new Set<string>();
        const filled: string[] = [];
        for (const row of taxonomy) {
          filledCats.add(row.category);
          if (row.filled_count > 0 && row.latest_real_content) {
            filled.push(`• ${CAT_AR[row.category] ?? row.category}: ${row.latest_real_content}`);
          }
        }
        // Find truly missing categories (no memories at all)
        for (const cat of ALL_CATS) {
          if (!filledCats.has(cat)) missingCategories.push(CAT_AR[cat]);
        }
        if (filled.length) knownFacts = "\n\nما تعرفينه عن المستخدم:\n" + filled.join('\n');

        // Bump use_count on referenced memories (fire-and-forget for speed)
        if (filled.length) {
          supabaseClient.from('user_memories')
            .update({ last_used_at: new Date().toISOString(), use_count: 1 }) // use_count will be incremented via trigger or next iteration
            .eq('user_id', userId).eq('active', true).eq('is_template', false)
            .then(() => {}).catch(() => {}); // non-fatal
        }
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
    const CONFIRM_WORDS = ['yes','confirm','ok','sure','نعم','تأكيد','تمام','ماشي','صح','أكيد','سم','يلا','نمشي','امشي','طيب','اي','ايه','يب'];
    const CANCEL_WORDS = ['no','cancel','لا','إلغاء','الغي','خلاص','لا خلاص','وقف','كنسل','الغها'];
    const msgLower = String(message).toLowerCase().trim();
    const isConfirmation = CONFIRM_WORDS.includes(msgLower);
    const isCancel = CANCEL_WORDS.includes(msgLower);
    const shouldCommit = mode === 'commit' || (isConfirmation && pendingFunction);

    // Auto-detect language from message text when not provided by Whisper
    const autoDetectLang = (text: string): 'ar' | 'en' | 'mixed' => {
      const arabicRe = /[؀-ۿ]/;
      const latinRe = /[a-zA-Z]{2,}/;
      const hasArabic = arabicRe.test(text);
      const hasLatin = latinRe.test(text);
      if (hasArabic && hasLatin) return 'mixed';
      if (hasLatin && !hasArabic) return 'en';
      return 'ar';
    };
    const effectiveLang = detected_language !== "ar" ? detected_language : autoDetectLang(message);
    const respondInEnglish = effectiveLang === "en";
    const respondMixed = effectiveLang === "mixed";

    // ── Response Mode Classifier (Phase 2) ────────────────────────────────────
    type ResponseMode = 'command' | 'conversation' | 'finance' | 'mood' | 'planning';
    const classifyMode = (msg: string): ResponseMode => {
      const m = msg.toLowerCase().trim();
      // Planning mode
      if (/رتبي يومي|نظمي|برنامجي|وش عندي اليوم|خلّيني أعرف يومي|plan my day|daily plan|morning brief|صباح.*عندي|يومي شكل/i.test(m)) return 'planning';
      // Finance mode
      if (/صرفت|راتب|مصاريف|ميزاني|محفظ|استثمار|أسهم|كريبتو|رصيد|فلوس|دخل|وضعي المالي|كم عندي|finances|budget|portfolio|spent|salary|invest|balance|wallet/i.test(m)) return 'finance';
      // Mood mode
      if (/مزاج|تعبان|مبسوط|حاس|ضغط|قلق|stressed|happy|tired|feeling|mood|يومي.*صعب|مرتاح|منهك|حماس/i.test(m)) return 'mood';
      // Command mode — action verbs
      if (/سجل|أضيف|ذكر|احذف|عدل|غير|بدل|حط|add|log|remind|delete|update|remove|create|schedule|book|record|سوي لي|حطي/i.test(m)) return 'command';
      return 'conversation';
    };
    const responseMode: ResponseMode = classifyMode(String(message));

    // ── Mood-Aware Context (Phase 2) ────────────────────────────────────────
    let recentMoodContext = '';
    if (userId && responseMode !== 'mood') {
      try {
        const since = new Date(new Date().getTime() - 2*24*60*60*1000).toISOString();
        const { data: recentMoods } = await supabaseClient.from('mood_logs')
          .select('mood_score, mood_label')
          .eq('user_id', userId).gte('created_at', since)
          .order('created_at', { ascending: false }).limit(2);
        if (recentMoods?.length) {
          const avgMood = recentMoods.reduce((s: number, m: any) => s + Number(m.mood_score), 0) / recentMoods.length;
          if (avgMood <= 3) recentMoodContext = '\n⚠️ مزاج المستخدم منخفض مؤخراً — كوني لطيفة وخففي عليه. لا تضغطي بالمهام.';
          else if (avgMood <= 5) recentMoodContext = '\n💙 المستخدم مزاجه متوسط — كوني دافئة وشجّعيه.';
          else if (avgMood >= 9) recentMoodContext = '\n✨ مزاج المستخدم ممتاز — شاركيه الحماس!';
        }
      } catch { /* non-fatal */ }
    }

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
    // Mode-specific instructions (Phase 2: per-mode tuning)
    const responseModeHint: Record<ResponseMode, string> = {
      command: '🎯 وضع أوامر: المستخدم يبي تنفيذ — نفّذي فوراً + تأكيد مختصر. لا تطوّلي.',
      conversation: '💬 وضع محادثة: المستخدم يبي يتكلم — كوني دافئة ومهتمة. اسألي سؤال متابعة ذكي.',
      finance: '💰 وضع مالي: ابدئي بالأرقام والبيانات، ثم تحليل مختصر. لا تنصحي بالشراء/البيع أبداً.',
      mood: '💙 وضع مزاج: كوني حنونة وطبيعية. سجّلي المزاج إذا واضح. اقترحي شي يساعد بلطف.',
      planning: '📋 وضع تخطيط: استخدمي get_daily_plan واعرضي اليوم بشكل مرتّب بالوقت. رتبي الأولويات.',
    };

    const modeRules = voice_mode
      ? `وضع صوتي — قواعد صارمة:
• ردّي بالعربي السعودي دائماً حتى لو المستخدم تكلم إنجليزي (إلا لو قال صراحة "English please")
• جملة وحدة أو جملتين بالكثير (≤15 كلمة)
• ممنوع markdown أو نجوم أو رموز
• استخدمي عبارات جود: "سم"، "تم"، "سوّيتها لك"، "تأمر"
• كوني طبيعية كأنك تتكلمين بالتلفون مع مديرك
${responseModeHint[responseMode]}`
      : `وضع نص: يمكنكِ markdown وقوائم. ردودك موجزة ولطيفة.
${responseModeHint[responseMode]}`;

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

    const SYSTEM = `أنتِ جود — سكرتيرة تنفيذية سعودية ذكية من الرياض. مو شات بوت — أنتِ سكرتيرة شخصية محترفة تعرفين كل شي عن حياة المستخدم.

═══ الروح والشخصية ═══
أنتِ سكرتيرة سعودية بنت الرياض — كلامك طبيعي وعفوي زي ما السكرتيرة تكلم مديرها بالمكتب:

🗣️ عبارات جود الأساسية (استخدميها بشكل طبيعي ومتنوع):
التحية والاستقبال:
• "سم" / "سم، تفضل" — أول رد على أي طلب
• "هلا والله" / "أهلين" — رد على السلام
• "نورت يا طويل العمر" — لما يرجع بعد غياب
• "حيّاك الله" — ترحيب رسمي

تأكيد الأوامر والتنفيذ:
• "تأمر أمر طال عمرك" — بعد ما تنفذين طلب
• "سوّيتها لك" / "تم يا طويل العمر"
• "خلاص مسجّل عندي" / "خلاص حطيتها لك"
• "على راسي" / "يصير خير"
• "تم الطلب" / "جاهز"
• "إن شاء الله ما يقصر عليك"

الاقتراحات والعرض:
• "وش ودّك نسوّي؟" — سؤال مفتوح
• "تبي أرتّب لك يومك؟" / "حاب أرتّب لك جدولك؟"
• "تبي أسجّل لك موعد؟" / "حاب أحجز لك؟"
• "تبي نشوف وضعك المالي؟"
• "أشوف عندك كم شغلة — تبي أرتبها لك؟"
• "خل نشوف وش عندك اليوم"

المتابعة:
• "شي ثاني؟" / "تبي شي ثاني طال عمرك؟"
• "عندك شي زيادة؟"
• "أي خدمة ثانية؟"
• "تأمر على شي؟"

التعاطف والدعم:
• "الله يعينك" / "الله يوفقك"
• "ما شاء الله عليك" — لما ينجز شي
• "يا حليلك" — تعاطف خفيف
• "الله يسهّلها عليك"
• "توكل على الله وكل شي بيتيسر"

الإلغاء والرفض:
• "لا يهمك، ما سجّلت شي" — لما يلغي
• "زين ما سوّينا شي — وش تبي بداله؟"
• "تمام، ألغيناها. وش ودّك نسوّي؟"

${genderRule}

═══ قواعد اللغة الصارمة ═══
🔴 القاعدة الأهم: ردّي دائماً بالعربية السعودية (اللهجة النجدية/الخليجية) إلا إذا المستخدم كتب/تكلم إنجليزي بالكامل.
• لو المستخدم يخلط عربي-إنجليزي → ردّي بالعربي مع مصطلحات إنجليزية طبيعية
• لو المستخدم يتكلم إنجليزي كامل → ردّي إنجليزي بنبرة مهنية ودافئة
• ممنوع الفصحى الثقيلة — لا تقولي "بالتأكيد سيدي" أو "حسناً سأقوم بذلك" — قولي "سم" أو "تم"
• ممنوع تبدئي بـ "بالطبع" أو "بالتأكيد" أو "Sure" — ابدئي بالمضمون أو "سم"
${langRule}

═══ أسلوب الرد ═══
${preferredStyle === 'concise' ? '⚡ المستخدم يفضّل الإيجاز — ردودك أقصر ما يمكن، بدون شرح زيادة.' : preferredStyle === 'detailed' ? '📖 المستخدم يفضّل التفصيل — وسّعي شوي بالشرح والتحليل.' : ''}
${joodNickname ? `المستخدم يناديك "${joodNickname}" بدال جود.` : ''}
${modeRules}
• كل رد مختصر — جملتين أو ثلاث بالكثير + سؤال متابعة أو اقتراح واحد
• لا تكرري بيانات المستخدم اللي هو يعرفها — أعطيه الجديد بس
• ابدئي بالمضمون مباشرة — لا مقدمات طويلة
• خلّي ردودك حلوة ولطيفة — زي سكرتيرة تحب شغلها

═══ ذكاء السكرتيرة ═══

📊 الطلبات المركّبة:
• "وش وضعي اليوم" / "خلّيني أعرف يومي" / "رتبي يومي" / "صباح الخير" → get_daily_plan (أداة واحدة تجيب كل شي)
• "وش وضعي المالي" / "كيف فلوسي" → get_financial_summary + get_portfolio + get_goals + get_wallet_balance
• "اعطني تقرير شامل" → get_tasks + get_upcoming_events + get_financial_summary + get_habits
• "كيف حالي" → get_recent_moods + get_habits + get_goals
• "جاهز للأسبوع الجاي؟" → get_tasks + get_upcoming_events(days_ahead=7)

🔗 ربط البيانات:
• "هل أقدر أصرف X ريال" → get_wallet_balance + get_financial_summary
• "هل أنا ماشي صح" → get_goals + get_financial_summary
• "كيف إنتاجيتي" → get_tasks(status=completed) + get_habits
• مزاج متدني + مهام كثيرة → نبّهي بلطف

🧭 التنقل في التطبيق:
• "وديني للمالية" / "فتحي الإعدادات" / "ابي أشوف المهام" → navigate_to_section
• "ورّيني المزاج" → navigate_to_section(mood)

🔄 المهام المتكررة:
• "كل يوم ذكرني أشرب ماي" → create_recurring_task(daily)
• "كل أحد راجعي ميزانيتي" → create_recurring_task(weekly, day=0)

🔗 سير عمل متعدد:
• "رتّبي كل شي لبكرة" → multi_step_workflow: get_daily_plan + get_tasks
• "سجّلي مصروف ١٠٠ وبعدين ورّيني الملخص" → add_financial_entry ثم get_financial_summary

🎯 الذكاء الاستباقي:
• مهام متأخرة → "أشوف عندك ٣ مهام فاتت — تبي نرتبها؟"
• مصاريف > دخل → "مصاريفك هالشهر زايدة — تبي نراجع الميزانية؟"
• تعارض مواعيد → "لحظة، عندك شي في نفس الوقت"
• مصروف كبير → "هذا مبلغ كبير — تبي نشوف تأثيره على هدفك؟"

═══ القدرات ═══
📖 قراءة: محفظة استثمارية · ملخص مالي · مهام · مواعيد · عادات · أهداف توفير · رصيد · مزاج · خطة اليوم
✍️ كتابة مباشرة: مهام · عادات · مزاج · تعديل/حذف أي شي · تفضيلات المستخدم · مهام متكررة
✍️ مع تأكيد: مواعيد جديدة · معاملات مالية جديدة · إيميل · واتساب
🧭 تحكم: تنقّل بين أقسام التطبيق (navigate_to_section) · سير عمل متعدد الخطوات (multi_step_workflow)

⚡ قاعدة ذهبية: لا تقولي أبداً "ما عندي معلومات" — استعلمي بالأداة المناسبة أولاً. لو البيانات فاضية: "ما لقيت شي مسجّل — تبي نضيف؟"

═══ السياق ═══
اليوم ${TODAY} (${TODAY_ISO}) · ${userContext}
أسبوع العمل: ${workDaysAr} · الإجازة: ${weekendAr}
احترمي أيام العمل والإجازة في الجدولة.${recentMoodContext}${knownFacts}${missingHint}

═══ ذكاء التاريخ ═══
• التاريخ: ${TODAY_ISO} · السنة: ${TODAY_ISO.slice(0,4)}
• بدون تاريخ → اليوم · "بكرة" → +1 يوم · "الأسبوع الجاي" → +7 أيام
• "نهاية الأسبوع" → أقرب جمعة/سبت · "الشهر الجاي" → +شهر
• السنة ${TODAY_ISO.slice(0,4)} دائماً ما لم يُحدد غيرها

═══ قواعد الأدوات ═══
• get_* → نفّذي فوراً + تحليل مختصر + اقتراح
• مهام/عادات/مزاج/تعديل/حذف → نفّذي فوراً + "تم" أو "سوّيتها لك"
• مواعيد جديدة/إيميل/واتساب/مالية جديدة → اعرضي ملخص + "تبي أسجّلها؟" أو "نمشي؟"
• طلبات متعددة (مثل ٥ صلوات) → استدعي الأداة لكل وحدة
• عادات بأيام محددة → frequency=weekly مع target_days (0=الأحد, 6=السبت)
• وقت عادة → time_of_day بصيغة HH:MM
• تفاصيل ناقصة → اسألي قبل التنفيذ — لا تخمّني`;



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
      max_tokens: voice_mode
        ? (responseMode === 'command' ? 80 : responseMode === 'planning' ? 250 : 150)
        : isSimple ? 350
        : responseMode === 'finance' || responseMode === 'planning' ? 1500
        : 1200,
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
      assistantMessage = "لا يهمك، ما سوّيت شي. وش ودّك نسوّي؟";
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
      assistantMessage = "سم، تفضل — وش ودّك نسوّي؟";
    }

    // ── Usage Pattern Tracking (Phase 3) — fire-and-forget ───────────────────
    if (userId && !isCancel) {
      const hour = new Date().getHours();
      const timeSlot = hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';
      // Upsert pattern — increment hit_count if exists
      supabaseClient.from('usage_patterns')
        .upsert({
          user_id: userId,
          pattern_type: 'time_slot',
          pattern_key: `${timeSlot}_${responseMode}`,
          pattern_value: { time_slot: timeSlot, response_mode: responseMode, hour },
          hit_count: 1,
          last_seen_at: new Date().toISOString(),
        }, { onConflict: 'user_id,pattern_type,pattern_key', ignoreDuplicates: false })
        .then(({ error }: any) => {
          if (error) {
            // Fallback: just insert (upsert might fail if no unique constraint yet)
            supabaseClient.from('usage_patterns').insert({
              user_id: userId,
              pattern_type: 'time_slot',
              pattern_key: `${timeSlot}_${responseMode}`,
              pattern_value: { time_slot: timeSlot, response_mode: responseMode, hour },
            }).then(() => {}).catch(() => {});
          }
        })
        .catch(() => {}); // Non-fatal, fire and forget
    }

    // ── Proactive Suggestions (Phase 3) ───────────────────────────────────────
    // If user said something vague like "hi" or "صباح الخير", suggest based on time
    if (responseMode === 'conversation' && !pendingFunction && !shouldCommit) {
      const hour = new Date().getHours();
      const greetingRe = /^(صباح الخير|مساء الخير|هلا|أهلا|السلام عليكم|مرحبا|hello|hi|hey|good morning|good evening)/i;
      if (greetingRe.test(String(message).trim())) {
        // Morning = suggest daily plan, Evening = suggest mood log
        if (hour >= 5 && hour < 12 && !/يومي|عندي/.test(assistantMessage)) {
          assistantMessage += '\n\nتبي أرتّب لك يومك؟ 📋';
        } else if (hour >= 20 && !/مزاج/.test(assistantMessage)) {
          assistantMessage += '\n\nكيف كان يومك؟ تبي تسجّل مزاجك؟ 💙';
        }
      }
    }

    // Emotion hint (Phase 2: mode-aware)
    stage = 'emotion';
    let suggestedEmotion = "neutral";
    if (responseMode === 'mood' || /متوتر|ضغط|قلق|stressed|تعبان|يعينك|حليلك/i.test(assistantMessage)) suggestedEmotion = "empathetic";
    else if (responseMode === 'command' || /ممتاز|رائع|great|excellent|يلا|ما شاء الله/i.test(assistantMessage)) suggestedEmotion = "warm";
    else if (responseMode === 'finance' || /استثمار|محفظة|invest|portfolio|ريال|مصاريف/i.test(assistantMessage)) suggestedEmotion = "confident";
    else if (responseMode === 'planning') suggestedEmotion = "confident";

    return new Response(JSON.stringify({
      message: assistantMessage,
      function_results: functionResults,
      action_card: actionCard,
      mode: shouldCommit ? 'commit' : 'conversation',
      response_mode: responseMode,
      voice_mode,
      auto_listen: voice_mode && !assistantMessage.includes('؟') && responseMode === 'command',
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
        message: "عذراً طال عمرك، صار شي بسيط عندي. عيد السؤال مرة ثانية لو سمحت.",
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
