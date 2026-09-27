# Screenshot & demo capture plan

## Screenshots for Devpost / README

Capture at 1440×900 (desktop) and 390×844 (mobile), light on context:
1. **Landing** — hero + privacy badge + sample-case buttons.
2. **Scam analysis** — the synthetic scam case analyzed: Stop band, channel map with
   Lookalike sender highlighted, findings list with evidence spans.
3. **Channel map close-up** — Official/Unrelated/Lookalike/Unverifiable chips.
4. **Legitimate case → Low** — proves it isn't paranoid.
5. **Verification path** — numbered independent-verification steps.
6. **DevTools Network** — zero requests after load (the privacy proof shot).
7. **Mobile layout** — same view at phone width, controls stacked.

## Videos (per the series judging guide)

- **10-minute feature MP4:** hook line → problem stats (FTC/IC3) → scam case walkthrough →
  channel map → verification path → legitimate case scoring Low → DevTools zero-network
  proof → architecture slide → `npx vitest run` output → limitations & AI disclosure.
- **5-minute backup MP4:** hook → scam case → channel map → verification path → legit Low
  → network proof → outro.
- **Live Zoom demo readiness:** same 5-minute path, rehearsed to run in ≤5 min on request.

## Recording method

Full-screen browser at 1440×900; OS-level screen recorder (OBS/ffmpeg x11grab) to MP4
(H.264, ≤1080p). Avoid showing any real personal email — use only the synthetic cases in
`src/data/cases.ts`.

## Pre-submission link audit (logged-out incognito)

- Repo loads: https://github.com/sharonbasovich/offercheck-305
- Demo loads and functions: https://sharonbasovich.github.io/offercheck-305/
- Both MP4s and the Google Slides link open without permission requests.
- Same links appear identically on Devpost, README, and slides.
