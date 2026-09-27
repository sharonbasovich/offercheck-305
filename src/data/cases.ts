import type { AnalyzeInput } from "../analysis";

export interface SampleCase extends AnalyzeInput {
  id: string;
  label: string;
  blurb: string;
}

export const SAMPLE_CASES: SampleCase[] = [
  {
    id: "fake-internship",
    label: "Synthetic scam",
    blurb: "Fake check + gift cards + urgency",
    organization: "Meridian Dynamics",
    claimedDomain: "meridiandynamics.com",
    senderEmail: "hr.recruit@meridiandynamics-careers.net",
    offerText: `CONGRATULATIONS! You have been selected for the Meridian Dynamics Remote Data Internship — $850 per week, no interview needed.

To activate your placement, reply within 48 hours. Spots are limited.

We will mail you a cashier's check for $2,400. Deposit it via mobile deposit, keep $400 as your signing bonus, and use the rest to purchase your equipment starter kit from our approved vendor. A $120 processing fee must be paid via Steam gift cards before onboarding.

Reply with your full name, date of birth, and Social Security number, plus a copy of your driver's license.

Interview conducted over Telegram: https://t.me/meridian_hr
Onboarding form: https://forms.gle/x7fakeformid
Vendor portal: http://185.220.101.4/meridian-kit

Act now — this offer expires in 24 hours.`,
  },
  {
    id: "plausible-legit",
    label: "Plausible legitimate",
    blurb: "Real-company style offer",
    organization: "Brightfield University",
    claimedDomain: "brightfield.edu",
    senderEmail: "careers@brightfield.edu",
    offerText: `Dear Jordan,

Thank you for applying to the Brightfield University Summer Research Internship through our careers portal at https://careers.brightfield.edu/jobs/apply/2026-sri. After interviews with the selection committee, we are pleased to offer you a position on the computational biology team.

Your stipend of $4,800 will be disbursed in two installments through the university payroll office. Details about start dates, required enrollment verification, and next steps are available at https://brightfield.edu/summer-research/onboarding.

Please review the attached offer letter and let us know your decision by October 15. If you have questions, contact the program office at research.interns@brightfield.edu or call the main university line listed on our website.

Sincerely,
The Undergraduate Research Office`,
  },
  {
    id: "ambiguous",
    label: "Ambiguous",
    blurb: "Mixed signals — verify first",
    organization: "Coastal Scholars Fund",
    claimedDomain: "coastalscholars.org",
    senderEmail: "awards@coastalscholars.org",
    offerText: `Dear Alex,

Congratulations — you have been chosen as a finalist for the Coastal Scholars Fund merit award of $2,500.

To proceed, confirm your mailing address and student ID number using our finalist form at https://tally.so/r/coastalscholars-finalist within 72 hours so we can reserve your award before the deadline.

A virtual interview over Zoom will follow next week. If you have questions, reply to this email or reach our volunteer coordinator at csf.coordinator@gmail.com.

Warm regards,
Coastal Scholars Fund`,
  },
];
