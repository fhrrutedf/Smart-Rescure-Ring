// ─────────────────────────────────────────────────────────────────────────────
// AI Service — OpenRouter (Primary & Only Provider)
// Replaces Google AI Studio / Gemini SDK entirely
// ─────────────────────────────────────────────────────────────────────────────

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Vision models (support image input) — free tier on OpenRouter
// Ordered by reliability
const VISION_MODELS = [
  "google/gemini-2.0-flash-exp:free",
  "google/gemini-flash-1.5",
  "meta-llama/llama-4-scout:free",
  "qwen/qwen2.5-vl-72b-instruct:free",
  "mistralai/mistral-small-3.2-24b-instruct:free",
];

// Text-only models (for health analysis) — free tier on OpenRouter
const TEXT_MODELS = [
  "google/gemini-2.0-flash-exp:free",
  "google/gemini-flash-1.5",
  "meta-llama/llama-4-scout:free",
  "qwen/qwen2.5-72b-instruct:free",
];

function getOpenRouterApiKey() {
  return process.env.OPENROUTER_API_KEY;
}

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
  riskScore: number;
  recommendation: string;
  condition?: string;
}

// ─── JSON Extractor ───────────────────────────────────────────────────────────
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

// ─── Sanitize Detections ─────────────────────────────────────────────────────
function sanitizeDetections(raw: any[]): DiagnosisResult[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((d) => d && typeof d === "object")
    .map((d) => ({
      class: String(d.class || "INJURY").toUpperCase().trim(),
      confidence: Math.min(1, Math.max(0, d.confidence || 0)),
      description: String(d.description || ""),
      instructions: Array.isArray(d.instructions) ? d.instructions.map(String) : [],
      bbox_x: Number(d.bbox_x) || 30,
      bbox_y: Number(d.bbox_y) || 30,
      bbox_w: Number(d.bbox_w) || 40,
      bbox_h: Number(d.bbox_h) || 40,
      severity: d.severity || (d.confidence >= 0.8 ? "critical" : "high"),
    }))
    .slice(0, 3);
}

// ─── OpenRouter Vision Call ───────────────────────────────────────────────────
async function callOpenRouterVision(
  imageBase64: string,
  prompt: string,
  model: string
): Promise<string | null> {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    console.error("[AI] ❌ OPENROUTER_API_KEY is not set!");
    return null;
  }

  try {
    console.log(`[AI] Trying vision model: ${model}`);
    const res = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://pulsering.vercel.app",
        "X-Title": "PULSE RING",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
              },
            ],
          },
        ],
        max_tokens: 1024,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(`[AI] Vision model "${model}" HTTP ${res.status}: ${errText.slice(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.warn(`[AI] Vision model "${model}" returned empty content`);
      return null;
    }

    console.log(`[AI] ✅ Vision success with model: ${model}`);
    return content;
  } catch (e: any) {
    console.warn(`[AI] Vision model "${model}" network error: ${e?.message}`);
    return null;
  }
}

// ─── OpenRouter Text Call ─────────────────────────────────────────────────────
async function callOpenRouterText(
  prompt: string,
  model: string
): Promise<string | null> {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    console.error("[AI] ❌ OPENROUTER_API_KEY is not set!");
    return null;
  }

  try {
    console.log(`[AI] Trying text model: ${model}`);
    const res = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://pulsering.vercel.app",
        "X-Title": "PULSE RING",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 512,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(`[AI] Text model "${model}" HTTP ${res.status}: ${errText.slice(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.warn(`[AI] Text model "${model}" returned empty content`);
      return null;
    }

    console.log(`[AI] ✅ Text success with model: ${model}`);
    return content;
  } catch (e: any) {
    console.warn(`[AI] Text model "${model}" network error: ${e?.message}`);
    return null;
  }
}

// ─── Main: Analyze Image ──────────────────────────────────────────────────────
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

  // Try all vision models in order
  for (const model of VISION_MODELS) {
    const content = await callOpenRouterVision(base64Data, prompt, model);
    if (content) {
      console.log(`[AI] Raw response from ${model}: ${content.substring(0, 300)}...`);
      const results = extractJSON(content);
      if (results) {
        const sanitized = sanitizeDetections(results);
        console.log(
          `[AI] ✅ Detected ${sanitized.length} item(s) via ${model}:`,
          sanitized.map((d) => `${d.class} (${Math.round(d.confidence * 100)}%)`).join(", ")
        );
        return sanitized;
      }
    }
  }

  console.error("[AI] ❌ All OpenRouter vision models failed. Check OPENROUTER_API_KEY.");
  return [];
}

// ─── Health Anomaly Analysis ──────────────────────────────────────────────────
export async function analyzeHealthAnomalies(data: {
  current: { heartRate: number; oxygen: number; temperature: number; movement: boolean };
  history: any[];
}): Promise<HealthAnalysis> {
  const prompt = `You are an expert predictive medical AI.
Analyze these current vital signs against user history:
Current: HeartRate: ${data.current.heartRate}, SpO2: ${data.current.oxygen}%, Temp: ${data.current.temperature}C, Movement: ${data.current.movement}.
History: ${JSON.stringify(data.history)}

Return ONLY a JSON object (no extra text):
{
  "status": "normal" | "warning" | "critical",
  "riskScore": 0.0 to 1.0,
  "condition": "string",
  "recommendation": "Arabic spoken text"
}`;

  for (const model of TEXT_MODELS) {
    const content = await callOpenRouterText(prompt, model);
    if (content) {
      const json = extractJSON(content);
      if (json) {
        console.log(`[AI] ✅ Health analysis via ${model}: ${json.status}`);
        return json;
      }
    }
  }

  console.error("[AI] ❌ All OpenRouter text models failed for health analysis.");
  return { status: "normal", riskScore: 0, recommendation: "" };
}
