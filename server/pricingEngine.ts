import {
  PRICING_CONFIG,
  DEFAULT_PAYMENT_TERMS,
  DEFAULT_DISCOUNT,
  type ComplexityLevel,
  type ServiceCategory,
} from './pricingConfig';
import {
  generateQuoteNumber,
  calculateValidUntilDate,
} from './quoteConfig';

export interface InquiryInput {
  customerName: string;
  customerEmail?: string;
  companyName?: string;
  serviceRequired: string;
  projectRequirements: string;
  budget?: string;
  desiredDeadline?: string;
}

export interface AIAnalysisInput {
  summary?: string;
  serviceCategory?: string;
  scopeComplexity?: string;
  estimatedTimeline?: string;
  keyDeliverables?: string[];
  budgetFeasibility?: string;
  recommendations?: string[];
  clarificationQuestions?: string[];
}

export interface QuoteServiceItem {
  name: string;
  complexity: ComplexityLevel;
  price: number;
}

export interface CalculatedQuote {
  quote_number: string;
  created_at: string;
  valid_until: string;
  status: 'Draft' | 'Sent';
  sent_at?: string;
  sent_to?: string;
  customer_name: string;
  customer_email?: string;
  company_name: string;
  services: QuoteServiceItem[];
  subtotal: number;
  discount: number;
  total: number;
  timeline: string;
  payment_terms: string;
  complexity_estimated: boolean;
  notes?: string;
}

const VALID_COMPLEXITIES: ComplexityLevel[] = ['Basic', 'Standard', 'Advanced'];

/**
 * Validates and maps AI scope complexity to one of: Basic | Standard | Advanced.
 * If unrecognized or missing, defaults to 'Standard' and marks as estimated.
 */
export function determineComplexity(rawComplexity?: string): {
  complexity: ComplexityLevel;
  isEstimated: boolean;
} {
  if (!rawComplexity || typeof rawComplexity !== 'string') {
    return { complexity: 'Standard', isEstimated: true };
  }

  const normalized = rawComplexity.trim().toLowerCase();

  if (normalized.includes('basic') || normalized.includes('low') || normalized.includes('simple')) {
    return { complexity: 'Basic', isEstimated: false };
  }

  if (
    normalized.includes('advanced') ||
    normalized.includes('high') ||
    normalized.includes('enterprise') ||
    normalized.includes('complex')
  ) {
    return { complexity: 'Advanced', isEstimated: false };
  }

  if (normalized.includes('standard') || normalized.includes('medium') || normalized.includes('moderate')) {
    return { complexity: 'Standard', isEstimated: false };
  }

  // Not enough information or unrecognized string
  return { complexity: 'Standard', isEstimated: true };
}

/**
 * Identifies applicable services based on user inquiry text and AI categorization.
 */
export function detectServices(
  serviceRequired: string,
  projectRequirements: string,
  aiCategory?: string
): ServiceCategory[] {
  const combinedText = `${serviceRequired} ${projectRequirements} ${aiCategory || ''}`.toLowerCase();
  const matchedServices: ServiceCategory[] = [];

  // Match Website Development
  if (
    combinedText.includes('web') ||
    combinedText.includes('site') ||
    combinedText.includes('store') ||
    combinedText.includes('app') ||
    combinedText.includes('portal') ||
    combinedText.includes('fullstack') ||
    combinedText.includes('frontend') ||
    combinedText.includes('backend')
  ) {
    matchedServices.push('Website Development');
  }

  // Match Logo & Branding
  if (
    combinedText.includes('logo') ||
    combinedText.includes('brand') ||
    combinedText.includes('identity') ||
    combinedText.includes('visual identity')
  ) {
    matchedServices.push('Logo & Branding');
  }

  // Match Social Media Design
  if (
    combinedText.includes('social') ||
    combinedText.includes('instagram') ||
    combinedText.includes('media design') ||
    combinedText.includes('post design') ||
    combinedText.includes('banner')
  ) {
    matchedServices.push('Social Media Design');
  }

  // Match SEO
  if (
    combinedText.includes('seo') ||
    combinedText.includes('search engine') ||
    combinedText.includes('ranking') ||
    combinedText.includes('organic traffic')
  ) {
    matchedServices.push('SEO');
  }

  // If no specific service was matched, use closest or default to Website Development
  if (matchedServices.length === 0) {
    matchedServices.push('Website Development');
  }

  return matchedServices;
}

/**
 * Deterministic pricing engine that calculates the final quote based on
 * predefined pricing rules. Gemini never sets or modifies price totals directly.
 */
export function calculateQuote(
  inquiry: InquiryInput,
  analysis: AIAnalysisInput
): CalculatedQuote {
  const { complexity, isEstimated } = determineComplexity(analysis.scopeComplexity);

  // Validate complexity is strictly one of the 3 allowed levels
  if (!VALID_COMPLEXITIES.includes(complexity)) {
    throw new Error(`Invalid complexity level: ${complexity}`);
  }

  const detected = detectServices(
    inquiry.serviceRequired,
    inquiry.projectRequirements,
    analysis.serviceCategory
  );

  const services: QuoteServiceItem[] = detected.map((serviceName) => {
    const tierPricing = PRICING_CONFIG[serviceName];
    const price = tierPricing ? tierPricing[complexity] : PRICING_CONFIG['Website Development'][complexity];

    return {
      name: serviceName,
      complexity,
      price,
    };
  });

  // Calculate Subtotal deterministically
  const subtotal = services.reduce((sum, item) => sum + item.price, 0);

  // Discount is fixed at 0 for version 1
  const discount = DEFAULT_DISCOUNT;

  // Total calculation
  const total = subtotal - discount;

  // Determine timeline: prefer AI's estimated timeline if available, otherwise default by complexity
  let timeline = analysis.estimatedTimeline?.trim();
  if (!timeline) {
    if (complexity === 'Basic') timeline = '1 - 2 weeks';
    else if (complexity === 'Standard') timeline = '3 - 5 weeks';
    else timeline = '6 - 8 weeks';
  }

  const issueDate = new Date();
  const validUntilDate = calculateValidUntilDate(issueDate);

  return {
    quote_number: generateQuoteNumber(issueDate),
    created_at: issueDate.toISOString(),
    valid_until: validUntilDate.toISOString(),
    status: 'Draft',
    customer_name: inquiry.customerName || 'Valued Customer',
    customer_email: inquiry.customerEmail?.trim() || '',
    company_name: inquiry.companyName?.trim() || '',
    services,
    subtotal,
    discount,
    total,
    timeline,
    payment_terms: DEFAULT_PAYMENT_TERMS,
    complexity_estimated: isEstimated,
    notes: isEstimated
      ? 'Complexity was automatically estimated as Standard based on initial scope indicators.'
      : undefined,
  };
}
