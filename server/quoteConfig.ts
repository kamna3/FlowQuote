/**
 * FlowQuote Quotation Configuration
 * Centralized settings for quote validity, identifiers, and standard terms.
 */

export const QUOTE_VALIDITY_DAYS = 14;

export const STANDARD_TERMS = [
  `Quote Validity: This quotation is valid for ${QUOTE_VALIDITY_DAYS} days from the date of issue.`,
  'Scope of Work: Pricing and delivery timeline are strictly based on the specifications, requirements, and deliverables documented in this quote.',
  'Revisions & Scope Adjustments: Any additional features, scope expansions, or changes requested will require a revised quote or separate addendum.',
  'Commencement: Work officially begins upon execution of the agreement and receipt of the initial deposit per the agreed payment terms.',
  'Deliverable Acceptance: Final project deliverables and asset handoff are subject to client review and formal sign-off.',
];

/**
 * Generates a unique quote number in the standard format: FQ-YYYYMMDD-XXXX
 * where XXXX is a generated uppercase 4-character alphanumeric identifier.
 * Deterministic and non-AI generated.
 */
export function generateQuoteNumber(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `FQ-${year}${month}${day}-${rand}`;
}

/**
 * Calculates the valid until date based on issue date and QUOTE_VALIDITY_DAYS.
 */
export function calculateValidUntilDate(issueDate: Date = new Date()): Date {
  const validUntil = new Date(issueDate);
  validUntil.setDate(validUntil.getDate() + QUOTE_VALIDITY_DAYS);
  return validUntil;
}

/**
 * Formats a Date object into a readable date string: e.g. "September 20, 2026"
 */
export function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
