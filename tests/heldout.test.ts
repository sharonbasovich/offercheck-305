import { describe, expect, it } from "vitest";
import { analyzeOffer } from "../src/analysis";
import type { AnalyzeInput } from "../src/analysis";

const input = (partial: Partial<AnalyzeInput>): AnalyzeInput => ({
  organization: "",
  claimedDomain: "",
  senderEmail: "",
  offerText: "",
  ...partial,
});

const hasSignal = (r: ReturnType<typeof analyzeOffer>, title: string) =>
  r.signals.some((s) => s.title === title);

describe("held-out scam cases", () => {
  it("Deloitte lookalike + WhatsApp text interview + fake check reaches Stop", () => {
    const r = analyzeOffer(
      input({
        organization: "Deloitte",
        claimedDomain: "deloitte.com",
        senderEmail: "recruiting@deloitte-hire.net",
        offerText:
          "Congratulations! You have been selected for the Deloitte Remote Analyst " +
          "Internship. Your interview will be conducted as a text interview on " +
          "WhatsApp at +1 415 555 0192. We will mail a cashier's check for $2,850 — " +
          "deposit it using mobile deposit, keep $500 as your first stipend, and " +
          "send the balance to our approved equipment supplier for your laptop.",
      }),
    );
    console.log(`deloitte-case score=${r.score} band=${r.band} signals=${r.signals.map((s) => s.id).join(",")}`);
    expect(r.band).toBe("stop");
    expect(hasSignal(r, "Interview moved to messaging app")).toBe(true);
    expect(hasSignal(r, "Check-deposit / reimbursement scheme")).toBe(true);
    expect(hasSignal(r, "Fake-check vendor purchase")).toBe(true);
    expect(r.channels.some((c) => c.kind === "sender" && c.verdict === "lookalike")).toBe(true);
    expect(r.channels.some((c) => c.kind === "chat")).toBe(true);
  });

  it("check mailed, deposited, then balance to equipment vendor reaches Stop", () => {
    const r = analyzeOffer(
      input({
        organization: "Northgate Research",
        claimedDomain: "northgate.com",
        senderEmail: "onboarding@northgate.com",
        offerText:
          "Welcome to the team. We will send a check for $3,000 to cover your " +
          "home-office setup — deposit it at your bank this week, then pay our " +
          "certified equipment vendor $1,800 for your laptop bundle.",
      }),
    );
    console.log(`check-vendor score=${r.score} band=${r.band} signals=${r.signals.map((s) => s.id).join(",")}`);
    expect(r.band).toBe("stop");
    expect(hasSignal(r, "Check-deposit / reimbursement scheme")).toBe(true);
    expect(hasSignal(r, "Fake-check vendor purchase")).toBe(true);
    expect(hasSignal(r, "Asked to send money")).toBe(true);
  });

  it("Signal or Google Chat text interview flags the messaging-app signal and chat channel", () => {
    const r = analyzeOffer(
      input({
        organization: "Helix Labs",
        claimedDomain: "helixlabs.com",
        senderEmail: "talent@helixlabs-hiring.com",
        offerText:
          "You have been pre-approved for the Helix Summer Fellowship. To proceed, " +
          "your interview will be conducted over Signal text message. Reply with " +
          "your full name and date of birth.",
      }),
    );
    console.log(`signal-interview score=${r.score} band=${r.band} signals=${r.signals.map((s) => s.id).join(",")}`);
    expect(hasSignal(r, "Interview moved to messaging app")).toBe(true);
    expect(r.channels.some((c) => c.kind === "chat")).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(45);
  });

  it("Zelle/Cash App scholarship release fee reaches Stop", () => {
    const r = analyzeOffer(
      input({
        organization: "Merit Scholars Fund",
        claimedDomain: "meritscholars.org",
        senderEmail: "awards@meritscholars.org",
        offerText:
          "Your $5,000 scholarship has been approved. To release the funds to your " +
          "student account, pay the $75 release fee via Zelle or Cash App today.",
      }),
    );
    console.log(`zelle-fee score=${r.score} band=${r.band} signals=${r.signals.map((s) => s.id).join(",")}`);
    expect(r.band).toBe("stop");
    expect(hasSignal(r, "Upfront fee request")).toBe(true);
    expect(hasSignal(r, "Asked to send money")).toBe(true);
  });
});

describe("held-out payment-app fees", () => {
  it("training-kit charge payable via Venmo or Cash App reaches Stop", () => {
    const r = analyzeOffer(
      input({
        organization: "Target",
        claimedDomain: "target.com",
        offerText:
          "Target Remote Hiring Team: you've been shortlisted. Before your start " +
          "date there is a $60 training kit charge payable via Venmo or Cash App " +
          "to @target-hr-team. Reply YES to proceed.",
      }),
    );
    expect(r.band).toBe("stop");
    expect(hasSignal(r, "Fee payable through a payment app")).toBe(true);
    expect(hasSignal(r, "Upfront fee request")).toBe(true);
  });

  it("Interac e-Transfer application cost is flagged", () => {
    const r = analyzeOffer(
      input({
        organization: "Maple Futures Bursary",
        claimedDomain: "maplefutures.ca",
        senderEmail: "bursary@maplefutures.ca",
        offerText:
          "You are eligible for the Maple Futures Bursary. The one-time file " +
          "review cost of $35 can be sent by Interac e-Transfer to confirm your spot.",
      }),
    );
    expect(hasSignal(r, "Fee payable through a payment app")).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(40);
  });

  it("stipend paid by direct deposit with no fee stays Low", () => {
    const r = analyzeOffer(
      input({
        organization: "University of Waterloo",
        claimedDomain: "uwaterloo.ca",
        senderEmail: "coop@uwaterloo.ca",
        offerText:
          "Your co-op stipend will be paid by direct deposit through university " +
          "payroll every two weeks. There is no cost to you. Questions: coop@uwaterloo.ca.",
      }),
    );
    expect(r.band).toBe("low");
    expect(hasSignal(r, "Fee payable through a payment app")).toBe(false);
  });
});

describe("institutional affiliated domains", () => {
  const uoftOffer =
    "Dear Priya, Thank you for applying to the Computer Science graduate " +
    "research program. We are pleased to offer you a research assistantship " +
    "for the fall term. Your stipend will be paid in monthly installments " +
    "through university payroll. Details are on the department page at " +
    "https://cs.toronto.edu/graduate/funding and you can reach me at " +
    "a.lee@cs.toronto.edu or 416 555 0164.";

  it("legitimate cs.toronto.edu sender under claimed utoronto.ca stays Low, flagged affiliated not lookalike", () => {
    const r = analyzeOffer(
      input({
        organization: "University of Toronto",
        claimedDomain: "utoronto.ca",
        senderEmail: "a.lee@cs.toronto.edu",
        offerText: uoftOffer,
      }),
    );
    console.log(`uoft-legit score=${r.score} band=${r.band} signals=${r.signals.map((s) => s.id).join(",")}`);
    expect(r.band).toBe("low");
    expect(r.score).toBeLessThan(20);
    expect(r.channels.every((c) => c.verdict !== "lookalike")).toBe(true);
    const sender = r.channels.find((c) => c.kind === "sender");
    expect(sender?.verdict).toBe("unrelated");
    expect(sender?.reason).toMatch(/affiliat|listed by/i);
    expect(hasSignal(r, "Sender uses an affiliated institutional domain")).toBe(true);
  });

  it("cs-toronto.edu (unaffiliated near-match) is not certified and still mismatches", () => {
    const r = analyzeOffer(
      input({
        organization: "University of Toronto",
        claimedDomain: "utoronto.ca",
        senderEmail: "recruit@cs-toronto.edu",
        offerText: uoftOffer,
      }),
    );
    console.log(`cs-toronto-spoof score=${r.score} band=${r.band} signals=${r.signals.map((s) => s.id).join(",")}`);
    const sender = r.channels.find((c) => c.kind === "sender");
    expect(sender?.verdict).not.toBe("official");
    expect(r.signals.some((s) => s.id === "domain-sender-mismatch")).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(20);
  });

  it("utoronto-careers.com remains a lookalike", () => {
    const r = analyzeOffer(
      input({
        organization: "University of Toronto",
        claimedDomain: "utoronto.ca",
        senderEmail: "jobs@utoronto-careers.com",
        offerText: uoftOffer,
      }),
    );
    console.log(`utoronto-careers score=${r.score} band=${r.band} signals=${r.signals.map((s) => s.id).join(",")}`);
    expect(r.channels.some((c) => c.kind === "sender" && c.verdict === "lookalike")).toBe(true);
    expect(r.signals.some((s) => s.id === "domain-sender-mismatch")).toBe(true);
  });
});

describe("held-out legitimate controls", () => {
  it("uwaterloo.ca research assistant offer stays Low", () => {
    const r = analyzeOffer(
      input({
        organization: "University of Waterloo",
        claimedDomain: "uwaterloo.ca",
        senderEmail: "csadvising@uwaterloo.ca",
        offerText:
          "Dear Amara, Thank you for applying to the NSERC Undergraduate Student " +
          "Research Award. We are pleased to offer you a research assistant " +
          "position in the School of Computer Science for the winter term. Your " +
          "award of $6,500 will be paid in two installments through university " +
          "payroll. Apply through the portal at https://uwaterloo.ca/undergraduate-research " +
          "and contact csadvising@uwaterloo.ca with questions.",
      }),
    );
    console.log(`uwaterloo score=${r.score} band=${r.band} signals=${r.signals.map((s) => s.id).join(",")}`);
    expect(r.band).toBe("low");
    expect(r.score).toBeLessThan(20);
    expect(r.channels.every((c) => c.verdict === "official")).toBe(true);
  });

  it("scholarship paid directly to financial aid stays Low", () => {
    const r = analyzeOffer(
      input({
        organization: "Ridgemont College",
        claimedDomain: "ridgemont.edu",
        senderEmail: "finaid@ridgemont.edu",
        offerText:
          "Dear Sam, Congratulations on receiving the Ridgemont Trustee " +
          "Scholarship for the coming year. The $8,000 award will be paid " +
          "directly to your student account through the Office of Financial " +
          "Aid — no action or payment is required from you. Confirm receipt at " +
          "https://ridgemont.edu/financial-aid/awards or call our office at " +
          "519 555 0148.",
      }),
    );
    console.log(`finaid score=${r.score} band=${r.band} signals=${r.signals.map((s) => s.id).join(",")}`);
    expect(r.band).toBe("low");
    expect(r.score).toBeLessThan(20);
    expect(r.channels.filter((c) => c.verdict === "lookalike")).toHaveLength(0);
  });
});
