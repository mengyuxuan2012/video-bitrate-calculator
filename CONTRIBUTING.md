# Contributing

## The most useful PR you can send

**A corrected upload limit.** Every entry in [`src/platforms.js`](src/platforms.js)
carries a `checked` date, and these numbers move — Discord alone has revised its
tiers more than once. If one is wrong or stale:

1. Edit the entry, including `checked`.
2. Link the source in the PR description (an official help page, not a blog post).
3. That's it. The test suite will confirm the target still sits under the limit.

Adding a platform is the same edit, plus a `note` explaining *what* the limit applies
to — per file, per message, per account tier. That sentence is usually the part people
actually needed.

## Running things

```bash
npm test         # node:test — no framework, no watch mode, no config
npm run types    # regenerate types/ from the JSDoc
npm run check    # both, which is what CI runs
```

There is no build step for the library. `src/*.js` is what ships.

## House rules

**JSDoc, not TypeScript.** The source stays plain JavaScript so it runs unmodified in
a browser console, a Node REPL, or a `<script type="module">`. Types are emitted from
the JSDoc into `types/` and committed; CI fails if they drift.

**No dependencies.** Not "few". None. This is arithmetic.

**Every exported function is pure** and throws `RangeError` on nonsense input rather
than returning `NaN`. A silent `NaN` here becomes a corrupt ffmpeg command three
layers up.

**Warnings are written for humans.** `"Audio is eating 55% of the budget"` is worth
more than a `WARN_AUDIO_RATIO` constant. If you add one, write it the way you'd say it
to someone standing next to you, and make it name the fix.

**Tests assert behaviour, not implementation.** The round-trip test — that every
target/duration pair produces a file under the target, and not wastefully under it —
is the one that has to keep passing. If a change breaks it, the change is wrong.
