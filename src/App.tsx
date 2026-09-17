import { useState, type FormEvent, type ChangeEvent } from 'react';
import type { InquiryFormData, FormErrors } from './types';

const INITIAL_FORM_STATE: InquiryFormData = {
  customerName: '',
  customerEmail: '',
  companyName: '',
  serviceRequired: '',
  projectRequirements: '',
  budget: '',
  desiredDeadline: '',
};

export default function App() {
  const [formData, setFormData] = useState<InquiryFormData>(INITIAL_FORM_STATE);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submittedInquiry, setSubmittedInquiry] = useState<InquiryFormData | null>(null);

  const validateField = (name: keyof InquiryFormData, value: string): string => {
    const trimmed = value.trim();
    switch (name) {
      case 'customerName':
        if (!trimmed) return 'Customer name is required.';
        return '';
      case 'customerEmail':
        if (!trimmed) return 'Customer email is required.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
          return 'Please enter a valid email address.';
        }
        return '';
      case 'serviceRequired':
        if (!trimmed) return 'Service required cannot be empty.';
        return '';
      case 'projectRequirements':
        if (!trimmed) return 'Project requirements cannot be empty.';
        return '';
      default:
        return '';
    }
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    const fieldName = name as keyof InquiryFormData;
    
    setFormData((prev) => ({
      ...prev,
      [fieldName]: value,
    }));

    // Clear error for field if previously erroneous
    if (errors[fieldName]) {
      const errorMsg = validateField(fieldName, value);
      setErrors((prev) => ({
        ...prev,
        [fieldName]: errorMsg || undefined,
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    const nameError = validateField('customerName', formData.customerName);
    if (nameError) newErrors.customerName = nameError;

    const emailError = validateField('customerEmail', formData.customerEmail);
    if (emailError) newErrors.customerEmail = emailError;

    const serviceError = validateField('serviceRequired', formData.serviceRequired);
    if (serviceError) newErrors.serviceRequired = serviceError;

    const reqsError = validateField('projectRequirements', formData.projectRequirements);
    if (reqsError) newErrors.projectRequirements = reqsError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmittedInquiry({ ...formData });
  };

  const handleReset = () => {
    setFormData(INITIAL_FORM_STATE);
    setErrors({});
    setSubmittedInquiry(null);
  };

  return (
    <div id="app-root" className="min-h-screen bg-white text-neutral-900 antialiased py-12 px-4 sm:px-6 lg:px-8">
      <div id="page-container" className="max-w-2xl mx-auto">
        {/* Header */}
        <header id="main-header" className="text-center mb-10">
          <h1 id="brand-title" className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-950">
            FlowQuote
          </h1>
          <p id="brand-subtitle" className="mt-2 text-base sm:text-lg text-neutral-600">
            Turn customer inquiries into professional quotes.
          </p>
        </header>

        {/* Inquiry Form */}
        <div id="form-card" className="border border-neutral-200 rounded-lg p-6 sm:p-8 bg-white shadow-xs">
          <form id="inquiry-form" onSubmit={handleSubmit} noValidate className="space-y-6">
            {/* Customer Name */}
            <div id="field-customer-name">
              <div className="flex justify-between items-baseline mb-1">
                <label htmlFor="customer-name-input" className="block text-sm font-medium text-neutral-900">
                  Customer Name <span className="text-red-600">*</span>
                </label>
                <span className="text-xs text-neutral-500">Required</span>
              </div>
              <input
                id="customer-name-input"
                name="customerName"
                type="text"
                value={formData.customerName}
                onChange={handleChange}
                placeholder="e.g. Jane Doe"
                className={`w-full rounded-md border px-3.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent ${
                  errors.customerName ? 'border-red-500 bg-red-50/20' : 'border-neutral-300'
                }`}
              />
              {errors.customerName && (
                <p id="error-customer-name" className="mt-1.5 text-xs text-red-600 font-medium">
                  {errors.customerName}
                </p>
              )}
            </div>

            {/* Customer Email */}
            <div id="field-customer-email">
              <div className="flex justify-between items-baseline mb-1">
                <label htmlFor="customer-email-input" className="block text-sm font-medium text-neutral-900">
                  Customer Email <span className="text-red-600">*</span>
                </label>
                <span className="text-xs text-neutral-500">Required</span>
              </div>
              <input
                id="customer-email-input"
                name="customerEmail"
                type="email"
                value={formData.customerEmail}
                onChange={handleChange}
                placeholder="e.g. jane@example.com"
                className={`w-full rounded-md border px-3.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent ${
                  errors.customerEmail ? 'border-red-500 bg-red-50/20' : 'border-neutral-300'
                }`}
              />
              {errors.customerEmail && (
                <p id="error-customer-email" className="mt-1.5 text-xs text-red-600 font-medium">
                  {errors.customerEmail}
                </p>
              )}
            </div>

            {/* Company Name (Optional) */}
            <div id="field-company-name">
              <div className="flex justify-between items-baseline mb-1">
                <label htmlFor="company-name-input" className="block text-sm font-medium text-neutral-900">
                  Company Name
                </label>
                <span className="text-xs text-neutral-400">Optional</span>
              </div>
              <input
                id="company-name-input"
                name="companyName"
                type="text"
                value={formData.companyName}
                onChange={handleChange}
                placeholder="e.g. Acme Corporation"
                className="w-full rounded-md border border-neutral-300 px-3.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
            </div>

            {/* Service Required */}
            <div id="field-service-required">
              <div className="flex justify-between items-baseline mb-1">
                <label htmlFor="service-required-input" className="block text-sm font-medium text-neutral-900">
                  Service Required <span className="text-red-600">*</span>
                </label>
                <span className="text-xs text-neutral-500">Required</span>
              </div>
              <input
                id="service-required-input"
                name="serviceRequired"
                type="text"
                value={formData.serviceRequired}
                onChange={handleChange}
                placeholder="e.g. Website Redesign, Custom Software Development"
                className={`w-full rounded-md border px-3.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent ${
                  errors.serviceRequired ? 'border-red-500 bg-red-50/20' : 'border-neutral-300'
                }`}
              />
              {errors.serviceRequired && (
                <p id="error-service-required" className="mt-1.5 text-xs text-red-600 font-medium">
                  {errors.serviceRequired}
                </p>
              )}
            </div>

            {/* Project Requirements */}
            <div id="field-project-requirements">
              <div className="flex justify-between items-baseline mb-1">
                <label htmlFor="project-requirements-input" className="block text-sm font-medium text-neutral-900">
                  Project Requirements <span className="text-red-600">*</span>
                </label>
                <span className="text-xs text-neutral-500">Required</span>
              </div>
              <textarea
                id="project-requirements-input"
                name="projectRequirements"
                rows={4}
                value={formData.projectRequirements}
                onChange={handleChange}
                placeholder="Describe project scope, deliverables, and specific goals..."
                className={`w-full rounded-md border px-3.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-y ${
                  errors.projectRequirements ? 'border-red-500 bg-red-50/20' : 'border-neutral-300'
                }`}
              />
              {errors.projectRequirements && (
                <p id="error-project-requirements" className="mt-1.5 text-xs text-red-600 font-medium">
                  {errors.projectRequirements}
                </p>
              )}
            </div>

            {/* Budget & Desired Deadline Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Budget (Optional) */}
              <div id="field-budget">
                <div className="flex justify-between items-baseline mb-1">
                  <label htmlFor="budget-input" className="block text-sm font-medium text-neutral-900">
                    Budget
                  </label>
                  <span className="text-xs text-neutral-400">Optional</span>
                </div>
                <input
                  id="budget-input"
                  name="budget"
                  type="text"
                  value={formData.budget}
                  onChange={handleChange}
                  placeholder="e.g. $5,000 - $10,000"
                  className="w-full rounded-md border border-neutral-300 px-3.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                />
              </div>

              {/* Desired Deadline (Optional) */}
              <div id="field-desired-deadline">
                <div className="flex justify-between items-baseline mb-1">
                  <label htmlFor="desired-deadline-input" className="block text-sm font-medium text-neutral-900">
                    Desired Deadline
                  </label>
                  <span className="text-xs text-neutral-400">Optional</span>
                </div>
                <input
                  id="desired-deadline-input"
                  name="desiredDeadline"
                  type="text"
                  value={formData.desiredDeadline}
                  onChange={handleChange}
                  placeholder="e.g. 4 weeks or Nov 30"
                  className="w-full rounded-md border border-neutral-300 px-3.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div id="submit-section" className="pt-2">
              <button
                id="submit-button"
                type="submit"
                className="w-full py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 text-white font-medium rounded-md text-sm transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
              >
                Analyze Inquiry
              </button>
            </div>
          </form>
        </div>

        {/* Inquiry received section */}
        {submittedInquiry && (
          <section
            id="inquiry-received-section"
            className="mt-8 border border-neutral-200 rounded-lg p-6 sm:p-8 bg-neutral-50"
          >
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200 mb-6">
              <div>
                <h2 id="inquiry-received-title" className="text-xl font-bold text-neutral-950">
                  Inquiry received
                </h2>
                <p id="inquiry-received-caption" className="text-xs text-neutral-500 mt-0.5">
                  Stored client-side in React state
                </p>
              </div>
              <button
                id="clear-inquiry-button"
                type="button"
                onClick={handleReset}
                className="text-xs font-medium text-neutral-600 hover:text-neutral-900 border border-neutral-300 hover:border-neutral-400 rounded px-2.5 py-1.5 transition-colors cursor-pointer"
              >
                Clear / New Inquiry
              </button>
            </div>

            <dl id="submitted-data-list" className="space-y-4 text-sm">
              <div id="result-customer-name" className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                <dt className="font-medium text-neutral-500">Customer Name</dt>
                <dd className="sm:col-span-2 text-neutral-900 font-semibold">{submittedInquiry.customerName}</dd>
              </div>

              <div id="result-customer-email" className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                <dt className="font-medium text-neutral-500">Customer Email</dt>
                <dd className="sm:col-span-2 text-neutral-900">{submittedInquiry.customerEmail}</dd>
              </div>

              <div id="result-company-name" className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                <dt className="font-medium text-neutral-500">Company Name</dt>
                <dd className="sm:col-span-2 text-neutral-900">
                  {submittedInquiry.companyName.trim() ? submittedInquiry.companyName : (
                    <span className="text-neutral-400 italic">Not provided</span>
                  )}
                </dd>
              </div>

              <div id="result-service-required" className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                <dt className="font-medium text-neutral-500">Service Required</dt>
                <dd className="sm:col-span-2 text-neutral-900">{submittedInquiry.serviceRequired}</dd>
              </div>

              <div id="result-project-requirements" className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                <dt className="font-medium text-neutral-500">Project Requirements</dt>
                <dd className="sm:col-span-2 text-neutral-900 whitespace-pre-wrap">
                  {submittedInquiry.projectRequirements}
                </dd>
              </div>

              <div id="result-budget" className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                <dt className="font-medium text-neutral-500">Budget</dt>
                <dd className="sm:col-span-2 text-neutral-900">
                  {submittedInquiry.budget.trim() ? submittedInquiry.budget : (
                    <span className="text-neutral-400 italic">Not specified</span>
                  )}
                </dd>
              </div>

              <div id="result-desired-deadline" className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                <dt className="font-medium text-neutral-500">Desired Deadline</dt>
                <dd className="sm:col-span-2 text-neutral-900">
                  {submittedInquiry.desiredDeadline.trim() ? submittedInquiry.desiredDeadline : (
                    <span className="text-neutral-400 italic">Not specified</span>
                  )}
                </dd>
              </div>
            </dl>
          </section>
        )}
      </div>
    </div>
  );
}
