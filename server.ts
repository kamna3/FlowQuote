import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { calculateQuote } from "./server/pricingEngine";
import { generateQuotePDF } from "./server/pdfGenerator";
import { sendQuoteEmail, getGmailServiceStatus } from "./server/emailService";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// API: Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// API: Analyze Inquiry using Gemini
app.post("/api/analyze-inquiry", async (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      companyName,
      serviceRequired,
      projectRequirements,
      budget,
      desiredDeadline,
    } = req.body;

    // Validate required fields
    if (
      !customerName?.trim() ||
      !customerEmail?.trim() ||
      !serviceRequired?.trim() ||
      !projectRequirements?.trim()
    ) {
      return res.status(400).json({
        error:
          "Missing required inquiry fields (Customer Name, Email, Service Required, and Project Requirements).",
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error:
          "Gemini server configuration is missing. GEMINI_API_KEY environment variable is not configured.",
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const prompt = `Analyze this incoming customer inquiry to prepare a professional quotation:
- Customer Name: ${customerName}
- Customer Email: ${customerEmail}
- Company Name: ${companyName ? companyName : "Not specified"}
- Service Required: ${serviceRequired}
- Project Requirements: ${projectRequirements}
- Budget: ${budget ? budget : "Not specified"}
- Desired Deadline: ${desiredDeadline ? desiredDeadline : "Not specified"}

Perform a detailed scoping analysis, assess budget/timeline feasibility, highlight key deliverables, recommend quoting strategies, and generate clarification questions.`;

    const schemaConfig = {
      systemInstruction:
        "You are FlowQuote's professional project scoping and quotation analyst. Evaluate customer inquiries with high precision. Provide realistic scope complexity, key deliverables, budget feasibility feedback, actionable quotation recommendations, and client clarification questions in valid JSON.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: {
            type: Type.STRING,
            description: "Executive summary of the customer inquiry and its objectives",
          },
          serviceCategory: {
            type: Type.STRING,
            description: "Classified primary domain or service category",
          },
          scopeComplexity: {
            type: Type.STRING,
            description: "Estimated project complexity level: Low, Medium, High, or Enterprise",
          },
          estimatedTimeline: {
            type: Type.STRING,
            description: "Realistic timeline estimation to deliver the requested requirements",
          },
          keyDeliverables: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Key deliverables necessary to fulfill this inquiry",
          },
          budgetFeasibility: {
            type: Type.STRING,
            description: "Assessment of the stated budget compared to the scope, or guidance if omitted",
          },
          recommendations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Strategic advice for pricing and quoting this project",
          },
          clarificationQuestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Crucial questions to clarify with the client before signing off on the quote",
          },
        },
        required: [
          "summary",
          "serviceCategory",
          "scopeComplexity",
          "estimatedTimeline",
          "keyDeliverables",
          "budgetFeasibility",
          "recommendations",
          "clarificationQuestions",
        ],
      },
    };

    // Try candidate models with graceful fallback if a model experiences high demand
    const candidateModels = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3.8-flash"];
    let response;
    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: schemaConfig,
        });
        if (response?.text) {
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${model} attempt note:`, err?.message?.slice(0, 120));
      }
    }

    if (!response?.text) {
      throw lastError || new Error("No response generated by Gemini model.");
    }

    const responseText = response.text;
    const analysis = JSON.parse(responseText);
    return res.json({ success: true, analysis });
  } catch (error: any) {
    console.error("Error analyzing inquiry with Gemini:", error);
    return res.status(500).json({
      error: error.message || "Failed to process inquiry analysis.",
    });
  }
});

// API: Generate Quote using deterministic Pricing Engine
app.post("/api/generate-quote", (req, res) => {
  try {
    const { inquiry, analysis } = req.body;

    if (!inquiry || !analysis) {
      return res.status(400).json({
        error: "Missing inquiry or AI analysis payload to generate quote.",
      });
    }

    // Deterministic calculation via pricing engine (Gemini does not decide the final price)
    const quote = calculateQuote(inquiry, analysis);

    return res.json({
      success: true,
      quote,
    });
  } catch (error: any) {
    console.error("Error calculating quote:", error);
    return res.status(500).json({
      error: error.message || "Failed to calculate quote.",
    });
  }
});

// API: Generate Quote PDF
app.post("/api/generate-quote-pdf", async (req, res) => {
  try {
    const { quote, inquiry, analysis } = req.body;

    if (!quote || typeof quote !== "object") {
      return res.status(400).json({
        error: "Missing or invalid quote data payload to generate PDF.",
      });
    }

    if (!quote.customer_name || !Array.isArray(quote.services) || quote.services.length === 0) {
      return res.status(400).json({
        error: "Quote data is missing required fields (customer_name or services).",
      });
    }

    if (typeof quote.total !== "number" || isNaN(quote.total)) {
      return res.status(400).json({
        error: "Invalid total amount in quote data.",
      });
    }

    // Generate deterministic PDF document buffer
    const pdfBuffer = await generateQuotePDF({
      quote,
      inquiry,
      analysis,
    });

    const safeQuoteNumber = quote.quote_number
      ? String(quote.quote_number).replace(/[^a-zA-Z0-9-_]/g, "_")
      : "Quotation";
    const filename = `FlowQuote_${safeQuoteNumber}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.status(200).send(pdfBuffer);
  } catch (error: any) {
    console.error("Error generating quote PDF:", error);
    return res.status(500).json({
      error: error.message || "Failed to generate quote PDF.",
    });
  }
});

// API: Check Gmail service status (without exposing secrets)
app.get("/api/email-status", (_req, res) => {
  const status = getGmailServiceStatus();
  return res.json(status);
});

// API: Send approved Quote PDF to Customer via Gmail
app.post("/api/send-quote", async (req, res) => {
  try {
    const { quote, inquiry, analysis, recipientEmail } = req.body;

    // 1. Validate quote payload
    if (!quote || typeof quote !== "object") {
      return res.status(400).json({
        error: "Missing or invalid quote data payload.",
      });
    }

    if (!quote.customer_name || typeof quote.customer_name !== "string" || !quote.customer_name.trim()) {
      return res.status(400).json({
        error: "Quote data is missing customer name.",
      });
    }

    if (!quote.quote_number || typeof quote.quote_number !== "string") {
      return res.status(400).json({
        error: "Quote data is missing a valid quote number.",
      });
    }

    if (!Array.isArray(quote.services) || quote.services.length === 0) {
      return res.status(400).json({
        error: "Quote data contains no service line items.",
      });
    }

    if (typeof quote.total !== "number" || isNaN(quote.total)) {
      return res.status(400).json({
        error: "Quote data contains invalid total pricing.",
      });
    }

    // 2. Determine and validate recipient email
    const targetEmail = (
      recipientEmail ||
      quote.customer_email ||
      inquiry?.customerEmail ||
      ""
    ).trim();

    if (!targetEmail) {
      return res.status(400).json({
        error: "Customer email address is required to send the quotation.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(targetEmail)) {
      return res.status(400).json({
        error: `Invalid recipient email format: "${targetEmail}".`,
      });
    }

    // 3. Check server Gmail configuration
    const gmailStatus = getGmailServiceStatus();
    if (!gmailStatus.configured) {
      return res.status(400).json({
        error: "Gmail service is not configured on the server. Please provide GMAIL_USER and GMAIL_APP_PASSWORD in the environment variables.",
        code: "GMAIL_UNCONFIGURED",
        missing: gmailStatus.missing,
      });
    }

    // 4. Send email with PDF attachment
    const result = await sendQuoteEmail({
      recipientEmail: targetEmail,
      quote,
      inquiry,
      analysis,
    });

    return res.status(200).json({
      success: true,
      status: "Sent",
      quote_number: result.quoteNumber,
      recipient: result.recipient,
      sent_at: result.sentAt,
      message: `Quotation email successfully sent to ${result.recipient}.`,
    });
  } catch (error: any) {
    console.error("Error executing send-quote:", error?.message || error);

    if (error?.name === "GmailConfigurationError") {
      return res.status(400).json({
        error: error.message,
        code: "GMAIL_UNCONFIGURED",
      });
    }

    // Check for authentication failure
    if (
      error?.code === "EAUTH" ||
      error?.responseCode === 535 ||
      error?.message?.includes("Invalid login") ||
      error?.message?.includes("Username and Password not accepted")
    ) {
      return res.status(400).json({
        error: "Gmail authentication failed. Please verify that your GMAIL_USER and GMAIL_APP_PASSWORD are valid and that 2-Step Verification with an App Password is used.",
        code: "GMAIL_AUTH_FAILED",
      });
    }

    // Check for connection/network error
    if (error?.code === "ESOCKET" || error?.code === "ECONNECTION" || error?.code === "ETIMEDOUT") {
      return res.status(400).json({
        error: "Network timeout or connection error contacting Gmail servers. Please try again.",
        code: "NETWORK_ERROR",
      });
    }

    return res.status(400).json({
      error: error?.message || "Failed to send quotation email via Gmail.",
      code: "GMAIL_SEND_FAILED",
    });
  }
});

// Vite middleware & Static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const isAiStudioPreview = Boolean(
      process.env.DISABLE_HMR === "true" ||
      process.env.APPLET_ID ||
      process.env.APP_URL?.includes("ais-") ||
      process.env.K_SERVICE?.startsWith("ais-")
    );

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isAiStudioPreview ? false : true,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`FlowQuote server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
