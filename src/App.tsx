import { useState, type FormEvent, type ChangeEvent } from 'react';
import type { InquiryFormData, FormErrors, AIAnalysisResult, QuoteDraft } from './types';
import {
  Sparkles,
  AlertCircle,
  Clock,
  Layers,
  CheckCircle2,
  Lightbulb,
  HelpCircle,
  RefreshCw,
  Receipt,
  FileCheck,
  FileDown,
  Check,
  Send,
  Mail,
} from 'lucide-react';

const INITIAL_FORM_STATE: InquiryFormData = {
  customerName: '',
  customerEmail: '',
  companyName: '',
  serviceRequired: '',
  projectRequirements: '',
  budget: '',
  desiredDeadline: '',
};

interface ParsedResponse<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
}

async function parseJsonResponse<T = any>(response: Response): Promise<ParsedResponse<T>> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      const data = await response.json();
      const isSuccess = response.ok && data?.success !== false;
      return {
        ok: isSuccess,
        status: response.status,
        data,
        error: data?.error || (isSuccess ? undefined : `Server returned status ${response.status}`),
      };
    } catch {
      return {
        ok: false,
        status: response.status,
        data: null,
        error: 'Malformed JSON returned from server.',
      };
    }
  }

  // Handle HTML or text fallback from proxies (e.g. Cloud Run, Nginx)
  const text = await response.text();
  let cleanMsg = `Server returned HTTP ${response.status}.`;
  if (response.status === 503 || text.includes('503 Service Unavailable')) {
    cleanMsg = 'Service is temporarily unavailable or unconfigured on the server.';
  } else if (response.status === 502 || text.includes('502 Bad Gateway')) {
    cleanMsg = 'Gateway error communicating with upstream service.';
  } else if (response.status === 504 || text.includes('504 Gateway Timeout')) {
    cleanMsg = 'Server response timed out. Please try again.';
  } else if (text && text.length < 150 && !text.includes('<')) {
    cleanMsg = text;
  }

  return {
    ok: false,
    status: response.status,
    data: null,
    error: cleanMsg,
  };
}

export default function App() {
  const [formData, setFormData] = useState<InquiryFormData>(INITIAL_FORM_STATE);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submittedInquiry, setSubmittedInquiry] = useState<InquiryFormData | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);

  // Step 3 State: Quote Draft & Pricing Engine
  const [quoteDraft, setQuoteDraft] = useState<QuoteDraft | null>(null);
  const [isGeneratingQuote, setIsGeneratingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Step 4 State: PDF Generation
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfDownloaded, setPdfDownloaded] = useState(false);

  // Step 5 State: Email Quote via Gmail
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [sendEmailError, setSendEmailError] = useState<string | null>(null);
  const [sendEmailSuccess, setSendEmailSuccess] = useState<{
    sentAt: string;
    recipient: string;
    quoteNumber: string;
  } | null>(null);

  const formatUSD = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Reset previous feedback states
    setServerError(null);
    setAiAnalysis(null);
    setSubmittedInquiry(null);
    setQuoteDraft(null);
    setQuoteError(null);
    setIsGeneratingPdf(false);
    setPdfError(null);
    setPdfDownloaded(false);
    setIsSendingEmail(false);
    setSendEmailError(null);
    setSendEmailSuccess(null);
    setIsAnalyzing(true);

    try {
      const response = await fetch('/api/analyze-inquiry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const parsed = await parseJsonResponse(response);

      if (!parsed.ok || !parsed.data?.success) {
        const message =
          parsed.error ||
          (response.status === 503 || response.status === 400
            ? 'Gemini server configuration is missing. GEMINI_API_KEY environment variable is not configured.'
            : 'An unexpected server error occurred while analyzing the inquiry.');
        setServerError(message);
        return;
      }

      setSubmittedInquiry({ ...formData });
      setAiAnalysis(parsed.data.analysis);
    } catch (err: any) {
      console.error('Failed to communicate with /api/analyze-inquiry:', err);
      setServerError(
        'Failed to connect to the analysis service. Please verify that the backend server is running and your Gemini API key is configured.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateQuote = async () => {
    if (!aiAnalysis) return;

    setIsGeneratingQuote(true);
    setQuoteError(null);

    try {
      const inquiryPayload = submittedInquiry || formData;
      const response = await fetch('/api/generate-quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inquiry: inquiryPayload,
          analysis: aiAnalysis,
        }),
      });

      const parsed = await parseJsonResponse(response);

      if (!parsed.ok || !parsed.data?.success) {
        throw new Error(parsed.error || 'Failed to calculate quote from pricing engine.');
      }

      setQuoteDraft(parsed.data.quote);
    } catch (err: any) {
      console.error('Failed to generate quote:', err);
      setQuoteError(err.message || 'An unexpected error occurred while calculating the quote.');
    } finally {
      setIsGeneratingQuote(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!quoteDraft) return;

    setIsGeneratingPdf(true);
    setPdfError(null);
    setPdfDownloaded(false);

    try {
      const inquiryPayload = submittedInquiry || formData;
      const response = await fetch('/api/generate-quote-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quote: quoteDraft,
          inquiry: inquiryPayload,
          analysis: aiAnalysis,
        }),
      });

      if (!response.ok) {
        let errorMsg = 'Failed to generate PDF quotation.';
        try {
          const errData = await response.json();
          if (errData?.error) errorMsg = errData.error;
        } catch {
          // Non-JSON response
        }
        throw new Error(errorMsg);
      }

      // Determine filename from response header or quote number
      const disposition = response.headers.get('Content-Disposition');
      let filename = `FlowQuote_${quoteDraft.quote_number || 'Quotation'}.pdf`;
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) {
          filename = match[1];
        }
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setPdfDownloaded(true);
    } catch (err: any) {
      console.error('Failed to generate quotation PDF:', err);
      setPdfError(err.message || 'An unexpected error occurred while generating the PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleSendQuote = async () => {
    if (!quoteDraft) {
      setSendEmailError('No active quote draft available to send.');
      return;
    }

    const recipient = (
      quoteDraft.customer_email ||
      submittedInquiry?.customerEmail ||
      formData.customerEmail ||
      ''
    ).trim();

    if (!recipient) {
      setSendEmailError('Customer email address is required to email the quotation. Please enter an email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipient)) {
      setSendEmailError(`Invalid recipient email address format: "${recipient}".`);
      return;
    }

    setIsSendingEmail(true);
    setSendEmailError(null);

    try {
      const inquiryPayload = submittedInquiry || formData;
      const response = await fetch('/api/send-quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quote: quoteDraft,
          inquiry: inquiryPayload,
          analysis: aiAnalysis,
          recipientEmail: recipient,
        }),
      });

      const parsed = await parseJsonResponse(response);

      if (!parsed.ok || !parsed.data?.success) {
        throw new Error(parsed.error || 'Failed to send quote email.');
      }

      const data = parsed.data;
      // Update quoteDraft status to 'Sent' and record timestamp and recipient
      const updatedQuote: QuoteDraft = {
        ...quoteDraft,
        status: 'Sent',
        sent_at: data.sent_at || new Date().toISOString(),
        sent_to: data.recipient || recipient,
      };

      setQuoteDraft(updatedQuote);
      setSendEmailSuccess({
        sentAt: data.sent_at || new Date().toISOString(),
        recipient: data.recipient || recipient,
        quoteNumber: data.quote_number || quoteDraft.quote_number || '',
      });
    } catch (err: any) {
      console.error('Error sending quote email:', err);
      setSendEmailError(err.message || 'An unexpected error occurred while sending the email.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleReset = () => {
    setFormData(INITIAL_FORM_STATE);
    setErrors({});
    setServerError(null);
    setAiAnalysis(null);
    setSubmittedInquiry(null);
    setQuoteDraft(null);
    setIsGeneratingQuote(false);
    setQuoteError(null);
    setIsGeneratingPdf(false);
    setPdfError(null);
    setPdfDownloaded(false);
    setIsSendingEmail(false);
    setSendEmailError(null);
    setSendEmailSuccess(null);
  };

  return (
    <div id="app-root" className="min-h-screen bg-white text-neutral-900 antialiased py-12 px-4 sm:px-6 lg:px-8">
      <div id="page-container" className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <header id="main-header" className="text-center">
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
                disabled={isAnalyzing || isGeneratingQuote}
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
                disabled={isAnalyzing || isGeneratingQuote}
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
                disabled={isAnalyzing || isGeneratingQuote}
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
                disabled={isAnalyzing || isGeneratingQuote}
                value={formData.serviceRequired}
                onChange={handleChange}
                placeholder="e.g. Website Development, Logo & Branding, SEO"
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
                disabled={isAnalyzing || isGeneratingQuote}
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
                  disabled={isAnalyzing || isGeneratingQuote}
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
                  disabled={isAnalyzing || isGeneratingQuote}
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
                disabled={isAnalyzing || isGeneratingQuote}
                className="w-full py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-400 text-white font-medium rounded-md text-sm transition-colors cursor-pointer disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 flex items-center justify-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Analyzing Inquiry with Gemini...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-white" />
                    <span>Analyze Inquiry</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Server / Configuration Error Banner */}
        {serverError && (
          <div
            id="server-error-banner"
            className="border border-red-200 bg-red-50 rounded-lg p-5 flex items-start gap-3.5 text-red-900"
          >
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 id="error-banner-heading" className="text-sm font-semibold text-red-900">
                AI Analysis Request Failed
              </h3>
              <p id="error-banner-message" className="text-sm text-red-700 leading-relaxed">
                {serverError}
              </p>
              <p id="error-banner-hint" className="text-xs text-red-600 mt-2">
                Make sure <code className="bg-red-100 px-1 py-0.5 rounded font-mono">GEMINI_API_KEY</code> is set in the environment or the AI Studio Secrets panel.
              </p>
            </div>
          </div>
        )}

        {/* AI Analysis Section */}
        {aiAnalysis && (
          <section
            id="ai-analysis-section"
            className="border border-neutral-200 rounded-lg p-6 sm:p-8 bg-neutral-50/70 space-y-6"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-neutral-200 gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-neutral-100" />
                </div>
                <div>
                  <h2 id="ai-analysis-title" className="text-xl font-bold text-neutral-950">
                    AI Analysis
                  </h2>
                  <p id="ai-analysis-subtitle" className="text-xs text-neutral-500">
                    Generated via Gemini server-side quotation analysis
                  </p>
                </div>
              </div>
              <button
                id="reset-analysis-button"
                type="button"
                onClick={handleReset}
                className="self-start sm:self-auto text-xs font-medium text-neutral-600 hover:text-neutral-900 border border-neutral-300 hover:border-neutral-400 rounded px-2.5 py-1.5 transition-colors cursor-pointer"
              >
                New Inquiry
              </button>
            </div>

            {/* Executive Summary */}
            <div id="ai-summary-card" className="bg-white border border-neutral-200 rounded-md p-4">
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                Executive Summary
              </h3>
              <p id="ai-summary-text" className="text-sm text-neutral-900 leading-relaxed">
                {aiAnalysis.summary}
              </p>
            </div>

            {/* Quick Metrics Grid */}
            <div id="ai-metrics-grid" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Service Category */}
              <div id="metric-category" className="bg-white border border-neutral-200 rounded-md p-3.5">
                <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 mb-1">
                  <Layers className="w-3.5 h-3.5 text-neutral-700" />
                  <span>Category</span>
                </div>
                <div id="metric-category-value" className="text-sm font-semibold text-neutral-900">
                  {aiAnalysis.serviceCategory}
                </div>
              </div>

              {/* Scope Complexity */}
              <div id="metric-complexity" className="bg-white border border-neutral-200 rounded-md p-3.5">
                <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-neutral-700" />
                  <span>Complexity</span>
                </div>
                <div id="metric-complexity-value" className="text-sm font-semibold text-neutral-900">
                  {aiAnalysis.scopeComplexity}
                </div>
              </div>

              {/* Estimated Timeline */}
              <div id="metric-timeline" className="bg-white border border-neutral-200 rounded-md p-3.5">
                <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 mb-1">
                  <Clock className="w-3.5 h-3.5 text-neutral-700" />
                  <span>Estimated Timeline</span>
                </div>
                <div id="metric-timeline-value" className="text-sm font-semibold text-neutral-900">
                  {aiAnalysis.estimatedTimeline}
                </div>
              </div>
            </div>

            {/* Key Deliverables */}
            <div id="ai-deliverables-card" className="bg-white border border-neutral-200 rounded-md p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                <CheckCircle2 className="w-4 h-4 text-neutral-800" />
                <span>Key Deliverables</span>
              </div>
              <ul id="ai-deliverables-list" className="space-y-2">
                {aiAnalysis.keyDeliverables.map((deliverable, index) => (
                  <li key={index} className="flex items-start gap-2.5 text-sm text-neutral-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 mt-2 shrink-0" />
                    <span>{deliverable}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Budget Feasibility */}
            <div id="ai-budget-card" className="bg-white border border-neutral-200 rounded-md p-4">
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                Budget & Pricing Feasibility
              </h3>
              <p id="ai-budget-text" className="text-sm text-neutral-800 leading-relaxed">
                {aiAnalysis.budgetFeasibility}
              </p>
            </div>

            {/* Recommendations & Clarifications Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Recommendations */}
              <div id="ai-recommendations-card" className="bg-white border border-neutral-200 rounded-md p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  <Lightbulb className="w-4 h-4 text-neutral-800" />
                  <span>Quotation Recommendations</span>
                </div>
                <ul id="ai-recommendations-list" className="space-y-2 text-sm text-neutral-800">
                  {aiAnalysis.recommendations.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-neutral-400 font-mono text-xs mt-0.5">{idx + 1}.</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Clarification Questions */}
              <div id="ai-clarifications-card" className="bg-white border border-neutral-200 rounded-md p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  <HelpCircle className="w-4 h-4 text-neutral-800" />
                  <span>Questions for Client</span>
                </div>
                <ul id="ai-clarifications-list" className="space-y-2 text-sm text-neutral-800">
                  {aiAnalysis.clarificationQuestions.map((q, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-neutral-400 font-mono text-xs mt-0.5">{idx + 1}.</span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Submitted Inquiry Data Reference */}
            {submittedInquiry && (
              <details id="submitted-data-details" className="bg-white border border-neutral-200 rounded-md text-xs text-neutral-600">
                <summary className="p-3.5 font-medium text-neutral-700 cursor-pointer hover:text-neutral-900 select-none">
                  View submitted inquiry details
                </summary>
                <div className="p-4 pt-1 border-t border-neutral-100 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <span className="font-medium text-neutral-500">Customer:</span>
                    <span className="col-span-2 text-neutral-900">{submittedInquiry.customerName} ({submittedInquiry.customerEmail})</span>
                  </div>
                  {submittedInquiry.companyName && (
                    <div className="grid grid-cols-3 gap-2">
                      <span className="font-medium text-neutral-500">Company:</span>
                      <span className="col-span-2 text-neutral-900">{submittedInquiry.companyName}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <span className="font-medium text-neutral-500">Service:</span>
                    <span className="col-span-2 text-neutral-900">{submittedInquiry.serviceRequired}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="font-medium text-neutral-500">Requirements:</span>
                    <span className="col-span-2 text-neutral-900 whitespace-pre-wrap">{submittedInquiry.projectRequirements}</span>
                  </div>
                  {submittedInquiry.budget && (
                    <div className="grid grid-cols-3 gap-2">
                      <span className="font-medium text-neutral-500">Budget:</span>
                      <span className="col-span-2 text-neutral-900">{submittedInquiry.budget}</span>
                    </div>
                  )}
                  {submittedInquiry.desiredDeadline && (
                    <div className="grid grid-cols-3 gap-2">
                      <span className="font-medium text-neutral-500">Deadline:</span>
                      <span className="col-span-2 text-neutral-900">{submittedInquiry.desiredDeadline}</span>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Step 3: Action to Generate Quote */}
            <div id="generate-quote-cta" className="pt-2 border-t border-neutral-200">
              <button
                id="generate-quote-button"
                type="button"
                onClick={handleGenerateQuote}
                disabled={!aiAnalysis || isGeneratingQuote}
                className="w-full py-3 px-4 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white font-medium rounded-md text-sm transition-colors cursor-pointer disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 flex items-center justify-center gap-2 shadow-xs"
              >
                {isGeneratingQuote ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Calculating Quote using Pricing Engine...</span>
                  </>
                ) : (
                  <>
                    <Receipt className="w-4 h-4 text-white" />
                    <span>Generate Quote</span>
                  </>
                )}
              </button>
              <p className="text-center text-xs text-neutral-500 mt-2">
                Uses deterministic pricing rules with verified scope complexity. Gemini does not set prices.
              </p>
            </div>
          </section>
        )}

        {/* Quote Calculation Error Banner */}
        {quoteError && (
          <div
            id="quote-error-banner"
            className="border border-red-200 bg-red-50 rounded-lg p-5 flex items-start gap-3.5 text-red-900"
          >
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 id="quote-error-heading" className="text-sm font-semibold text-red-900">
                Quote Generation Failed
              </h3>
              <p id="quote-error-message" className="text-sm text-red-700 leading-relaxed">
                {quoteError}
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Quote Draft Section */}
        {quoteDraft && (
          <section
            id="quote-draft-section"
            className="border border-neutral-300 rounded-lg p-6 sm:p-8 bg-white shadow-sm space-y-6"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-neutral-200 gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-neutral-900 text-white flex items-center justify-center">
                  <FileCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 id="quote-draft-title" className="text-xl font-bold text-neutral-950">
                      Quote Review
                    </h2>
                    {quoteDraft.status === 'Sent' ? (
                      <span id="quote-status-badge" className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Sent
                      </span>
                    ) : (
                      <span id="quote-status-badge" className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-800 border border-neutral-200">
                        Draft
                      </span>
                    )}
                  </div>
                  <p id="quote-draft-subtitle" className="text-xs text-neutral-500">
                    Deterministic pricing calculated from predefined rules
                  </p>
                </div>
              </div>
              <div className="text-xs text-neutral-500 font-mono sm:text-right">
                <span>Pricing Rules Engine v1.0</span>
              </div>
            </div>

            {/* Sent Status Banner if Sent */}
            {quoteDraft.status === 'Sent' && quoteDraft.sent_at && (
              <div id="quote-sent-banner" className="border border-emerald-200 bg-emerald-50/80 rounded-md p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-emerald-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Approved quotation emailed to <strong>{quoteDraft.sent_to || quoteDraft.customer_email}</strong> on{' '}
                    {new Date(quoteDraft.sent_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}{' '}
                    at{' '}
                    {new Date(quoteDraft.sent_at).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <span className="font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 shrink-0">
                  Status: Sent
                </span>
              </div>
            )}

            {/* Client & Quote Metadata */}
            <div id="quote-client-info" className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-neutral-50 rounded-md p-4 border border-neutral-200 text-sm">
              <div>
                <span className="text-xs font-medium text-neutral-500 block uppercase tracking-wider mb-1">
                  Quote Number
                </span>
                <span id="quote-number-display" className="font-mono font-semibold text-neutral-900">
                  {quoteDraft.quote_number || 'FQ-Draft'}
                </span>
              </div>
              <div>
                <span className="text-xs font-medium text-neutral-500 block uppercase tracking-wider mb-1">
                  Customer Name
                </span>
                <span id="quote-customer-name" className="font-semibold text-neutral-900 block truncate">
                  {quoteDraft.customer_name}
                </span>
                {quoteDraft.company_name ? (
                  <span id="quote-company-name" className="text-xs text-neutral-600 block truncate">
                    {quoteDraft.company_name}
                  </span>
                ) : (
                  <span className="text-xs text-neutral-400 italic block">Individual Client</span>
                )}
              </div>
              <div>
                <span className="text-xs font-medium text-neutral-500 block uppercase tracking-wider mb-1">
                  Quote Validity
                </span>
                <span id="quote-validity-display" className="text-neutral-900 font-medium">
                  14 Days (Draft Proposal)
                </span>
              </div>
            </div>

            {/* Complexity Note if Estimated */}
            {quoteDraft.complexity_estimated && (
              <div id="quote-complexity-estimated-note" className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-md p-3">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{quoteDraft.notes || 'Complexity was estimated as Standard based on initial scope indicators.'}</span>
              </div>
            )}

            {/* Services Table */}
            <div id="quote-services-container" className="overflow-x-auto border border-neutral-200 rounded-md">
              <table id="quote-services-table" className="min-w-full divide-y divide-neutral-200 text-sm">
                <thead className="bg-neutral-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left font-medium text-neutral-600">
                      Service
                    </th>
                    <th scope="col" className="px-4 py-3 text-left font-medium text-neutral-600">
                      Complexity
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium text-neutral-600">
                      Price (USD)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 bg-white">
                  {quoteDraft.services.map((item, idx) => (
                    <tr key={idx} id={`quote-service-row-${idx}`}>
                      <td className="px-4 py-3 text-neutral-900 font-medium">
                        {item.name}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.complexity === 'Basic'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : item.complexity === 'Standard'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {item.complexity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-neutral-900 font-semibold">
                        {formatUSD(item.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Totals Breakdown */}
            <div id="quote-totals-container" className="bg-neutral-50 rounded-md p-4 border border-neutral-200 space-y-2.5">
              <div className="flex justify-between items-center text-sm text-neutral-600">
                <span>Subtotal</span>
                <span id="quote-subtotal" className="font-mono text-neutral-900">
                  {formatUSD(quoteDraft.subtotal)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm text-neutral-600">
                <span>Discount</span>
                <span id="quote-discount" className="font-mono text-neutral-900">
                  {formatUSD(quoteDraft.discount)}
                </span>
              </div>
              <div className="pt-2 border-t border-neutral-200 flex justify-between items-center">
                <span className="text-base font-bold text-neutral-950">Total</span>
                <span id="quote-total" className="text-xl font-bold font-mono text-neutral-950">
                  {formatUSD(quoteDraft.total)}
                </span>
              </div>
            </div>

            {/* Engagement Terms */}
            <div id="quote-terms-grid" className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div id="quote-timeline-box" className="p-4 border border-neutral-200 rounded-md bg-white">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
                  Estimated Timeline
                </span>
                <span id="quote-timeline" className="text-neutral-900 font-medium">
                  {quoteDraft.timeline}
                </span>
              </div>
              <div id="quote-payment-terms-box" className="p-4 border border-neutral-200 rounded-md bg-white">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
                  Payment Terms
                </span>
                <span id="quote-payment-terms" className="text-neutral-900 font-medium">
                  {quoteDraft.payment_terms}
                </span>
              </div>
            </div>

            {/* Step 4 & 5: Review & Send Actions */}
            <div id="quote-actions-container" className="pt-5 border-t border-neutral-200 space-y-4">
              {/* Send Email Error Banner or Configuration Guide */}
              {sendEmailError && (
                sendEmailError.includes('GMAIL_USER') ||
                sendEmailError.includes('not configured') ||
                sendEmailError.includes('GMAIL_APP_PASSWORD') ? (
                  <div
                    id="email-setup-banner"
                    className="border border-amber-300 bg-amber-50/95 rounded-lg p-4 sm:p-5 text-amber-950 text-sm space-y-3 shadow-xs"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center justify-between">
                          <h4 id="email-setup-title" className="font-semibold text-amber-950">
                            Gmail Configuration Required to Dispatch Live Emails
                          </h4>
                          <button
                            type="button"
                            onClick={() => setSendEmailError(null)}
                            className="text-amber-700 hover:text-amber-900 text-xs font-medium cursor-pointer"
                          >
                            Dismiss
                          </button>
                        </div>
                        <p id="email-setup-message" className="text-amber-900 text-xs sm:text-sm">
                          Direct email dispatch requires setting two environment variables in your project settings:
                        </p>
                      </div>
                    </div>

                    <div className="bg-white/90 rounded border border-amber-200 p-3 text-xs space-y-2 font-mono">
                      <div>
                        <strong className="text-neutral-900">1. GMAIL_USER</strong>
                        <div className="text-neutral-600 font-sans mt-0.5">
                          Your sender Gmail address (e.g. <span className="font-mono">yourname@gmail.com</span>).
                        </div>
                      </div>
                      <div className="pt-1.5 border-t border-amber-100">
                        <strong className="text-neutral-900">2. GMAIL_APP_PASSWORD</strong>
                        <div className="text-neutral-600 font-sans mt-0.5">
                          A 16-character Google App Password (from Google Account &rarr; Security &rarr; 2-Step Verification &rarr; App passwords).
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                      <p className="text-xs text-amber-800">
                        💡 <em>Tip: You do not need to configure email to get your quote. You can download the PDF directly!</em>
                      </p>
                      <button
                        type="button"
                        onClick={handleGeneratePDF}
                        disabled={isGeneratingPdf}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-xs font-medium cursor-pointer transition-colors shadow-xs shrink-0"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        <span>Download PDF Directly</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    id="email-error-banner"
                    className="border border-red-200 bg-red-50 rounded-lg p-4 flex items-start gap-3 text-red-900 text-sm"
                  >
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 id="email-error-title" className="font-semibold text-red-900">
                          Unable to Send Quotation Email
                        </h4>
                        <button
                          type="button"
                          onClick={() => setSendEmailError(null)}
                          className="text-red-700 hover:text-red-900 text-xs font-medium cursor-pointer"
                        >
                          Dismiss
                        </button>
                      </div>
                      <p id="email-error-message" className="text-red-700">
                        {sendEmailError}
                      </p>
                    </div>
                  </div>
                )
              )}

              {/* Send Email Success Banner */}
              {sendEmailSuccess && (
                <div
                  id="email-success-banner"
                  className="border border-emerald-200 bg-emerald-50 rounded-lg p-4 flex items-start gap-3 text-emerald-900 text-sm"
                >
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 id="email-success-title" className="font-semibold text-emerald-900">
                      Quotation Successfully Sent
                    </h4>
                    <p id="email-success-message" className="text-emerald-800">
                      The official quotation PDF (Quote #{sendEmailSuccess.quoteNumber}) was sent to <strong>{sendEmailSuccess.recipient}</strong>.
                    </p>
                    <p id="email-success-timestamp" className="text-xs text-emerald-700 font-mono">
                      Timestamp: {new Date(sendEmailSuccess.sentAt).toLocaleString()} • Quote Status: Sent
                    </p>
                  </div>
                </div>
              )}

              {/* PDF Error Banner if any */}
              {pdfError && (
                <div
                  id="pdf-error-banner"
                  className="border border-red-200 bg-red-50 rounded-lg p-4 flex items-start gap-3 text-red-900 text-sm"
                >
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <h4 id="pdf-error-title" className="font-semibold text-red-900">
                      PDF Generation Failed
                    </h4>
                    <p id="pdf-error-message" className="text-red-700">
                      {pdfError}
                    </p>
                  </div>
                </div>
              )}

              {/* PDF Download Success Confirmation */}
              {pdfDownloaded && (
                <div
                  id="pdf-success-indicator"
                  className="border border-emerald-200 bg-emerald-50 rounded-lg p-3.5 flex items-center justify-between text-emerald-900 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-medium">Quotation PDF downloaded to your device.</span>
                  </div>
                  <span className="font-mono text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded border border-emerald-200">
                    Status: {quoteDraft.status || 'Draft'}
                  </span>
                </div>
              )}

              {/* Action Buttons: Send Quote (Primary) & Generate PDF (Secondary) */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  id="send-quote-button"
                  type="button"
                  onClick={handleSendQuote}
                  disabled={isSendingEmail || isGeneratingPdf}
                  className="flex-1 py-3 px-5 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white font-medium rounded-md text-sm transition-colors cursor-pointer disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 flex items-center justify-center gap-2 shadow-xs"
                >
                  {isSendingEmail ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Sending Quotation via Gmail...</span>
                    </>
                  ) : quoteDraft.status === 'Sent' ? (
                    <>
                      <Send className="w-4 h-4 text-white" />
                      <span>Resend Quote</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 text-white" />
                      <span>Send Quote</span>
                    </>
                  )}
                </button>

                <button
                  id="generate-pdf-button"
                  type="button"
                  onClick={handleGeneratePDF}
                  disabled={isGeneratingPdf || isSendingEmail}
                  className="py-3 px-5 bg-white hover:bg-neutral-50 disabled:bg-neutral-100 text-neutral-800 disabled:text-neutral-400 font-medium rounded-md text-sm border border-neutral-300 transition-colors cursor-pointer disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 flex items-center justify-center gap-2 shadow-xs"
                >
                  {isGeneratingPdf ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-neutral-600" />
                      <span>Generating PDF...</span>
                    </>
                  ) : (
                    <>
                      <FileDown className="w-4 h-4 text-neutral-700" />
                      <span>Generate PDF</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-neutral-500 gap-1.5 pt-1">
                <span>
                  Recipient:{' '}
                  <strong className="text-neutral-700 font-medium">
                    {quoteDraft.customer_email || submittedInquiry?.customerEmail || formData.customerEmail || 'No email specified'}
                  </strong>
                </span>
                <span>Human Approval Required: Quote remains Draft until explicit delivery.</span>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
