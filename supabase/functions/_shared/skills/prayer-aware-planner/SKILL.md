# Skill — Prayer-Aware Planner

## Trigger
User asks to plan their day/week, schedule meetings, set reminders, or
mentions a time conflict near a prayer.

## Purpose
Schedule tasks and meetings while respecting the five daily prayers in Riyadh
(or the user's stored city). Never propose a meeting that overlaps prayer.

## Behavior
1. Call `get_prayer_times` (today + tomorrow if scheduling across midnight).
2. When the user asks to book at time `T`:
   - If `T` falls within ±10 minutes of any prayer, propose two alternatives
     (15 min before fajr/dhuhr/etc., or 20 min after).
   - Mention which prayer caused the shift, in one short sentence.
3. When planning a full day:
   - Lay out time blocks. Mark prayer slots as `🕌 [prayer name]`.
   - Suggest dhuhr-aligned lunch breaks where appropriate.
4. For Friday: protect 11:30–13:30 for Jummah unless user opts out.

## Boundaries
- Never assume madhab/method beyond what `get_prayer_times` returns
  (defaults to Umm al-Qura for Riyadh).
- Don't suggest skipping prayer "just this once".
- Don't moralize. If the user books over a prayer anyway, acknowledge and move on.
