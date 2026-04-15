import type { Express } from "express";
import { createServer, type Server } from "node:http";
import * as path from "path";
import * as fs from "fs";
import { analyzeImage, analyzeHealthAnomalies } from "./gemini-service";
import { storage } from "./storage";
import { generateMicrosoftSpeech } from "./microsoft-tts-service";
import { generateSpeech as generateElevenLabsSpeech } from "./elevenlabs-service";
import { generateGoogleTTS } from "./google-tts-service";

export async function registerRoutes(app: Express): Promise<Server> {
  // Medical Analysis API
  app.post("/api/analyze", async (req, res) => {
    console.log(`[API] /api/analyze called at ${new Date().toLocaleTimeString()}`);
    try {
      const { imageData } = req.body;
      if (!imageData) {
        return res.status(400).json({ error: "Image data is required" });
      }

      const results = await analyzeImage(imageData);
      
      // Save to dashboard if an injury is found
      if (results && results.length > 0) {
        await storage.saveDetection({
          detections: results,
          imagePreview: imageData.substring(0, 500) + "..." 
        });
      }

      res.json({ detections: results });
    } catch (error) {
      console.error("Analysis Error:", error);
      res.status(500).json({ error: "Failed to analyze image" });
    }
  });

  // TTS API — Microsoft حامد السعودي primary, Google & ElevenLabs fallbacks
  // Support both POST (for typical usage) and GET (for FileSystem.downloadAsync on mobile)
  app.all("/api/tts", async (req, res) => {
    try {
      const text = req.body?.text || req.query?.text;
      const lang = req.body?.lang || req.query?.lang;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "Text is required" });
      }

      let audioBuffer: Buffer | null = null;
      let engine = "none";

      // 1️⃣ ElevenLabs — Premium Quality (Primary)
      try {
        audioBuffer = await generateElevenLabsSpeech(text);
        if (audioBuffer) engine = "elevenlabs";
      } catch (e) {
        console.warn("[TTS] ElevenLabs failed, trying Google...");
      }

      // 2️⃣ Google Translate TTS — Free and Reliable (Fallback)
      if (!audioBuffer) {
        try {
          audioBuffer = await generateGoogleTTS(text, lang || "ar");
          if (audioBuffer) engine = "google";
        } catch (e) {
          console.warn("[TTS] Google TTS failed, trying Microsoft...");
        }
      }

      // 3️⃣ Microsoft Edge TTS — Fallback only (May be blocked on Vercel)
      if (!audioBuffer) {
        try {
          audioBuffer = await generateMicrosoftSpeech(text);
          if (audioBuffer) engine = "microsoft-hamed";
        } catch (e) {
          console.warn("[TTS] Microsoft Hamid also failed.");
        }
      }

      if (!audioBuffer) {
        console.error("[TTS] All TTS engines failed.");
        return res.status(500).json({ error: "Failed to generate speech" });
      }

      console.log(`[TTS] ✅ Audio delivered via ${engine} — ${audioBuffer.length} bytes`);
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("X-TTS-Engine", engine);
      res.send(audioBuffer);
    } catch (error) {
      console.error("TTS Error:", error);
      res.status(500).json({ error: "Failed to generate speech" });
    }
  });

  // Emergency SOS API
  app.post("/api/emergency/sos", async (req, res) => {
    try {
      const { userId, location, type } = req.body;
      console.log(`[SOS] Emergency triggered for ${userId} at ${JSON.stringify(location)}`);
      
      const message = `SOS: Emergency detected for ${userId}. Type: ${type}. Location: ${location.lat}, ${location.lng}`;
      
      await storage.saveDetection({
        detections: [{
          class: "SOS_ALERT",
          confidence: 1.0,
          description: `User triggered SOS: ${type}`,
          instructions: ["Dispatch emergency services to location"]
        }],
        imagePreview: "SOS_LOCATION_ALERT"
      });
      
      res.json({ success: true, message: "Emergency services notified" });
    } catch (error) {
      res.status(500).json({ error: "Failed to trigger SOS" });
    }
  });

  // Real-time Sensor Data Analysis (The Predictive Logic)
  app.post("/api/sensors/analyze", async (req, res) => {
    try {
      const { heartRate, oxygen, temperature, movement, history } = req.body;
      
      const analysis = await analyzeHealthAnomalies({
        current: { 
          heartRate: Number(heartRate), 
          oxygen: Number(oxygen), 
          temperature: Number(temperature), 
          movement: movement === "true" || movement === true 
        },
        history: history || []
      });

      if (analysis.riskScore > 0.7) {
        const warningText = analysis.recommendation;
        const audioBuffer = await generateMicrosoftSpeech(warningText);
        
        await storage.saveDetection({
          detections: [{
            class: "CRITICAL_ANOMALY",
            confidence: analysis.riskScore,
            description: analysis.condition || "Unknown Anomaly",
            instructions: [analysis.recommendation]
          }],
          imagePreview: "SENSOR_DATA_ONLY"
        });

        return res.json({ 
          status: "CRITICAL", 
          analysis, 
          audioBase64: audioBuffer?.toString('base64') 
        });
      }

      res.json({ status: "NORMAL", analysis });
    } catch (error) {
      console.error("Sensor Analysis Error:", error);
      res.status(500).json({ error: "Sensor analysis failed" });
    }
  });

  // Dashboard Data API
  app.get("/api/dashboard", async (_req, res) => {
    try {
      const data = await storage.getLatestDetections();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard" });
    }
  });

  // Dashboard Page
  app.get("/dashboard", async (_req, res) => {
    const templatePath = path.resolve(
      process.cwd(),
      "server",
      "templates",
      "dashboard.html",
    );
    const html = fs.readFileSync(templatePath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  });

  const httpServer = createServer(app);

  return httpServer;
}
