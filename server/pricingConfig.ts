/**
 * Pricing configuration for FlowQuote.
 * All base prices are centralized here and can be adjusted without modifying logic.
 */

export type ComplexityLevel = 'Basic' | 'Standard' | 'Advanced';

export type ServiceCategory =
  | 'Website Development'
  | 'Logo & Branding'
  | 'Social Media Design'
  | 'SEO';

export interface ServicePricingTier {
  Basic: number;
  Standard: number;
  Advanced: number;
}

export const PRICING_CONFIG: Record<ServiceCategory, ServicePricingTier> = {
  'Website Development': {
    Basic: 800,
    Standard: 1500,
    Advanced: 2500,
  },
  'Logo & Branding': {
    Basic: 300,
    Standard: 600,
    Advanced: 1000,
  },
  'Social Media Design': {
    Basic: 200,
    Standard: 400,
    Advanced: 700,
  },
  'SEO': {
    Basic: 300,
    Standard: 600,
    Advanced: 1000,
  },
};

export const DEFAULT_PAYMENT_TERMS = '50% upfront, 50% on completion';
export const DEFAULT_DISCOUNT = 0;
