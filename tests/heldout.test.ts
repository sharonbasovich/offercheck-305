import { describe, expect, it } from "vitest";
import { analyzeOffer } from "../src/analysis";
import { isLookalike } from "../src/analysis/domains";
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

describe("held-out professor-assistant scam", () => {
  it("gmail 'professor' personal-assistant errand job reaches Stop", () => {
    const r = analyzeOffer(
      input({
        organization: "University of Waterloo",
        claimedDomain: "uwaterloo.ca",
        senderEmail: "dr.mark.hollis.uw@gmail.com",
        offerText:
          "Hello student, I am Dr. Mark Hollis from the Department of Biology. I am " +
          "looking for a part-time remote personal assistant to run errands and " +
          "handle tasks while I travel for a conference. The position pays $400 " +
          "weekly. If interested, reply with your full name, personal email and " +
          "cell phone number.",
      }),
    );
    expect(r.band).toBe("stop");
    expect(hasSignal(r, "Personal-assistant / errand job")).toBe(true);
    expect(hasSignal(r, "Asks to move to personal contact details")).toBe(true);
  });

  it("official-domain research assistant offer does not trigger the errand-job rule", () => {
    const r = analyzeOffer(
      input({
        organization: "University of Waterloo",
        claimedDomain: "uwaterloo.ca",
        senderEmail: "j.chen@uwaterloo.ca",
        offerText:
          "Hi Priya, I'm pleased to offer you a research assistant position in my " +
          "lab this winter, 10 hours per week through university payroll. Please " +
          "confirm by replying to this email.",
      }),
    );
    expect(r.band).toBe("low");
    expect(hasSignal(r, "Personal-assistant / errand job")).toBe(false);
    expect(hasSignal(r, "Asks to move to personal contact details")).toBe(false);
  });
});

describe("held-out look-alike sender asking for a home address", () => {
  it("shopify-careers.co offer asking to reply with a home address reaches High", () => {
    const r = analyzeOffer(
      input({
        organization: "Shopify",
        claimedDomain: "shopify.com",
        senderEmail: "talent@shopify-careers.co",
        offerText:
          "We reviewed your resume and would like to offer you a remote Data Entry " +
          "Intern role. Please confirm your acceptance by replying with your full " +
          "legal name and home address.",
      }),
    );
    expect(hasSignal(r, "Home address requested by reply")).toBe(true);
    expect(["high", "stop"]).toContain(r.band);
  });

  it("official offer that ships a laptop to your home address via Workday stays Low", () => {
    const r = analyzeOffer(
      input({
        organization: "Shopify",
        claimedDomain: "shopify.com",
        senderEmail: "people@shopify.com",
        offerText:
          "We'll send your laptop to the home address in your Workday profile, so " +
          "please keep your mailing address up to date there before your start date.",
      }),
    );
    expect(r.band).toBe("low");
    expect(hasSignal(r, "Home address requested by reply")).toBe(false);
  });
});

describe("held-out reworded gift-card request", () => {
  it("'pick up Apple cards and share the codes' is flagged as a gift-card payment", () => {
    const r = analyzeOffer(
      input({
        organization: "RBC",
        claimedDomain: "rbc.com",
        senderEmail: "hr@rbc-talent.com",
        offerText:
          "Before your start date please pick up three Apple cards at any store and " +
          "share the codes so IT can set up your laptop.",
      }),
    );
    expect(hasSignal(r, "Gift card payment request")).toBe(true);
    expect(["high", "stop"]).toContain(r.band);
  });

  it("a corporate Visa card for approved travel on an official offer stays Low", () => {
    const r = analyzeOffer(
      input({
        organization: "RBC",
        claimedDomain: "rbc.com",
        senderEmail: "campus.recruiting@rbc.com",
        offerText:
          "Payroll is by direct deposit. Interns who travel receive a corporate Visa " +
          "card for approved expenses, issued by your manager after onboarding.",
      }),
    );
    expect(r.band).toBe("low");
    expect(hasSignal(r, "Gift card payment request")).toBe(false);
  });
});

describe("held-out Canadian SIN and ID-photo request", () => {
  it("fake scholarship asking for SIN and a passport photo reaches Stop", () => {
    const r = analyzeOffer(
      input({
        organization: "University of Waterloo",
        claimedDomain: "uwaterloo.ca",
        senderEmail: "uw.scholarships@yahoo.com",
        offerText:
          "You have been selected for the $10,000 Global Excellence Scholarship. " +
          "Kindly provide your SIN and a photo of your passport to process disbursement.",
      }),
    );
    expect(hasSignal(r, "Social Insurance Number (SIN) requested")).toBe(true);
    expect(hasSignal(r, "Identity document requested")).toBe(true);
    expect(r.band).toBe("stop");
  });

  it("the English word 'sin' and a verified TD1 onboarding note stay Low", () => {
    const r = analyzeOffer(
      input({
        organization: "Shopify",
        claimedDomain: "shopify.com",
        senderEmail: "people@shopify.com",
        offerText:
          "It would be a sin to miss our intern welcome week! Please sign your offer " +
          "in Workday and complete your TD1 tax forms by Friday.",
      }),
    );
    expect(r.band).toBe("low");
    expect(hasSignal(r, "Social Insurance Number (SIN) requested")).toBe(false);
  });
});

describe("held-out immigration threat", () => {
  it("fake IRCC study-permit penalty with deportation threat reaches Stop", () => {
    const r = analyzeOffer(
      input({
        organization: "IRCC",
        claimedDomain: "canada.ca",
        senderEmail: "ircc.visa.office@gmail.com",
        offerText:
          "Your study permit has an error. Pay the correction penalty today or you " +
          "will be deported. Call 1-888-555-0199.",
      }),
    );
    expect(hasSignal(r, "Threat of deportation, arrest, or legal action")).toBe(true);
    expect(r.band).toBe("stop");
  });

  it("official permit-renewal reminder and police-check onboarding stay Low", () => {
    const r = analyzeOffer(
      input({
        organization: "University of Waterloo",
        claimedDomain: "uwaterloo.ca",
        senderEmail: "international@uwaterloo.ca",
        offerText:
          "Your study permit expires in 60 days. See the IRCC website to renew. Your " +
          "co-op employer may also ask for a police record check during onboarding.",
      }),
    );
    expect(r.band).toBe("low");
    expect(hasSignal(r, "Threat of deportation, arrest, or legal action")).toBe(false);
  });
});

describe("held-out source-verified employer careers domain", () => {
  it("amazon.jobs link in a genuine Amazon offer is not a Lookalike and stays Low", () => {
    const r = analyzeOffer(
      input({
        organization: "Amazon",
        claimedDomain: "amazon.com",
        senderEmail: "university-recruiting@amazon.com",
        offerText:
          "Thanks for applying to the Operations Intern role at our Cambridge " +
          "fulfillment centre. Next steps are listed on https://www.amazon.jobs under your application.",
      }),
    );
    expect(r.channels.find((c) => c.value.includes("amazon.jobs"))?.verdict).not.toBe("lookalike");
    expect(r.band).toBe("low");
  });

  it("an unlisted look-alike careers domain is still a Lookalike", () => {
    expect(isLookalike("amazon-jobs.net", "amazon.com")).toBe(true);
  });
});

describe("held-out reshipping mule job", () => {
  it("receive packages at home and forward them overseas reaches High or Stop", () => {
    const r = analyzeOffer(
      input({
        organization: "Amazon",
        claimedDomain: "amazon.com",
        senderEmail: "amazon.hr.team@gmail.com",
        offerText:
          "You'll receive packages at home, inspect them, and forward them to our " +
          "overseas clients with the labels we provide.",
      }),
    );
    expect(hasSignal(r, "Reshipping / package-forwarding job")).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(45);
  });

  it("ordinary warehouse forwarding stays Low", () => {
    const r = analyzeOffer(
      input({
        organization: "North Peak Logistics",
        claimedDomain: "northpeak-logistics.example",
        senderEmail: "hiring@northpeak-logistics.example",
        offerText:
          "Warehouse associates forward packages to regional carriers and keep " +
          "the loading dock clear. Shift hours and pay bands are in the posting.",
      }),
    );
    console.log(`warehouse-forwarding score=${r.score} band=${r.band} signals=${r.signals.map((s) => s.id).join(",")}`);
    expect(r.band).toBe("low");
    expect(hasSignal(r, "Reshipping / package-forwarding job")).toBe(false);
  });

  it("legitimate Package Handler posting stays Low", () => {
    const r = analyzeOffer(
      input({
        organization: "North Peak Logistics",
        claimedDomain: "northpeak-logistics.example",
        senderEmail: "hiring@northpeak-logistics.example",
        offerText:
          "We're hiring a Package Handler at our Cambridge distribution centre. " +
          "You'll scan, sort, and load outbound shipments on the evening shift. " +
          "Safety training provided on site.",
      }),
    );
    console.log(`package-handler score=${r.score} band=${r.band} signals=${r.signals.map((s) => s.id).join(",")}`);
    expect(r.band).toBe("low");
    expect(hasSignal(r, "Reshipping / package-forwarding job")).toBe(false);
  });

  it("work-from-home Package Inspector mule ad still flags", () => {
    const r = analyzeOffer(
      input({
        organization: "Global Parcel Co",
        claimedDomain: "globalparcel.example",
        senderEmail: "recruit@globalparcel-careers.example",
        offerText:
          "Work from home as a Package Inspector. Receive parcels at your " +
          "address, check them, and forward them to clients abroad.",
      }),
    );
    console.log(`inspector-mule score=${r.score} band=${r.band} signals=${r.signals.map((s) => s.id).join(",")}`);
    expect(hasSignal(r, "Reshipping / package-forwarding job")).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(45);
  });

  it("warehouse role at an official domain stays Low", () => {
    const r = analyzeOffer(
      input({
        organization: "Amazon",
        claimedDomain: "amazon.com",
        senderEmail: "university-recruiting@amazon.com",
        offerText:
          "Thanks for applying to the Operations Intern role at our Cambridge " +
          "fulfillment centre. Next steps are listed in your candidate portal.",
      }),
    );
    expect(r.band).toBe("low");
    expect(hasSignal(r, "Reshipping / package-forwarding job")).toBe(false);
  });
});

describe("held-out overpayment and third-party payment agent", () => {
  it("scholarship 'overpaid, refund the difference' reaches High or Stop", () => {
    const r = analyzeOffer(
      input({
        organization: "University of Waterloo",
        claimedDomain: "uwaterloo.ca",
        senderEmail: "awards.office@outlook.com",
        offerText:
          "Congratulations, you won the Merit Scholarship of $5,000. We accidentally " +
          "sent an extra $1,200 to your account; please refund the difference via " +
          "Interac before your award is processed.",
      }),
    );
    expect(hasSignal(r, "Overpayment refund request")).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(70);
  });

  it("tuition discount paid through an 'agent' reaches High or Stop", () => {
    const r = analyzeOffer(
      input({
        organization: "University of Waterloo",
        claimedDomain: "uwaterloo.ca",
        senderEmail: "finance@uwaterloo-tuition.com",
        offerText:
          "Pay your tuition through our partner and get a 30% discount. Transfer the " +
          "balance to our agent and we will pay the university on your behalf.",
      }),
    );
    expect(hasSignal(r, "Payment routed through a third-party agent")).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(70);
  });

  it("official award paid to student account with payroll partner stays Low", () => {
    const r = analyzeOffer(
      input({
        organization: "University of Waterloo",
        claimedDomain: "uwaterloo.ca",
        senderEmail: "awards@uwaterloo.ca",
        offerText:
          "Your $2,000 award has been credited to your student account in Quest. " +
          "Research stipends are paid through our payroll partner by direct deposit; " +
          "there is nothing you need to pay or return.",
      }),
    );
    expect(r.band).toBe("low");
    expect(hasSignal(r, "Overpayment refund request")).toBe(false);
    expect(hasSignal(r, "Payment routed through a third-party agent")).toBe(false);
  });
});

describe("held-out credential phishing", () => {
  it("offer letter behind an off-domain WatIAM password sign-in reaches High or Stop", () => {
    const r = analyzeOffer(
      input({
        organization: "University of Waterloo",
        claimedDomain: "uwaterloo.ca",
        senderEmail: "noreply@uwaterloo.ca",
        offerText:
          "Your internship offer letter is ready. Sign in with your WatIAM password " +
          "at https://uwaterloo-offer.docs-sign.com to view it.",
      }),
    );
    expect(hasSignal(r, "Password or login code requested")).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(45);
  });

  it("request to read back a texted verification code is flagged", () => {
    const r = analyzeOffer(
      input({
        organization: "Shopify",
        claimedDomain: "shopify.com",
        senderEmail: "talent.shopify@gmail.com",
        offerText: "To confirm your identity for the interview, reply with the 6-digit verification code we just texted you.",
      }),
    );
    expect(hasSignal(r, "Password or login code requested")).toBe(true);
  });

  it("official portal login reminder without credential request stays Low", () => {
    const r = analyzeOffer(
      input({
        organization: "University of Waterloo",
        claimedDomain: "uwaterloo.ca",
        senderEmail: "coop@uwaterloo.ca",
        offerText:
          "Your co-op interview with Shopify is scheduled on WaterlooWorks for Tuesday. " +
          "Please log in to WaterlooWorks to confirm.",
      }),
    );
    expect(r.band).toBe("low");
    expect(hasSignal(r, "Password or login code requested")).toBe(false);
  });
});

describe("held-out short-brand hyphenated lookalike", () => {
  it("td-careers.ca imitates td.com", () => {
    expect(isLookalike("td-careers.ca", "td.com")).toBe(true);
    expect(isLookalike("careers-ibm.com", "ibm.com")).toBe(true);
  });

  it("unrelated domains containing the short brand as a substring are not lookalikes", () => {
    expect(isLookalike("stdlib.com", "td.com")).toBe(false);
    expect(isLookalike("tdameritrade.com", "td.com")).toBe(false);
    expect(isLookalike("ibmforums-archive.org", "ibm.com")).toBe(false);
  });
});

describe("held-out pay-now-reimbursed-later fee", () => {
  it("screening charged to your card and reimbursed on first paycheck reaches High or Stop", () => {
    const r = analyzeOffer(
      input({
        organization: "TD Bank",
        claimedDomain: "td.com",
        senderEmail: "careers@td-careers.ca",
        offerText:
          "You are hired pending a background screening. Please complete the " +
          "screening through our partner at https://quickscreen-verify.com; the " +
          "$39.99 screening is charged to your card and reimbursed on your first paycheck.",
      }),
    );
    expect(hasSignal(r, "Pay now, reimbursed later")).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(70);
  });

  it("employer-paid background check stays Low", () => {
    const r = analyzeOffer(
      input({
        organization: "Shopify",
        claimedDomain: "shopify.com",
        senderEmail: "recruiting@shopify.com",
        offerText:
          "Your offer is contingent on a background check, which Shopify pays for. " +
          "You'll receive an invitation from recruiting@shopify.com; there is no cost to you.",
      }),
    );
    expect(r.band).toBe("low");
    expect(hasSignal(r, "Pay now, reimbursed later")).toBe(false);
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
