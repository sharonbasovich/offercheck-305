import { hostFromInput, registrableDomain } from "./domains";
import type { AnalyzeInput } from "./types";

/**
 * Build an independent verification path using ONLY the claimed institution
 * name/domain the user typed — never a channel extracted from the offer.
 */
export function buildVerifyPath(input: AnalyzeInput): string[] {
  const claimedHost = hostFromInput(input.claimedDomain);
  const claimedReg = claimedHost ? registrableDomain(claimedHost) : null;
  const org = input.organization.trim();
  const who = org || claimedReg || "the organization";

  const steps: string[] = [];
  if (claimedReg) {
    steps.push(
      `Open a new browser tab and type the official site yourself: ${claimedReg}. Do not click or copy any link from the offer.`,
    );
  } else {
    steps.push(
      `Search for "${who}" yourself and open its official website from the results. Do not use any link, email, or phone number from the offer.`,
    );
  }
  steps.push(
    `On ${who}'s official site, find the careers/admissions/financial-aid page and check whether this exact posting exists there.`,
  );
  steps.push(
    `Call or email the office using the contact details published on the official site. Ask whether the offer and the sender are genuine.`,
  );
  steps.push(
    `If the offer asks for any payment, gift card, deposit, or "equipment fee" — stop. Real employers and scholarship programs never charge applicants.`,
  );
  steps.push(
    `Do not share your SSN, ID documents, or bank details until the offer is verified and you are completing official payroll/enrollment forms.`,
  );
  steps.push(
    `Ask your campus career centre or financial aid office for a second opinion — they see these scams regularly.`,
  );
  steps.push(`If it turns out to be a scam, report it at reportfraud.ftc.gov, and ic3.gov if money was lost.`);
  return steps;
}
