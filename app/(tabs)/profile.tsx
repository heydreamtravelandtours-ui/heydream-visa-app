// app/(tabs)/profile.tsx

import { HeaderActions } from "@/components/header-actions";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import { useUnreadCount } from "@/hooks/use-unread-count";
import { showConfirm } from "@/utils/cross-alert";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL } from "@/api/config";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { unreadCount } = useUnreadCount();

  const handleLogout = () => {
    showConfirm("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.hero}>
        {user && <HeaderActions unreadCount={unreadCount} showProfile={false} style={styles.heroActions} />}
        {user ? (
          <>
            <View style={styles.avatar}>
              <ThemedText style={styles.avatarText}>{initials(user.full_name)}</ThemedText>
            </View>
            <ThemedText style={styles.name}>{user.full_name}</ThemedText>
            <ThemedText style={styles.email}>{user.email}</ThemedText>
          </>
        ) : (
          <>
            <View style={styles.avatar}>
              <Ionicons name="person" size={30} color={Colors.white} />
            </View>
            <ThemedText style={styles.name}>Welcome</ThemedText>
            <ThemedText style={styles.email}>Log in to manage your visa applications</ThemedText>
          </>
        )}
      </SafeAreaView>

      <View style={styles.menu}>
        {!user && (
          <>
            <MenuRow
              icon="log-in-outline"
              label="Log In"
              onPress={() => router.push("/(auth)/login")}
            />
            <MenuRow
              icon="person-add-outline"
              label="Create Account"
              onPress={() => router.push("/(auth)/register")}
            />
          </>
        )}
        {user && (
          <>
            <MenuRow
              icon="document-text-outline"
              label="My Applications"
              onPress={() => router.push("/(tabs)/applications")}
            />
            <MenuRow
              icon="create-outline"
              label="Edit Profile"
              onPress={() => router.push("/edit-profile")}
            />
            <MenuRow
              icon="lock-closed-outline"
              label="Change Password"
              onPress={() => router.push("/change-password")}
            />
          </>
        )}
        <MenuRow icon="mail-outline" label="Contact Support" onPress={() => router.push("/support")} />
        <MenuRow icon="information-circle-outline" label="About Us" onPress={() => router.push("/about")} />
        <MenuRow icon="share-social-outline" label="Social Media" onPress={() => router.push("/social")} />
        <MenuRow
          icon="reader-outline"
          label="Terms of Service"
          onPress={() => WebBrowser.openBrowserAsync(`${API_BASE_URL}/visa/terms.php`)}
        />
        {user && (
          <MenuRow icon="log-out-outline" label="Log Out" onPress={handleLogout} destructive />
        )}
      </View>
    </View>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  destructive,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={onPress}>
      <View style={[styles.rowIconWrap, destructive && styles.rowIconWrapDestructive]}>
        <Ionicons name={icon} size={18} color={destructive ? "#B00020" : Colors.primary} />
      </View>
      <ThemedText style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>
        {label}
      </ThemedText>
      <Ionicons name="chevron-forward" size={18} color={Colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  hero: {
    backgroundColor: Colors.primary,
    alignItems: "center",
    paddingBottom: 28,
    paddingTop: 8,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroActions: { position: "absolute", top: 12, right: 20, zIndex: 1 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatarText: { color: Colors.white, fontSize: 24, fontWeight: "800" },
  name: { color: Colors.white, fontSize: 18, fontWeight: "800" },
  email: { color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 4 },
  menu: { padding: 20, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    shadowColor: Colors.black,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  rowPressed: { opacity: 0.85 },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#E8F0FE",
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconWrapDestructive: { backgroundColor: "#FDECEA" },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: Colors.dark },
  rowLabelDestructive: { color: "#B00020" },
});
