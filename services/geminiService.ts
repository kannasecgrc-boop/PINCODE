import { GoogleGenAI, Type } from "@google/genai";
import { GEMINI_MODEL, GEMINI_LITE_MODEL } from "../constants";
import { SearchResult } from "../types";

// Initialize client lazily or inside functions to prevent immediate crash if key is missing on load
const getAiClient = () => {
    // Falls back to empty string to prevent constructor error, though API calls will still fail gracefully
    return new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
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
      3. clearly state the hierarchy: Country -> State -> District -> Tehsil/Mandal -> Village.
      4. If multiple pincodes apply to a city, list them broken down by area (e.g., "Bangalore North: 5600XX").
      5. Present the data in a clean, easy-to-read table or bullet list using Markdown.
      `,
      config: {
        tools: [{ googleSearch: {} }], // Keep Google Search for verification
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
    // Provide a more user-friendly error if it's an API Key issue
    if (error.message?.includes("API key") || error.toString().includes("API_KEY")) {
        throw new Error("API Configuration Error: Please check your API Key settings.");
    }
    throw new Error(error.message || "Failed to fetch postal code data.");
  }
};

export const getLocationSuggestions = async (
  level: 'state' | 'city' | 'area' | 'mandal' | 'village',
  context: { country?: string; state?: string; city?: string; mandal?: string }
): Promise<string[]> => {
  try {
    const ai = getAiClient();
    let prompt = "";
    // We use strict prompts to guide the model to real administrative divisions
    if (level === 'state') {
      prompt = `List the all official States and Union Territories of ${context.country}. Return only a clean JSON array of names.`;
    } else if (level === 'city') {
      prompt = `List the all administrative Districts (or major Cities if districts are not applicable) in ${context.state}, ${context.country}. Return only a clean JSON array of names.`;
    } else if (level === 'area') {
      prompt = `List the major localities, areas, or neighborhoods within ${context.city}, ${context.state}. Return only a clean JSON array of names.`;
    } else if (level === 'mandal') {
      // Expanded terminology for India (Mandal / Tehsil / Taluk / Block)
      prompt = `List the all Mandals, Tehsils, Taluks, or Administrative Blocks in the ${context.city} district of ${context.state}, ${context.country}. Return only a clean JSON array of names.`;
    } else if (level === 'village') {
      prompt = `List the significant Villages, Towns, or Post Office locations in ${context.mandal} (Mandal/Tehsil), ${context.city} District, ${context.state}. Return only a clean JSON array of names.`;
    }

    // CRITICAL CHANGE: Use GEMINI_MODEL (Flash) instead of Lite for higher accuracy on Indian Geography
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL, 
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
    const ai = getAiClient();
    // Keep Lite for quick autocomplete as it needs speed over deep accuracy
    const response = await ai.models.generateContent({
      model: GEMINI_LITE_MODEL,
      contents: `List 5 valid geographical locations or pincode queries starting with "${partialQuery}". 
      Return only a JSON array of strings.`,
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