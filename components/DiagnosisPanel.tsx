import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import COLORS from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";
import { EmergencyType } from "@/constants/medical-instructions";

const DIAGNOSIS_CONFIG: Record<
  EmergencyType,
  { icon: string; label: string; desc: string; color: string; bg: string }
> = {
  none: {
    icon: "shield-check",
    label: "لا توجد حالة طارئة",
    desc: "جميع المؤشرات ضمن النطاق الطبيعي",
    color: COLORS.statusGreen,
    bg: COLORS.statusGreenGlow,
  },
  fall: {
    icon: "human-handsdown",
    label: "احتمال سقوط شخص",
    desc: "رصد تحليل الكاميرا حالة سقوط محتملة",
    color: COLORS.statusYellow,
    bg: COLORS.statusYellowGlow,
  },
  bleeding: {
    icon: "water-alert",
    label: "تم رصد نزيف",
    desc: "تم تحديد علامات بصرية لوجود نزيف حاد",
    color: COLORS.statusRed,
    bg: COLORS.statusRedGlow,
  },
  cardiac: {
    icon: "heart-off",
    label: "اضطراب في نبض القلب",
    desc: "تم رصد نمط غير طبيعي لضربات القلب",
    color: COLORS.statusRed,
    bg: COLORS.statusRedGlow,
  },
  critical: {
    icon: "alert-octagon",
    label: "حالة طارئة حرجة",
    desc: "تم رصد مؤشرات متعددة تهدد الحياة",
    color: COLORS.statusRed,
    bg: COLORS.statusRedGlow,
  },
};

function DiagnosisIcon({
  icon,
  color,
  isCritical,
}: {
  icon: string;
  color: string;
  isCritical: boolean;
}) {
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isCritical) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 350 }),
          withTiming(1, { duration: 350 })
        ),
        -1,
        false
      );
    } else {
      scale.value = withTiming(1, { duration: 300 });
    }
  }, [isCritical, scale, rotate]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.iconContainer,
        { backgroundColor: DIAGNOSIS_CONFIG[icon as EmergencyType]?.bg || "transparent" },
        animStyle,
      ]}
    >
      <MaterialCommunityIcons name={icon as any} size={24} color={color} />
    </Animated.View>
  );
}

export function DiagnosisPanel() {
  const { diagnosis, aiRunning, latestDetections, healthScore } = useApp();
  
  // تحقق من وجود كشف AI حقيقي
  const hasAiDetection = latestDetections.length > 0 && latestDetections[0].class !== "NONE";
  const aiInfo = hasAiDetection ? latestDetections[0] : null;

  const config = DIAGNOSIS_CONFIG[diagnosis];
  
  // استخدام وصف الـ AI إذا وجد، وإلا الوصف الثابت
  const displayLabel = aiInfo ? (aiInfo.class === "BLEEDING" ? "تم رصد نزيف حقيقي" : aiInfo.class) : config.label;
  const displayDesc = aiInfo?.description || config.desc;
  const displaySeverity = aiInfo?.severity || (diagnosis === "none" ? "CLEAR" : "CRITICAL");
  
  const isCritical = diagnosis === "critical" || diagnosis === "cardiac" || diagnosis === "bleeding" || aiInfo?.severity === "critical";
  const slideIn = useSharedValue(0);

  useEffect(() => {
    slideIn.value = 0;
    slideIn.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });
  }, [diagnosis, aiInfo?.description, slideIn]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: slideIn.value,
    transform: [{ translateX: (1 - slideIn.value) * 12 }],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="brain" size={15} color={COLORS.accent} />
        <Text style={styles.headerTitle}>محرك التشخيص الذكي v4.2</Text>
        {aiRunning && (
          <View style={styles.runningBadge}>
            <Text style={styles.runningText}>تحليل مباشر</Text>
          </View>
        )}
      </View>

      <Animated.View style={[styles.content, contentStyle]}>
        <DiagnosisIcon icon={config.icon} color={config.color} isCritical={isCritical} />
        <View style={styles.textBlock}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.diagnosisLabel, { color: config.color }]}>
              {displayLabel}
            </Text>
            <View style={[styles.scoreBadge, { backgroundColor: healthScore > 70 ? COLORS.statusGreenGlow : COLORS.statusRedGlow }]}>
              <Text style={[styles.scoreText, { color: healthScore > 70 ? COLORS.statusGreen : COLORS.statusRed }]}>
                {healthScore}% استقرار
              </Text>
            </View>
          </View>
          <Text style={styles.diagnosisDesc}>{displayDesc}</Text>
        </View>
        <View style={[styles.severityTag, { backgroundColor: config.bg, borderColor: config.color }]}>
          <Text style={[styles.severityText, { color: config.color }]}>
            {String(displaySeverity).toUpperCase() === "CLEAR" ? "سليم" : 
             String(displaySeverity).toUpperCase() === "CRITICAL" ? "خطير" : 
             String(displaySeverity).toUpperCase() === "HIGH" ? "مرتفع" : "تنبيه"}
          </Text>
        </View>
      </Animated.View>
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
    flex: 1,
  },
  runningBadge: {
    backgroundColor: COLORS.cyanGlow,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.cyanDim,
  },
  runningText: {
    color: COLORS.cyan,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  diagnosisLabel: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    lineHeight: 18,
  },
  diagnosisDesc: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 15,
  },
  severityTag: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    alignSelf: "center",
  },
  severityText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
    fontFamily: "Inter_700Bold",
  },
  scoreBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  scoreText: {
    fontSize: 8,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
});
