// Quick script to list available Gemini models for this API key
const API_KEY = process.env.GEMINI_API_KEY || "";

async function listModels(apiVersion) {
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) {
    console.error(`[${apiVersion}] Error ${res.status}:`, JSON.stringify(data).slice(0, 300));
    return [];
  }
  return data.models || [];
}

async function testModel(modelName, apiVersion) {
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: "Say: OK" }] }]
    })
  });
  return { status: res.status, ok: res.ok };
}

async function main() {
  console.log("🔍 Checking available models...\n");

  for (const ver of ["v1", "v1beta"]) {
    const models = await listModels(ver);
    const visionModels = models.filter(m =>
      m.supportedGenerationMethods?.includes("generateContent") &&
      m.name.includes("gemini")
    );
    console.log(`\n=== ${ver} — ${visionModels.length} generateContent models ===`);
    visionModels.forEach(m => console.log(`  ✅ ${m.name}  (${m.displayName || ""})`));
  }

  console.log("\n\n🧪 Quick test on top candidates...");
  const candidates = [
    ["gemini-2.5-flash", "v1beta"],
    ["gemini-2.5-flash-lite", "v1beta"],
    ["gemini-2.0-flash-lite", "v1beta"],
    ["gemini-2.0-flash", "v1beta"],
    ["gemini-1.5-flash", "v1"],
    ["gemini-1.5-flash-002", "v1"],
    ["gemini-1.5-flash-8b", "v1"],
  ];
  for (const [model, ver] of candidates) {
    const r = await testModel(model, ver);
    console.log(`  ${r.ok ? "✅" : "❌"} ${model} (${ver}) → HTTP ${r.status}`);
  }
}

main().catch(console.error);
