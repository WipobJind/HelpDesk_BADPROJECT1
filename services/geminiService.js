const { GoogleGenAI } = require("@google/genai");

const VALID_CATEGORIES = ["Hardware", "Software", "Network", "Account", "Other"];

async function categorizeTicket(title, description) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `You are an IT helpdesk ticket classifier. Based on the ticket title and description below, classify it into exactly one of these categories: ${VALID_CATEGORIES.join(", ")}.
Respond with ONLY the category name, nothing else.

Title: ${title}
Description: ${description}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    const text = response.text.trim();
    const match = VALID_CATEGORIES.find(
      (c) => c.toLowerCase() === text.toLowerCase()
    );
    return match || "Other";
  } catch (err) {
    console.error("Gemini categorization failed:", err.message);
    return "Other";
  }
}

module.exports = { categorizeTicket, VALID_CATEGORIES };
