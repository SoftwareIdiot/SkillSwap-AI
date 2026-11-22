# SkillSwap AI

SkillSwap AI helps learners choose a skill, practice a concept, review mistakes, and return with a focused next step. It combines guided skill paths, an AI coach, planning tools, and Study Circle communities in one personal workspace.

## Explore the workspace

- Skill Studio offers starter and community curricula, plus manual or AI-assisted skill creation. Your enrolled path can be edited as your goals change.
- The skill map tracks actual module progress. Selected starter modules include reviewed learning checks, targeted practice tasks, and fresh follow-up questions.
- The AI coach uses the learning context you allow. Career Explorer suggests possible directions using your studies and enrolled skills.
- Planner brings together tasks, individual habit streaks, a dated mood journal, and focus sessions with soundscapes and optional video backgrounds.
- Study Circle includes communities, posts, Veels, partners, and live voice and video study rooms where the network supports them.
- A connected Supabase account can carry profile and learning progress between devices. Some local browser data remains tied to its current browser and origin.

## Run locally

Use Node.js 22.18 or newer.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Copy `.env.example` to `.env.local` and supply your Supabase project URL and publishable key. Apply the SQL files in `supabase/migrations` in order, skipping migrations already applied. Never commit `.env.local`.

Google login requires the provider and callback URL in Supabase Authentication. Email signup codes require custom SMTP and the template in `supabase/templates`; enable `EMAIL_OTP_ENABLED` after delivery works. The AI coach uses Groq by default when `GROQ_API_KEY` is configured. Provider keys belong only in server-side configuration. Optional study-message automation is in `automation/study-nudges.json` and needs its own sender and credentials.

Study Circle calls use WebRTC and may need a TURN relay on restrictive networks. Set `SKILLSWAP_PUBLIC_ORIGIN` to an exact HTTPS origin when sharing a forwarded preview.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

With the app running, `node --test tests/http-smoke.mjs` checks local HTTP routes.

## Project notes

This repository contains the Next.js web app. It does not include a hosted backend, API keys, database contents, or user accounts. Learning checks currently cover selected starter modules; other skills do not automatically have the same assessment coverage.

The focus sound library includes public-domain recordings by ezwa and Barracuda1983 and CC BY 3.0 recordings by Luftrum and Glaneur de sons. Source and license links are in `lib/focus-library.ts` and the Focus room's Sound credits.
