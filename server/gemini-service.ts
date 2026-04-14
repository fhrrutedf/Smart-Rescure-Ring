import { GoogleGenerativeAI } from "@google/generative-ai";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Models ordered by reliability — newer flash models first
const VISION_MODELS = [
  "google/gemini-2.0-flash-001",
  "google/gemini-flash-1.5-8b",
  "google/gemini-flash-1.5",
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

export interface HealthAnalysis {
  status: "normal" | "warning" | "critical";
  riskScore: number; // 0.0 to 1.0
  recommendation: string;
  condition?: string;
}

const ALLOWED_CLASSES = new Set([
  "BLEEDING", "FRACTURE", "BURN", "PERSON FALLEN", "UNCONSCIOUS", "INJURY"
]);

function extractJSON(text: string): any {
  if (!text) return null;
  const trimmed = text.trim();
  try {
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) return JSON.parse(trimmed);
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) return JSON.parse(codeBlockMatch[1].trim());
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) return JSON.parse(arrayMatch[0]);
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) return JSON.parse(objMatch[0]);
  } catch (e) {
    console.error("[AI] JSON Parse Fail:", e);
  }
  return null;
}

function sanitizeDetections(raw: any[]): DiagnosisResult[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(d => d && typeof d === "object")
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

// ─── Direct Google Gemini SDK (Primary Fallback) ────────────────────────────
async function callGoogleGeminiDirect(imageBase64: string, prompt: string): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("No Gemini API Key");
  
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Try newer models first for better vision analysis
  const models = ["gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-pro-vision"];
  
  for (const modelName of models) {
    try {
      console.log(`[AI] Trying Gemini Direct: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([
        prompt,
        { inlineData: { data: imageBase64, mimeType: "image/jpeg" } }
      ]);
      const text = result.response.text();
      console.log(`[AI] ✅ Gemini Direct success with ${modelName}`);
      return text;
    } catch (e: any) {
      console.warn(`[AI] Gemini model "${modelName}" failed: ${e?.message}`);
    }
  }
  
  throw new Error("All Gemini Direct models failed");
}

// ─── OpenRouter API Call ─────────────────────────────────────────────────────
async function callOpenRouter(imageBase64: string, prompt: string, model: string): Promise<string | null> {
  const orKey = getOpenRouterApiKey();
  if (!orKey) return null;

  try {
    const res = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${orKey}`,
        "HTTP-Referer": "https://smart-rescuer.app",
        "X-Title": "Smart Rescuer Ring",
      },
      body: JSON.stringify({
        model,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
          ]
        }],
        max_tokens: 1024,
      })
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(`[AI] OpenRouter model "${model}" HTTP ${res.status}: ${errText.slice(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.warn(`[AI] OpenRouter model "${model}" returned empty content`);
      return null;
    }

    console.log(`[AI] ✅ OpenRouter success with model: ${model}`);
    return content;
  } catch (e: any) {
    console.warn(`[AI] OpenRouter model "${model}" network error: ${e?.message}`);
    return null;
  }
}

// ─── Main Analyze Function ───────────────────────────────────────────────────
export async function analyzeImage(imageBase64: string): Promise<DiagnosisResult[]> {
  console.log(`[AI] Analyze request received, image length: ${imageBase64.length}`);
  
  const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
  
  const prompt = `أنت طبيب طوارئ متخصص في الذكاء الاصطناعي. حلّل هذه الصورة الطبية بدقة.

مهمتك:
- افحص الصورة بعناية شديدة بحثاً عن أي إصابة أو حالة طارئة
- إذا رأيت أي جلد متضرر، جرح، كدمة، حرق، احمرار، تورم، أو شخص ساقط → يجب أن تصنفها كإصابة
- لا تكن متحفظاً أكثر من اللازم — إذا كان هناك احتمال إصابة، صنفها كإصابة

أنواع الإصابات المطلوبة:
- BLEEDING: نزيف، جروح، دم ظاهر
- FRACTURE: كسور، تشوه في العظام أو الأطراف  
- BURN: حروق، احمرار شديد، فقاعات جلدية
- PERSON FALLEN: شخص ساقط على الأرض
- UNCONSCIOUS: شخص فاقد للوعي
- INJURY: أي إصابة أخرى (كدمات، جروح، سحجات)

تعليمات مهمة:
1. إذا رأيت إصابة واضحة → صنفها مع وصف دقيق وتعليمات إسعافية بالعربية
2. bbox = موقع الإصابة بالنسبة المئوية من الصورة (0-100)
3. إذا الصورة واضحة ولا توجد إصابة فعلاً → NONE
4. إذا الصورة ضبابية جداً → NONE مع نصيحة بتقريب الكاميرا

أجب فقط بمصفوفة JSON صالحة:
[
  {
    "class": "BLEEDING",
    "confidence": 0.92,
    "description": "جرح نازف في منطقة الذراع الأيسر",
    "instructions": ["اضغط على الجرح بقطعة قماش نظيفة", "ارفع الطرف المصاب فوق مستوى القلب", "لا تزل القماش حتى يتوقف النزيف"],
    "bbox_x": 20,
    "bbox_y": 35,
    "bbox_w": 40,
    "bbox_h": 30,
    "severity": "high"
  }
]`;

  // 1️⃣ Try OpenRouter models first
  const orKey = getOpenRouterApiKey();
  if (orKey) {
    for (const model of VISION_MODELS) {
      const content = await callOpenRouter(base64Data, prompt, model);
      if (content) {
        console.log(`[AI] Raw response from ${model}: ${content.substring(0, 300)}...`);
        const results = extractJSON(content);
        if (results) {
          const sanitized = sanitizeDetections(results);
          console.log(`[AI] OpenRouter detected ${sanitized.length} item(s):`, sanitized.map(d => `${d.class} (${Math.round(d.confidence*100)}%)`).join(", "));
          return sanitized;
        }
      }
    }
    console.warn("[AI] All OpenRouter models failed, falling back to Gemini Direct...");
  } else {
    console.log("[AI] No OpenRouter key, using Gemini Direct...");
  }

  // 2️⃣ Fallback: Google Gemini Direct SDK
  try {
    const text = await callGoogleGeminiDirect(base64Data, prompt);
    const results = extractJSON(text);
    if (results) {
      const sanitized = sanitizeDetections(results);
      console.log(`[AI] Gemini Direct detected ${sanitized.length} item(s)`);
      return sanitized;
    }
    console.warn("[AI] Gemini Direct returned unparseable response");
    return [];
  } catch (e: any) {
    console.error("[AI] Total failure — both OpenRouter and Gemini Direct failed:", e?.message);
    return [];
  }
}

// ─── Health Anomaly Analysis ─────────────────────────────────────────────────
export async function analyzeHealthAnomalies(data: {
  current: { heartRate: number; oxygen: number; temperature: number; movement: boolean };
  history: any[];
}): Promise<HealthAnalysis> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("No Gemini API Key");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `You are an expert predictive medical AI. 
Analyze these current vital signs against user history:
Current: HeartRate: ${data.current.heartRate}, SpO2: ${data.current.oxygen}%, Temp: ${data.current.temperature}C, Movement: ${data.current.movement}.
History: ${JSON.stringify(data.history)}

Return ONLY a JSON object:
{
  "status": "normal" | "warning" | "critical",
  "riskScore": 0.0 to 1.0,
  "condition": "string",
  "recommendation": "Arabic spoken text"
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const json = extractJSON(text);
    return json || { status: "normal", riskScore: 0, recommendation: "" };
  } catch (e) {
    console.error("[AI] Anomaly Analysis Fail:", e);
    return { status: "normal", riskScore: 0, recommendation: "" };
  }
}
