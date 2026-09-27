export interface Span {
  start: number;
  end: number;
  text: string;
}

export type Severity = "info" | "low" | "medium" | "high";

export type SignalCategory =
  | "domain"
  | "link"
  | "payment"
  | "pii"
  | "urgency"
  | "channel"
  | "content";

export interface Signal {
  id: string;
  category: SignalCategory;
  severity: Severity;
  /** Contribution to the 0–100 risk score. */
  weight: number;
  title: string;
  detail: string;
  /** Spans into the pasted offer text; empty for field-level signals. */
  evidence: Span[];
}

export interface LinkInfo {
  /** The raw URL text exactly as pasted. Never fetched. */
  raw: string;
  hostname: string | null;
  /** Registrable (eTLD+1-style) domain, best-effort. */
  registrable: string | null;
  flags: string[];
}

export type ChannelKind = "sender" | "email" | "link" | "phone" | "chat" | "payment";

/**
 * Provenance verdicts:
 * - official: the channel's registrable domain matches the claimed institution's domain.
 * - lookalike: the domain is different but visibly imitates the institution
 *   (brand embedded in a foreign registrable, small edit distance, or IDN/homoglyph).
 * - unrelated: a different, non-imitating domain — including free webmail —
 *   or a phone/chat/payment channel owned by whoever controls it.
 * - unverifiable: the channel's destination cannot be tied to any organization
 *   offline (shorteners, form hosts, raw IPs, chat handles, phone numbers,
 *   payment instruments).
 */
export type ChannelVerdict = "official" | "unrelated" | "lookalike" | "unverifiable";

export interface Channel {
  kind: ChannelKind;
  /** Raw text as pasted (an email, URL, handle, number, or payment term). */
  value: string;
  hostname: string | null;
  verdict: ChannelVerdict;
  reason: string;
  span: Span | null;
}

export type RiskBand = "low" | "caution" | "high" | "stop";

export interface AnalyzeInput {
  organization: string;
  claimedDomain: string;
  senderEmail: string;
  offerText: string;
}

export interface AnalysisResult {
  score: number;
  band: RiskBand;
  bandLabel: string;
  signals: Signal[];
  links: LinkInfo[];
  channels: Channel[];
  /** Verification steps built only from the claimed institution — never
   *  from a channel the offer supplied. */
  verifyPath: string[];
  claimedRegistrable: string | null;
  senderRegistrable: string | null;
  summary: string;
}

export const BAND_LABELS: Record<RiskBand, string> = {
  low: "Low",
  caution: "Caution",
  high: "High",
  stop: "Stop",
};

export const BAND_HINTS: Record<RiskBand, string> = {
  low: "No strong signals found. Still verify — a low score does not certify legitimacy.",
  caution: "Some signals warrant a closer look. Verify independently before responding.",
  high: "Multiple concerning signals. Do not reply or send anything until independently verified.",
  stop: "Strong scam indicators. Do not engage; verify only through channels you find yourself.",
};

export function bandForScore(score: number): RiskBand {
  if (score >= 70) return "stop";
  if (score >= 45) return "high";
  if (score >= 20) return "caution";
  return "low";
}
