# Speak Smart — Never freeze again

A drills app that trains the exact one-line reply — in your voice — for the moments
people talk down to you, corner you, or leave you speechless. Offline-first PWA,
no account, no runtime AI in V1. Built from `DESIGN (4).pdf` (v1.0, Oct 24 2026),
the single source of truth.

## Run it

```sh
npm install
npm run dev        # local dev server
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build
```

Content factory:

```sh
npm run content:validate   # schema + voice + dedupe gate (exit 1 on error)
npm run content:stats      # library counts by category and register
python3 tools/make-icons.py  # regenerate PWA icons
```

Deploy anywhere static: the build uses relative paths (`base: "./"`), so `dist/`
works from any host path, including GitHub Pages project sites.

## Layout

- `src/config.ts` — every tunable, single-sourced (§9.4). No magic numbers elsewhere.
- `src/tokens.css`, `src/app.css` — design tokens + components built from tokens only (§2).
- `src/types.ts` — scenario schema types + locked taxonomy (§5).
- `src/content/loader.ts` — versioned JSON packs, lazy per category, IndexedDB mirror.
- `src/store/` — IndexedDB wrapper + retention engine (streaks, XP, ranks, mastery).
- `src/lib/` — delivery scorer (§4.3), on-device speech (§9.2), utils.
- `src/views/` — onboarding, Today, Library, Drill, Reveal, Arsenal (+recall), settings, styleguide.
- `public/content/` — the library: `manifest.json` + one JSON file per subcategory (§5.3).
- `public/sw.js` — offline-first service worker (§9.1).
- `tools/validate.mjs` — content factory gate (§5.4–§5.5).

## Spec compliance

- Phase 0: tokens/components live at `#/styleguide`; taxonomy + schema implemented as
  data tooling (`tools/validate.mjs`); seed library of **49 approved scenarios**
  across all 10 categories, including the Appendix B golden examples verbatim.
- Phase 1: onboarding (≤4 screens, first drill before any gate), Today, Library,
  Drill (pick + say-it with on-device delivery metrics), Reveal, Arsenal + spaced
  repetition, streaks with automatic freeze, settings. Zero runtime AI, zero accounts.
- Content milestones: the seed is the pipeline's first output, not M1. The factory
  (schema, validator, dedupe, trap-coverage and tier reporting) is what carries the
  library to M1 (1,000) → M2 (3,000, launch gate) → M3 (10,000).
- Budgets: initial JS ≤ 150KB gzipped (vanilla TS, zero runtime deps — see build
  report); drill transitions are local-state only (<100ms); WCAG 2.2 AA targets
  (contrast pairs, ≥48px targets, keyboard/screen-reader pick mode, reduced motion,
  200% text scaling).
- Privacy (§10): V1 collects nothing — no account, no analytics, no audio off-device.

## Deviations & interpretations (agent rule 10)

1. **Trap in pick mode.** §4.1 shows 3–5 replies; §4.5 scores "chose the trap", which
   requires the trap to be choosable. Pick options = replies + trap when present
   (up to 6 cards). The ≤5 rule governs replies; the trap is a distinct mechanic.
2. **Trap unlabeled in pick, labeled in reveal.** The test is genuine; the teaching
   (label + cost) happens in the reveal per §4.4.5.
3. **Recall "clean".** Speech path: clean = perfect delivery on all four metrics
   (§4.3's highest mark). No-speech fallback: honest self-mark after reveal.
4. **Notifications (§6.4) deferred.** Scheduling needs a backend; V1 has none. No
   fake or local-notification theater ships in its place.
5. **Seasonal pack** (Today below-the-fold) ships as "Fresh lines from the library"
   — no seasons exist in seed content.
6. **"Why it's next"** is honest: least-seen pack. The app knows no calendar.
7. **Beat duration** setting: 0.8s / 1.2s (default) / 1.6s.
8. **Voice off** = pick mode only, with a quiet notice. Voice is an enhancement,
   never a gate (§9.2).
9. **Register substitution.** Say-it reveals in the default register; when a scenario
   has no line in that voice (the library never forces one, §5.2), the reveal says
   so and trains the nearest available voice.
10. **Speech timing.** The Web Speech API gives no per-word timestamps, so pace is
    measured over first-result→end and pause from Beat end to first result. Documented
    here rather than faked precisely.
