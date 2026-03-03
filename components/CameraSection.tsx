import React, { useRef, useEffect, useCallback } from "react";
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
  interpolate,
  Easing,
} from "react-native-reanimated";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import COLORS from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";

function PulsingBorder({ color, glow }: { color: string; glow: string }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [opacity]);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));
  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        style,
        {
          borderWidth: 2,
          borderColor: color,
          borderRadius: 0,
        },
      ]}
      pointerEvents="none"
    />
  );
}

function BoundingBox({
  label,
  x,
  y,
  w,
  h,
  color,
}: {
  label: string;
  x: string;
  y: string;
  w: string;
  h: string;
  color: string;
}) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withTiming(1, { duration: 300 });
    return () => {
      opacity.value = withTiming(0, { duration: 200 });
    };
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: x,
          top: y,
          width: w,
          height: h,
          borderWidth: 2,
          borderColor: color,
        },
        style,
      ]}
      pointerEvents="none"
    >
      <View
        style={{
          backgroundColor: color,
          paddingHorizontal: 6,
          paddingVertical: 2,
          alignSelf: "flex-start",
        }}
      >
        <Text style={{ color: COLORS.black, fontSize: 10, fontWeight: "700" }}>
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}

function ScanLine() {
  const translateY = useSharedValue(0);
  useEffect(() => {
    translateY.value = withRepeat(
      withTiming(1, { duration: 2500, easing: Easing.linear }),
      -1,
      false
    );
  }, [translateY]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(translateY.value, [0, 1], [0, 200]) }],
  }));
  return (
    <Animated.View
      style={[styles.scanLine, style]}
      pointerEvents="none"
    />
  );
}

function StatusBadge({
  status,
}: {
  status: "normal" | "warning" | "emergency";
}) {
  const colors = {
    normal: { bg: COLORS.statusGreenGlow, border: COLORS.statusGreen, text: COLORS.statusGreen, label: "NORMAL" },
    warning: { bg: COLORS.statusYellowGlow, border: COLORS.statusYellow, text: COLORS.statusYellow, label: "WARNING" },
    emergency: { bg: COLORS.statusRedGlow, border: COLORS.statusRed, text: COLORS.statusRed, label: "EMERGENCY" },
  };
  const c = colors[status];
  const scale = useSharedValue(1);
  useEffect(() => {
    if (status === "emergency") {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 400 }),
          withTiming(1, { duration: 400 })
        ),
        -1,
        false
      );
    } else {
      scale.value = withTiming(1);
    }
  }, [status, scale]);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View
      style={[
        styles.statusBadge,
        { backgroundColor: c.bg, borderColor: c.border },
        animStyle,
      ]}
    >
      <View style={[styles.statusDot, { backgroundColor: c.text }]} />
      <Text style={[styles.statusLabel, { color: c.text }]}>{c.label}</Text>
    </Animated.View>
  );
}

export function CameraSection() {
  const [permission, requestPermission] = useCameraPermissions();
  const { visionAlert, emergencyStatus, setCameraReady, aiRunning } = useApp();

  const onCameraReady = useCallback(() => {
    setCameraReady(true);
  }, [setCameraReady]);

  const borderColor =
    emergencyStatus === "emergency"
      ? COLORS.statusRed
      : emergencyStatus === "warning"
      ? COLORS.statusYellow
      : COLORS.cyanDim;
  const borderGlow =
    emergencyStatus === "emergency"
      ? COLORS.statusRed
      : emergencyStatus === "warning"
      ? COLORS.statusYellow
      : COLORS.cyan;

  const showFallBox = visionAlert === "fall" || visionAlert === "motionless";
  const showBleedBox = visionAlert === "bleeding";

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionLoadingDot} />
      </View>
    );
  }

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
      {Platform.OS !== "web" ? (
        <CameraView style={StyleSheet.absoluteFill} facing="back" onCameraReady={onCameraReady} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.webCameraFallback]}>
          <MaterialCommunityIcons name="camera" size={40} color={COLORS.textMuted} />
          <Text style={styles.webCameraText}>Camera preview on device</Text>
        </View>
      )}

      <View style={styles.darkOverlay} pointerEvents="none" />

      {aiRunning && <ScanLine />}

      {showFallBox && (
        <BoundingBox
          label="PERSON FALLEN"
          x="15%"
          y="20%"
          w="55%"
          h="50%"
          color={COLORS.statusYellow}
        />
      )}
      {showBleedBox && (
        <BoundingBox
          label="BLEEDING DETECTED"
          x="25%"
          y="30%"
          w="40%"
          h="35%"
          color={COLORS.statusRed}
        />
      )}

      {emergencyStatus !== "normal" && (
        <PulsingBorder color={borderColor} glow={borderGlow} />
      )}

      <View style={styles.topBar}>
        <StatusBadge status={emergencyStatus} />
        <View style={styles.aiTag}>
          <View style={[styles.aiDot, { backgroundColor: aiRunning ? COLORS.statusGreen : COLORS.textMuted }]} />
          <Text style={styles.aiTagText}>AI ACTIVE</Text>
        </View>
      </View>

      <View style={styles.bottomBar}>
        <View style={styles.cornerTL} />
        <View style={styles.cornerTR} />
        <View style={styles.cornerBL} />
        <View style={styles.cornerBR} />
        <Text style={styles.fpsText}>5 FPS · YOLOv8n</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    overflow: "hidden",
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.12)",
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
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 1,
    backgroundColor: COLORS.cyan,
    opacity: 0.4,
  },
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
    backgroundColor: "rgba(0,0,0,0.6)",
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
  bottomBar: {
    position: "absolute",
    bottom: 10,
    left: 10,
    right: 10,
    alignItems: "center",
  },
  fpsText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.8,
  },
  cornerTL: {
    position: "absolute",
    top: -100,
    left: 0,
    width: 18,
    height: 18,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: COLORS.cyan,
  },
  cornerTR: {
    position: "absolute",
    top: -100,
    right: 0,
    width: 18,
    height: 18,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: COLORS.cyan,
  },
  cornerBL: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 18,
    height: 18,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: COLORS.cyan,
  },
  cornerBR: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: COLORS.cyan,
  },
});
