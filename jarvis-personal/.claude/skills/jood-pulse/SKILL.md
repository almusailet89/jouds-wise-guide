---
name: jood-pulse
description: نبض تطبيق جود — أرقام التطبيق الحية. استخدمه عند "كيف حال جود"، "كيف التطبيق اليوم"، "أرقام جود"، "how's the app doing"، "how are my numbers". يقرأ Supabase و Vercel قراءة فقط.
---

# نبض جود (قراءة فقط)

## المصادر
- **Supabase MCP** — `execute_sql` بـ `SELECT` فقط. ممنوع INSERT/UPDATE/DELETE/ALTER/`apply_migration`.
- **Vercel MCP** — `list_deployments` / `get_deployment` / `get_runtime_errors` فقط.
- إذا ما تعرف الـ project id: `list_projects` واختر مشروع جود. إذا فيه أكثر من واحد، اسألني.

## الاستعلامات (عدّل أسماء الأعمدة إذا اختلفت — تحقق بـ `list_tables` أول مرة)
```sql
-- مستخدمين جدد آخر ٢٤ ساعة
select count(*) from auth.users where created_at > now() - interval '24 hours';
-- نشطين اليوم (أرسلوا رسالة لجود)
select count(distinct user_id) from chat_messages where created_at > date_trunc('day', now() at time zone 'Asia/Riyadh');
-- موجزات انقرت اليوم
select count(*) from daily_briefs where brief_date = (now() at time zone 'Asia/Riyadh')::date and read_at is not null;
-- تذاكر دعم مفتوحة
select count(*) from support_tickets where status not in ('resolved', 'closed');
```
للاشتراكات والإيراد: Stripe ما له موصّل هنا — قلها بوضوح بدل التخمين.

## الرد
- ٣ جمل كحد أقصى إذا السؤال صوتي: الرقم الأهم أولاً، بعدين أي شي غير طبيعي (deploy فاشل، أخطاء runtime، تذاكر متراكمة).
- أرقام إجمالية فقط. لا إيميلات ولا أسماء مستخدمين.
- إذا استعلام فشل: قل أي واحد فشل وليش.
