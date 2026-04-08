import { GoogleGenerativeAI } from "@google/generative-ai";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

const VISION_MODELS = [
  "google/gemini-flash-1.5-8b",        // تم إزالة :free لاختبار النسخة المباشرة
  "google/gemini-2.0-flash-001"
];

function getOpenRouterApiKey() { return process.env.OPENROUTER_API_KEY; }
function getGeminiApiKey() { return process.env.GEMINI_API_KEY; }

export interface DiagnosisResult {
  class: string;
  confidence: number;
  description: string;
  instructions: string[];
  bbox_x?: number;
  bbox_y?: number;
  bbox_w?: number;
  bbox_h?: number;
  severity?: "low" | "medium" | "high" | "critical";
}

const ALLOWED_CLASSES = new Set([
  "BLEEDING", "FRACTURE", "BURN", "PERSON FALLEN", "UNCONSCIOUS", "INJURY"
]);

function extractJSON(text: string): DiagnosisResult[] {
  if (!text) return [];
  const trimmed = text.trim();
  try {
    if (trimmed.startsWith("[")) return JSON.parse(trimmed);
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) return JSON.parse(codeBlockMatch[1].trim());
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) return JSON.parse(arrayMatch[0]);
  } catch (e) {
    console.error("[AI] JSON Parse Fail:", e);
  }
  return [];
}

function sanitizeDetections(raw: any[]): DiagnosisResult[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(d => d && typeof d === "object") // شلنا فلتر الـ 0.35 عشان نسمح بمرور رسائل التوجيه (NONE)
    .map(d => ({
      class: String(d.class || "INJURY").toUpperCase().trim(),
      confidence: Math.min(1, Math.max(0, d.confidence || 0)),
      description: String(d.description || ""),
      instructions: Array.isArray(d.instructions) ? d.instructions.map(String) : [],
      bbox_x: Number(d.bbox_x) || 30,
      bbox_y: Number(d.bbox_y) || 30,
      bbox_w: Number(d.bbox_w) || 40,
      bbox_h: Number(d.bbox_h) || 40,
      severity: d.severity || (d.confidence >= 0.8 ? "critical" : "high")
    }))
    .slice(0, 3);
}

async function callGoogleGeminiDirect(imageBase64: string, prompt: string): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("No Gemini API Key");
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // تجربة النسخة المستقرة فقط
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent([
    prompt,
    { inlineData: { data: imageBase64, mimeType: "image/jpeg" } }
  ]);
  return result.response.text();
}

export async function analyzeImage(imageBase64: string): Promise<DiagnosisResult[]> {
  console.log(`[AI] Analyze request received, length: ${imageBase64.length}`);
  const orKey = getOpenRouterApiKey();
  const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
  
  const prompt = `You are a professional emergency medical AI. 
Analyze this image for specific medical emergencies: BLEEDING, FRACTURE, BURN, PERSON FALLEN, UNCONSCIOUS.

CRITICAL INSTRUCTIONS:
1. IMAGE QUALITY CHECK: If the image is blurry, too dark, or the injury is too far away to identify clearly, set "class" to "NONE" and "description" to a specific guidance in Arabic (e.g., 'الصورة غير واضحة، يرجى تقريب الكاميرا من الجرح' or 'الإضاءة ضعيفة جداً' or 'يرجى مسح عدسة الكاميرا').
2. SPECIFICITY: If you see an injury, identify the exact type and severity.
3. INSTRUCTIONS: Provide immediate, clear first-aid instructions in Arabic.
4. FORMAT: Respond ONLY with a JSON array of objects with this structure:
[{
  "class": "BLEEDING" | "FRACTURE" | "BURN" | "PERSON FALLEN" | "UNCONSCIOUS" | "NONE",
  "confidence": 0.0-1.0,
  "description": "Specific description OR guidance if image is bad (in Arabic)",
  "instructions": ["Step 1", "Step 2"] (Empty if class is NONE),
  "severity": "low" | "medium" | "high" | "critical",
  "bbox_x": 0-100, "bbox_y": 0-100, "bbox_w": 0-100, "bbox_h": 0-100
}]
If it's just a normal scene with no injury and clear quality, return [].`;

  if (orKey) {
    for (const model of VISION_MODELS) {
      try {
        console.log(`[AI] Trying OpenRouter: ${model}`);
        const res = await fetch(OPENROUTER_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${orKey}` },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Data}` } }] }]
          })
        });
        if (res.ok) {
          const data = await res.json();
          return sanitizeDetections(extractJSON(data.choices?.[0]?.message?.content));
        }
      } catch (e) { console.warn(`[AI] OR Fail: ${model}`); }
    }
  }

  try {
    console.log("[AI] Fallback: Gemini SDK (1.5-flash)");
    const text = await callGoogleGeminiDirect(base64Data, prompt);
    return sanitizeDetections(extractJSON(text));
  } catch (e) {
    console.error("[AI] Total Failure");
    return [];
  }
}
