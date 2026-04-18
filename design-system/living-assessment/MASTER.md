# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Living Assessment
**Generated:** 2026-04-18 14:17:46
**Category:** SaaS (General)

---

## Global Rules

### Color Palette — Preserve Existing Brand

The app already ships an established teal + warm-amber palette in `src/index.css`. **Keep it.** The redesign is a *surface treatment* change (glass + minimalism), not a rebrand.

| Role | Hex | Existing Tailwind Token |
|------|-----|--------------------------|
| Primary (brand) | `#0D7377` | `primary-500` (teal) |
| Primary hover | `#0B5F62` | `primary-600` |
| Primary tint | `#E6F5F5` | `primary-50` |
| Accent (CTA / highlight) | `#D4943A` | `accent-500` (warm amber) |
| Accent deep | `#AA762E` | `accent-600` |
| Background page | `#FAF9F6` | `bg` (warm off-white) |
| Background card (solid fallback) | `#FFFFFF` | `bg-card` |
| Background muted | `#F3F1EC` | `bg-muted` |
| Foreground | `#2D3436` | `text` |
| Foreground muted | `#636E72` | `text-muted` |
| Foreground light | `#B2BEC3` | `text-light` |
| Success | `#10B981` / `#059669` | `success-500` / `success-600` |
| Caution | `#F59E0B` / `#D97706` | `caution-500` / `caution-600` |
| Alert | `#F43F5E` / `#E11D48` | `alert-500` / `alert-600` |

**What to add for the redesign** (in `@theme`): the glass tokens below, plus a **background canvas gradient** for glass to sit over:

```css
--canvas-gradient: radial-gradient(at 20% 0%, #E6F5F5 0%, transparent 50%),
                   radial-gradient(at 100% 100%, #FBF2E6 0%, transparent 50%),
                   #FAF9F6;
```

This gives the amoeba/glass something to refract. Solid `--color-bg` is the fallback.

### Typography

- **Heading Font:** Inter
- **Body Font:** Inter
- **Mood:** minimal, swiss, functional, neutral, professional
- **Google Fonts:** [Inter](https://fonts.google.com/share?selection.family=Inter:wght@300;400;500;600;700)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
```

**Tailwind:** `fontFamily: { sans: ['Inter', 'sans-serif'] }`

**Type Scale:** 12 / 14 / 16 / 18 / 24 / 32 / 48 — base 16px, line-height 1.5 body · 1.2 display. Apply `-0.02em` tracking on display sizes. Use `font-variant-numeric: tabular-nums` on data tables, timestamps, and counters to prevent layout shift.

**Mono (data-only):** system `ui-monospace, SFMono-Regular, Menlo`. Reserved for IDs, timestamps, and tabular numeric columns — never prose or headings.

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

### Glass Tokens (the core of this redesign)

| Token | Value | Usage |
|-------|-------|-------|
| `--glass-tint-light` | `rgba(255, 255, 255, 0.55)` | Card on colored/amoeba background |
| `--glass-tint-neutral` | `rgba(255, 255, 255, 0.75)` | Card on neutral page background |
| `--glass-tint-strong` | `rgba(255, 255, 255, 0.88)` | Modal / sheet surface (high contrast) |
| `--glass-border` | `1px solid rgba(255, 255, 255, 0.35)` | Top/left edge highlight |
| `--glass-border-inset` | `inset 0 1px 0 rgba(255, 255, 255, 0.6)` | Inner highlight (depth cue) |
| `--glass-blur-sm` | `blur(8px) saturate(140%)` | Inline chips, compact cards |
| `--glass-blur-md` | `blur(16px) saturate(160%)` | Default cards, sidebar, top bar |
| `--glass-blur-lg` | `blur(24px) saturate(180%)` | Modals, sheets, full overlays |
| `--glass-shadow` | `0 8px 32px rgba(30, 58, 138, 0.08), 0 1px 0 rgba(255,255,255,0.6) inset` | Depth + inner highlight combined |
| `--glass-radius` | `16px` | Card |
| `--glass-radius-lg` | `20px` | Modal/sheet |

**Fallback:** When `backdrop-filter` is unsupported (≈3% of users), swap tint to `rgba(255,255,255,0.92)` — keeps legibility without the blur.

---

## Component Specs

### Buttons

```css
/* Primary Button — solid teal, never glass (primary CTAs need to be unambiguous) */
.btn-primary {
  background: var(--color-primary-500);  /* #0D7377 */
  color: white;
  padding: 10px 20px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 14px;
  letter-spacing: -0.01em;
  transition: background 180ms ease, box-shadow 180ms ease;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(13, 115, 119, 0.15);
}
.btn-primary:hover { background: var(--color-primary-600); box-shadow: 0 4px 12px rgba(13, 115, 119, 0.25); }
.btn-primary:focus-visible { outline: 2px solid var(--color-primary-500); outline-offset: 2px; }

/* Secondary Button — glass chip */
.btn-secondary {
  background: var(--glass-tint-neutral);
  backdrop-filter: var(--glass-blur-sm);
  -webkit-backdrop-filter: var(--glass-blur-sm);
  color: var(--color-primary-700);
  border: 1px solid rgba(13, 115, 119, 0.18);
  padding: 10px 20px;
  border-radius: 10px;
  font-weight: 500;
  font-size: 14px;
  transition: border-color 180ms ease, background 180ms ease;
  cursor: pointer;
}
.btn-secondary:hover { border-color: rgba(13, 115, 119, 0.35); background: rgba(255, 255, 255, 0.85); }

/* Tertiary — text-only, no chrome */
.btn-tertiary {
  background: transparent;
  color: var(--color-primary-700);
  padding: 10px 12px;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
}
.btn-tertiary:hover { background: var(--color-bg-muted); }
```

### Cards (Glass)

```css
.card {
  background: var(--glass-tint-neutral);
  backdrop-filter: var(--glass-blur-md);
  -webkit-backdrop-filter: var(--glass-blur-md);
  border: var(--glass-border);
  border-radius: var(--glass-radius);
  padding: 24px;
  box-shadow: var(--glass-shadow);
  transition: box-shadow 200ms ease, border-color 200ms ease;
}

/* Only cards that are actual links/buttons get cursor + hover lift. Static info cards don't. */
.card-interactive {
  cursor: pointer;
}
.card-interactive:hover {
  border-color: rgba(255, 255, 255, 0.55);
  box-shadow: 0 12px 40px rgba(30, 58, 138, 0.12), 0 1px 0 rgba(255,255,255,0.7) inset;
}
```

> Never nest a glass card inside another glass card — it muddies the blur and breaks depth. Use a flat inner panel (`background: rgba(255,255,255,0.4); border: 1px solid rgba(0,0,0,0.04)`) for sub-regions instead.

### Inputs

```css
.input {
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid rgba(45, 52, 54, 0.12);
  border-radius: 10px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-text);
  transition: border-color 180ms ease, box-shadow 180ms ease, background 180ms ease;
}

.input:hover { border-color: rgba(45, 52, 54, 0.22); }
.input:focus {
  background: #FFFFFF;
  border-color: var(--color-primary-500);
  outline: none;
  box-shadow: 0 0 0 3px rgba(13, 115, 119, 0.15);
}
.input::placeholder { color: var(--color-text-light); }
```

### Modals (Glass Sheet)

```css
.modal-overlay {
  background: rgba(30, 58, 138, 0.18);  /* Indigo scrim — warmer than pure black */
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.modal {
  background: var(--glass-tint-strong);
  backdrop-filter: var(--glass-blur-lg);
  -webkit-backdrop-filter: var(--glass-blur-lg);
  border: var(--glass-border);
  border-radius: var(--glass-radius-lg);
  padding: 32px;
  box-shadow: 0 24px 64px rgba(30, 58, 138, 0.18), 0 1px 0 rgba(255,255,255,0.7) inset;
  max-width: 500px;
  width: 90%;
}
```

### Sidebar / Top Bar (Glass Chrome)

```css
.app-sidebar,
.app-topbar {
  background: var(--glass-tint-neutral);
  backdrop-filter: var(--glass-blur-md);
  -webkit-backdrop-filter: var(--glass-blur-md);
  border-right: 1px solid rgba(255, 255, 255, 0.4);  /* or border-bottom for topbar */
}
```

---

## Style Guidelines

**Style:** Glassmorphism

**Keywords:** Frosted glass, transparent, blurred background, layered, vibrant background, light source, depth, multi-layer

**Best For:** Modern SaaS, financial dashboards, high-end corporate, lifestyle apps, modal overlays, navigation

**Key Effects:** Backdrop blur (10-20px), subtle border (1px solid rgba white 0.2), light reflection, Z-depth

### Page Pattern — App Shell (not marketing landing)

**Pattern Name:** Minimalist Glass Dashboard Shell

Living Assessment is an authenticated app, not a landing page. Every page lives inside the same shell.

- **Shell:** Persistent left sidebar (collapsible) + thin top bar with page title, school switcher, user menu. Content area on light, neutral background. Bottom tab nav on mobile (≤5 items).
- **Primary surface:** Frosted glass cards over a soft gradient or amoeba background. One primary CTA per screen — everything else visually subordinate.
- **Information hierarchy:** Page title (32–40px) → section headings (24px) → card titles (18px) → body (16px) → meta (14px / muted).
- **Density:** Generous whitespace. 24–32px gaps between sections, 16–24px card padding. Never edge-to-edge data tables on desktop — contain within cards.
- **Depth rules:** Max 3 z-layers visible at once (background / card / modal). Don't stack glass over glass over glass — one glass layer at a time.

---

## Anti-Patterns (Do NOT Use)

- ❌ Excessive animation
- ❌ Dark mode by default

### Glassmorphism-Specific Anti-Patterns

- ❌ **Glass on glass on glass** — Max one glass layer in a z-stack. Nest flat panels inside glass cards, not more glass.
- ❌ **Glass over busy photography** — Frosted glass needs a calm background (soft gradient, amoeba, solid tint). Over high-frequency imagery, legibility collapses.
- ❌ **Low-contrast text on transparent tint** — Text on glass must still hit 4.5:1 against the *effective* blended background. Prefer `--color-foreground` (#1E3A8A) on `--glass-tint-neutral`.
- ❌ **Full-page glass** — Glass is for elevated surfaces (cards, modals, chrome). Page backgrounds stay opaque.
- ❌ **Borderless glass** — Without the 1px white edge highlight, glass looks like a rendering bug, not a surface.
- ❌ **Skipping the `-webkit-` prefix** — Safari/iOS still requires `-webkit-backdrop-filter`.
- ❌ **Heavy drop shadows** — Glass reads as depth via blur + edge highlight, not dark shadows. Keep shadow opacity ≤ 0.12.
- ❌ **Decorative glass on data tables** — Tabular numbers need opaque, high-contrast backgrounds to scan fast. Glass only on the *container*, not rows.

### Minimalism-Specific Anti-Patterns

- ❌ **Multiple primary CTAs per screen** — Pick one. Everything else is secondary/tertiary.
- ❌ **Decorative dividers everywhere** — Use spacing to separate, not lines. Reserve borders for actual structure (table rows, input fields).
- ❌ **Color-coded everything** — Prefer monochrome + one accent. Apply color to convey *state* (success/error/active), not decoration.
- ❌ **Icon + label + tooltip + description on the same control** — Minimalism means the cheapest sufficient affordance.

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Lucide is already in the project; stay on it)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
