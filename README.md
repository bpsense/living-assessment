# SproutMap (Living Assessment)

A learner-centered assessment platform that visualizes student growth across
multiple dimensions using an organic "amoeba" blob chart. Built with React +
TypeScript + Vite, backed by Supabase.

**Live site:** https://sproutmap.org

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS
- **Backend:** Supabase (Postgres, Auth, Edge Functions)
- **Hosting:** Netlify (auto-deploys from `main`)
- **Key libraries:** Recharts, date-fns, Lucide icons, clsx, dnd-kit, papaparse

## Getting Started

```bash
npm install
cp .env.local.example .env.local   # then fill in Supabase URL + anon key
npm run dev                         # Vite dev server on http://localhost:5173
```

## Commands

```bash
npm run dev        # Start dev server (Vite, port 5173)
npm run build      # Type-check (tsc -b) + production build to dist/
npm run lint       # ESLint
npm test           # Vitest
npx tsc --noEmit   # Type-check only
```

## Project Structure

```
src/
  components/   UI components, grouped by feature area
  pages/        Route-level pages (admin/ and system/ subtrees)
  lib/          Data access (*-data.ts) + domain logic (scoring, snapshots)
  hooks/        Reusable React hooks
  types/        Shared TypeScript types (database.ts)
supabase/       Edge functions + migrations
scripts/        Seed / maintenance tooling
standards/      Reference standards frameworks (PDFs, JSON)
docs/           Project documentation (see docs/prompts/ for feature briefs)
```

## Documentation

- [CLAUDE.md](CLAUDE.md) — architecture overview, git workflow, and conventions
- [docs/ASSESSMENT_PHILOSOPHY.md](docs/ASSESSMENT_PHILOSOPHY.md) — the assessment model
- [docs/prompts/](docs/prompts/) — feature design briefs
