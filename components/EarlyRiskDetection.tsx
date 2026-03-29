import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import COLORS from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";

type RiskLevel = "low" | "medium" | "high";

const RISK_COLORS: Record<RiskLevel, string> = {
  low: COLORS.statusGreen,
  medium: COLORS.statusYellow,
  high: COLORS.statusRed,
};

function computeHeartRisk(heartRate: number, spo2: number): RiskLevel {
  if (heartRate > 110 || spo2 < 90) return "high";
  if ((heartRate >= 95 && heartRate <= 110) || (spo2 >= 90 && spo2 <= 94))
    return "medium";
  return "low";
}

function computeDiabetesRisk(temperature: number, heartRate: number): RiskLevel {
  if (temperature > 38.5 && heartRate > 100) return "high";
  if (temperature >= 37.5 && temperature <= 38.5) return "medium";
  return "low";
}

function computeStrokeRisk(
  motionStatus: string,
  heartRate: number
): RiskLevel {
  if (motionStatus !== "Still") return "low";
  if (heartRate > 110) return "high";
  if (heartRate >= 90 && heartRate <= 110) return "medium";
  return "low";
}

function RiskRow({
  label,
  level,
  isLast,
}: {
  label: string;
  level: RiskLevel;
  isLast: boolean;
}) {
  const color = RISK_COLORS[level];

  return (
    <>
      <View style={styles.riskRow}>
        <Text style={styles.riskLabel}>{label}</Text>
        <View style={[styles.riskDot, { backgroundColor: color }]} />
      </View>
      {!isLast && <View style={styles.divider} />}
    </>
  );
}

export function EarlyRiskDetection() {
  const { vitals } = useApp();
  const { heartRate, spo2, temperature, motionStatus } = vitals;

  const heartRisk = computeHeartRisk(heartRate, spo2);
  const diabetesRisk = computeDiabetesRisk(temperature, heartRate);
  const strokeRisk = computeStrokeRisk(motionStatus, heartRate);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons
          name="alert-circle-outline"
          size={15}
          color={COLORS.accent}
        />
        <Text style={styles.headerTitle}>EARLY RISK DETECTION</Text>
      </View>

      <View style={styles.riskList}>
        <RiskRow label="Heart Risk" level={heartRisk} isLast={false} />
        <RiskRow label="Diabetes Risk" level={diabetesRisk} isLast={false} />
        <RiskRow label="Stroke Risk" level={strokeRisk} isLast={true} />
      </View>

      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.statusGreen }]} />
          <Text style={styles.legendText}>Low Risk</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.statusYellow }]} />
          <Text style={styles.legendText}>Medium Risk</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.statusRed }]} />
          <Text style={styles.legendText}>High Risk</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.bgCard,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  headerTitle: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    fontFamily: "Inter_700Bold",
  },
  riskList: {
    gap: 0,
  },
  riskRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  riskLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  riskDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 0,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
