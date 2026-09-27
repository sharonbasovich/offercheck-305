/**
 * Best-effort domain normalization. This is NOT the full Public Suffix List;
 * it covers the common multi-part suffixes students are most likely to see so
 * that `careers.foo.ac.uk` still reduces to `foo.ac.uk`.
 */
const MULTI_PART_SUFFIXES = new Set([
  "ac.uk", "co.uk", "gov.uk", "ltd.uk", "me.uk", "net.uk", "org.uk", "plc.uk", "sch.uk",
  "ac.in", "co.in", "edu.in", "firm.in", "gov.in", "net.in", "org.in", "res.in",
  "com.au", "edu.au", "gov.au", "net.au", "org.au",
  "com.br", "edu.br", "gov.br", "net.br", "org.br",
  "ac.jp", "co.jp", "go.jp", "ne.jp", "or.jp",
  "ac.kr", "co.kr", "go.kr", "ne.kr", "or.kr", "re.kr",
  "com.mx", "edu.mx", "gob.mx", "net.mx", "org.mx",
  "com.cn", "edu.cn", "gov.cn", "net.cn", "org.cn",
  "com.sg", "edu.sg", "gov.sg", "net.sg", "org.sg",
  "co.nz", "ac.nz", "govt.nz", "net.nz", "org.nz",
  "com.tr", "edu.tr", "gov.tr", "net.tr", "org.tr",
  "com.ar", "edu.ar", "gob.ar", "net.ar", "org.ar",
  "com.co", "edu.co", "gov.co", "net.co", "org.co",
  "com.pk", "edu.pk", "gov.pk", "net.pk", "org.pk",
  "com.ng", "edu.ng", "gov.ng", "net.ng", "org.ng",
  "com.ph", "edu.ph", "gov.ph", "net.ph", "org.ph",
  "com.my", "edu.my", "gov.my", "net.my", "org.my",
  "com.tw", "edu.tw", "gov.tw", "net.tw", "org.tw",
  "com.hk", "edu.hk", "gov.hk", "net.hk", "org.hk",
  "co.za", "ac.za", "gov.za", "net.za", "org.za",
  "com.ua", "edu.ua", "gov.ua", "net.ua", "org.ua",
  "com.vn", "edu.vn", "gov.vn", "net.vn", "org.vn",
  "co.th", "ac.th", "go.th", "in.th", "or.th",
  "com.eg", "edu.eg", "gov.eg", "net.eg", "org.eg",
  "com.pe", "edu.pe", "gob.pe", "net.pe", "org.pe",
  "com.ve", "edu.ve", "gob.ve", "net.ve", "org.ve",
  "com.pl", "edu.pl", "gov.pl", "net.pl", "org.pl",
  "com.es", "edu.es", "gob.es", "nom.es", "org.es",
]);

const SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "rb.gy", "cutt.ly", "is.gd",
  "buff.ly", "ow.ly", "shorturl.at", "tiny.cc", "rebrand.ly", "lnkd.in",
  "bit.do", "s.id", "clck.ru", "v.gd", "qr.ae", "short.io", "t.ly",
]);

const FREE_WEBMAIL = new Set([
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "aol.com",
  "proton.me", "protonmail.com", "icloud.com", "mail.com", "zoho.com",
  "gmx.com", "gmx.net", "yandex.com", "live.com", "msn.com", "pm.me",
]);

/** Hosts whose only purpose is collecting form responses off-domain. */
const FORM_BUILDERS = new Set([
  "forms.gle", "docs.google.com", "forms.office.com", "jotform.com",
  "typeform.com", "surveymonkey.com", "forms.app", "tally.so",
  "airtable.com", "formstack.com", "cognitoforms.com", "qualtrics.com",
  "google.com", "office.com", "wufoo.com", "123formbuilder.com",
]);

/** Messaging platforms — a link or handle here is a chat channel. */
const CHAT_HOSTS = new Set([
  "t.me", "telegram.me", "wa.me", "whatsapp.com", "signal.me",
  "weixin.qq.com", "wechat.com", "discord.gg", "discord.com",
]);

export function normalizeHost(raw: string): string {
  return raw.trim().toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}

export function looksLikeIp(host: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.startsWith("[");
}

/** Extract hostname-like text from a user-entered domain/email/URL field. */
export function hostFromInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let candidate = trimmed;
  if (candidate.includes("@")) candidate = candidate.split("@").pop() ?? candidate;
  if (/^hxxps?:/i.test(candidate)) candidate = candidate.replace(/^hxxp/i, "http");
  candidate = candidate.replace(/\[\.\]|\[dot\]/gi, ".");
  if (candidate.includes("://")) {
    try {
      candidate = new URL(candidate).hostname;
    } catch {
      return null;
    }
  }
  candidate = candidate.split("/")[0].split("?")[0].split(":")[0];
  const host = normalizeHost(candidate);
  if (looksLikeIp(host)) return host;
  return /^[a-z0-9.-]+\.[a-z0-9-]{2,}$/i.test(host) || host.includes("xn--") || /[\u0080-\uFFFF]/.test(host)
    ? host
    : null;
}

/** Registrable-domain heuristic: last 3 labels when the last 2 form a known multi-part suffix. */
export function registrableDomain(host: string): string | null {
  if (looksLikeIp(host)) return host;
  const labels = normalizeHost(host).split(".").filter(Boolean);
  if (labels.length < 2) return null;
  const last2 = labels.slice(-2).join(".");
  if (labels.length >= 3 && MULTI_PART_SUFFIXES.has(last2)) {
    return labels.slice(-3).join(".");
  }
  return last2;
}

/** The "name" label of a registrable domain: `uwaterloo` for `uwaterloo.ca`. */
export function sldOf(registrable: string): string | null {
  const labels = registrable.split(".");
  if (labels.length < 2) return null;
  const last2 = labels.slice(-2).join(".");
  if (labels.length >= 3 && MULTI_PART_SUFFIXES.has(last2)) {
    return labels[labels.length - 3];
  }
  return labels[labels.length - 2];
}

export function isPunycode(host: string): boolean {
  return host.split(".").some((l) => l.startsWith("xn--"));
}

export function hasNonAscii(host: string): boolean {
  return /[\u0080-\uFFFF]/.test(host);
}

export function isShortener(registrable: string | null): boolean {
  return registrable !== null && SHORTENERS.has(registrable);
}

export function isFreeWebmail(registrable: string | null): boolean {
  return registrable !== null && FREE_WEBMAIL.has(registrable);
}

export function isFormBuilder(host: string | null): boolean {
  if (!host) return false;
  const reg = registrableDomain(host);
  return FORM_BUILDERS.has(normalizeHost(host)) || (reg !== null && FORM_BUILDERS.has(reg));
}

export function isChatHost(registrable: string | null): boolean {
  return registrable !== null && CHAT_HOSTS.has(registrable);
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/**
 * Does `registrable` visually imitate `claimedRegistrable`?
 * Catches brand-embedding (`uwaterloo-careers.ca`, `uwaterloo.ca.verify-now.com`)
 * and small typosquat edit distance (`uwaterioo.ca`, `uwaterIoo.ca`).
 */
export function isLookalike(host: string, claimedRegistrable: string): boolean {
  const h = normalizeHost(host);
  const reg = registrableDomain(h);
  if (!reg || reg === claimedRegistrable) return false;

  if (isPunycode(h) || hasNonAscii(h)) return true;

  // Brand embedded as a subdomain of a foreign registrable:
  // uwaterloo.ca.verify-now.com, uwaterloo.evil.com
  if (h === claimedRegistrable || h.endsWith("." + claimedRegistrable)) return false;
  if (h.includes(claimedRegistrable)) return true;

  const claimedSld = sldOf(claimedRegistrable);
  const sld = sldOf(reg);
  if (!claimedSld || !sld) return false;
  if (claimedSld.length >= 4 && (sld.includes(claimedSld) || claimedSld.includes(sld))) return true;
  if (Math.abs(sld.length - claimedSld.length) <= 2 && levenshtein(sld, claimedSld) <= 2) return true;
  return false;
}
