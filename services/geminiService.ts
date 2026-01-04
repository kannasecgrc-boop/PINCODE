import { GoogleGenAI, Type } from "@google/genai";
import { GEMINI_MODEL, GEMINI_LITE_MODEL } from "../constants";
import { SearchResult } from "../types";

// Initialize client lazily to prevent crash if env is missing during load
const getAiClient = () => {
    const key = process.env.API_KEY;
    if (!key) {
        console.warn("API_KEY is missing in process.env");
    }
    return new GoogleGenAI({ apiKey: key || "" });
};

// Helper to clean markdown formatting from JSON strings
const cleanJsonString = (text: string): string => {
  let cleaned = text.trim();
  // Remove markdown code blocks if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleaned;
};

export const searchPostcodes = async (query: string): Promise<SearchResult> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Find the exact and accurate postal code/pincode for: "${query}".
      
      Strict Data Accuracy Rules:
      1. **Accuracy is paramount.** If the location is in India, ensure the Pincode matches the official Department of Posts data.
      2. If the query specifies a Village or Mandal, return the specific Pincode for that locality, not just the District code.
      3. Clearly state the hierarchy: Country -> State -> District -> Tehsil/Mandal -> Village.
      4. If multiple pincodes apply to a city, list them broken down by area (e.g., "Bangalore North: 5600XX").
      5. Present the data in a clean, easy-to-read table or bullet list using Markdown.
      `,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "No results found.";
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

    return {
      text,
      groundingMetadata,
    };
  } catch (error: any) {
    console.error("Gemini API Error (Search):", error);
    if (error.message?.includes("API key") || error.toString().includes("403") || error.toString().includes("API_KEY")) {
        throw new Error("API Key Error: The API key is missing or invalid. Please check your configuration.");
    }
    throw new Error("Unable to fetch data. Please try again later.");
  }
};

export const getLocationSuggestions = async (
  level: 'state' | 'city' | 'area' | 'mandal' | 'village',
  context: { country?: string; state?: string; city?: string; mandal?: string }
): Promise<string[]> => {
  const fetchSuggestions = async (model: string) => {
      const ai = getAiClient();
      let prompt = "";
      
      if (level === 'state') {
        prompt = `List the all official States and Union Territories of ${context.country}. Return only a clean JSON array of names.`;
      } else if (level === 'city') {
        prompt = `List the all administrative Districts (or major Cities) in ${context.state}, ${context.country}. Return only a clean JSON array of names.`;
      } else if (level === 'area') {
        prompt = `List the major localities, areas, or neighborhoods within ${context.city}, ${context.state}. Return only a clean JSON array of names.`;
      } else if (level === 'mandal') {
        prompt = `List the all Mandals, Tehsils, Taluks, or Administrative Blocks in the ${context.city} district of ${context.state}, ${context.country}. Return only a clean JSON array of names.`;
      } else if (level === 'village') {
        prompt = `List the significant Villages, Towns, or Post Office locations in ${context.mandal} (Mandal/Tehsil), ${context.city} District, ${context.state}. Return only a clean JSON array of names.`;
      }

      const response = await ai.models.generateContent({
        model: model, 
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });

      const cleanedText = cleanJsonString(response.text || "[]");
      return JSON.parse(cleanedText) as string[];
  };

  try {
    // Try with high-accuracy model first
    return await fetchSuggestions(GEMINI_MODEL);
  } catch (error) {
    console.warn(`Primary model failed for ${level}, retrying with Lite model...`, error);
    try {
        // Fallback to Lite model if the first one fails (often faster/more available)
        return await fetchSuggestions(GEMINI_LITE_MODEL);
    } catch (retryError) {
        console.error(`Failed to fetch ${level} suggestions:`, retryError);
        return [];
    }
  }
};

export const getQuickSuggestions = async (partialQuery: string): Promise<string[]> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: GEMINI_LITE_MODEL,
      contents: `List 5 valid geographical locations or pincode queries starting with "${partialQuery}". 
      Return only a JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const cleanedText = cleanJsonString(response.text || "[]");
    return JSON.parse(cleanedText) as string[];
  } catch (error) {
    console.error("Failed to fetch quick suggestions:", error);
    return [];
  }
};