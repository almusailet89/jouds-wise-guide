// جارفس يعيد كتابة هذا الملف كل مرة يشغّل "موجز الصباح".
// هذه بيانات مثال فقط — الموصّلات كلها "غير متصل" لين تربطها وتتأكد منها.
window.JARVIS_DATA = {
  greeting: "صباح الخير — هذا مثال، شغّل «موجز الصباح» عشان تشوف أرقامك الحقيقية",
  generated: null,
  timezone: "Asia/Riyadh",
  listenLang: "ar-SA",
  connectors: [
    { name: "Google Calendar", online: false, detail: "لم يُربط بعد" },
    { name: "Gmail (مسودات فقط)", online: false, detail: "لم يُربط بعد" },
    { name: "Notion", online: false, detail: "لم يُربط بعد" },
    { name: "Supabase — جود", online: false, detail: "لم يُربط بعد" },
    { name: "Vercel — جود", online: false, detail: "لم يُربط بعد" }
  ],
  priorities: [],
  stats: [],
  figures: [],
  dueChip: null,
  headline: null,
  log: [
    "تشغيل جارفس…",
    "قراءة CLAUDE.md و priorities.md",
    "بانتظار ربط أول موصّل"
  ],
  ticker: [],
  briefText: null,
  closer: "وش أبدأ فيه أول؟"
};
