export type EmergencyType = "none" | "fall" | "bleeding" | "cardiac" | "critical";

export interface MedicalInstruction {
  type: EmergencyType;
  title: string;
  steps: string[];
  priority: "low" | "medium" | "high" | "critical";
}

export const MEDICAL_INSTRUCTIONS: Record<EmergencyType, MedicalInstruction> = {
  none: {
    type: "none",
    title: "No Emergency Detected",
    steps: [
      "Continue monitoring patient",
      "Keep the area safe and accessible",
      "Stay alert for any changes in condition",
      "Ensure emergency contacts are reachable",
    ],
    priority: "low",
  },
  fall: {
    type: "fall",
    title: "Fall Detected",
    steps: [
      "Do not move the patient — stabilize position",
      "Check responsiveness — call their name",
      "Assess breathing and pulse immediately",
      "Do not move neck or spine",
      "Keep patient warm and still",
      "Call emergency services if unconscious",
    ],
    priority: "high",
  },
  bleeding: {
    type: "bleeding",
    title: "Bleeding Detected",
    steps: [
      "Apply firm, direct pressure to wound",
      "Use a clean cloth or sterile bandage",
      "Elevate injured limb above heart level",
      "Do not remove embedded objects",
      "Replace soaked cloths — add more on top",
      "Call emergency services immediately",
    ],
    priority: "high",
  },
  cardiac: {
    type: "cardiac",
    title: "Cardiac Anomaly Detected",
    steps: [
      "Check responsiveness — tap shoulders firmly",
      "Call emergency services immediately",
      "Begin CPR if patient is unresponsive",
      "30 chest compressions then 2 rescue breaths",
      "Compress 5-6 cm deep at 100-120 bpm",
      "Use AED if available — follow instructions",
    ],
    priority: "critical",
  },
  critical: {
    type: "critical",
    title: "Critical Emergency",
    steps: [
      "CALL EMERGENCY SERVICES NOW",
      "Do not leave the patient alone",
      "Keep airway open — tilt head back",
      "Monitor breathing every 30 seconds",
      "Begin CPR if no pulse detected",
      "Stay on line with emergency dispatcher",
    ],
    priority: "critical",
  },
};
