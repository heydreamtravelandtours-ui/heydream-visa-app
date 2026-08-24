// app/social.tsx
// Mirrors the sidebar's Social Media dropdown on visa/help-support.php etc.
// (same real URLs, not the placeholder href="#" icons in that page's
// footer) -- previously nowhere in the app.

import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { Linking, Pressable, StyleSheet, View } from "react-native";

const SOCIALS = [
  {
    icon: "logo-facebook" as const,
    label: "Facebook",
    color: "#1877F2",
    url: "https://www.facebook.com/profile.php?id=61583752858443",
  },
  {
    icon: "logo-instagram" as const,
    label: "Instagram",
    color: "#E4405F",
    url: "https://www.instagram.com/haedreamconsultancy?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==",
  },
  {
    icon: "logo-twitter" as const,
    label: "X (Twitter)",
    color: "#000000",
    url: "https://x.com/HeyDreamTravel?s=20",
  },
  {
    icon: "logo-tiktok" as const,
    label: "TikTok",
    color: "#000000",
    url: "https://www.tiktok.com/@heydreamtravelandtours?is_from_webapp=1&sender_device=pc",
  },
];

export default function SocialScreen() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScreenHeader title="Social Media" />
      <View style={styles.list}>
        {SOCIALS.map((s) => (
          <Pressable key={s.label} style={styles.row} onPress={() => Linking.openURL(s.url)}>
            <View style={[styles.iconWrap, { backgroundColor: `${s.color}1A` }]}>
              <Ionicons name={s.icon} size={20} color={s.color} />
            </View>
            <ThemedText style={styles.label}>{s.label}</ThemedText>
            <Ionicons name="open-outline" size={18} color={Colors.text} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: 20, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    shadowColor: Colors.black,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  label: { flex: 1, fontSize: 15, fontWeight: "600", color: Colors.dark },
});
