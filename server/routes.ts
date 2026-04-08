import type { Express } from "express";
import { createServer, type Server } from "node:http";
import * as path from "path";
import * as fs from "fs";
import { analyzeImage } from "./gemini-service";
import { storage } from "./storage";
import { generateSpeech } from "./elevenlabs-service";

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
          imagePreview: imageData.substring(0, 500) + "..." // For tracking
        });
      }

      res.json({ detections: results });
    } catch (error) {
      console.error("Analysis Error:", error);
      res.status(500).json({ error: "Failed to analyze image" });
    }
  });

  // ElevenLabs TTS API
  app.post("/api/tts", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      const audioBuffer = await generateSpeech(text);
      
      if (!audioBuffer) {
        return res.status(500).json({ error: "Failed to generate speech" });
      }

      res.setHeader("Content-Type", "audio/mpeg");
      res.send(audioBuffer);
    } catch (error) {
      console.error("TTS Error:", error);
      res.status(500).json({ error: "Failed to generate speech" });
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
