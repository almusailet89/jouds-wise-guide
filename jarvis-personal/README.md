# جارفس — نسختك الشخصية بالعربي

مساعدك الشخصي: **Claude Code هو العقل**، والموصّلات (MCP) هي اليدين، وهذا المجلد هو الوجه والصوت.
فيه كل شي يحتاجه الدليل، مبني بالعربي ومربوط بتطبيق جود.

```
jarvis-personal/
├── CLAUDE.md              ← مين أنت (عبّي الأقواس [ ])
├── priorities.md          ← أولوياتك مرتبة — الموجز يرتب يومك منها
├── dashboard.html         ← لوحة جارفس (الكرة المتوهجة، RTL، عربي)
├── jarvis_data.js         ← البيانات اللي تعرضها اللوحة (جارفس يعيد كتابتها)
├── server.py              ← جسر الصوت المحلي: مايك ← Claude Code ← صوت عربي
├── .env.example           ← مفاتيح الصوت (انسخه لـ .env)
└── .claude/
    ├── skills/
    │   ├── morning-brief/  ← «موجز الصباح» / «brief me»
    │   ├── jood-pulse/     ← «كيف حال جود؟» — أرقام التطبيق (قراءة فقط)
    │   └── jood-support/   ← مسودات ردود الدعم + faqs.md
    └── agents/
        ├── jood-dev.md     ← مطوّر جود (الوحيد اللي معه GitHub)
        └── jood-analyst.md ← محلل الأرقام (Supabase + Vercel قراءة فقط، Haiku)
```

## التشغيل — بالترتيب (قراءة قبل كتابة، موصّل واحد قبل اثنين)

**١. العقل**
```bash
npm install -g @anthropic-ai/claude-code
cd jarvis-personal
claude            # سجّل دخول بحساب claude.ai (مو API key) عشان تشتغل الموصّلات والصوت
```
عبّ `CLAUDE.md` و `priorities.md` بمعلوماتك الحقيقية.

**٢. أول موصّل (قراءة فقط) وتأكد منه**
اربط من الويب: claude.ai/customize/connectors — الطرفية ترثها تلقائياً. شغّل `/mcp` للتأكد.
- Supabase و Vercel (لأرقام جود) — جرّب: «كم مستخدم سجّل في جود آخر ٢٤ ساعة؟» وقارن الرقم بلوحة Supabase بعينك.
- Google Calendar و Gmail: **من الويب فقط** — `claude mcp add` ما يشتغل معها.
- إذا موصّل مربوط وما يطلع: شغّل `/status` — أي `ANTHROPIC_API_KEY` في الـ shell يخفي كل الموصّلات بدون أي خطأ.

**٣. الصوت**
- تكلّم معه في الطرفية: `/voice` ثم اضغط مطوّل على Space.
- خلّه يرد بصوت عربي:
  ```bash
  cp .env.example .env      # حط ELEVENLABS_API_KEY (نفس صوت جود) أو FISH_API_KEY
  python3 server.py         # افتح http://localhost:8765 في Chrome (مو الملف مباشرة — المايك يحتاج localhost)
  ```
  اضغط **🎙 تكلّم** وقل: «كيف حال تطبيق جود اليوم؟» — المتصفح يسمعك (ar-SA)، `claude -p` يجاوب بمهاراتك وموصّلاتك، والكرة تنبض وهو يتكلم.
  بدون مفتاح صوت؟ يشتغل بصوت الجهاز العربي تلقائياً.

**٤. الموجز**
داخل `claude` قل: **«موجز الصباح»**. يقرأ مصادرك، يكتب `brief.txt`، يحدّث `jarvis_data.js`، ويسوي `jarvis_brief.mp3`. حدّث اللوحة واضغط **موجز الصباح**.

**٥. الدعم** — راجع `.claude/skills/jood-support/faqs.md` (خصوصاً سياسة الاسترداد)، بعدين: «رد على تذاكر الدعم».

**٦. الفريق** — «خلّ jood-dev يراجع آخر PR» أو «اسأل jood-analyst عن أرقام الأسبوع».

**٧. الجدولة (آخر شي)** — `/schedule` موجز يومي ٧:٤٥ الصبح بتوقيت الرياض.
⚠️ الجدولة السحابية تشتغل **بدون أي موافقة**: ضمّن فقط الموصّلات اللي يحتاجها، ولا تضمّن أي موصّل يقدر يرسل أو يكتب إلا لو الـ prompt يمنعه صراحة. اقرأ نتائج أول أسبوع بنفسك.

## القاعدة الوحيدة
**جارفس يقترح، أنت توافق.** Gmail يقدر يرسل — «مسودات فقط» قاعدة مكتوبة في المهارات و`CLAUDE.md`، مو جدار تقني. Supabase يقدر يكتب — المهارات تسمح بـ `SELECT` فقط. لا تعطيه صلاحيات أكثر من اللي يحتاجها.

## الأمان في server.py
- يسمع على `127.0.0.1` فقط، ويرفض أي طلب من موقع ثاني (Origin) أو بدون `application/json` — عشان ما تقدر صفحة غريبة تشغّل Claude Code عندك.
- ما يقدّم أي ملف يبدأ بنقطة (`.env`، `.claude/`).
- `claude -p` يشتغل بدون موافقات تفاعلية، فأي أداة تحتاج إذن **تنرفض** تلقائياً — هذا مقصود. لو تبي تسمح بأدوات قراءة معيّنة، أضفها في `.claude/settings.json` تحت `permissions.allow`.

---

### English quick start
`cd jarvis-personal && claude` → fill `CLAUDE.md` / `priorities.md` → connect one read-only connector on claude.ai and verify one fact → `cp .env.example .env` (ElevenLabs or Fish Audio key) → `python3 server.py` → open http://localhost:8765 in Chrome, tap 🎙 and speak Arabic. Say "brief me" inside Claude Code to regenerate the dashboard data and the spoken brief.
