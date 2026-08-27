// components/app-update-gate.tsx
// On launch, compares the installed app version against the manifest at
// api/app-version.php and prompts the user:
//   installed < minimum  -> blocking "Update Required" (app unusable until updated)
//   installed < latest    -> dismissible "Update Available" (nags once per version)
// Sideloaded APK from GitHub Releases means there's no store to do this for
// us. Mounted once in app/_layout.tsx, on top of everything.

import * as api from "@/api/client";
import type { AppVersionInfo } from "@/api/client";
import * as secureStorage from "@/api/secure-storage";
import { Colors } from "@/constants/theme";
import * as Application from "expo-application";
import { useEffect, useState } from "react";
import { Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";

// Numeric dotted compare: -1 if a < b, 1 if a > b, 0 if equal.
function cmpVersion(a: string, b: string): number {
  const pa = a.split(".");
  const pb = b.split(".");
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (parseInt(pa[i], 10) || 0) - (parseInt(pb[i], 10) || 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

export function AppUpdateGate() {
  const [state, setState] = useState<{ mode: "required" | "optional"; info: AppVersionInfo } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // null on web / Expo Go returns its own version -- only a real build has
    // a meaningful value, so bail out otherwise rather than false-prompt.
    const current = Application.nativeApplicationVersion;
    if (!current) return;

    let cancelled = false;
    (async () => {
      const info = await api.getAppVersionInfo();
      if (cancelled || !info) return;

      if (cmpVersion(current, info.minimum) < 0) {
        setState({ mode: "required", info });
        return;
      }
      if (cmpVersion(current, info.latest) < 0) {
        const key = `hd_update_seen_${info.latest}`;
        const seen = await secureStorage.getItem(key);
        if (!cancelled && !seen) setState({ mode: "optional", info });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!state || (state.mode === "optional" && dismissed)) return null;

  const required = state.mode === "required";
  const { info } = state;

  const update = () => {
    Linking.openURL(info.download_url).catch(() => {});
  };
  const later = async () => {
    await secureStorage.setItem(`hd_update_seen_${info.latest}`, "1");
    setDismissed(true);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => (required ? undefined : later())}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>{required ? "!" : "↑"}</Text>
          </View>
          <Text style={styles.title}>{required ? "Update Required" : "Update Available"}</Text>
          <Text style={styles.body}>
            {required
              ? `This version of HeyDream Visa is no longer supported. Please update to version ${info.latest} to keep using the app.`
              : `HeyDream Visa ${info.latest} is available.`}
          </Text>
          {!!info.notes && <Text style={styles.notes}>{info.notes}</Text>}

          <Pressable style={styles.primaryBtn} onPress={update}>
            <Text style={styles.primaryBtnText}>Update Now</Text>
          </Pressable>
          {!required && (
            <Pressable style={styles.laterBtn} onPress={later}>
              <Text style={styles.laterBtnText}>Later</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,20,35,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: Colors.black,
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E8F0FE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  icon: { fontSize: 24, fontWeight: "900", color: Colors.primary },
  title: { fontSize: 18, fontWeight: "800", color: Colors.dark, textAlign: "center" },
  body: { fontSize: 13.5, color: Colors.text, textAlign: "center", marginTop: 8, lineHeight: 20 },
  notes: {
    fontSize: 12,
    color: Colors.text,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 17,
    backgroundColor: "#F4F7FB",
    borderRadius: 10,
    padding: 10,
  },
  primaryBtn: {
    marginTop: 20,
    width: "100%",
    backgroundColor: Colors.gold,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: Colors.primary, fontWeight: "800", fontSize: 15 },
  laterBtn: { marginTop: 10, paddingVertical: 8, paddingHorizontal: 16 },
  laterBtnText: { color: Colors.text, fontWeight: "700", fontSize: 13.5 },
});
