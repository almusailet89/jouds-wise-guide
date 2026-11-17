// Gemini Live function declarations for Jood's voice tools.
// Implementations live in ./agent-tools.ts. Destructive tools (delete_*) are
// intentionally left out of voice: a misheard word should never erase data.

export const LIVE_TOOL_NAMES = new Set([
  "get_daily_briefing",
  "get_tasks",
  "get_financial_summary",
  "get_schedule",
  "check_availability",
  "get_goals",
  "get_mood_history",
  "add_task",
  "update_task",
  "add_financial_entry",
  "add_event",
  "update_event",
  "log_mood",
  "remember",
]);

const str = (description: string) => ({ type: "STRING", description });
const num = (description: string) => ({ type: "NUMBER", description });
const bool = (description: string) => ({ type: "BOOLEAN", description });

export const LIVE_FUNCTION_DECLARATIONS = [
  {
    name: "get_daily_briefing",
    description: "Today's overview for the user: open tasks, upcoming events, habits, recent mood, finances and saved memories. Call this at the start of a conversation or when the user asks how their day looks.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "get_tasks",
    description: "List the user's tasks.",
    parameters: { type: "OBJECT", properties: { status: str("pending | in_progress | completed. Default pending.") } },
  },
  {
    name: "get_financial_summary",
    description: "The user's recent income, expenses and savings.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "get_schedule",
    description: "The user's upcoming calendar events.",
    parameters: { type: "OBJECT", properties: { days_ahead: num("How many days ahead to look. Default 7.") } },
  },
  {
    name: "check_availability",
    description: "Check whether the user is free in a time window.",
    parameters: {
      type: "OBJECT",
      properties: { starts_at: str("ISO 8601 start time"), ends_at: str("ISO 8601 end time (optional)") },
      required: ["starts_at"],
    },
  },
  {
    name: "get_goals",
    description: "The user's savings and life goals with progress.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "get_mood_history",
    description: "The user's recent mood check-ins.",
    parameters: { type: "OBJECT", properties: { days: num("Days to look back. Default 7.") } },
  },
  {
    name: "add_task",
    description: "Add a task for the user. Confirm the title back in one short sentence.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: str("Task title, in the user's language"),
        due_date: str("YYYY-MM-DD. Default today."),
        priority: str("low | medium | high"),
        notes: str("Optional details"),
      },
      required: ["title"],
    },
  },
  {
    name: "update_task",
    description: "Change or complete one of the user's tasks, found by part of its title.",
    parameters: {
      type: "OBJECT",
      properties: {
        search_title: str("Part of the existing task title"),
        new_title: str("New title"),
        due_date: str("YYYY-MM-DD"),
        priority: str("low | medium | high"),
        status: str("pending | in_progress | completed"),
        notes: str("Notes"),
      },
      required: ["search_title"],
    },
  },
  {
    name: "add_financial_entry",
    description: "Record income, an expense or savings. Ask for the amount if the user did not say it.",
    parameters: {
      type: "OBJECT",
      properties: {
        type: str("income | expense | savings"),
        amount: num("Amount as a number"),
        currency: str("ISO currency, default SAR"),
        category: str("e.g. food, transport, shopping, bills, salary, health, entertainment, general"),
        description: str("Short description"),
      },
      required: ["type", "amount"],
    },
  },
  {
    name: "add_event",
    description: "Add a calendar event. If the result reports a conflict, tell the user and ask before retrying with force=true.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: str("Event title"),
        starts_at: str("ISO 8601 start time in the user's timezone"),
        ends_at: str("ISO 8601 end time (optional, default one hour)"),
        location: str("Location"),
        description: str("Details"),
        category: str("personal | work | family | health | religious"),
        all_day: bool("All-day event"),
        reminder_min: num("Minutes before to remind. Default 15."),
        recurrence: str("daily | weekly | monthly | yearly"),
        force: bool("Book even if it overlaps another event (only after the user agrees)"),
      },
      required: ["title", "starts_at"],
    },
  },
  {
    name: "update_event",
    description: "Move or edit an existing event, found by part of its title.",
    parameters: {
      type: "OBJECT",
      properties: {
        search_title: str("Part of the existing event title"),
        new_title: str("New title"),
        starts_at: str("New ISO 8601 start"),
        ends_at: str("New ISO 8601 end"),
        location: str("New location"),
        description: str("New details"),
      },
      required: ["search_title"],
    },
  },
  {
    name: "log_mood",
    description: "Log how the user feels.",
    parameters: {
      type: "OBJECT",
      properties: { score: num("1 to 10"), label: str("One or two words, in the user's language"), note: str("Optional note") },
      required: ["score", "label"],
    },
  },
  {
    name: "remember",
    description: "Save a lasting fact or preference the user shares about themselves, so Jood remembers it next time.",
    parameters: {
      type: "OBJECT",
      properties: {
        fact: str("The fact, written as one clear sentence"),
        category: str("preferences | family | work | health | finance | goals"),
        importance: num("0 to 1, default 0.6"),
      },
      required: ["fact"],
    },
  },
];
