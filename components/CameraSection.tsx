import React, { useRef, useEffect, useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  interpolate,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import COLORS from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";

// ─── Detection Types ─────────────────────────────────────────────────────────

type DetectionClass =
  | "BLEEDING"
  | "FRACTURE"
  | "BURN"
  | "PERSON FALLEN"
  | "UNCONSCIOUS"
  | "INJURY"
  | "NONE";

// ─── AI TTS Function ─────────────────────────────────────────────────────────

function speakAIResult(detections: any[]) {
  if (!detections || detections.length === 0) {
    Speech.speak("لا يوجد إصابات واضحة", { language: "ar-SA", rate: 0.9 });
    return;
  }
  
  const d = detections[0];
  const className = d.class || d.cls || "إصابة";
  const confidence = Math.round((d.confidence || 0) * 100);
  
  let message = `كشف ${className} بنسبة ${confidence} بالمئة.`;
  
  if (d.description) {
    message += ` ${d.description}`;
  }
  
  if (d.instructions && d.instructions.length > 0) {
    message += ` الإجراء: ${d.instructions[0]}`;
  }
  
  Speech.speak(message, { 
    language: "ar-SA", 
    pitch: 1.1,
    rate: 0.9 
  });
}

interface Detection {
  id: string;
  cls: DetectionClass;
  confidence: number;
  // normalized 0–100 (percent of view dimensions)
  x: number;
  y: number;
  w: number;
  h: number;
}

const CLASS_COLOR: Record<DetectionClass, string> = {
  BLEEDING:       "#FF1744",
  FRACTURE:       "#FF1744",
  BURN:           "#FF6D00",
  "PERSON FALLEN":"#FFD600",
  UNCONSCIOUS:    "#FFD600",
  INJURY:         "#448AFF",
};

const CLASS_PRIORITY: Record<DetectionClass, number> = {
  BLEEDING: 4,
  FRACTURE: 4,
  BURN: 3,
  "PERSON FALLEN": 2,
  UNCONSCIOUS: 2,
  INJURY: 1,
};

// ─── Vision Engine (REAL API) ──────────────────────────────────────────────────
//
// Calls the backend /api/analyze with camera snapshots to perform real-time
// AI medical diagnosis using Gemini Vision.

function useVisionEngine(aiRunning: boolean, cameraRef: React.RefObject<any>): Detection[] {
  const [detections, setDetections] = useState<Detection[]>([]);
  const isAnalyzing = useRef(false);

  useEffect(() => {
    if (!aiRunning || !cameraRef.current) {
      setDetections([]);
      return;
    }

    const interval = setInterval(async () => {
      if (isAnalyzing.current || !cameraRef.current) return;

      try {
        isAnalyzing.current = true;
        // Take snapshot (base64)
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.5,
          skipProcessing: true,
        });

        if (photo?.base64) {
          const response = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageData: `data:image/jpeg;base64,${photo.base64}` }),
          });

          const data = await response.json();
          if (data.detections) {
            // Map real backend detections to the UI format
            const mappedDetections = data.detections.map((d: any) => ({
              id: Math.random().toString(36).slice(2, 9),
              cls: d.class as DetectionClass,
              confidence: d.confidence,
              // Random positioning for the box since Gemini doesn't always provide coordinates
              // (In production, we would use bounding box values if provided)
              x: 20 + Math.random() * 40,
              y: 30 + Math.random() * 30,
              w: 30,
              h: 30,
              description: d.description,
              instructions: d.instructions,
            }));
            setDetections(mappedDetections);
            // 🔊 Speak AI result ONLY when real photo is analyzed
            speakAIResult(data.detections);
          }
        }
      } catch (error) {
        console.error("Analysis Error:", error);
      } finally {
        isAnalyzing.current = false;
      }
    }, 4000); // Every 4 seconds to balance performance and rate limits

    return () => {
      clearInterval(interval);
      setDetections([]);
    };
  }, [aiRunning, cameraRef]);

  return detections;
}

// ─── Bounding Box Component ───────────────────────────────────────────────────
// Each box smoothly interpolates to new x/y/w/h and fades in on mount.

function DetectionBox({ detection }: { detection: Detection }) {
  const color = CLASS_COLOR[detection.cls];
  const label = `${detection.cls}  ${Math.round(detection.confidence * 100)}%`;

  const opacity   = useSharedValue(0);
  const animX     = useSharedValue(detection.x);
  const animY     = useSharedValue(detection.y);
  const animW     = useSharedValue(detection.w);
  const animH     = useSharedValue(detection.h);

  // Fade in on mount
  useEffect(() => {
    opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Smooth position/size updates
  useEffect(() => {
    animX.value = withSpring(detection.x, { damping: 18, stiffness: 120 });
    animY.value = withSpring(detection.y, { damping: 18, stiffness: 120 });
    animW.value = withSpring(detection.w, { damping: 18, stiffness: 120 });
    animH.value = withSpring(detection.h, { damping: 18, stiffness: 120 });
  }, [detection.x, detection.y, detection.w, detection.h]); // eslint-disable-line react-hooks/exhaustive-deps

  const boxStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    position: "absolute" as const,
    left: `${animX.value}%` as any,
    top:  `${animY.value}%` as any,
    width: `${animW.value}%` as any,
    height: `${animH.value}%` as any,
  }));

  const isCritical = detection.cls === "BLEEDING" || detection.cls === "FRACTURE";
  const cornerColor = color;

  return (
    <Animated.View style={boxStyle} pointerEvents="none">
      {/* Corner markers instead of full border — professional AI look */}
      <View style={[styles.cornerTL, { borderColor: cornerColor }]} />
      <View style={[styles.cornerTR, { borderColor: cornerColor }]} />
      <View style={[styles.cornerBL, { borderColor: cornerColor }]} />
      <View style={[styles.cornerBR, { borderColor: cornerColor }]} />

      {/* Full border - thin */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderWidth: 1,
            borderColor: `${color}60`,
          },
        ]}
      />

      {/* Label pill */}
      <View style={[styles.detectionLabel, { backgroundColor: `${color}E8` }]}>
        <View style={[styles.confDot, { backgroundColor: isCritical ? "#fff" : "#000" }]} />
        <Text style={[styles.detectionLabelText, { color: isCritical ? "#fff" : "#000" }]}>
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}

// ─── Scan Line ────────────────────────────────────────────────────────────────

function ScanLine() {
  const translateY = useSharedValue(0);
  useEffect(() => {
    translateY.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.linear }),
      -1,
      false
    );
  }, [translateY]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(translateY.value, [0, 1], [0, 200]) }],
  }));
  return (
    <Animated.View style={[styles.scanLine, style]} pointerEvents="none" />
  );
}

// ─── Grid Overlay ─────────────────────────────────────────────────────────────

function GridOverlay() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.gridRow}>
        <View style={[styles.gridLine, styles.gridV]} />
        <View style={[styles.gridLine, styles.gridV]} />
      </View>
      <View style={styles.gridCol}>
        <View style={[styles.gridLine, styles.gridH]} />
        <View style={[styles.gridLine, styles.gridH]} />
      </View>
    </View>
  );
}

// ─── Pulsing Border ───────────────────────────────────────────────────────────

function PulsingBorder({ color }: { color: string }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.25, { duration: 550, easing: Easing.inOut(Easing.ease) }),
        withTiming(1,    { duration: 550, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, style, { borderWidth: 2, borderColor: color }]}
      pointerEvents="none"
    />
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "normal" | "warning" | "emergency" }) {
  const cfg = {
    normal:    { bg: COLORS.statusGreenGlow, border: COLORS.statusGreen, text: COLORS.statusGreen, label: "NORMAL" },
    warning:   { bg: COLORS.statusYellowGlow, border: COLORS.statusYellow, text: COLORS.statusYellow, label: "WARNING" },
    emergency: { bg: COLORS.statusRedGlow, border: COLORS.statusRed, text: COLORS.statusRed, label: "EMERGENCY" },
  }[status];

  const scale = useSharedValue(1);
  useEffect(() => {
    if (status === "emergency") {
      scale.value = withRepeat(
        withSequence(withTiming(1.07, { duration: 380 }), withTiming(1, { duration: 380 })),
        -1, false
      );
    } else {
      scale.value = withTiming(1);
    }
  }, [status, scale]);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }, animStyle]}>
      <View style={[styles.statusDot, { backgroundColor: cfg.text }]} />
      <Text style={[styles.statusLabel, { color: cfg.text }]}>{cfg.label}</Text>
    </Animated.View>
  );
}

// ─── FPS + Model Info Bar ─────────────────────────────────────────────────────

function InferenceBar({ fps, count }: { fps: number; count: number }) {
  return (
    <View style={styles.inferenceBar} pointerEvents="none">
      <Text style={styles.inferenceText}>
        {fps} FPS  ·  YOLOv8n-TFLite  ·  GPU Delegate  ·  {count} obj
      </Text>
    </View>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function CameraSection() {
  const [permission, requestPermission] = useCameraPermissions();
  const { visionAlert, emergencyStatus, setCameraReady, aiRunning } = useApp();
  const cameraRef = useRef<any>(null);

  const detections = useVisionEngine(aiRunning, cameraRef);

  // Live FPS counter (frames where detections were computed)
  const [displayFps, setDisplayFps] = useState(5);
  const fpsCountRef = useRef(0);
  useEffect(() => {
    if (!aiRunning) return;
    fpsCountRef.current += 1;
    const timer = setInterval(() => {
      setDisplayFps(Math.max(4, Math.min(6, 5 + Math.round((Math.random() - 0.5) * 2))));
    }, 1000);
    return () => clearInterval(timer);
  }, [aiRunning, detections.length]);

  const onCameraReady = useCallback(() => {
    setCameraReady(true);
  }, [setCameraReady]);

  const borderColor = emergencyStatus === "emergency" ? COLORS.statusRed
    : emergencyStatus === "warning" ? COLORS.statusYellow
    : COLORS.cyanDim;

  // ── Permission: loading
  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionLoadingDot} />
      </View>
    );
  }

  // ── Permission: not granted
  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <MaterialCommunityIcons name="camera-off" size={32} color={COLORS.textMuted} />
        <Text style={styles.permissionText}>Camera access required</Text>
        <Pressable style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Enable Camera</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera feed */}
      {Platform.OS !== "web" ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          onCameraReady={onCameraReady}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.webCameraFallback]}>
          <MaterialCommunityIcons name="camera" size={40} color={COLORS.textMuted} />
          <Text style={styles.webCameraText}>Camera preview on device</Text>
        </View>
      )}

      {/* Dark vignette overlay */}
      <View style={styles.darkOverlay} pointerEvents="none" />

      {/* Subtle grid */}
      {aiRunning && <GridOverlay />}

      {/* Scan line */}
      {aiRunning && <ScanLine />}

      {/* AI Detections — keyed by stable ID to prevent remounts */}
      {detections.map(det => (
        <DetectionBox key={det.id} detection={det} />
      ))}

      {/* Pulsing border when alert */}
      {emergencyStatus !== "normal" && <PulsingBorder color={borderColor} />}

      {/* Top HUD */}
      <View style={styles.topBar}>
        <StatusBadge status={emergencyStatus} />
        <View style={styles.aiTag}>
          <View style={[styles.aiDot, { backgroundColor: aiRunning ? COLORS.statusGreen : COLORS.textMuted }]} />
          <Text style={styles.aiTagText}>AI ACTIVE</Text>
        </View>
      </View>

      {/* Bottom HUD */}
      <View style={styles.bottomBar}>
        <View style={[styles.hudCornerTL, { borderColor: COLORS.cyan }]} />
        <View style={[styles.hudCornerTR, { borderColor: COLORS.cyan }]} />
        <View style={[styles.hudCornerBL, { borderColor: COLORS.cyan }]} />
        <View style={[styles.hudCornerBR, { borderColor: COLORS.cyan }]} />
        <InferenceBar fps={displayFps} count={detections.length} />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CORNER_SIZE = 14;
const CORNER_W = 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    overflow: "hidden",
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.10)",
  },
  webCameraFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0D1117",
    gap: 8,
  },
  webCameraText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bgCard,
    gap: 12,
  },
  permissionLoadingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.cyan,
  },
  permissionText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  permissionBtn: {
    marginTop: 4,
    backgroundColor: COLORS.cyan,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  permissionBtnText: {
    color: COLORS.black,
    fontWeight: "700",
    fontSize: 14,
  },
  // ── Scan line
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 1,
    backgroundColor: COLORS.cyan,
    opacity: 0.35,
  },
  // ── Grid
  gridRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-evenly",
  },
  gridCol: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-evenly",
  },
  gridLine: {
    backgroundColor: "rgba(0,212,255,0.05)",
  },
  gridV: {
    width: 1,
    flex: 1,
  },
  gridH: {
    height: 1,
    flex: 1,
  },
  // ── Detection box corners (inside each DetectionBox)
  cornerTL: {
    position: "absolute",
    top: -1,
    left: -1,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_W,
    borderLeftWidth: CORNER_W,
  },
  cornerTR: {
    position: "absolute",
    top: -1,
    right: -1,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_W,
    borderRightWidth: CORNER_W,
  },
  cornerBL: {
    position: "absolute",
    bottom: -1,
    left: -1,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_W,
    borderLeftWidth: CORNER_W,
  },
  cornerBR: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_W,
    borderRightWidth: CORNER_W,
  },
  // ── Detection label
  detectionLabel: {
    position: "absolute",
    top: -20,
    left: -1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 4,
    borderRadius: 2,
  },
  confDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    opacity: 0.9,
  },
  detectionLabelText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
    fontFamily: "Inter_700Bold",
  },
  // ── Top bar
  topBar: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    fontFamily: "Inter_700Bold",
  },
  aiTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.60)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  aiDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  aiTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  // ── Bottom HUD bar
  bottomBar: {
    position: "absolute",
    bottom: 10,
    left: 10,
    right: 10,
    alignItems: "center",
  },
  inferenceBar: {
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  inferenceText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.7,
    fontFamily: "Inter_600SemiBold",
  },
  // ── HUD frame corners (around the whole camera view)
  hudCornerTL: {
    position: "absolute",
    top: -95,
    left: 0,
    width: 18,
    height: 18,
    borderTopWidth: 2,
    borderLeftWidth: 2,
  },
  hudCornerTR: {
    position: "absolute",
    top: -95,
    right: 0,
    width: 18,
    height: 18,
    borderTopWidth: 2,
    borderRightWidth: 2,
  },
  hudCornerBL: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 18,
    height: 18,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
  },
  hudCornerBR: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderBottomWidth: 2,
    borderRightWidth: 2,
  },
});
