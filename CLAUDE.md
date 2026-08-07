# Joud's Wise Guide — Project Context

## What This Is

Joud is an AI financial assistant with a distinctive persona: elegant, confident, warm Saudi female voice. The product is a web app (React/TS frontend + FastAPI backend) where users chat with Joud for financial planning, mood tracking, task management, and investment guidance.

## Business Stage

Pre-launch. Core tech is complete. Currently working through the launch checklist (`LAUNCH_CHECKLIST.md`). Target: $10k MRR within 6 months of launch.

## Revenue Model

- $5/month or $49/year subscription
- 7-day free trial for all new users
- Premium features gated: voice, data export, advanced AI

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Shadcn UI
- **Backend**: FastAPI (Python), OpenAI GPT-4o-mini
- **Auth/DB**: Supabase (Row Level Security, user profiles, portfolio, transactions, mood logs, tasks)
- **Voice**: LiveKit + ElevenLabs
- **Payments**: Stripe

## Core Features (Built)

- AI chat with Joud (financial planning, task creation via natural language)
- Financial tracking: income/expense logging, portfolio, savings rate, investment suggestions
- Mood tracker with logs
- Task/event planner (parsed from Joud's responses)
- Two visual themes: `ameera-calm` and `ameera-dark`
- PDF + CSV export

## What's Still Missing (Pre-Launch)

- Custom domain + SSL (joud-ai.com)
- Error monitoring (Sentry)
- Terms of Service + Privacy Policy
- Stripe customer portal configuration
- SEO optimization
- Analytics (Google Analytics)
- Social media presence

## Target Audience

Users who want a premium, culturally-resonant AI financial assistant — primarily Gulf region (Saudi Arabia focus). Non-technical users who respond to persona-driven AI experiences.

## Key Constraints

- OpenAI API key is hardcoded in `app.py` (needs env var migration before production)
- LiveKit credentials are placeholder — real deployment requires proper LiveKit cloud setup
- No mobile app yet (PWA is optional roadmap item)

## LLM Council Skill

This project has the LLM Council skill installed at `.claude/skills/llm-council/`. Trigger it with: "council this", "run the council", "debate this", "pressure-test this", or any genuine decision with meaningful tradeoffs.
