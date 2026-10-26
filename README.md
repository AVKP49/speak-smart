# Speak Smart — Find your words

Practice what to say when you're put on the spot, and how to say it.

## Current product

- 100 everyday scenarios, 10 in each of 10 categories; 393 responses in 57 packs.
- A bright practice home, focused sessions, searchable situations, and My Lines.
- Think → learn → rehearse → respond to follow-up → recall → completion.
- Optional written first attempt stays in session memory. No automated grading.
- Delivery coaching for every response; an authored follow-up exchange for every scenario.
- Daily progress and XP awarded after the user completes the recall assessment.
- Recall is self-assessed: remembering the useful idea matters more than verbatim memorization.
- One kept line per scenario; replacing it resets that line's mastery. Keeping an identical line preserves progress.
- Spaced reviews for kept lines; a shaky review returns in one day.
- No accounts, runtime AI, recording, speech recognition, or analytics. IndexedDB holds local progress; memory fallback is temporary if storage is unavailable.

## Development

```sh
npm ci
npm run dev
npm run build
npm run preview
npm test
npm run content:validate
npm run content:stats
npm run content:expand
```

Vanilla TypeScript and Vite, with no runtime dependencies. jsdom is used only for development interaction checks. `npm test` covers shipped URLs, session selection, mastery behavior, and the drill interactions. jsdom does not check browser rendering, layout, or accessibility conformance.

## Source layout

- `src/main.ts` — hash routing and in-memory session lifecycle.
- `src/views/` — practice home, search, drill, coaching/recall, saved lines, settings.
- `src/types.ts` — scenario schema and category taxonomy.
- `src/config.ts` — session size, XP, review intervals, register metadata.
- `src/tokens.css`, `src/app.css` — theme and components.
- `src/store/` — local settings, completion history, saved lines, spaced review.
- `src/content/loader.ts` — versioned content fetching and indexing.
- `public/content/packs/` — authored scenario data.
- `public/content/manifest.json` — generated pack manifest; use `content:expand`.
- `reviews/content-review.json` — per-scenario review notes and content fingerprints.
- `public/sw.js` — scoped offline cache; mutable content uses network-first fetching.

## What “reviewed” means

The 100 scenarios received editorial self-review by Codex, followed by automated checks. **No independent human or expert review, user study, or efficacy validation has been performed.** The review log records this explicitly and the Settings screen describes it.

Review checks cover realistic context, an identifiable conversational goal, appropriate default responses, natural wording, delivery cues that match the actual line, plausible follow-up, and avoidance of guaranteed reactions. Some earlier replies were rewritten to remove insults, invented facts, coercive framing, misleading guarantees, and humor that undermined a serious refusal or apology.

`content:validate` checks taxonomy, IDs, schema, word limits, duplicate jabs, explanations, delivery coverage, follow-up coverage, and approved content's SHA-256 against the review log. Editing approved content invalidates its review record. A matching hash establishes that reviewed text has not changed; it does not establish subjective quality.

For changes: author/update the pack, conduct and record editorial review, update its review fingerprint, bump pack version, run `content:expand`, then test and build. New drafts can be kept as `draft`; only `approved` records appear in the app.

Feedback is local. Settings can export response feedback for the user to share with the developer; the app does not transmit flags or imply a working remote review queue.

## Product decisions, October 26

Ajay authorized the first 100-scenario release and a more engaging rebuild. This supersedes the handoff's future bulk-content target for this release, the marquee visual theme, fighter selection, and the requirement to force two witty replies into every scenario. Calm/Direct/Friendly are available throughout; Playful is optional and omitted where it weakens repair or a clear refusal. Internal register IDs remain stable for saved data.

The previous agent's handoff and `/Users/ajayvallab/Downloads/DESIGN (4).pdf` remain historical context. The current schema, this README, and Ajay's latest instructions govern this implementation.

## Deployment

`main` contains source. GitHub Pages publishes built files from `gh-pages`. Build to `dist/` (relative asset paths), publish that directory to the Pages branch, then verify Pages status, the live bundle hash, the 100-scenario manifest, and all pack URLs.
