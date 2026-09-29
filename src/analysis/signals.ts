import {
  affiliatedSource,
  hostFromInput,
  isFreeWebmail,
  registrableDomain,
} from "./domains";
import { extractEmails, extractLinks } from "./extract";
import type { AnalyzeInput, Signal, Span } from "./types";

interface PhraseDef {
  pattern: RegExp;
  title: string;
  detail: string;
  severity: Signal["severity"];
  weight: number;
}

function phraseBank(category: Signal["category"], defs: PhraseDef[]) {
  return defs.map((d, i) => ({ ...d, id: `${category}-${i}`, category }));
}

const PAYMENT = phraseBank("payment", [
  {
    pattern: /\b(?:gift|itunes|steam|google\s*play|amazon)\s*cards?\b/gi,
    title: "Gift card payment request",
    detail:
      "Legitimate employers and scholarship programs never ask you to buy or send gift cards. This is the single most common advance-fee scam pattern.",
    severity: "high",
    weight: 45,
  },
  {
    pattern: /\b(?:wire\s*transfer|western\s*union|moneygram|money\s*order)\b/gi,
    title: "Wire/money-transfer request",
    detail: "Requests to send or forward money by wire or remittance service are a hallmark of job-offer fraud and money-mule recruitment.",
    severity: "high",
    weight: 40,
  },
  {
    pattern: /\b(?:bitcoin|crypto(?:currency)?|usdt|ethereum|btc\s*wallet)\b/gi,
    title: "Cryptocurrency payment request",
    detail: "Crypto payments are irreversible and are not used by real internship or scholarship programs for fees or deposits.",
    severity: "high",
    weight: 40,
  },
  {
    pattern: /\b(?:processing|activation|registration|application|training|starter[-\s]?kit|equipment|software|background\s*(?:check|screening)|screening|release|verification|insurance|clearance|disbursement|onboarding|kit)\s+(?:fees?|charges?|costs?)\b/gi,
    title: "Upfront fee request",
    detail: "Any fee you must pay to receive a job, internship, or scholarship is a classic scam. Real employers and funders do not charge applicants.",
    severity: "high",
    weight: 40,
  },
  {
    pattern: /\b(?:deposit|mobile\s*deposit|cash(?:app)?|zelle|venmo|paypal)\b.{0,60}\b(?:check|cheque|refund|reimburs)|\b(?:check|cheque)\b.{0,60}\b(?:deposit|mobile\s*deposit|forward|send|transfer|keep)/gi,
    title: "Check-deposit / reimbursement scheme",
    detail: "Fake-check scams send you a check, ask you to deposit it, then forward part of the money. The check bounces weeks later and you owe the bank.",
    severity: "high",
    weight: 40,
  },
  {
    pattern: /\b(?:send|forward|transfer|pay|purchase|wire)\b[^.\n]{0,40}\$?\s*\d[\d,]*/gi,
    title: "Asked to send money",
    detail: "The offer asks you to send money. No legitimate opportunity requires applicants to send funds.",
    severity: "high",
    weight: 40,
  },
  {
    pattern: /\b(?:check|cheque)\b[^.\n]{0,160}\b(?:vendor|supplier|equipment\s*(?:purchase|kit|bundle)|starter\s*kit)/gi,
    title: "Fake-check vendor purchase",
    detail: "Fake-check scams have you deposit a check and forward the balance to a 'vendor' or 'supplier'. The check bounces and the money you sent is gone.",
    severity: "high",
    weight: 40,
  },
  {
    pattern: /(?<=^|[.!?\n])[^.!?\n]*?(?=[^.!?\n]*\b(?:fees?|charges?|costs?|payable|price|purchase|buy)\b)[^.!?\n]*?\b(?:venmo|cash\s*app|zelle|paypal|apple\s*(?:pay|cash)|interac(?:\s*e-?transfer)?|e-?transfer)\b/gi,
    title: "Fee payable through a payment app",
    detail: "The offer asks you to pay a fee or charge through a peer-to-peer payment app. These transfers are instant and hard to reverse, which is why scammers prefer them. Real employers and funders do not charge you.",
    severity: "high",
    weight: 40,
  },
  {
    pattern: /\b(?:charged|billed|debited)\s+(?:to\s+)?(?:your\s+)?(?:credit\s+|debit\s+)?card\b|\breimburs\w*\s+(?:on|in|with|from|through)\s+your\s+first\s+(?:pay\s*check|paycheque|pay\s*stub|salary|payroll|payment)\b/gi,
    title: "Pay now, reimbursed later",
    detail: "Being told to pay a screening, training, or equipment cost now and get it back on your first paycheck is an upfront-fee scam. Real employers pay these costs directly.",
    severity: "high",
    weight: 40,
  },
]);

const PII = phraseBank("pii", [
  {
    pattern: /\b(?:social\s*security|ssn)\b/gi,
    title: "Social Security number requested",
    detail: "SSNs should only be given after an offer is independently verified — typically on official payroll forms (W-4/I-9), never over email or a web form linked in a message.",
    severity: "high",
    weight: 30,
  },
  {
    pattern: /\b(?:passport|driver'?s?\s*licen[sc]e|national\s*id|photo\s*id)\b.{0,40}\b(?:copy|number|scan|upload|attach|send)/gi,
    title: "Identity document requested",
    detail: "Asking for scans of passports or IDs before verification is a common identity-theft vector.",
    severity: "high",
    weight: 30,
  },
  {
    pattern: /\b(?:bank\s*account|routing\s*number|account\s*number|credit\s*card|debit\s*card|card\s*number|cvv)\b/gi,
    title: "Banking/card details requested",
    detail: "Bank details are only ever collected through verified payroll systems after hiring — never in the offer stage.",
    severity: "high",
    weight: 35,
  },
  {
    pattern: /\b(?:mother'?s\s*maiden|security\s*question|date\s*of\s*birth.{0,30}(?:send|provide|reply|confirm))\b/gi,
    title: "Security-question bait",
    detail: "Questions like mother's maiden name are account-recovery answers — handing them over enables account takeover.",
    severity: "medium",
    weight: 20,
  },
  {
    pattern: /\b(?:personal|private|alternate|alternative|non[-\s]?(?:university|school|work))\s+(?:e-?mail|phone|cell(?:\s*phone)?|mobile|number|contact)\b|\bcell\s*(?:phone\s*)?number\b/gi,
    title: "Asks to move to personal contact details",
    detail: "Asking for your personal email or cell number moves the conversation off official channels, where the organization can't see it and filters can't catch it.",
    severity: "medium",
    weight: 15,
  },
]);

const URGENCY = phraseBank("urgency", [
  {
    pattern: /\b(?:act\s*now|immediately|asap|right\s*away|today\s*only|final\s*notice|last\s*chance|don'?t\s*miss)\b/gi,
    title: "Pressure to act immediately",
    detail: "Scammers use urgency so you skip verification. Real offers give you reasonable time to decide.",
    severity: "medium",
    weight: 12,
  },
  {
    pattern: /\b(?:within|in\s*the\s*next)\s+(?:24|48|72)\s*hours?\b/gi,
    title: "Short deadline pressure",
    detail: "24–72 hour deadlines are designed to stop you from checking with the real organization.",
    severity: "medium",
    weight: 12,
  },
  {
    pattern: /\b(?:limited\s*(?:spots?|seats?|slots?)|only\s+\d+\s+(?:spots?|positions?|awards?)\s*(?:left|remain))/gi,
    title: "Artificial scarcity",
    detail: "Claims of very few remaining spots push fast, unverified decisions.",
    severity: "low",
    weight: 8,
  },
]);

const CHANNEL = phraseBank("channel", [
  {
    pattern: /\b(?:telegram|whats\s*app|signal|wechat|google\s*chat|google\s*hangouts?|sms|text\s*message)\b[^.\n]{0,80}\b(?:interview|onboard|contact|reply|continue|proceed)|\b(?:interview|onboarding|onboard)\b[^.\n]{0,80}\b(?:telegram|whats\s*app|signal|wechat|google\s*chat|google\s*hangouts?|sms|via\s*text|text\s*message)|\b(?:text|sms)\s+interview\b/gi,
    title: "Interview moved to messaging app",
    detail: "Moving an interview or onboarding to Telegram/WhatsApp/text is a strong scam signal — real employers use verifiable corporate channels.",
    severity: "high",
    weight: 25,
  },
  {
    pattern: /\b(?:no\s*(?:interview|experience)\s*(?:needed|required|necessary)|interview\s*not\s*required)\b/gi,
    title: "No interview or experience required",
    detail: "Guaranteed placement with no interview or experience is not how competitive internships or scholarships work.",
    severity: "medium",
    weight: 15,
  },
]);

const CONTENT = phraseBank("content", [
  {
    pattern: /\b(?:guaranteed|100%\s*guarantee|risk[-\s]?free)\b/gi,
    title: "Guaranteed-outcome language",
    detail: "No legitimate offer can guarantee outcomes or earnings.",
    severity: "medium",
    weight: 10,
  },
  {
    pattern: /\$\s?\d{3,}(?:,\d{3})*\s*(?:per|a|\/)\s*(?:day|week)\b/gi,
    title: "Unrealistic pay for the role",
    detail: "High daily/weekly pay for entry-level internship work is a bait tactic.",
    severity: "medium",
    weight: 15,
  },
  {
    pattern: /\b(?:congratulations[,!]?\s*you\s*(?:have|'?ve)\s*been\s*(?:selected|chosen)|you\s*(?:have|'?ve)\s*been\s*pre[-\s]?approv)/gi,
    title: "Unsolicited selection notice",
    detail: "Being 'selected' or 'pre-approved' for something you never applied to is a mass-scam opener.",
    severity: "medium",
    weight: 15,
  },
  {
    pattern: /\b(?:personal|virtual)\s+assistant\b|\brun(?:ning)?\s+(?:personal\s+)?errands?\b|\bwhile\s+I\s+(?:am\s+)?(?:travel(?:l?ing)?|away|abroad|out\s+of\s+(?:town|the\s+country)|at\s+(?:a\s+)?conference)\b/gi,
    title: "Personal-assistant / errand job",
    detail: "A \"professor\" or executive who needs a remote personal assistant to run errands while they travel is one of the scams universities most often warn students about. It usually leads to a fake check or a gift-card purchase.",
    severity: "high",
    weight: 25,
  },
]);

const ALL_BANKS = [...PAYMENT, ...PII, ...URGENCY, ...CHANNEL, ...CONTENT];

function phraseSignals(text: string): Signal[] {
  const signals: Signal[] = [];
  for (const def of ALL_BANKS) {
    const evidence: Span[] = [];
    def.pattern.lastIndex = 0;
    for (const m of text.matchAll(def.pattern)) {
      evidence.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, text: m[0] });
    }
    if (evidence.length > 0) {
      signals.push({
        id: def.id,
        category: def.category,
        severity: def.severity,
        weight: def.weight,
        title: def.title,
        detail: def.detail,
        evidence,
      });
    }
  }
  return signals;
}

export function collectSignals(input: AnalyzeInput): {
  signals: Signal[];
  links: ReturnType<typeof extractLinks>;
  claimedRegistrable: string | null;
  senderRegistrable: string | null;
} {
  const text = input.offerText;
  const signals = phraseSignals(text);
  const inlineEmails = extractEmails(text);
  const links = extractLinks(text, inlineEmails);

  const claimedHost = hostFromInput(input.claimedDomain);
  const claimedRegistrable = claimedHost ? registrableDomain(claimedHost) : null;
  const senderHost = hostFromInput(input.senderEmail);
  const senderRegistrable = senderHost ? registrableDomain(senderHost) : null;

  if (claimedHost) {
    if (
      senderHost &&
      senderRegistrable &&
      claimedRegistrable &&
      affiliatedSource(senderRegistrable, claimedRegistrable)
    ) {
      signals.push({
        id: "domain-sender-affiliated",
        category: "domain",
        severity: "info",
        weight: 0,
        title: "Sender uses an affiliated institutional domain",
        detail: `${senderRegistrable} is listed by ${affiliatedSource(senderRegistrable, claimedRegistrable)} as an institutional contact domain of ${claimedRegistrable}. Affiliation explains the domain but does not prove this sender is genuine — verify through official channels.`,
        evidence: [],
      });
    } else if (senderHost && senderRegistrable && claimedRegistrable && senderRegistrable !== claimedRegistrable) {
      const freeMail = isFreeWebmail(senderRegistrable);
      signals.push({
        id: "domain-sender-mismatch",
        category: "domain",
        severity: freeMail ? "high" : "medium",
        weight: freeMail ? 30 : 20,
        title: freeMail
          ? "Sender uses free webmail, not the claimed organization"
          : "Sender domain does not match the claimed organization",
        detail: freeMail
          ? `The message claims to be from ${claimedRegistrable} but was sent from ${senderRegistrable}, a free webmail provider. Real organizations email from their own domain.`
          : `Sender domain ${senderRegistrable} differs from claimed domain ${claimedRegistrable}. Verify the relationship before trusting.`,
        evidence: [],
      });
    }
    for (const link of links) {
      const skipOffDomain =
        link.flags.includes("raw IP address") || link.flags.includes("unparseable URL");
      if (link.registrable && link.registrable !== claimedRegistrable && !skipOffDomain) {
        const isForm = link.flags.includes("third-party form host");
        if (affiliatedSource(link.registrable, claimedRegistrable)) {
          signals.push({
            id: `link-affiliated-${link.start}`,
            category: "link",
            severity: "info",
            weight: 0,
            title: "Link is on an affiliated institutional domain",
            detail: `${link.registrable} is listed by ${affiliatedSource(link.registrable, claimedRegistrable)} as an institutional domain of ${claimedRegistrable}. Affiliation does not prove the link is genuine.`,
            evidence: [{ start: link.start, end: link.end, text: link.raw }],
          });
          continue;
        }
        signals.push({
          id: `link-offdomain-${link.start}`,
          category: "link",
          severity: "medium",
          weight: isForm ? 12 : 20,
          title: isForm
            ? "Link goes to a third-party form, not the organization"
            : "Link is off-domain from the claimed organization",
          detail: `Link host ${link.registrable} does not match claimed domain ${claimedRegistrable}.${
            isForm
              ? " Real programs rarely collect applications through generic form builders linked from email."
              : ""
          }`,
          evidence: [{ start: link.start, end: link.end, text: link.raw }],
        });
      }
    }
  }

  for (const link of links) {
    for (const flag of link.flags) {
      if (flag === "off-domain" || flag === "not HTTPS") continue;
      const meta: Record<string, { title: string; detail: string; severity: Signal["severity"]; weight: number }> = {
        punycode: {
          title: "Punycode (internationalized) domain",
          detail:
            "xn-- domains can visually imitate a real organization's domain using look-alike Unicode characters. Treat as hostile until proven otherwise.",
          severity: "high",
          weight: 35,
        },
        "non-ascii hostname": {
          title: "Non-ASCII characters in domain",
          detail: "Unicode look-alike characters in a hostname are a classic impersonation technique.",
          severity: "high",
          weight: 35,
        },
        "raw IP address": {
          title: "Link points at a raw IP address",
          detail: "Legitimate organizations link to named domains, not bare IP addresses.",
          severity: "high",
          weight: 30,
        },
        "URL shortener": {
          title: "URL shortener hides the real destination",
          detail: "Shortened links conceal where you will actually land. Real offers link to their own domain.",
          severity: "medium",
          weight: 20,
        },
        "third-party form host": {
          title: "Third-party form host",
          detail:
            "Collecting applications through a generic form service instead of the organization's own site is a common scam pattern — verify independently.",
          severity: "medium",
          weight: 15,
        },
        "unparseable URL": {
          title: "Unparseable link",
          detail: "This text looks like a link but could not be parsed — possibly an obfuscation attempt.",
          severity: "low",
          weight: 8,
        },
      };
      const m = meta[flag];
      if (!m) continue;
      signals.push({
        id: `link-${flag}-${link.start}`,
        category: "link",
        severity: m.severity,
        weight: m.weight,
        title: m.title,
        detail: m.detail,
        evidence: [{ start: link.start, end: link.end, text: link.raw }],
      });
    }
    if (link.flags.includes("not HTTPS")) {
      signals.push({
        id: `link-http-${link.start}`,
        category: "link",
        severity: "low",
        weight: 5,
        title: "Insecure HTTP link",
        detail: "A plain http:// link offers no transport integrity. Minor signal on its own, but unusual for a real organization.",
        evidence: [{ start: link.start, end: link.end, text: link.raw }],
      });
    }
  }

  // Emails inside the offer text that don't match the claimed domain.
  if (claimedRegistrable) {
    for (const e of inlineEmails) {
      if (e.registrable && e.registrable !== claimedRegistrable) {
        if (affiliatedSource(e.registrable, claimedRegistrable)) {
          signals.push({
            id: `email-affiliated-${e.start}`,
            category: "domain",
            severity: "info",
            weight: 0,
            title: "Contact email is on an affiliated institutional domain",
            detail: `${e.registrable} is listed by ${affiliatedSource(e.registrable, claimedRegistrable)} as an institutional contact domain of ${claimedRegistrable}. Affiliation does not prove the address is genuine.`,
            evidence: [{ start: e.start, end: e.end, text: e.raw }],
          });
          continue;
        }
        const freeMail = isFreeWebmail(e.registrable);
        signals.push({
          id: `email-offdomain-${e.start}`,
          category: "domain",
          severity: freeMail ? "medium" : "medium",
          weight: freeMail ? 15 : 15,
          title: freeMail
            ? "Contact email is a free webmail address"
            : "Contact email does not match the claimed organization",
          detail: `The offer routes replies to ${e.registrable}, not ${claimedRegistrable}.${
            freeMail
              ? " Free webmail proves nothing about who controls it — treat the contact as unverified."
              : ""
          }`,
          evidence: [{ start: e.start, end: e.end, text: e.raw }],
        });
      }
    }
  }

  return { signals, links, claimedRegistrable, senderRegistrable };
}
