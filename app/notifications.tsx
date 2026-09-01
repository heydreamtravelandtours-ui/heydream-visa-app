// app/notifications.tsx
// Mirrors visa/api/notifications-api.php's list -- already scoped
// server-side to visa-only notifications (HD_NOTIFICATIONS_VISA_ONLY).

import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import * as api from "@/api/client";
import { resolveNotificationRoute } from "@/lib/notification-routing";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  booking_number: string | null;
  link: string | null;
  is_read: number;
  created_at: string;
}

function iconFor(type: string): keyof typeof Ionicons.glyphMap {
  if (type.includes("document")) return "document-text-outline";
  if (type.includes("payment")) return "card-outline";
  if (type.includes("visa")) return "airplane-outline";
  if (type.includes("booking")) return "checkmark-circle-outline";
  return "notifications-outline";
}

// Mirrors js/auth-menu.js's notifIsBad() exactly -- bad-news notifications
// (cancellations, rejections, failed uploads) always read red, whether read
// or unread, same rule the website already applies.
const BAD_TYPES = new Set([
  "upload_failed",
  "booking_auto_cancelled",
  "booking_cancelled",
  "payment_rejected",
  "inquiry_cancelled",
  "visa_rejected",
  "visa_requested",
  "document_rejected",
  "additional_documents_requested",
]);
function isBad(type: string) {
  return BAD_TYPES.has(type);
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await api.getNotifications();
    if (result.success) {
      setNotifications(result.notifications || []);
      setErrorMessage(null);
    } else {
      // Previously silent on failure -- looked identical to "genuinely no
      // notifications" (an expired/missing token resolves to the same
      // {success:false} shape as a logged-out visitor). Surface it instead.
      setErrorMessage(result.message || "Failed to load notifications.");
    }
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await load();
      setIsLoading(false);
    })();
  }, [load]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  const handlePress = async (n: Notification) => {
    if (!n.is_read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: 1 } : x)));
      api.markNotificationRead(n.id);
    }
    const route = resolveNotificationRoute(n);
    if (route) {
      router.push(route as any);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <ThemedView style={styles.container}>
      <StatusBar style="light" />
      <ScreenHeader
        title="Notifications"
        right={
          unreadCount > 0 ? (
            <Pressable
              onPress={async () => {
                setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
                await api.markAllNotificationsRead();
              }}
            >
              <ThemedText style={styles.markAllText}>Mark all</ThemedText>
            </Pressable>
          ) : undefined
        }
      />

      {isLoading ? (
        <ActivityIndicator style={styles.loading} color={Colors.primary} />
      ) : errorMessage ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={40} color="#B00020" />
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="notifications-off-outline" size={40} color={Colors.text} />
          <ThemedText style={styles.emptyText}>No notifications yet.</ThemedText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        >
          {notifications.map((n) => (
            <Pressable
              key={n.id}
              style={({ pressed }) => [
                styles.card,
                !n.is_read && styles.cardUnread,
                pressed && styles.cardPressed,
              ]}
              onPress={() => handlePress(n)}
            >
              <View
                style={[
                  styles.iconWrap,
                  !n.is_read && styles.iconWrapUnread,
                  isBad(n.type) && (n.is_read ? styles.iconWrapBad : styles.iconWrapBadUnread),
                ]}
              >
                <Ionicons
                  name={iconFor(n.type)}
                  size={18}
                  color={isBad(n.type) ? (n.is_read ? "#dc2626" : Colors.white) : n.is_read ? Colors.text : Colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.cardTitle, isBad(n.type) && styles.cardTitleBad]}>
                  {n.title}
                </ThemedText>
                <ThemedText style={styles.cardMessage}>{n.message}</ThemedText>
              </View>
              {!n.is_read && (
                <View style={[styles.unreadDot, isBad(n.type) && styles.unreadDotBad]} />
              )}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  loading: { marginTop: 60 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  emptyText: { color: Colors.text },
  errorText: { color: "#B00020", textAlign: "center" },
  markAllText: { color: Colors.gold, fontWeight: "700", fontSize: 13 },
  scrollContent: { padding: 20 },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  cardUnread: { backgroundColor: "#E8F0FE" },
  cardPressed: { opacity: 0.85 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapUnread: { backgroundColor: Colors.white },
  // Bad-news notifications (cancellations, rejections, failed uploads)
  // always read red, whether read or unread -- see BAD_TYPES above.
  iconWrapBad: { backgroundColor: "#fee2e2" },
  iconWrapBadUnread: { backgroundColor: "#dc2626" },
  cardTitle: { fontWeight: "700", color: Colors.dark, fontSize: 14, marginBottom: 3 },
  cardTitleBad: { color: "#b91c1c" },
  cardMessage: { color: Colors.text, fontSize: 12.5, lineHeight: 17 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginTop: 6 },
  unreadDotBad: { backgroundColor: "#dc2626" },
});
