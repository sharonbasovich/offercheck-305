import { describe, expect, it } from "vitest";
import {
  analyzeOffer,
  buildVerifyPath,
  classifyChannels,
  extractLinks,
  extractPhones,
  hostFromInput,
  isLookalike,
  isPunycode,
  isShortener,
  registrableDomain,
} from "../src/analysis";
import { SAMPLE_CASES } from "../src/data/cases";

const base = { organization: "", claimedDomain: "", senderEmail: "", offerText: "" };

describe("domain normalization", () => {
  it("collapses subdomains to the registrable domain", () => {
    expect(registrableDomain("careers.university.edu")).toBe("university.edu");
    expect(registrableDomain("www.example.com")).toBe("example.com");
  });

  it("handles multi-part public suffixes like .ac.uk", () => {
    expect(registrableDomain("jobs.oxford.ac.uk")).toBe("oxford.ac.uk");
    expect(registrableDomain("oxford.ac.uk")).toBe("oxford.ac.uk");
  });

  it("parses hostnames from emails, URLs, and bare domains", () => {
    expect(hostFromInput("hr@brightfield.edu")).toBe("brightfield.edu");
    expect(hostFromInput("https://careers.acme.com/apply")).toBe("careers.acme.com");
    expect(hostFromInput("acme.com")).toBe("acme.com");
    expect(hostFromInput("")).toBeNull();
  });
});

describe("link flagging", () => {
  it("flags punycode domains", () => {
    const links = extractLinks("apply at https://xn--80ak6aa92e.com now");
    expect(links[0].flags).toContain("punycode");
    expect(isPunycode(links[0].hostname!)).toBe(true);
  });

  it("flags URL shorteners", () => {
    const links = extractLinks("apply https://bit.ly/3xJob");
    expect(links[0].flags).toContain("URL shortener");
    expect(isShortener(links[0].registrable)).toBe(true);
  });

  it("flags third-party form hosts", () => {
    const links = extractLinks("fill https://forms.gle/abc123");
    expect(links[0].flags).toContain("third-party form host");
  });

  it("flags raw IP links and non-HTTPS links", () => {
    const links = extractLinks("portal http://185.220.101.4/x");
    expect(links[0].flags).toEqual(expect.arrayContaining(["raw IP address", "not HTTPS"]));
  });

  it("extracts defanged hxxp and [.] domains", () => {
    const links = extractLinks("verify at hxxps://acme-verify[.]net/ok and acme-login[.]net");
    expect(links.map((l) => l.hostname)).toEqual(
      expect.arrayContaining(["acme-verify.net", "acme-login.net"]),
    );
  });

  it("does not extract the domain part of an email as a link", () => {
    const links = extractLinks("email us at jobs@acme.com today");
    expect(links).toHaveLength(0);
  });
});

describe("channel provenance", () => {
  const input = {
    ...base,
    organization: "Acme Corp",
    claimedDomain: "acmecorp.com",
    senderEmail: "hr@acmecorp.com",
  };

  it("marks matching domains Official", () => {
    const channels = classifyChannels({
      ...input,
      offerText: "Apply at https://careers.acmecorp.com and email jobs@acmecorp.com",
    });
    const sender = channels.find((c) => c.kind === "sender")!;
    const link = channels.find((c) => c.kind === "link")!;
    const email = channels.find((c) => c.kind === "email")!;
    expect(sender.verdict).toBe("official");
    expect(link.verdict).toBe("official");
    expect(email.verdict).toBe("official");
  });

  it("marks brand-embedded and typo domains Lookalike", () => {
    expect(isLookalike("acmecorp-careers.net", "acmecorp.com")).toBe(true);
    expect(isLookalike("acmecorp.com.verify-now.com", "acmecorp.com")).toBe(true);
    expect(isLookalike("acmec0rp.com", "acmecorp.com")).toBe(true);
    const channels = classifyChannels({
      ...input,
      senderEmail: "jobs@acmecorp-careers.net",
    });
    expect(channels.find((c) => c.kind === "sender")!.verdict).toBe("lookalike");
  });

  it("marks free webmail Unrelated and phones/chat Unverifiable", () => {
    const channels = classifyChannels({
      ...input,
      senderEmail: "acmecorp.jobs@gmail.com",
      offerText: "Call +1 (519) 555-0100 or Telegram @acme_hr",
    });
    expect(channels.find((c) => c.kind === "sender")!.verdict).toBe("unrelated");
    expect(channels.find((c) => c.kind === "phone")!.verdict).toBe("unverifiable");
    expect(channels.find((c) => c.kind === "chat")!.verdict).toBe("unverifiable");
  });
});

describe("offer analysis", () => {
  it("scores the synthetic scam case as Stop", () => {
    const scam = SAMPLE_CASES.find((c) => c.id === "fake-internship")!;
    const r = analyzeOffer(scam);
    expect(r.band).toBe("stop");
    expect(r.signals.some((s) => s.title.includes("Gift card"))).toBe(true);
    expect(r.signals.some((s) => s.title.includes("Social Security"))).toBe(true);
    expect(r.channels.some((c) => c.verdict === "lookalike")).toBe(true);
  });

  it("scores the plausible legitimate case Low with official channels", () => {
    const legit = SAMPLE_CASES.find((c) => c.id === "plausible-legit")!;
    const r = analyzeOffer(legit);
    expect(r.band).toBe("low");
    expect(r.channels.length).toBeGreaterThan(0);
    expect(r.channels.every((c) => c.verdict === "official")).toBe(true);
  });

  it("scores the ambiguous case in a middle band", () => {
    const amb = SAMPLE_CASES.find((c) => c.id === "ambiguous")!;
    const r = analyzeOffer(amb);
    expect(["caution", "high"]).toContain(r.band);
    expect(r.signals.length).toBeGreaterThan(0);
  });

  it("flags a free-webmail sender claiming to be an organization", () => {
    const r = analyzeOffer({
      ...base,
      claimedDomain: "acmecorp.com",
      senderEmail: "recruiter.acmecorp@gmail.com",
      offerText: "We would like to offer you the position.",
    });
    expect(r.signals.map((s) => s.id)).toContain("domain-sender-mismatch");
  });

  it("flags links that are off-domain from the claimed organization", () => {
    const r = analyzeOffer({
      ...base,
      claimedDomain: "acmecorp.com",
      offerText: "Apply at https://acme-careers-portal.net/apply",
    });
    expect(r.signals.some((s) => s.id.startsWith("link-offdomain-"))).toBe(true);
  });

  it("does not flag on-domain links as off-domain", () => {
    const r = analyzeOffer({
      ...base,
      claimedDomain: "acmecorp.com",
      offerText: "Apply at https://careers.acmecorp.com/apply",
    });
    expect(r.signals.some((s) => s.id.startsWith("link-offdomain-"))).toBe(false);
  });

  it("detects urgency and payment evidence with text spans", () => {
    const text = "Pay a $50 processing fee within 24 hours to secure your spot.";
    const r = analyzeOffer({ ...base, offerText: text });
    const fee = r.signals.find((s) => s.title === "Upfront fee request");
    const urgent = r.signals.find((s) => s.category === "urgency");
    expect(fee?.evidence.length).toBeGreaterThan(0);
    expect(urgent?.evidence.length).toBeGreaterThan(0);
    const span = fee!.evidence[0];
    expect(text.slice(span.start, span.end)).toBe(span.text);
  });

  it("extracts phone numbers as unverifiable channels", () => {
    const phones = extractPhones("Call +1 (519) 555-0100 for details");
    expect(phones).toHaveLength(1);
    const r = analyzeOffer({ ...base, offerText: "Call +1 (519) 555-0100 for details" });
    expect(r.channels.some((c) => c.kind === "phone" && c.verdict === "unverifiable")).toBe(true);
  });

  it("never uses an extracted contact in the verification path", () => {
    for (const c of SAMPLE_CASES) {
      const r = analyzeOffer(c);
      const joined = r.verifyPath.join("\n").toLowerCase();
      for (const ch of r.channels) {
        expect(joined).not.toContain(ch.value.toLowerCase());
      }
      const path = buildVerifyPath(c);
      expect(path.length).toBeGreaterThanOrEqual(5);
    }
  });

  it("produces no signals for a clean empty-ish offer", () => {
    const r = analyzeOffer({ ...base, offerText: "Thanks for applying. We will be in touch." });
    expect(r.band).toBe("low");
    expect(r.score).toBe(0);
  });
});
