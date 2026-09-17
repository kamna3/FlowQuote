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
