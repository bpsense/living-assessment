# Living Assessment (SproutMap)

## Project Overview
A learner-centered assessment platform that visualizes student growth across multiple dimensions using an organic "amoeba" blob chart. Built with React + TypeScript + Vite, backed by Supabase.

**Live site:** https://sproutmap.org

## Deployment

- **Netlify deploys from the `main` branch** — push to `main` to deploy.
- Auto-publish is on: merges/pushes to `main` trigger a build and go live automatically.
- Build command: `npm run build` → outputs to `dist/`
- Typical deploy time: ~30 seconds.
- **Do NOT use `claude/cranky-williamson` or any other branch for deploys.** That was a legacy setup that caused repeated missed deployments.

## Git Workflow

- Work directly on `main` for small fixes, or create feature branches and merge to `main` via PR.
- Always verify your changes are on `main` before expecting them to deploy.
- When using worktrees, remember the worktree branch is NOT `main` — you must merge/push to `main` for production.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **Backend:** Supabase (Postgres, Auth, Edge Functions)
- **Hosting:** Netlify
- **Key libraries:** Recharts, date-fns, Lucide icons, clsx

## Key Architecture

### Living Assessment Visualization
- **`src/lib/living-data.ts`** — Builds monthly snapshot time series from observations/surveys. Handles grade-level transitions (September boundaries), forward-looking smoothing, and score decay at grade changes.
- **`src/components/student/LivingBlob.tsx`** — SVG amoeba/blob chart using Catmull-Rom curves. Shows competency (teal) and interest (amber) across 8 dimensions with concentric rings (Emerging → Developing → Achieving → Mastery).
- **`src/components/student/LivingVisualization.tsx`** — Orchestrates blob + timeline playback + animation. Contains `useAnimatedScores` (smooth morphing) and `useGradeTransition` (squeeze animation at September).
- **`src/components/student/TimelinePlayback.tsx`** — Timeline scrubber with school-year navigation buttons, play/pause/loop, and snapshot dot markers.
- **`src/pages/StudentProfile.tsx`** — Main student page. Builds the snapshot pipeline: `buildSnapshots → smoothSnapshots → applyGradeTransitionDecay`.

### Grade Transitions
- School year boundary: September 1st
- At each September, competency scores decay by 0.35x to represent higher-grade expectations
- The blob "squeezes" with an animation showing new rings coming in
- A persistent grade label (e.g., "Grade 2") shows in the blob center during playback

### Data Flow
- Observations (educator-assessed) + Interest Surveys (learner-reported) → monthly snapshots
- Forward-looking smoothing creates gradual ramps instead of staircase jumps
- Grade boundary detection prevents smoothing across September transitions

## Commands

```bash
npm run dev        # Start dev server (Vite, port 5173)
npm run build      # TypeScript check + production build
npm run lint       # ESLint
npx tsc --noEmit   # Type-check only (no build)
```

## Test Data

- Multi-year seed script: `scripts/seed-multiyear-observations.ts`
- Test student: Gia Chen (Grade 3) at Embark Academy
- Student ID: `f1ae80a0-3d64-442b-9354-a54402b072a7`
- School ID: `17a20c36-a25b-4551-8fa3-86832fe146cd`
