const { GoogleGenerativeAI } = require("@google/generative-ai");

const VALID_CATEGORIES = ["Hardware", "Software", "Network", "Account", "Other"];

async function categorizeTicket(title, description) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `You are an IT helpdesk ticket classifier. Based on the ticket title and description below, classify it into exactly one of these categories: Hardware, Software, Network, Account, Other.

Title: ${title}
Description: ${description}

Respond with ONLY the category name, nothing else.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text().trim();

    if (VALID_CATEGORIES.includes(response)) {
      return response;
    }

    // Fuzzy match if response contains one of the valid categories
    for (const cat of VALID_CATEGORIES) {
      if (response.toLowerCase().includes(cat.toLowerCase())) {
        return cat;
      }
    }

    return "Other";
  } catch (error) {
    console.error("Gemini categorization error:", error.message);
    return "Other";
  }
}

module.exports = { categorizeTicket };
