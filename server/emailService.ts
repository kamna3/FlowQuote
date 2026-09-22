import nodemailer from 'nodemailer';
import { generateQuotePDF, type GeneratePDFParams } from './pdfGenerator';

export interface EmailServiceStatus {
  configured: boolean;
  userConfigured: boolean;
  method: 'app_password' | 'unconfigured';
  senderAddress?: string;
  missing: string[];
}

export interface SendQuoteEmailParams extends GeneratePDFParams {
  recipientEmail: string;
}

export interface SendQuoteEmailResult {
  success: boolean;
  messageId?: string;
  recipient: string;
  quoteNumber: string;
  sentAt: string;
}

/**
 * Checks if server-side Gmail credentials are configured in environment variables.
 * Uses Gmail SMTP with an App Password. Never exposes credentials or secrets.
 */
export function getGmailServiceStatus(): EmailServiceStatus {
  const user = process.env.GMAIL_USER?.trim();
  const appPassword = process.env.GMAIL_APP_PASSWORD?.trim();

  const missing: string[] = [];
  if (!user) missing.push('GMAIL_USER');
  if (!appPassword) missing.push('GMAIL_APP_PASSWORD');

  const configured = Boolean(user && appPassword);

  return {
    configured,
    userConfigured: Boolean(user),
    method: configured ? 'app_password' : 'unconfigured',
    senderAddress: user ? user.replace(/(.{2})(.*)(@.*)/, '$1***$3') : undefined,
    missing,
  };
}

/**
 * Creates a nodemailer transport instance using Gmail SMTP with an App Password.
 */
function createGmailTransporter() {
  const status = getGmailServiceStatus();
  if (!status.configured) {
    const errorMsg = `Gmail service is not configured on the server. Please set ${status.missing.join(' and ')} in the environment variables.`;
    const err = new Error(errorMsg);
    err.name = 'GmailConfigurationError';
    throw err;
  }

  const user = process.env.GMAIL_USER!.trim();
  // Strip any accidental spaces from user-pasted app passwords (e.g. "abcd efgh ijkl mnop" -> "abcdefghijklmnop")
  const appPassword = process.env.GMAIL_APP_PASSWORD!.trim().replace(/\s+/g, '');

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user,
      pass: appPassword,
    },
  });
}

function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Generates the deterministic email content (subject, text body, html body).
 * Adheres strictly to prompt instructions: no AI generation, deterministic template.
 */
export function buildDeterministicEmail(params: GeneratePDFParams) {
  const { quote, inquiry, analysis } = params;

  const quoteNumber = quote.quote_number || 'Quotation';
  const customerName = quote.customer_name || 'Valued Client';
  const primaryService = inquiry?.serviceRequired || analysis?.serviceCategory || quote.services[0]?.name || 'Professional Services';
  const formattedTotal = formatUSD(quote.total);
  const timeline = quote.timeline || 'As agreed';

  const subject = `Quotation from FlowQuote — [${quoteNumber}]`;

  // Deterministic Plain Text template
  const textBody = `Dear ${customerName},

Thank you for your inquiry. Please find attached the formal quotation for your project.

QUOTATION DETAILS:
- Quote Number: ${quoteNumber}
- Project / Service: ${primaryService}
- Total Amount: ${formattedTotal} USD
- Estimated Timeline: ${timeline}
- Payment Terms: ${quote.payment_terms}

The complete itemized quotation, deliverables breakdown, and terms are included in the attached PDF document (${quoteNumber}.pdf).

If you have any questions or would like to approve this quotation, please reply directly to this email.

Best regards,
The FlowQuote Team
FlowQuote Quotation Engine
`;

  // Deterministic Clean HTML template
  const htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .header { background: #0f172a; color: #ffffff; padding: 24px; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { margin: 4px 0 0 0; color: #94a3b8; font-size: 13px; }
    .content { padding: 24px; }
    .intro { font-size: 15px; margin-bottom: 20px; color: #334155; }
    .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0; }
    .summary-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; border-bottom: 1px solid #f1f5f9; }
    .summary-row:last-child { border-bottom: none; font-weight: 700; font-size: 16px; color: #0f172a; padding-top: 10px; }
    .label { color: #64748b; font-weight: 500; }
    .value { color: #0f172a; text-align: right; }
    .attachment-notice { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; font-size: 13px; color: #1e40af; margin: 20px 0; border-radius: 0 4px 4px 0; }
    .footer { padding: 18px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>FlowQuote</h1>
      <p>Official Project Quotation</p>
    </div>
    <div class="content">
      <p class="intro">Dear <strong>${customerName}</strong>,</p>
      <p>Thank you for submitting your project inquiry. We have prepared an itemized proposal for your review.</p>
      
      <div class="summary-card">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Quote Number:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; font-family: monospace; color: #0f172a;">${quoteNumber}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Project / Service:</td>
            <td style="padding: 6px 0; text-align: right; color: #0f172a;">${primaryService}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Timeline:</td>
            <td style="padding: 6px 0; text-align: right; color: #0f172a;">${timeline}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Payment Terms:</td>
            <td style="padding: 6px 0; text-align: right; color: #0f172a;">${quote.payment_terms}</td>
          </tr>
          <tr style="border-top: 1px solid #e2e8f0;">
            <td style="padding: 10px 0 0 0; font-size: 16px; font-weight: 700; color: #0f172a;">Total Quotation:</td>
            <td style="padding: 10px 0 0 0; text-align: right; font-size: 18px; font-weight: 700; color: #0f172a;">${formattedTotal}</td>
          </tr>
        </table>
      </div>

      <div class="attachment-notice">
        <strong>PDF Attached:</strong> Your formal quotation document (<code>FlowQuote_${quoteNumber}.pdf</code>) is attached to this email with comprehensive scope specifications and terms.
      </div>

      <p style="font-size: 14px; color: #475569;">
        To proceed with this quotation or if you require any adjustments, please reply directly to this email.
      </p>

      <p style="font-size: 14px; margin-top: 24px; color: #1e293b;">
        Best regards,<br>
        <strong>The FlowQuote Team</strong>
      </p>
    </div>
    <div class="footer">
      FlowQuote Quotation Engine • Confidential Business Communication
    </div>
  </div>
</body>
</html>`;

  return {
    subject,
    textBody,
    htmlBody,
  };
}

/**
 * Sends the approved quotation PDF to the customer email address via Gmail.
 * Generates the PDF using the existing deterministic server PDF generator.
 */
export async function sendQuoteEmail(params: SendQuoteEmailParams): Promise<SendQuoteEmailResult> {
  const { recipientEmail, quote, inquiry, analysis } = params;

  if (!recipientEmail || typeof recipientEmail !== 'string') {
    throw new Error('Valid recipient email address is required.');
  }

  // Basic email structure regex check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(recipientEmail.trim())) {
    throw new Error(`Invalid email address format: "${recipientEmail}".`);
  }

  // Generate the quotation PDF using the existing server-side generator
  const pdfBuffer = await generateQuotePDF({
    quote,
    inquiry,
    analysis,
  });

  const quoteNumber = quote.quote_number || 'Quotation';
  const safeQuoteNumber = quoteNumber.replace(/[^a-zA-Z0-9-_]/g, '_');
  const filename = `FlowQuote_${safeQuoteNumber}.pdf`;

  // Build the deterministic email content
  const { subject, textBody, htmlBody } = buildDeterministicEmail(params);

  // Initialize Gmail transporter
  const transporter = createGmailTransporter();
  const senderUser = process.env.GMAIL_USER!.trim();

  // Send the email with the attached PDF
  const info = await transporter.sendMail({
    from: `"FlowQuote" <${senderUser}>`,
    to: recipientEmail.trim(),
    subject,
    text: textBody,
    html: htmlBody,
    attachments: [
      {
        filename,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });

  return {
    success: true,
    messageId: info.messageId,
    recipient: recipientEmail.trim(),
    quoteNumber,
    sentAt: new Date().toISOString(),
  };
}
