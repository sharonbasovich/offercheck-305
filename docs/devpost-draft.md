# Devpost writeup draft — OfferCheck

> Draft for Sharon to paste into the Devpost form. Do not submit from the build session.

## Tagline

"Call the number in this email to confirm." — every offer scam says some version of
this. OfferCheck's answer: no. It shows which contact channels match, diverge from, or
cannot be checked against the institution's claimed domain, then builds a verification
path the scammer can't intercept. Nothing you
paste ever leaves your browser.

## Originality

Not a generic scam detector (that category exists, including in this series). The
differentiator is **channel provenance**: every contact the offer asks you to use gets a
verdict — Official, Unrelated, Lookalike, or Unverifiable — and the verification path is
built only from the institution you claim sent it. A legitimate offer demonstrably
scores Low, and the zero-network guarantee is enforced by CSP, not promised.

## Inspiration

Job- and internship-scam reports to the FTC have grown sharply, and the standard scam
pattern is elegant in the worst way: the offer itself supplies the phone number, link, or
email you'd use to "verify" it. First-generation students — often navigating offers
without family experience or a built-in gut check — are a prime target. Most scam tools
focus on scanning the message itself; OfferCheck puts its emphasis on a different
question: **how does each contact channel this offer is asking me to use relate to the institution it claims to come from?**

## What it does

Paste an offer, name the organization it claims to be from, and optionally give the
sender's address. OfferCheck extracts every contact channel — sender, body emails, links
(including defanged `hxxp` and `[.]` forms and bare domains), phone numbers, chat handles,
and payment instruments — and labels each one:

- **Official** — registrable domain matches the claimed institution
- **Lookalike** — visibly imitates it (`acme-careers.net`, `uwaterioo.ca`, punycode/IDN)
- **Unrelated** — a different domain, including free webmail
- **Unverifiable** — shorteners, form builders, raw IPs, chat handles, phone numbers

It also flags scam-script stages with evidence spans (upfront fees, gift cards, fake
checks, crypto/wire requests, SSN/bank-detail collection, urgency, off-platform
interviews), assigns an explainable Low/Caution/High/Stop band where every finding shows
its points, and builds a verification path using only the claimed institution — never a
contact the offer supplied.

## How we built it

React 19 + TypeScript + Vite, deployed as a static site on GitHub Pages. The analysis
engine (`src/analysis/`) is a pure, deterministic pipeline: extract → normalize domains
→ classify channel provenance → match scam-script rules → score → build the verification
path. No backend, no APIs, no storage, no network calls — enforced by a
`connect-src 'none'` Content-Security-Policy, not just promised. 58 Vitest regression
tests pin the behavior — including a held-out suite of synthetic scams (lookalike sender,
messaging-app text interviews, fake-check-to-vendor schemes, P2P release fees) and
legitimate university/scholarship controls — plus the invariant that verification steps
never reference an offer-supplied channel, and three UI tests verifying channels render
as inert text.
CI runs lint + tests + build on every push.

## Challenges we ran into

Registrable-domain math without shipping the full Public Suffix List; keeping evidence
spans byte-accurate while still parsing defanged URLs; and calibrating scoring so a
plausible legitimate offer lands Low while the synthetic scam hits Stop — the test suite pins both
ends and an ambiguous middle case.

## Accomplishments that we're proud of

The channel-provenance map makes the scammer's trick visible: you can see that the
"university" emails from a lookalike domain, replies route to free webmail, and the
interview moves to a chat app. And the privacy claim is enforced by the browser itself —
open DevTools and watch zero outbound requests after load.

## What we learned

Scam triage is really about provenance: the dangerous part isn't a suspicious phrase,
it's letting the sender define how you verify them. Building verification paths that
structurally cannot use sender-supplied channels changed how the whole tool works.

## What's next for OfferCheck

A bundled Public Suffix List snapshot and university-domain registry for richer
Official/lookalike matching; an optional on-device LLM explainer constrained to cite only
existing finding IDs; a multilingual rule set; and a browser extension that warns inline
on Gmail/Outlook.

## Built with

React, TypeScript, Vite, Vitest, GitHub Pages.

## AI / tool disclosure (paste honestly)

This project was designed and implemented with AI assistance: a Devin (Cognition)
strategy session researched the hackathon and concept, and Devin sessions wrote the
code, tests, docs, and CI. All work is original, created in September 2026 for this
hackathon, and the project is not entered anywhere else. No major third-party models,
APIs, or datasets are used at runtime.

## Links

- Repo: https://github.com/sharonbasovich/offercheck-305
- Demo: https://sharonbasovich.github.io/offercheck-305/
- Video: https://sharonbasovich.github.io/offercheck-305/video.html (synthesized voiceover, captioned; all offers synthetic)
- Slides: _[add public Google Slides link]_

## Devpost field map

| Devpost field | Paste |
|---|---|
| Project name | OfferCheck |
| Tagline | (the Tagline block above) |
| About this project | Inspiration → What's next sections above |
| Built with | React, TypeScript, Vite, Vitest, GitHub Pages |
| Try it out | https://sharonbasovich.github.io/offercheck-305/ |
| GitHub repo | https://github.com/sharonbasovich/offercheck-305 |
| Video demo | https://sharonbasovich.github.io/offercheck-305/video.html (GitHub Pages-hosted MP4; synthesized TTS voiceover + captions; disclose both in the Devpost video field if a description box exists) |
| GenAI question | Devin (Cognition) — design + implementation; answer honestly, add "Other" |
| Prizes | Session B (virtual); Gemma Challenge only if an on-device model ships — it does not |
| Screenshots | docs/screenshots/*.png in the repo |
