import React from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import COLORS from "@/constants/colors";
import { CameraSection } from "@/components/CameraSection";
import { VitalsPanel } from "@/components/VitalsPanel";
import { DiagnosisPanel } from "@/components/DiagnosisPanel";
import { EarlyRiskDetection } from "@/components/EarlyRiskDetection";
import { InstructionsPanel } from "@/components/InstructionsPanel";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <View style={styles.appBar}>
        <View style={styles.appBarLeft}>
          <MaterialCommunityIcons name="shield-plus" size={18} color={COLORS.accent} />
          <View>
            <View style={styles.labBadge}>
              <Text style={styles.labText}>NAWAF & MULK ALLAH AI LAB</Text>
            </View>
            <Text style={styles.appBarTitle}>Smart Rescuer AI</Text>
          </View>
        </View>
        <View style={styles.appBarRight}>
          <View style={styles.offlineBadge}>
            <MaterialCommunityIcons name="wifi-off" size={10} color={COLORS.statusGreen} />
            <Text style={styles.offlineText}>OFFLINE</Text>
          </View>
        </View>
      </View>

      <View style={styles.cameraSection}>
        <CameraSection />
      </View>

      <View style={styles.panelsSection}>
        <ScrollView
          style={styles.panelsScroll}
          contentContainerStyle={styles.panelsScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <VitalsPanel />
          <DiagnosisPanel />
          <EarlyRiskDetection />
          <InstructionsPanel />
        </ScrollView>
      </View>

      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 4 },
        ]}
      >
        <View style={styles.bottomItem}>
          <MaterialCommunityIcons name="cpu-64-bit" size={12} color={COLORS.textMuted} />
          <Text style={styles.bottomText}>On-Device AI</Text>
        </View>
        <View style={styles.bottomDivider} />
        <View style={styles.bottomItem}>
          <MaterialCommunityIcons name="lock-outline" size={12} color={COLORS.textMuted} />
          <Text style={styles.bottomText}>Fully Secure</Text>
        </View>
        <View style={styles.bottomDivider} />
        <View style={styles.bottomItem}>
          <MaterialCommunityIcons name="bluetooth" size={12} color={COLORS.textMuted} />
          <Text style={styles.bottomText}>BLE Ready</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  appBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: COLORS.bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  appBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  labBadge: {
    backgroundColor: COLORS.bgCardAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 4,
  },
  labText: {
    color: COLORS.textSecondary,
    fontSize: 8,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  appBarTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
  appBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  offlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.statusGreenGlow,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: COLORS.statusGreenDim,
  },
  offlineText: {
    color: COLORS.statusGreen,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
    fontFamily: "Inter_700Bold",
  },
  cameraSection: {
    flex: 5,
    minHeight: 0,
  },
  panelsSection: {
    flex: 5,
    minHeight: 0,
  },
  panelsScroll: {
    flex: 1,
  },
  panelsScrollContent: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 4,
    paddingHorizontal: 14,
    backgroundColor: COLORS.bgSecondary,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 12,
  },
  bottomItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  bottomText: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.3,
  },
  bottomDivider: {
    width: 1,
    height: 10,
    backgroundColor: COLORS.border,
  },
});
