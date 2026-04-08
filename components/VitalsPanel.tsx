import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import COLORS from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";

function VitalCard({
  icon,
  iconLibrary,
  label,
  value,
  unit,
  isAlert,
  isConnected = true,
}: {
  icon: string;
  iconLibrary: "mci" | "ion";
  label: string;
  value: string;
  unit: string;
  isAlert?: boolean;
  isConnected?: boolean;
}) {
  const flash = useSharedValue(1);
  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current !== value) {
      prevValue.current = value;
      flash.value = withSequence(
        withTiming(0.4, { duration: 120 }),
        withTiming(1, { duration: 200 })
      );
    }
  }, [value, flash]);

  const animStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  const color = !isConnected
    ? COLORS.textMuted
    : isAlert
    ? COLORS.statusRed
    : COLORS.cyan;

  return (
    <View style={[styles.card, isAlert && styles.cardAlert]}>
      <View style={styles.cardHeader}>
        {iconLibrary === "mci" ? (
          <MaterialCommunityIcons name={icon as any} size={14} color={color} />
        ) : (
          <Ionicons name={icon as any} size={14} color={color} />
        )}
        <Text style={styles.cardLabel}>{label}</Text>
      </View>
      <Animated.View style={animStyle}>
        <Text style={[styles.cardValue, { color }]}>
          {isConnected ? value : "--"}
          <Text style={styles.cardUnit}> {unit}</Text>
        </Text>
      </Animated.View>
    </View>
  );
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (connected) {
      pulse.value = withSequence(
        withTiming(1.2, { duration: 500 }),
        withTiming(1, { duration: 500 })
      );
    }
  }, [connected, pulse]);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <View style={styles.connectionBadge}>
      <Animated.View
        style={[
          styles.connectionDot,
          { backgroundColor: connected ? COLORS.statusGreen : COLORS.statusRed },
          animStyle,
        ]}
      />
      <Text
        style={[
          styles.connectionText,
          { color: connected ? COLORS.statusGreen : COLORS.statusRed },
        ]}
      >
        {connected ? "الخاتم متصل" : "الخاتم غير متصل"}
      </Text>
    </View>
  );
}

export function VitalsPanel() {
  const { vitals } = useApp();

  const hrAlert = vitals.heartRate > 140 || vitals.heartRate < 40;
  const spo2Alert = vitals.spo2 < 90;
  const tempAlert = vitals.temperature > 39;
  const motionAlert = vitals.motionStatus === "Sudden Movement";

  // ترجمة حالة الحركة
  const getMotionLabel = (status: string) => {
    switch (status) {
      case "Still": return "مستقر";
      case "Moving": return "يتحرك";
      case "Sudden Movement": return "حركة مفاجئة";
      default: return status;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="heart-pulse" size={15} color={COLORS.accent} />
          <Text style={styles.headerTitle}>العلامات الحيوية</Text>
        </View>
        <ConnectionBadge connected={vitals.ringConnected} />
      </View>

      <View style={styles.grid}>
        <VitalCard
          icon="heart-pulse"
          iconLibrary="mci"
          label="نبض القلب"
          value={String(vitals.heartRate)}
          unit="BPM"
          isAlert={hrAlert}
          isConnected={vitals.ringConnected}
        />
        <VitalCard
          icon="water-percent"
          iconLibrary="mci"
          label="الأكسجين"
          value={String(vitals.spo2)}
          unit="%"
          isAlert={spo2Alert}
          isConnected={vitals.ringConnected}
        />
        <VitalCard
          icon="thermometer"
          iconLibrary="mci"
          label="الحرارة"
          value={String(vitals.temperature)}
          unit="°C"
          isAlert={tempAlert}
          isConnected={vitals.ringConnected}
        />
        <VitalCard
          icon="motion-sensor"
          iconLibrary="mci"
          label="الحركة"
          value={getMotionLabel(vitals.motionStatus)}
          unit=""
          isAlert={motionAlert}
          isConnected={vitals.ringConnected}
        />
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
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    fontFamily: "Inter_700Bold",
  },
  connectionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  connectionText: {
    fontSize: 10,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  grid: {
    flexDirection: "row",
    gap: 8,
  },
  card: {
    flex: 1,
    backgroundColor: COLORS.bgCardAlt,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  cardAlert: {
    borderColor: COLORS.statusRedDim,
    backgroundColor: "rgba(255,23,68,0.06)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.5,
    fontFamily: "Inter_500Medium",
    flexShrink: 1,
  },
  cardValue: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    lineHeight: 22,
  },
  cardUnit: {
    fontSize: 10,
    fontWeight: "400",
    color: COLORS.textMuted,
    fontFamily: "Inter_400Regular",
  },
});
