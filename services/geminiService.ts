import { GoogleGenAI, Type } from "@google/genai";
import { GEMINI_MODEL, GEMINI_LITE_MODEL } from "../constants";
import { SearchResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const searchPostcodes = async (query: string): Promise<SearchResult> => {
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Find postal codes/pincodes/zip codes related to: "${query}".
      
      Rules:
      1. If the user searches for a specific location (Mandal, Village, Area), list the specific postal code(s).
      2. Identify the hierarchy (Country -> State -> District -> Mandal/Area).
      3. Provide the answer in a clear, readable format (bullet points or a small table structure using Markdown).
      4. Be concise but accurate.
      5. Include the country name clearly.
      `,
      config: {
        tools: [{ googleSearch: {} }], // Enable Google Search Grounding for accuracy
      },
    });

    // Extract text
    const text = response.text || "No results found.";
    
    // Extract grounding metadata if available
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

    return {
      text,
      groundingMetadata,
    };
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Failed to fetch postal code data.");
  }
};

export const getLocationSuggestions = async (
  level: 'state' | 'city' | 'area' | 'mandal' | 'village',
  context: { country?: string; state?: string; city?: string; mandal?: string }
): Promise<string[]> => {
  try {
    let prompt = "";
    if (level === 'state') {
      prompt = `List the states, provinces, or major regions of ${context.country}. Return only a list of names.`;
    } else if (level === 'city') {
      prompt = `List the districts or major cities in ${context.state}, ${context.country}. Return only a list of names.`;
    } else if (level === 'area') {
      prompt = `List the major areas, localities, or neighborhoods in ${context.city}, ${context.state}, ${context.country}. Return only a list of names.`;
    } else if (level === 'mandal') {
      prompt = `List the Mandals (administrative divisions/blocks/tehsils) in the district of ${context.city}, ${context.state}, ${context.country}. Return only a list of names.`;
    } else if (level === 'village') {
      prompt = `List the Villages or Post Office names in ${context.mandal} Mandal, ${context.city} District, ${context.state}, ${context.country}. Return only a list of names.`;
    }

    const response = await ai.models.generateContent({
      model: GEMINI_LITE_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) return [];
    return JSON.parse(jsonText) as string[];

  } catch (error) {
    console.error(`Failed to fetch ${level} suggestions:`, error);
    return [];
  }
};

export const getQuickSuggestions = async (partialQuery: string): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_LITE_MODEL,
      contents: `List 5 most likely geographical locations, cities, or postal code queries that start with or relate to "${partialQuery}". 
      Return only a JSON array of strings. Do not include explanations.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) return [];
    return JSON.parse(jsonText) as string[];
  } catch (error) {
    console.error("Failed to fetch quick suggestions:", error);
    return [];
  }
};