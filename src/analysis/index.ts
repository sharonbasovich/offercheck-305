import { classifyChannels } from "./provenance";
import { collectSignals } from "./signals";
import { BAND_LABELS, bandForScore } from "./types";
import { buildVerifyPath } from "./verify";
import type { AnalysisResult, AnalyzeInput } from "./types";

export * from "./types";
export {
  extractLinks,
  extractEmails,
  extractPhones,
  extractChatHandles,
  extractPaymentInstruments,
  defangUrl,
} from "./extract";
export {
  registrableDomain,
  normalizeHost,
  hostFromInput,
  isPunycode,
  isShortener,
  isFreeWebmail,
  isFormBuilder,
  isChatHost,
  isLookalike,
  levenshtein,
  sldOf,
} from "./domains";
export { classifyChannels } from "./provenance";
export { buildVerifyPath } from "./verify";

export function analyzeOffer(input: AnalyzeInput): AnalysisResult {
  const { signals, links, claimedRegistrable, senderRegistrable } = collectSignals(input);
  const channels = classifyChannels(input);
  const verifyPath = buildVerifyPath(input);

  // Provenance contributes to the score: a lookalike sender/link is serious;
  // a pile-up of unverifiable channels adds modest pressure.
  const lookalikes = channels.filter((c) => c.verdict === "lookalike").length;
  const unverifiable = channels.filter((c) => c.verdict === "unverifiable").length;
  const provenanceScore = Math.min(lookalikes * 20, 40) + Math.min(unverifiable * 5, 15);

  const score = Math.min(
    100,
    signals.reduce((sum, s) => sum + s.weight, 0) + provenanceScore,
  );
  const band = bandForScore(score);

  const counts = signals.reduce<Record<string, number>>((acc, s) => {
    acc[s.severity] = (acc[s.severity] ?? 0) + 1;
    return acc;
  }, {});
  const parts = (["high", "medium", "low", "info"] as const)
    .filter((k) => counts[k])
    .map((k) => `${counts[k]} ${k}-severity`);
  const channelSummary =
    channels.length === 0
      ? "No contact channels found."
      : `Channels: ${channels.filter((c) => c.verdict === "official").length} official, ` +
        `${lookalikes} lookalike, ` +
        `${channels.filter((c) => c.verdict === "unrelated").length} unrelated, ` +
        `${unverifiable} unverifiable.`;
  const summary =
    (signals.length
      ? `Found ${signals.length} signal${signals.length === 1 ? "" : "s"} (${parts.join(", ")}). `
      : "No suspicious language detected. ") +
    `${channelSummary} Score ${score}/100 → ${BAND_LABELS[band]}. Heuristics only — verify independently before acting.`;

  return {
    score,
    band,
    bandLabel: BAND_LABELS[band],
    signals: [...signals].sort((a, b) => b.weight - a.weight),
    links,
    channels,
    verifyPath,
    claimedRegistrable,
    senderRegistrable,
    summary,
  };
}
