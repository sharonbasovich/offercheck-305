import {
  affiliatedSource,
  hasNonAscii,
  hostFromInput,
  isChatHost,
  isFormBuilder,
  isFreeWebmail,
  isLookalike,
  isPunycode,
  isShortener,
  looksLikeIp,
  registrableDomain,
} from "./domains";
import {
  extractChatHandles,
  extractChatPlatforms,
  extractEmails,
  extractLinks,
  extractPaymentInstruments,
  extractPhones,
} from "./extract";
import type { AnalyzeInput, Channel, ChannelVerdict } from "./types";

function classifyDomainChannel(
  host: string | null,
  claimedRegistrable: string | null,
  linkFlags: string[] = [],
): { verdict: ChannelVerdict; reason: string } {
  if (!host) {
    return { verdict: "unverifiable", reason: "This address could not be parsed into a domain." };
  }
  const reg = registrableDomain(host);
  if (looksLikeIp(host)) {
    return { verdict: "unverifiable", reason: "A raw IP address cannot be tied to the organization." };
  }
  if (claimedRegistrable && reg === claimedRegistrable) {
    return { verdict: "official", reason: `Matches the claimed domain ${claimedRegistrable}.` };
  }
  const affiliation = affiliatedSource(reg, claimedRegistrable);
  if (affiliation) {
    return {
      verdict: "unrelated",
      reason: `${reg} is listed by ${affiliation} as an institutional contact domain — affiliation does not prove this address is genuine; verify independently.`,
    };
  }
  if (isPunycode(host) || hasNonAscii(host)) {
    return {
      verdict: "lookalike",
      reason: "Internationalized/look-alike domain — can visually imitate the real one.",
    };
  }
  if (claimedRegistrable && isLookalike(host, claimedRegistrable)) {
    return {
      verdict: "lookalike",
      reason: `Different domain (${reg}) that visibly imitates ${claimedRegistrable}.`,
    };
  }
  if (isShortener(reg)) {
    return { verdict: "unverifiable", reason: "URL shortener — the real destination is hidden." };
  }
  if (isFormBuilder(host)) {
    return {
      verdict: "unverifiable",
      reason: "Third-party form host — anyone can create a form here.",
    };
  }
  if (isChatHost(reg) || linkFlags.includes("chat platform")) {
    return {
      verdict: "unverifiable",
      reason: "Messaging-platform contact — cannot be tied to the organization offline.",
    };
  }
  if (isFreeWebmail(reg)) {
    return {
      verdict: "unrelated",
      reason: `${reg} is a free webmail provider — not controlled by the claimed organization.`,
    };
  }
  if (!claimedRegistrable) {
    return {
      verdict: "unverifiable",
      reason: "No claimed domain was provided to compare against.",
    };
  }
  return {
    verdict: "unrelated",
    reason: `Different domain (${reg ?? host}) with no visible imitation of ${claimedRegistrable}.`,
  };
}

export function classifyChannels(input: AnalyzeInput): Channel[] {
  const claimedHost = hostFromInput(input.claimedDomain);
  const claimedRegistrable = claimedHost ? registrableDomain(claimedHost) : null;
  const channels: Channel[] = [];

  const senderHost = hostFromInput(input.senderEmail);
  if (senderHost) {
    const { verdict, reason } = classifyDomainChannel(senderHost, claimedRegistrable);
    channels.push({
      kind: "sender",
      value: input.senderEmail.trim(),
      hostname: senderHost,
      verdict,
      reason,
      span: null,
    });
  }

  const emails = extractEmails(input.offerText);
  for (const e of emails) {
    const { verdict, reason } = classifyDomainChannel(e.host, claimedRegistrable);
    channels.push({
      kind: "email",
      value: e.raw,
      hostname: e.host,
      verdict,
      reason,
      span: { start: e.start, end: e.end, text: e.raw },
    });
  }

  const links = extractLinks(input.offerText, emails);
  for (const l of links) {
    const { verdict, reason } = classifyDomainChannel(l.hostname, claimedRegistrable, l.flags);
    channels.push({
      kind: isChatHost(l.registrable) ? "chat" : "link",
      value: l.raw,
      hostname: l.hostname,
      verdict,
      reason,
      span: { start: l.start, end: l.end, text: l.raw },
    });
  }

  for (const p of extractPhones(input.offerText)) {
    channels.push({
      kind: "phone",
      value: p.text,
      hostname: null,
      verdict: "unverifiable",
      reason: "Phone numbers cannot be tied to the organization without an independent directory lookup — find the official number yourself.",
      span: p,
    });
  }

  for (const h of extractChatHandles(input.offerText)) {
    channels.push({
      kind: "chat",
      value: h.text,
      hostname: null,
      verdict: "unverifiable",
      reason: "Messaging-app handles belong to whoever registered them — they prove nothing about the organization.",
      span: h,
    });
  }

  for (const p of extractChatPlatforms(input.offerText)) {
    channels.push({
      kind: "chat",
      value: p.text,
      hostname: null,
      verdict: "unverifiable",
      reason: "A messaging-platform contact is controlled by whoever registered the account — it cannot be tied to the organization offline.",
      span: p,
    });
  }

  for (const p of extractPaymentInstruments(input.offerText)) {
    channels.push({
      kind: "payment",
      value: p.text,
      hostname: null,
      verdict: "unverifiable",
      reason: "A payment channel requested by the sender is controlled by the sender — legitimate programs don't ask applicants to pay.",
      span: p,
    });
  }

  return channels;
}
