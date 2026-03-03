import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import COLORS from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";
import {
  MEDICAL_INSTRUCTIONS,
  EmergencyType,
} from "@/constants/medical-instructions";

const PRIORITY_COLORS = {
  low: COLORS.textMuted,
  medium: COLORS.statusYellow,
  high: COLORS.statusRed,
  critical: COLORS.statusRed,
};

function InstructionStep({ step, index, color }: { step: string; index: number; color: string }) {
  const opacity = useSharedValue(0);
  const tx = useSharedValue(20);

  useEffect(() => {
    const delay = index * 60;
    const timer = setTimeout(() => {
      opacity.value = withTiming(1, { duration: 300 });
      tx.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
    }, delay);
    return () => clearTimeout(timer);
  }, [step, index, opacity, tx]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: tx.value }],
  }));

  return (
    <Animated.View style={[styles.step, animStyle]}>
      <View style={[styles.stepNumber, { borderColor: color }]}>
        <Text style={[styles.stepNumberText, { color }]}>{index + 1}</Text>
      </View>
      <Text style={styles.stepText}>{step}</Text>
    </Animated.View>
  );
}

export function InstructionsPanel() {
  const { diagnosis } = useApp();
  const instruction = MEDICAL_INSTRUCTIONS[diagnosis];
  const color = PRIORITY_COLORS[instruction.priority];
  const prevDiagnosis = useRef<EmergencyType>(diagnosis);
  const keyRef = useRef(0);

  if (prevDiagnosis.current !== diagnosis) {
    prevDiagnosis.current = diagnosis;
    keyRef.current += 1;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="medical-bag" size={15} color={COLORS.accent} />
        <Text style={styles.headerTitle}>FIRST AID INSTRUCTIONS</Text>
        <View style={styles.priorityBadge}>
          <Text style={[styles.priorityText, { color }]}>
            {instruction.priority.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.stepsContainer} key={keyRef.current}>
        {instruction.steps.map((step, i) => (
          <InstructionStep key={i} step={step} index={i} color={color} />
        ))}
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
    flex: 1,
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
    flex: 1,
  },
  priorityBadge: {
    backgroundColor: "rgba(232,50,60,0.1)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  priorityText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    fontFamily: "Inter_700Bold",
  },
  stepsContainer: {
    gap: 6,
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  stepNumber: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumberText: {
    fontSize: 9,
    fontWeight: "800",
    lineHeight: 11,
    fontFamily: "Inter_700Bold",
  },
  stepText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
});
