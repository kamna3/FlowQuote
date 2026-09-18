import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { calculateQuote } from "./server/pricingEngine";

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
      return res.status(503).json({
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

// Vite middleware & Static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
