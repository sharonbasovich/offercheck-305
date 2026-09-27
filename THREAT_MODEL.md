# Threat model — OfferCheck

## What OfferCheck protects

Students evaluating internship/job/scholarship offers that may be fraudulent. The main
harms: financial loss (fees, fake checks, mule recruitment), identity theft (SSN, ID
documents, banking details), and time/energy spent on fake processes.

## Assets

- The **pasted offer text** — may contain the user's own PII plus scammer infrastructure
  details. It must never leave the device.
- **User trust decisions** — the app's output influences whether a user replies, pays, or
  shares documents.

## Trust boundaries

1. **Untrusted input → parser.** Pasted text is attacker-controlled. It is processed only
   by deterministic regex/heuristic code and rendered through React text nodes — never
   `dangerouslySetInnerHTML`, never `eval`, never interpolated into HTML. No XSS surface
   from pasted content.
2. **Untrusted links → network.** Extracted URLs are rendered as inert `<code>` text.
   The app never calls `fetch`, `XMLHttpRequest`, `WebSocket`, or resolves DNS for any
   extracted value. `index.html` carries
   `Content-Security-Policy: connect-src 'none'` so even a hypothetical bug cannot
   exfiltrate data or follow a link programmatically.
3. **App → storage.** Nothing is persisted: no `localStorage`, `sessionStorage`, cookies,
   IndexedDB, or service worker.
4. **Verdict → user action.** Heuristic verdicts can be wrong both ways. The UI labels
   evidence, never certifies legitimacy, and always pairs output with an independent
   verification path that uses only the claimed institution — never a channel supplied
   by the (possibly hostile) sender.

## Out of scope

- Live reputation checks (WHOIS, DNS, Safe Browsing, VirusTotal) — they would break the
  privacy guarantee and add failure modes. Stated as a limitation.
- Detecting scams with no extractable channels or signals (pure social engineering in
  text). Mitigated by the visible limitation statement and the verification checklist
  shown on every result, including clean ones.
- The full Public Suffix List (a curated subset is bundled instead — documented).

## Residual risks

- **False negatives:** a clean result could still be a scam. Mitigation: limitation
  statements and verification steps are shown regardless of score.
- **False positives:** e.g., a real small nonprofit legitimately using Gmail or a Google
  Form is labeled Unrelated/Unverifiable (not "scam") — the bands and wording are
  deliberately cautious.
- **Regex bypass:** obfuscated text can evade keyword rules. Mitigation: provenance
  scoring is independent of the language rules, and claims are framed as signals.

## Supply chain

Dependencies are pinned by `package-lock.json`; runtime surface is React + Vite only.
CI (lint, tests, build) runs on every push.
