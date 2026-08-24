// components/header-actions.tsx
// Notification bell (with unread badge) + profile shortcut, shared by every
// tab header (Home, Applications, Profile) so the badge looks and behaves
// identically everywhere. Previously Home hand-rolled its own separate
// copy of this same markup/styles, which is why the badge looked
// inconsistent from one tab to the next -- one real component now, with a
// `variant` for the two header backgrounds it appears on.

import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

const VARIANTS = {
  // White header (Applications, Profile)
  light: { buttonBg: "#E8F0FE", iconColor: Colors.primary },
  // Navy hero header (Home)
  dark: { buttonBg: "rgba(255,255,255,0.2)", iconColor: Colors.white },
};

export function HeaderActions({
  unreadCount,
  showProfile = true,
  variant = "light",
  style,
}: {
  unreadCount: number;
  showProfile?: boolean;
  variant?: keyof typeof VARIANTS;
  style?: StyleProp<ViewStyle>;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { buttonBg, iconColor } = VARIANTS[variant];

  return (
    <View style={[styles.row, style]}>
      {user && (
        <Pressable
          style={[styles.button, { backgroundColor: buttonBg }]}
          onPress={() => router.push("/notifications")}
          hitSlop={8}
        >
          <Ionicons name="notifications-outline" size={18} color={iconColor} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
            </View>
          )}
        </Pressable>
      )}
      {showProfile && (
        <Pressable
          style={[styles.button, { backgroundColor: buttonBg }]}
          onPress={() => router.push(user ? "/(tabs)/profile" : "/(auth)/login")}
          hitSlop={8}
        >
          <Ionicons name="person-outline" size={18} color={iconColor} />
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
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#E53935",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  badgeText: { color: Colors.white, fontSize: 9.5, fontWeight: "800" },
});
