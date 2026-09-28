import {
  hasNonAscii,
  hostFromInput,
  isChatHost,
  isFormBuilder,
  isPunycode,
  isShortener,
  looksLikeIp,
  registrableDomain,
} from "./domains";
import type { LinkInfo, Span } from "./types";

// http(s):// or defanged hxxp(s):// URLs, and www. links
const SCHEME_URL_RE = /\b(?:hxxps?|https?):\/\/[^\s<>"']+/gi;
const WWW_RE = /\bwww\.[^\s<>"'()[\]]+/gi;
// Bare or defanged domains: foo.bar.com, foo[.]bar[.]com — only for TLDs in a
// conservative allowlist to avoid matching ordinary text like "e.g. things".
const BARE_DOMAIN_RE =
  /\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\[\.\]|\[dot\]|\.)(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\[\.\]|\[dot\]|\.))*[a-z]{2,}\b(?:\/[^\s<>"'()[\]]*)?/gi;
const KNOWN_TLDS = new Set([
  "com", "net", "org", "edu", "gov", "ca", "io", "co", "info", "biz", "me",
  "app", "dev", "gg", "so", "ly", "us", "uk", "de", "fr", "ai", "xyz", "site",
  "online", "jobs", "work", "email", "pro", "top", "icu",
]);
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const PHONE_RE = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{3}\)[\s.-]?|\d{3}[\s.-])\d{3}[\s.-]\d{4}\b/g;
const CHAT_HANDLE_RE = /\b(?:telegram|whatsapp|signal|wechat|google\s*chat)\s*(?:handle|id|username|@)?\s*[:=]?\s*@([a-z0-9_]{3,32})\b/gi;
const CHAT_PLATFORM_RE = /\b(?:telegram|whats\s*app|signal|wechat|google\s*chat|google\s*hangouts?)\b/gi;
const PAYMENT_RE =
  /\b(?:gift\s*cards?|itunes\s*cards?|steam\s*cards?|e[-\s]?transfer|interac|zelle|venmo|cash\s*app|paypal|bitcoin|btc|usdt|crypto(?:currency)?|wire\s*transfer|western\s*union|moneygram|cashier'?s?\s*check|certified\s*check|money\s*order)\b/gi;

export function defangUrl(raw: string): string {
  return raw.replace(/^hxxp/i, "http").replace(/\[\.\]|\[dot\]/gi, ".");
}

export interface ExtractedLink extends LinkInfo {
  start: number;
  end: number;
}

interface RawHit {
  start: number;
  end: number;
  raw: string;
}

function overlapping(hit: RawHit, taken: RawHit[]): boolean {
  return taken.some((t) => hit.start < t.end && t.start < hit.end);
}

/** Extract URLs/domains as plain text. Returned data is never rendered as a link or fetched. */
export function extractLinks(text: string, emailSpans?: Span[]): ExtractedLink[] {
  const emailSpanList: Span[] = emailSpans ?? extractEmails(text);
  const rawHits: RawHit[] = [];
  for (const re of [SCHEME_URL_RE, WWW_RE]) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const raw = m[0].replace(/[.,;:!?)\]]+$/, "");
      rawHits.push({ start: m.index ?? 0, raw, end: (m.index ?? 0) + raw.length });
    }
  }
  // Bare domains not already covered by a URL match or an email's domain part.
  BARE_DOMAIN_RE.lastIndex = 0;
  for (const m of text.matchAll(BARE_DOMAIN_RE)) {
    const raw = m[0].replace(/[.,;:!?)]+$/, "");
    const start = m.index ?? 0;
    const hit = { start, raw, end: start + raw.length };
    if (overlapping(hit, rawHits)) continue;
    if (emailSpanList.some((e) => hit.start < e.end && e.start < hit.end)) continue;
    const defanged = defangUrl(raw);
    const host = defanged.split("/")[0].split("?")[0].split(":")[0].toLowerCase();
    const tld = host.split(".").pop() ?? "";
    if (!KNOWN_TLDS.has(tld) && !host.includes("xn--") && !/[\u0080-\uFFFF]/.test(host)) continue;
    rawHits.push(hit);
  }

  return rawHits
    .sort((a, b) => a.start - b.start)
    .map(({ start, end, raw }) => {
      const defanged = defangUrl(raw);
      const withScheme = /^https?:\/\//i.test(defanged) ? defanged : `http://${defanged}`;
      const host = hostFromInput(withScheme);
      const registrable = host ? registrableDomain(host) : null;
      const flags: string[] = [];
      if (host) {
        if (isPunycode(host)) flags.push("punycode");
        if (hasNonAscii(host)) flags.push("non-ascii hostname");
        if (looksLikeIp(host)) flags.push("raw IP address");
        if (isShortener(registrable)) flags.push("URL shortener");
        if (isFormBuilder(host)) flags.push("third-party form host");
        if (isChatHost(registrable)) flags.push("chat platform");
        if (/^http:\/\//i.test(raw)) flags.push("not HTTPS");
        if (/^hxxp/i.test(raw) || /\[\.\]|\[dot\]/i.test(raw)) flags.push("defanged link");
      } else {
        flags.push("unparseable URL");
      }
      return { raw, hostname: host, registrable, flags, start, end };
    });
}

export interface ExtractedEmail extends Span {
  raw: string;
  host: string;
  registrable: string | null;
}

export function extractEmails(text: string): ExtractedEmail[] {
  const emails: ExtractedEmail[] = [];
  EMAIL_RE.lastIndex = 0;
  for (const m of text.matchAll(EMAIL_RE)) {
    const raw = m[0];
    const host = raw.split("@")[1].toLowerCase();
    emails.push({
      raw,
      host,
      registrable: registrableDomain(host),
      start: m.index ?? 0,
      end: (m.index ?? 0) + raw.length,
      text: raw,
    });
  }
  return emails;
}

export function extractPhones(text: string): Span[] {
  const phones: Span[] = [];
  PHONE_RE.lastIndex = 0;
  for (const m of text.matchAll(PHONE_RE)) {
    phones.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, text: m[0] });
  }
  return phones;
}

export function extractChatHandles(text: string): Span[] {
  const handles: Span[] = [];
  CHAT_HANDLE_RE.lastIndex = 0;
  for (const m of text.matchAll(CHAT_HANDLE_RE)) {
    const handle = `@${m[1]}`;
    const off = m[0].lastIndexOf("@");
    const start = (m.index ?? 0) + off;
    handles.push({ start, end: start + handle.length, text: handle });
  }
  return handles;
}

export function extractChatPlatforms(text: string): Span[] {
  const hits: Span[] = [];
  const seen = new Set<string>();
  CHAT_PLATFORM_RE.lastIndex = 0;
  for (const m of text.matchAll(CHAT_PLATFORM_RE)) {
    const key = m[0].toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, text: m[0] });
  }
  return hits;
}

export function extractPaymentInstruments(text: string): Span[] {
  const hits: Span[] = [];
  PAYMENT_RE.lastIndex = 0;
  const seen = new Set<string>();
  for (const m of text.matchAll(PAYMENT_RE)) {
    const key = m[0].toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, text: m[0] });
  }
  return hits;
}
