import PDFDocument from 'pdfkit';
import {
  QUOTE_VALIDITY_DAYS,
  STANDARD_TERMS,
  generateQuoteNumber,
  calculateValidUntilDate,
  formatDisplayDate,
} from './quoteConfig';

export interface PDFQuoteItem {
  name: string;
  complexity: string;
  price: number;
}

export interface PDFQuoteData {
  quote_number?: string;
  created_at?: string;
  valid_until?: string;
  customer_name: string;
  customer_email?: string;
  company_name?: string;
  services: PDFQuoteItem[];
  subtotal: number;
  discount: number;
  total: number;
  timeline: string;
  payment_terms: string;
  complexity_estimated?: boolean;
  notes?: string;
}

export interface PDFInquiryData {
  customerName?: string;
  customerEmail?: string;
  companyName?: string;
  serviceRequired?: string;
  projectRequirements?: string;
  budget?: string;
  desiredDeadline?: string;
}

export interface PDFAnalysisData {
  summary?: string;
  serviceCategory?: string;
  scopeComplexity?: string;
  estimatedTimeline?: string;
  keyDeliverables?: string[];
  budgetFeasibility?: string;
  recommendations?: string[];
}

export interface GeneratePDFParams {
  quote: PDFQuoteData;
  inquiry?: PDFInquiryData;
  analysis?: PDFAnalysisData;
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
 * Generates a professional business quotation PDF document buffer.
 * Deterministic generation driven by existing quote and inquiry data.
 */
export function generateQuotePDF(params: GeneratePDFParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const { quote, inquiry, analysis } = params;

      const issueDate = quote.created_at ? new Date(quote.created_at) : new Date();
      const validUntilDate = quote.valid_until
        ? new Date(quote.valid_until)
        : calculateValidUntilDate(issueDate);
      const quoteNumber = quote.quote_number || generateQuoteNumber(issueDate);

      // Create PDF Document with A4 size and clean 40pt margins
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `FlowQuote - ${quoteNumber}`,
          Author: 'FlowQuote',
          Subject: `Quotation for ${quote.customer_name}`,
          Keywords: 'Quotation, Proposal, FlowQuote',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const pageWidth = doc.page.width;
      const contentWidth = pageWidth - 80; // 40pt margins on each side
      const leftMargin = 40;

      // --- 1. HEADER & BRANDING ---
      const headerTop = 40;
      doc.fontSize(22).font('Helvetica-Bold').fillColor('#0f172a').text('FlowQuote', leftMargin, headerTop);
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#64748b')
        .text('Turn customer inquiries into professional quotes.', leftMargin, headerTop + 26);

      // Header Right: Quotation & Status
      const rightColX = leftMargin + contentWidth - 200;
      doc
        .fontSize(13)
        .font('Helvetica-Bold')
        .fillColor('#0f172a')
        .text('PROJECT QUOTATION', rightColX, headerTop, { width: 200, align: 'right' });

      // Draft Proposal Badge
      const badgeY = headerTop + 20;
      const badgeW = 95;
      const badgeH = 18;
      const badgeX = leftMargin + contentWidth - badgeW;

      doc
        .roundedRect(badgeX, badgeY, badgeW, badgeH, 3)
        .fillAndStroke('#fef3c7', '#fde68a');

      doc
        .fontSize(8.5)
        .font('Helvetica-Bold')
        .fillColor('#b45309')
        .text('DRAFT PROPOSAL', badgeX, badgeY + 4.5, { width: badgeW, align: 'center' });

      // Top Divider line
      doc
        .moveTo(leftMargin, 76)
        .lineTo(leftMargin + contentWidth, 76)
        .strokeColor('#e2e8f0')
        .lineWidth(1)
        .stroke();

      // --- 2. METADATA BAR ---
      const metaBoxY = 86;
      doc
        .roundedRect(leftMargin, metaBoxY, contentWidth, 34, 4)
        .fillAndStroke('#f8fafc', '#e2e8f0');

      const col1X = leftMargin + 14;
      const col2X = leftMargin + 180;
      const col3X = leftMargin + 340;

      // Meta Col 1: Quote Number
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#64748b').text('QUOTE NUMBER', col1X, metaBoxY + 6);
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0f172a').text(quoteNumber, col1X, metaBoxY + 18);

      // Meta Col 2: Issue Date
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#64748b').text('DATE OF ISSUE', col2X, metaBoxY + 6);
      doc.fontSize(9).font('Helvetica').fillColor('#334155').text(formatDisplayDate(issueDate), col2X, metaBoxY + 18);

      // Meta Col 3: Validity Period
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#64748b').text('VALIDITY PERIOD', col3X, metaBoxY + 6);
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#334155')
        .text(`${QUOTE_VALIDITY_DAYS} Days (Until ${formatDisplayDate(validUntilDate)})`, col3X, metaBoxY + 18);

      // --- 3. CUSTOMER & PROJECT OVERVIEW (2 Columns) ---
      const clientInfoY = 132;
      const infoColWidth = (contentWidth - 16) / 2;
      const clientColX = leftMargin;
      const projectColX = leftMargin + infoColWidth + 16;
      const infoBoxH = 78;

      // Client Box
      doc
        .roundedRect(clientColX, clientInfoY, infoColWidth, infoBoxH, 4)
        .fillAndStroke('#ffffff', '#e2e8f0');

      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#64748b').text('PREPARED FOR', clientColX + 12, clientInfoY + 8);
      doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#0f172a').text(quote.customer_name, clientColX + 12, clientInfoY + 22);

      const customerEmail = quote.customer_email || inquiry?.customerEmail || 'Not specified';
      doc.fontSize(8.5).font('Helvetica').fillColor('#475569').text(`Email: ${customerEmail}`, clientColX + 12, clientInfoY + 38);

      const company = quote.company_name || inquiry?.companyName || 'Individual Client';
      doc.fontSize(8.5).font('Helvetica').fillColor('#475569').text(`Company: ${company}`, clientColX + 12, clientInfoY + 52);

      // Project Overview Box
      doc
        .roundedRect(projectColX, clientInfoY, infoColWidth, infoBoxH, 4)
        .fillAndStroke('#ffffff', '#e2e8f0');

      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#64748b').text('PROJECT OVERVIEW', projectColX + 12, clientInfoY + 8);

      const primaryService = inquiry?.serviceRequired || analysis?.serviceCategory || quote.services[0]?.name || 'General Development';
      doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#0f172a').text(primaryService, projectColX + 12, clientInfoY + 22);

      doc.fontSize(8.5).font('Helvetica').fillColor('#475569').text(`Estimated Timeline: ${quote.timeline}`, projectColX + 12, clientInfoY + 38);

      const complexityVal = analysis?.scopeComplexity || quote.services[0]?.complexity || 'Standard';
      doc.fontSize(8.5).font('Helvetica').fillColor('#475569').text(`Scope Complexity: ${complexityVal}`, projectColX + 12, clientInfoY + 52);

      // --- 4. PROJECT REQUIREMENTS & DELIVERABLES ---
      let currentY = 222;

      const projectSummary = analysis?.summary || inquiry?.projectRequirements;
      if (projectSummary) {
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#334155').text('Project Requirements Summary:', leftMargin, currentY);
        currentY += 13;

        const summaryText = projectSummary.length > 280 ? `${projectSummary.slice(0, 277)}...` : projectSummary;
        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#475569')
          .text(summaryText, leftMargin, currentY, { width: contentWidth, lineGap: 1.5 });
        currentY += Math.min(doc.heightOfString(summaryText, { width: contentWidth, lineGap: 1.5 }), 36) + 8;
      }

      // Key Deliverables
      const deliverables = analysis?.keyDeliverables || [];
      if (deliverables.length > 0) {
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#334155').text('Key Deliverables Included:', leftMargin, currentY);
        currentY += 12;

        const displayedDeliverables = deliverables.slice(0, 4);
        displayedDeliverables.forEach((item) => {
          doc.fontSize(8).font('Helvetica').fillColor('#475569').text(`•  ${item}`, leftMargin + 8, currentY, { width: contentWidth - 16 });
          currentY += 12;
        });
        currentY += 4;
      }

      // --- 5. PRICING TABLE ---
      currentY = Math.max(currentY, 305);

      doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0f172a').text('Services & Pricing Breakdown', leftMargin, currentY);
      currentY += 14;

      // Table Header
      const tableHeadH = 22;
      doc.rect(leftMargin, currentY, contentWidth, tableHeadH).fill('#f1f5f9');

      const colServiceX = leftMargin + 10;
      const colServiceW = contentWidth * 0.45;
      const colDescX = colServiceX + colServiceW;
      const colDescW = contentWidth * 0.30;
      const colPriceX = colDescX + colDescW;
      const colPriceW = contentWidth - colServiceW - colDescW - 20;

      doc.fontSize(8).font('Helvetica-Bold').fillColor('#475569');
      doc.text('SERVICE', colServiceX, currentY + 6);
      doc.text('COMPLEXITY / TIER', colDescX, currentY + 6);
      doc.text('PRICE (USD)', colPriceX, currentY + 6, { width: colPriceW, align: 'right' });

      currentY += tableHeadH;

      // Table Rows
      const rowH = 22;
      quote.services.forEach((item, index) => {
        const bg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
        doc.rect(leftMargin, currentY, contentWidth, rowH).fill(bg);

        // Border line under row
        doc
          .moveTo(leftMargin, currentY + rowH)
          .lineTo(leftMargin + contentWidth, currentY + rowH)
          .strokeColor('#f1f5f9')
          .lineWidth(0.5)
          .stroke();

        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1e293b').text(item.name, colServiceX, currentY + 6);
        doc.fontSize(8).font('Helvetica').fillColor('#64748b').text(`${item.complexity} Tier`, colDescX, currentY + 6);
        doc
          .fontSize(8.5)
          .font('Helvetica-Bold')
          .fillColor('#0f172a')
          .text(formatUSD(item.price), colPriceX, currentY + 6, { width: colPriceW, align: 'right' });

        currentY += rowH;
      });

      // --- 6. TOTALS BREAKDOWN ---
      currentY += 4;
      const totalsBoxW = 200;
      const totalsBoxX = leftMargin + contentWidth - totalsBoxW;

      doc
        .roundedRect(totalsBoxX, currentY, totalsBoxW, 58, 4)
        .fillAndStroke('#f8fafc', '#e2e8f0');

      // Subtotal
      doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('Subtotal:', totalsBoxX + 12, currentY + 8);
      doc.fontSize(8.5).font('Helvetica').fillColor('#334155').text(formatUSD(quote.subtotal), totalsBoxX + 100, currentY + 8, { width: 88, align: 'right' });

      // Discount
      doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('Discount:', totalsBoxX + 12, currentY + 22);
      doc.fontSize(8.5).font('Helvetica').fillColor('#334155').text(formatUSD(quote.discount), totalsBoxX + 100, currentY + 22, { width: 88, align: 'right' });

      // Divider inside totals
      doc
        .moveTo(totalsBoxX + 10, currentY + 36)
        .lineTo(totalsBoxX + totalsBoxW - 10, currentY + 36)
        .strokeColor('#cbd5e1')
        .lineWidth(0.5)
        .stroke();

      // Total
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0f172a').text('Total (USD):', totalsBoxX + 12, currentY + 41);
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a').text(formatUSD(quote.total), totalsBoxX + 100, currentY + 40, { width: 88, align: 'right' });

      // --- 7. PAYMENT TERMS BOX ---
      const paymentBoxW = contentWidth - totalsBoxW - 14;
      doc
        .roundedRect(leftMargin, currentY, paymentBoxW, 58, 4)
        .fillAndStroke('#ffffff', '#e2e8f0');

      doc.fontSize(8).font('Helvetica-Bold').fillColor('#334155').text('AGREED PAYMENT TERMS', leftMargin + 12, currentY + 8);
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a').text(quote.payment_terms, leftMargin + 12, currentY + 22);
      doc.fontSize(7.5).font('Helvetica').fillColor('#64748b').text('Invoices are issued according to project milestones and scope confirmation.', leftMargin + 12, currentY + 38);

      currentY += 66;

      // --- 8. STANDARD TERMS AND CONDITIONS ---
      doc
        .roundedRect(leftMargin, currentY, contentWidth, 80, 4)
        .fillAndStroke('#f8fafc', '#e2e8f0');

      doc.fontSize(8).font('Helvetica-Bold').fillColor('#334155').text('STANDARD FLOWQUOTE TERMS & CONDITIONS', leftMargin + 12, currentY + 8);

      let termY = currentY + 21;
      STANDARD_TERMS.forEach((term, idx) => {
        doc.fontSize(6.8).font('Helvetica').fillColor('#64748b').text(`${idx + 1}.  ${term}`, leftMargin + 12, termY, { width: contentWidth - 24 });
        termY += 10.5;
      });

      // --- 9. FOOTER ---
      const footerY = doc.page.height - 30;
      doc
        .moveTo(leftMargin, footerY - 6)
        .lineTo(leftMargin + contentWidth, footerY - 6)
        .strokeColor('#e2e8f0')
        .lineWidth(0.5)
        .stroke();

      doc
        .fontSize(7.5)
        .font('Helvetica')
        .fillColor('#94a3b8')
        .text('FlowQuote Quotation Engine • Confidential Business Proposal • Generated Server-Side', leftMargin, footerY, {
          width: contentWidth,
          align: 'center',
        });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
