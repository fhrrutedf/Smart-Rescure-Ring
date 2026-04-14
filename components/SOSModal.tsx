import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal } from "react-native";
import { useApp } from "@/contexts/AppContext";
import COLORS from "@/constants/colors";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { speak } from "@/lib/tts";

export function SOSModal() {
  const { latestDetections } = useApp();
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [hasTriggered, setHasTriggered] = useState(false);

  useEffect(() => {
    // Show modal if an injury is detected and hasn't triggered yet in this session
    if (!hasTriggered && latestDetections && latestDetections.length > 0) {
      const hasRealInjury = latestDetections.some(d => d.cls && d.cls !== "NONE");
      if (hasRealInjury) {
        setHasTriggered(true);
        setVisible(true);
        setCountdown(30);
        speak("تنبيه. هل تحتاج إلى الإسعاف؟ أرسل استغاثة الآن أو سيتم الاتصال تلقائياً بعد ثلاثين ثانية");
      }
    }
  }, [latestDetections, hasTriggered]);

  useEffect(() => {
    let timer: any;
    if (visible && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (visible && countdown === 0) {
      handleSos();
    }
    return () => clearInterval(timer);
  }, [visible, countdown]);

  const handleSos = () => {
    setVisible(false);
    speak("جاري إرسال موقعك للمستشفى وطلب الإسعاف فوراً");
    // وهنا يمكن ربطها بالـ API الحقيقي مستقبلاً للاتصال أو إرسال SMS
  };

  const handleCancel = () => {
    setVisible(false);
    speak("تم إلغاء الاستغاثة");
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <BlurView intensity={80} tint="dark" style={styles.overlay}>
        <View style={styles.modalBox}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="ambulance" size={40} color="#fff" />
          </View>
          <Text style={styles.title}>تنبيه طوارئ!</Text>
          <Text style={styles.message}>
            لقد اكتشفنا إصابة. هل تريد الاتصال بالطوارئ وطلب استغاثة؟
          </Text>
          <Text style={styles.timer}>
            سيتم الطلب تلقائياً بعد {countdown} ثانية
          </Text>

          <View style={styles.btnRow}>
            <Pressable style={[styles.btn, styles.btnSos]} onPress={handleSos}>
              <Text style={styles.btnText}>نعم، استغاثة!</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnCancel]} onPress={handleCancel}>
              <Text style={styles.btnText}>لا، أنا بخير</Text>
            </Pressable>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    width: "85%",
    backgroundColor: COLORS.bgCard,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.statusRedDim,
    shadowColor: COLORS.statusRed,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.statusRed,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 4,
    borderColor: COLORS.statusRedDim,
  },
  title: {
    fontSize: 24,
    color: "#fff",
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 24,
  },
  timer: {
    fontSize: 18,
    color: COLORS.statusYellow,
    fontFamily: "Inter_700Bold",
    marginBottom: 24,
  },
  btnRow: {
    flexDirection: "row-reverse", // Arabic UI
    gap: 12,
    width: "100%",
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnCancel: {
    backgroundColor: COLORS.bgSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnSos: {
    backgroundColor: COLORS.statusRed,
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
});
