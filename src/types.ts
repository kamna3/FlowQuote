export interface InquiryFormData {
  customerName: string;
  customerEmail: string;
  companyName: string;
  serviceRequired: string;
  projectRequirements: string;
  budget: string;
  desiredDeadline: string;
}

export type FormErrors = Partial<Record<keyof InquiryFormData, string>>;

export interface AIAnalysisResult {
  summary: string;
  serviceCategory: string;
  scopeComplexity: string;
  estimatedTimeline: string;
  keyDeliverables: string[];
  budgetFeasibility: string;
  recommendations: string[];
  clarificationQuestions: string[];
}

export interface QuoteServiceItem {
  name: string;
  complexity: 'Basic' | 'Standard' | 'Advanced';
  price: number;
}

export interface QuoteDraft {
  quote_number?: string;
  created_at?: string;
  valid_until?: string;
  customer_name: string;
  customer_email?: string;
  company_name: string;
  services: QuoteServiceItem[];
  subtotal: number;
  discount: number;
  total: number;
  timeline: string;
  payment_terms: string;
  complexity_estimated?: boolean;
  notes?: string;
}

