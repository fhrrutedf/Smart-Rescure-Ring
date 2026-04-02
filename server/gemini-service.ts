import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCskZW61HLc8e_qFP0j3sgevjUZQP7Itd8";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export interface DiagnosisResult {
  class: string;
  confidence: number;
  description: string;
  instructions: string[];
}

export async function analyzeImage(imageBase64: string): Promise<DiagnosisResult[]> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Analyze this medical emergency image. Identify the type of injury (e.g., BLEEDING, FRACTURE, BURN, PERSON FALLEN, UNCONSCIOUS, INJURY).
    Respond ONLY in JSON format like this:
    [
      {
        "class": "BLEEDING",
        "confidence": 0.95,
        "description": "Severe arterial bleeding on the forearm.",
        "instructions": ["Apply direct pressure", "Elevate the limb", "Call an ambulance"]
      }
    ]
    If no injury is found, return an empty array [].
    Translate descriptions and instructions to Arabic if possible, or provide English.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBase64.split(",")[1] || imageBase64,
          mimeType: "image/jpeg",
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();
    
    // Extract JSON from the text (Gemini sometimes adds markdown blocks)
    const jsonMatch = text.match(/\[.*\]/s);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return [];
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return [];
  }
}
