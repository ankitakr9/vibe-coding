import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini API client lazily to prevent server crashes if the API key is not set yet.
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not configured in the environment variables.");
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

// REST API endpoint: AI Astrology Guru
app.post("/api/astrology-guru", async (req, res) => {
  try {
    const { message, history, birthProfile } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    const ai = getAiClient();

    // Construct a beautiful rich system instruction that guides Gemini to act as a profound Vedic Astrologer.
    const systemPrompt = `You are Acharya Shastri, a profound, compassionate, and wise Indian Vedic Astrologer (Jyotish Guru) with decades of experience in reading horoscopes, charts, and counselling seekers. 
Your tone is serene, respectful, highly encouraging, and deeply rooted in Indian culture (using mild Sanskrit/Hindi astrological terms like "Pranam", "Shubh", "Karma", "Dharma", "Kundli" where fitting).

Seeker's details:
- Name: ${birthProfile?.birthDetails?.fullName || "Seeker"}
- Gender: ${birthProfile?.birthDetails?.gender || "Not specified"}
- Born: ${birthProfile?.birthDetails?.dateOfBirth || "Unknown Date"} at ${birthProfile?.birthDetails?.timeOfBirth || "Unknown Time"}
- Birth Place: ${birthProfile?.birthDetails?.placeOfBirth || "Unknown Location"}
- Moon Rashi (Moon Sign): ${birthProfile?.rashi || "Unknown"} (Lord: ${birthProfile?.rashiLord || "Unknown"})
- Nakshatra (Lunar Mansion): ${birthProfile?.nakshatra || "Unknown"} (Lord: ${birthProfile?.nakshatraLord || "Unknown"}, Pada: ${birthProfile?.pada || "1"})
- Lucky Number: ${birthProfile?.luckyNumber || "N/A"}
- Lucky Color: ${birthProfile?.luckyColor || "N/A"}
- Lucky Gemstone: ${birthProfile?.luckyGemstone || "N/A"}
- Active Doshas: ${birthProfile?.doshas?.filter((d: any) => d.present).map((d: any) => d.name).join(", ") || "None"}
- Auspicious Yogas Present: ${birthProfile?.yogas?.map((y: any) => y.name).join(", ") || "None"}

Rules of interaction:
1. Always refer back to their birth details, Rashi, and Nakshatra dynamically to answer their questions.
2. Be highly compassionate, focused on Karma, self-improvement, remedies (Pooja, charity, gemstones, mantras), and positive spiritual counseling.
3. Keep your answers concise, structured (using bold headings, short bullet points), and elegant.
4. Avoid scary, fatalistic predictions. Frame challenges as areas for spiritual growth and karmic healing.
5. Speak directly as Acharya Shastri. Do not break character. Use a welcoming greeting like "Pranam [Name]..." or "May the cosmic forces bless you, [Name]..."`;

    // Package the history for context
    const chatContents = [
      { text: systemPrompt }
    ];

    if (history && Array.isArray(history)) {
      history.forEach((msg: any) => {
        chatContents.push({ text: `${msg.role === 'user' ? 'Seeker' : 'Guru'}: ${msg.content}` });
      });
    }

    chatContents.push({ text: `Seeker's current question: ${message}` });

    // Call Gemini using the official @google/genai SDK
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: chatContents,
      config: {
        temperature: 0.7,
        maxOutputTokens: 1000,
      }
    });

    res.json({ reply: response.text });
  } catch (error: any) {
    console.error("Guru API error:", error);
    res.status(500).json({ 
      error: "Acharya Shastri is currently in deep meditation (API error). Please verify your API key or try again in a few moments.",
      details: error.message 
    });
  }
});

// REST API endpoint: Compile and Download Astrological Report
app.post("/api/generate-report", async (req, res) => {
  try {
    const { birthProfile } = req.body;
    if (!birthProfile) {
      return res.status(400).json({ error: "Astrological profile is required." });
    }

    const ai = getAiClient();

    const reportPrompt = `Compile a highly detailed, formal, premium Vedic Astrological Report (Janam Patrika Report) for ${birthProfile.birthDetails.fullName}.
Use the following birth chart data to structure the report:
- Name: ${birthProfile.birthDetails.fullName}
- Gender: ${birthProfile.birthDetails.gender}
- Date: ${birthProfile.birthDetails.dateOfBirth}
- Time: ${birthProfile.birthDetails.timeOfBirth}
- Place: ${birthProfile.birthDetails.placeOfBirth}
- Moon Rashi: ${birthProfile.rashi} (Rashi Lord: ${birthProfile.rashiLord})
- Nakshatra: ${birthProfile.nakshatra} (Nakshatra Lord: ${birthProfile.nakshatraLord}, Pada: ${birthProfile.pada})
- Active Doshas: ${birthProfile.doshas.filter((d: any) => d.present).map((d: any) => d.name + ' (' + d.severity + ' severity)').join(', ') || 'None'}
- Yogas: ${birthProfile.yogas.map((y: any) => y.name).join(', ') || 'None'}
- Lucky Details: Number ${birthProfile.luckyNumber}, Color ${birthProfile.luckyColor}, Gemstone ${birthProfile.luckyGemstone}

Report Structure:
1. Cosmic Welcome & Astrological Summary.
2. Deep analysis of Rashi (${birthProfile.rashi}) and Nakshatra (${birthProfile.nakshatra}).
3. House Positions and Planet Placement Guidance.
4. Doshas Interpretation & Vedic Remedies.
5. Yogas interpretation and active fortunes.
6. Mahadasha timeline breakdown & general advice.
7. Remedial Measures (Mantras, Gemstone advice, Charity, and Daily routines).

Output the report in elegant Markdown. Maintain a highly professional, reverent, and detailed voice.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: reportPrompt,
      config: {
        temperature: 0.6,
        maxOutputTokens: 2048,
      }
    });

    res.json({ report: response.text });
  } catch (error: any) {
    console.error("Report generator API error:", error);
    res.status(500).json({
      error: "Could not generate report due to server status. Please verify your GEMINI_API_KEY.",
      details: error.message
    });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});

// Vite Middleware & Production routing
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
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port http://localhost:${PORT}`);
  });
}

startServer();
