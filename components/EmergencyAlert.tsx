import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Linking,
  Vibration,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import COLORS from "@/constants/colors";

// ─── Configuration ────────────────────────────────────────────────────────────
const AMBULANCE_NUMBER = "999";
const AUTO_CALL_SECONDS = 30;

// ─── Pulsing siren icon ───────────────────────────────────────────────────────
function SirenIcon() {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: 400, easing: Easing.out(Easing.ease) }),
        withTiming(1,    { duration: 400, easing: Easing.in(Easing.ease) })
      ),
      -1,
      false
    );
  }, [scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={style}>
      <MaterialCommunityIcons name="alarm-light" size={64} color={COLORS.statusRed} />
    </Animated.View>
  );
}

// ─── Countdown ring ───────────────────────────────────────────────────────────
function CountdownTimer({ seconds }: { seconds: number }) {
  const pct = seconds / AUTO_CALL_SECONDS;
  const isUrgent = seconds <= 10;
  return (
    <View style={styles.timerBox}>
      <Text style={[styles.timerLabel, isUrgent && styles.timerUrgent]}>
        ⏱ سيتم الاتصال تلقائياً خلال:
      </Text>
      <Text style={[styles.timerCount, isUrgent && styles.timerUrgent]}>
        {seconds} ثانية
      </Text>
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: isUrgent ? COLORS.statusRed : COLORS.statusYellow }]} />
      </View>
    </View>
  );
}

// ─── Main Emergency Alert Modal ───────────────────────────────────────────────

interface EmergencyAlertProps {
  visible: boolean;
  onDismiss: () => void;
}

export function EmergencyAlert({ visible, onDismiss }: EmergencyAlertProps) {
  const [countdown, setCountdown]     = useState(AUTO_CALL_SECONDS);
  const [called, setCalled]           = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulsing red background overlay
  const bgOpacity = useSharedValue(0.85);
  useEffect(() => {
    if (visible) {
      bgOpacity.value = withRepeat(
        withSequence(
          withTiming(0.95, { duration: 600 }),
          withTiming(0.80, { duration: 600 })
        ),
        -1,
        false
      );
    }
  }, [visible, bgOpacity]);
  const bgStyle = useAnimatedStyle(() => ({ opacity: bgOpacity.value }));

  // Reset & start countdown whenever modal opens
  useEffect(() => {
    if (!visible) return;

    setCalled(false);
    setCountdown(AUTO_CALL_SECONDS);

    // Vibrate device to get user attention: long-short-long pattern
    Vibration.vibrate([0, 500, 200, 500, 200, 1000]);

    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Auto-call
          callAmbulance();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      Vibration.cancel();
    };
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const callAmbulance = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setCalled(true);
    Vibration.cancel();
    Linking.openURL(`tel:${AMBULANCE_NUMBER}`);
  }, []);

  const handleYes = useCallback(() => {
    callAmbulance();
  }, [callAmbulance]);

  const handleNo = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    Vibration.cancel();
    onDismiss();
  }, [onDismiss]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      {/* Dark red overlay */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, bgStyle]} />

      <View style={styles.centeredContainer}>
        <View style={styles.card}>

          {/* Icon */}
          <SirenIcon />

          {/* Title */}
          <Text style={styles.title}>🚨 حالة طارئة مكتشفة!</Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            الذكاء الاصطناعي اكتشف إصابة خطيرة
          </Text>
          <Text style={styles.question}>هل تريد إبلاغ الإسعاف؟</Text>

          {/* Countdown */}
          {!called && <CountdownTimer seconds={countdown} />}

          {/* Confirmation message after call */}
          {called && (
            <View style={styles.confirmedBox}>
              <MaterialCommunityIcons name="check-circle" size={28} color={COLORS.statusGreen} />
              <Text style={styles.confirmedText}>تم الاتصال بالإسعاف ✅</Text>
            </View>
          )}

          {/* Buttons */}
          {!called && (
            <View style={styles.btnRow}>
              <Pressable
                style={[styles.btn, styles.btnNo]}
                onPress={handleNo}
                android_ripple={{ color: "rgba(255,255,255,0.1)" }}
              >
                <Text style={styles.btnNoText}>لا</Text>
              </Pressable>

              <Pressable
                style={[styles.btn, styles.btnYes]}
                onPress={handleYes}
                android_ripple={{ color: "rgba(0,0,0,0.1)" }}
              >
                <MaterialCommunityIcons name="phone" size={18} color="#fff" />
                <Text style={styles.btnYesText}>نعم — اتصل الآن</Text>
              </Pressable>
            </View>
          )}

          {/* Dismiss after call */}
          {called && (
            <Pressable style={styles.dismissBtn} onPress={onDismiss}>
              <Text style={styles.dismissText}>إغلاق</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    backgroundColor: "#1a0000",
  },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    backgroundColor: "#0D0D0D",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.statusRed,
    padding: 28,
    alignItems: "center",
    gap: 14,
  },
  title: {
    color: COLORS.statusRed,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 15,
    textAlign: "center",
    fontFamily: "Inter_500Medium",
  },
  question: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    fontFamily: "Inter_700Bold",
  },
  // Timer
  timerBox: {
    width: "100%",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,23,68,0.08)",
    borderRadius: 12,
    padding: 12,
  },
  timerLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  timerCount: {
    color: COLORS.statusYellow,
    fontSize: 32,
    fontWeight: "900",
    fontFamily: "Inter_700Bold",
  },
  timerUrgent: {
    color: COLORS.statusRed,
  },
  progressTrack: {
    width: "100%",
    height: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  // Buttons
  btnRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    marginTop: 4,
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnNo: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  btnNoText: {
    color: COLORS.textSecondary,
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  btnYes: {
    backgroundColor: COLORS.statusRed,
    flex: 2,
  },
  btnYesText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    fontFamily: "Inter_700Bold",
  },
  // Confirmed
  confirmedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(0,230,118,0.08)",
    borderRadius: 12,
    padding: 14,
    width: "100%",
    justifyContent: "center",
  },
  confirmedText: {
    color: COLORS.statusGreen,
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  dismissBtn: {
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  dismissText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
