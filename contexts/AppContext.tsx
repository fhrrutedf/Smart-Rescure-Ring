import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
  ReactNode,
  useCallback,
} from "react";
import * as Haptics from "expo-haptics";
import { EmergencyType } from "@/constants/medical-instructions";
import { speak } from "@/lib/tts";

export interface VitalSigns {
  heartRate: number;
  spo2: number;
  temperature: number;
  motionStatus: "Still" | "Moving" | "Sudden Movement";
  ringConnected: boolean;
}

export type VisionAlert = "none" | "fall" | "bleeding" | "motionless";

export enum HealthStatus {
  STABLE = "Stable",
  PRE_SYNCOPE = "Fainting Risk",
  SHOCK_WARNING = "Shock Risk",
  CRITICAL = "Critical"
}

interface VitalsHistory {
  heartRate: number;
  spo2: number;
  timestamp: number;
}

export function calculatePredictiveRisk(
  history: VitalsHistory[], 
  currentVitals: VitalSigns,
  visionAlert: VisionAlert
): { status: HealthStatus; score: number } {
  if (history.length < 5) return { status: HealthStatus.STABLE, score: 100 };

  const current = currentVitals;
  const previous = history[history.length - 5]; // مقارنة ببيانات قبل 5 ثواني
  
  const hrDelta = current.heartRate - previous.heartRate;
  const spo2Delta = current.spo2 - previous.spo2;

  let riskScore = 100;

  // 1. منطق التنبؤ بالصدمة (Shock Prediction)
  // ارتفاع النبض مع انخفاض الأكسجين بوجود نزيف
  if (visionAlert === "bleeding") {
    if (hrDelta > 10 && spo2Delta < -1) {
      return { status: HealthStatus.SHOCK_WARNING, score: 60 };
    }
    if (current.heartRate > 120 && current.spo2 < 90) {
      return { status: HealthStatus.CRITICAL, score: 30 };
    }
  }

  // 2. منطق التنبؤ بالإغماء (Fainting/Syncope Prediction)
  // انخفاض حاد ومفاجئ في النبض
  if (hrDelta < -20 && Math.abs(spo2Delta) <= 1) {
    return { status: HealthStatus.PRE_SYNCOPE, score: 50 };
  }

  // 3. حساب درجة الاستقرار العامة
  if (current.heartRate > 100) riskScore -= 10;
  if (current.spo2 < 95) riskScore -= 20;
  
  return { status: HealthStatus.STABLE, score: Math.max(0, riskScore) };
}

export interface AppState {
  vitals: VitalSigns;
  visionAlert: VisionAlert;
  diagnosis: EmergencyType;
  emergencyStatus: "normal" | "warning" | "emergency";
  cameraReady: boolean;
  aiRunning: boolean;
  latestDetections: any[]; // مصفوفة لتخزين آخر كشوفات الـ AI
  healthScore: number;
}

interface AppContextValue extends AppState {
  setCameraReady: (ready: boolean) => void;
  setLatestDetections: (detections: any[]) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function fuseDiagnosis(
  vitals: VitalSigns,
  visionAlert: VisionAlert
): { diagnosis: EmergencyType; status: "normal" | "warning" | "emergency" } {
  const { heartRate, spo2, temperature } = vitals;

  const isCriticalVitals =
    heartRate > 160 || heartRate < 30 || spo2 < 85 || temperature > 41;
  const isAbnormalVitals =
    heartRate > 140 || heartRate < 40 || spo2 < 90 || temperature > 39;
  const hasVisionAlert = visionAlert !== "none";

  if (isCriticalVitals) {
    if (visionAlert === "fall" || visionAlert === "motionless") {
      return { diagnosis: "critical", status: "emergency" };
    }
    if (heartRate > 160 || heartRate < 30) {
      return { diagnosis: "cardiac", status: "emergency" };
    }
    return { diagnosis: "critical", status: "emergency" };
  }

  // SOS override: if bleeding is detected with any abnormal vitals, it's critical
  if (visionAlert === "bleeding" && (isAbnormalVitals || isCriticalVitals)) {
    return { diagnosis: "bleeding", status: "emergency" };
  }

  if (isAbnormalVitals && hasVisionAlert) {
    if (visionAlert === "bleeding") return { diagnosis: "bleeding", status: "emergency" };
    if (visionAlert === "fall") return { diagnosis: "fall", status: "emergency" };
    if (heartRate > 140 || heartRate < 40)
      return { diagnosis: "cardiac", status: "emergency" };
    return { diagnosis: "fall", status: "emergency" };
  }

  if (isAbnormalVitals) {
    if (heartRate > 140 || heartRate < 40)
      return { diagnosis: "cardiac", status: "warning" };
    return { diagnosis: "none", status: "warning" };
  }

  if (hasVisionAlert) {
    if (visionAlert === "bleeding") return { diagnosis: "bleeding", status: "warning" };
    if (visionAlert === "fall") return { diagnosis: "fall", status: "warning" };
    if (visionAlert === "motionless") return { diagnosis: "fall", status: "warning" };
    return { diagnosis: "none", status: "warning" };
  }

  return { diagnosis: "none", status: "normal" };
}

function generateVitals(
  prev: VitalSigns,
  scenario: "normal" | "spike"
): VitalSigns {
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  if (scenario === "spike") {
    const rand = Math.random();
    if (rand < 0.33) {
      return {
        ...prev,
        heartRate: 145 + Math.floor(Math.random() * 20),
        spo2: 87 + Math.floor(Math.random() * 4),
        temperature: 39.5 + Math.random(),
        motionStatus: "Sudden Movement",
      };
    } else if (rand < 0.66) {
      return {
        ...prev,
        heartRate: 28 + Math.floor(Math.random() * 10),
        spo2: 82 + Math.floor(Math.random() * 5),
        temperature: 35.5 + Math.random(),
        motionStatus: "Still",
      };
    } else {
      return {
        ...prev,
        heartRate: 170 + Math.floor(Math.random() * 20),
        spo2: 92,
        temperature: 38.5,
        motionStatus: "Moving",
      };
    }
  }

  const targetHR = 72 + Math.sin(Date.now() / 8000) * 8;
  const targetSpo2 = 98 + Math.sin(Date.now() / 12000) * 1;
  const targetTemp = 36.8 + Math.sin(Date.now() / 20000) * 0.3;
  const motionOptions: VitalSigns["motionStatus"][] = [
    "Still",
    "Still",
    "Still",
    "Moving",
    "Still",
  ];
  const motion = motionOptions[Math.floor(Math.random() * motionOptions.length)];

  return {
    heartRate: Math.round(lerp(prev.heartRate, targetHR + (Math.random() - 0.5) * 4, 0.3)),
    spo2: Math.round(Math.max(95, Math.min(100, lerp(prev.spo2, targetSpo2 + (Math.random() - 0.5), 0.3))) * 10) / 10,
    temperature: Math.round(Math.max(36, Math.min(37.5, lerp(prev.temperature, targetTemp + (Math.random() - 0.5) * 0.1, 0.3))) * 10) / 10,
    motionStatus: motion,
    ringConnected: true,
  };
}

function generateVisionAlert(): VisionAlert {
  // تم تعطيل التوليد العشوائي لجعل النتائج تعتمد فقط على الكاميرا والذكاء الاصطناعي
  return "none";
}

// ─── Audio Alert System ──────────────────────────────────────────────────────

async function playAlertHaptic(type: "warning" | "emergency") {
  try {
    if (type === "emergency") {
      // Strong vibration pattern for emergency
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error), 300);
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error), 600);
    } else {
      // Warning pattern
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  } catch (error) {
    console.log("Haptic feedback failed:", error);
  }
}

function speakDiagnosis(diagnosis: EmergencyType, status: "warning" | "emergency") {
  if (diagnosis === "none") return;

  const urgency = status === "emergency" ? "حالة طارئة" : "تحذير";
  const messages: Record<EmergencyType, string> = {
    bleeding: `${urgency}. كشف نزيف. قم بالضغط على الجرح فوراً.`,
    cardiac: `${urgency}. عدم انتظام ضربات القلب. تحقق من النبض.`,
    fall: `${urgency}. كشف سقوط. تحقق من الإصابات الرأسية.`,
    critical: `${urgency}. حالة حرجة. اتصل بالإسعاف فوراً.`,
    none: "",
  };

  const message = messages[diagnosis];
  if (message) {
    // ElevenLabs أولاً عبر lib/tts.ts
    speak(message);
  }
}

const INITIAL_VITALS: VitalSigns = {
  heartRate: 72,
  spo2: 98,
  temperature: 36.8,
  motionStatus: "Still",
  ringConnected: false,
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [vitals, setVitals] = useState<VitalSigns>(INITIAL_VITALS);
  const [visionAlert, setVisionAlert] = useState<VisionAlert>("none");
  const [diagnosis, setDiagnosis] = useState<EmergencyType>("none");
  const [emergencyStatus, setEmergencyStatus] = useState<AppState["emergencyStatus"]>("normal");
  const [cameraReady, setCameraReady] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [latestDetections, setLatestDetections] = useState<any[]>([]);
  const [healthScore, setHealthScore] = useState(100);
  const vitalsHistoryRef = useRef<VitalsHistory[]>([]);

  const scenarioRef = useRef<"normal" | "spike">("normal");
  const scenarioTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleScenarioSwitch = useCallback(() => {
    const delay = scenarioRef.current === "normal"
      ? 12000 + Math.random() * 20000
      : 5000 + Math.random() * 8000;

    scenarioTimerRef.current = setTimeout(() => {
      scenarioRef.current = scenarioRef.current === "normal" ? "spike" : "normal";
      scheduleScenarioSwitch();
    }, delay);
  }, []);

  useEffect(() => {
    const connectDelay = setTimeout(() => {
      setVitals((prev) => ({ ...prev, ringConnected: true }));
      setAiRunning(true);
    }, 2500);

    scheduleScenarioSwitch();

    const vitalsInterval = setInterval(() => {
      setVitals((prev) => generateVitals(prev, scenarioRef.current));
    }, 1000);

    const visionInterval = setInterval(() => {
      const alert = scenarioRef.current === "spike" ? generateVisionAlert() : "none";
      setVisionAlert(alert);
    }, 2000);

    return () => {
      clearTimeout(connectDelay);
      clearInterval(vitalsInterval);
      clearInterval(visionInterval);
      if (scenarioTimerRef.current) clearTimeout(scenarioTimerRef.current);
    };
  }, [scheduleScenarioSwitch]);

  useEffect(() => {
    const { diagnosis: newDx, status } = fuseDiagnosis(vitals, visionAlert);
    setDiagnosis(newDx);
    setEmergencyStatus(status);

    // تحديث تاريخ العلامات الحيوية
    vitalsHistoryRef.current.push({
      heartRate: vitals.heartRate,
      spo2: vitals.spo2,
      timestamp: Date.now()
    });
    if (vitalsHistoryRef.current.length > 60) vitalsHistoryRef.current.shift();

    // حساب درجة الاستقرار التنبؤية
    const risk = calculatePredictiveRisk(vitalsHistoryRef.current, vitals, visionAlert);
    setHealthScore(risk.score);
    
    // إذا كان هناك خطر تنبؤي، نرفع مستوى الطوارئ
    if (risk.status !== HealthStatus.STABLE && status === "normal") {
      setEmergencyStatus("warning");
    }
  }, [vitals, visionAlert]);

  // نظام الإنذار الصوتي عند تغيير حالة الطوارئ
  // فعّلناه مجدداً مع دعم Web Speech API للويب/لابتوب
  const prevStatusRef = useRef<AppState["emergencyStatus"]>("normal");
  useEffect(() => {
    // تجنب تكرار الإنذار إذا لم تتغير الحالة
    if (prevStatusRef.current === emergencyStatus) return;
    prevStatusRef.current = emergencyStatus;

    if (emergencyStatus === "warning") {
      playAlertHaptic("warning");
      speakDiagnosis(diagnosis, "warning");
    } else if (emergencyStatus === "emergency") {
      playAlertHaptic("emergency");
      speakDiagnosis(diagnosis, "emergency");
    }
  }, [emergencyStatus, diagnosis]);

  const value = useMemo<AppContextValue>(
    () => ({
      vitals,
      visionAlert,
      diagnosis,
      emergencyStatus,
      cameraReady,
      aiRunning,
      latestDetections,
      healthScore,
      setCameraReady,
      setLatestDetections,
    }),
    [vitals, visionAlert, diagnosis, emergencyStatus, cameraReady, aiRunning, latestDetections, healthScore]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
