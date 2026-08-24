// components/header-actions.tsx
// Notification bell (with unread badge) + profile shortcut, for use in any
// tab header on a light background (Applications, Profile). Home has its
// own navy-hero variant of the same idea inline in (tabs)/index.tsx; this
// is the light-background counterpart so the bell/badge isn't Home-only.

import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";

export function HeaderActions({
  unreadCount,
  showProfile = true,
  style,
}: {
  unreadCount: number;
  showProfile?: boolean;
  style?: ViewStyle;
}) {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <View style={[styles.row, style]}>
      {user && (
        <Pressable style={styles.button} onPress={() => router.push("/notifications")} hitSlop={8}>
          <Ionicons name="notifications-outline" size={18} color={Colors.primary} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
            </View>
          )}
        </Pressable>
      )}
      {showProfile && (
        <Pressable
          style={styles.button}
          onPress={() => router.push(user ? "/(tabs)/profile" : "/(auth)/login")}
          hitSlop={8}
        >
          <Ionicons name="person-outline" size={18} color={Colors.primary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E8F0FE",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#E53935",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: Colors.white, fontSize: 9, fontWeight: "800" },
});
