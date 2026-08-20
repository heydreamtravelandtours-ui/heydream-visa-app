// app/(tabs)/applications.tsx
// "My Applications" tab -- status-colored badges, card list matching the
// rest of the app's rounded/shadowed card language.

import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import * as api from "@/api/client";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface Booking {
  booking_number: string;
  package_name: string;
  package_duration: string;
  travel_date: string;
  number_of_travelers: number;
  total_amount: number;
  currency: string;
  booking_status: string;
  payment_status: string;
  visa_type_selected: string | null;
  is_renewal: number;
}

function statusStyle(status: string) {
  switch (status) {
    case "confirmed":
      return { bg: "#E8F5E9", fg: "#2E7D32" };
    case "cancelled":
      return { bg: "#FDECEA", fg: "#B00020" };
    case "completed":
      return { bg: "#E3F2FD", fg: "#1565C0" };
    default:
      return { bg: "#FFF3E0", fg: Colors.accent };
  }
}

export default function ApplicationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setBookings([]);
      setIsLoading(false);
      return;
    }
    const result = await api.getMyVisaBookings();
    if (result.success) {
      setBookings(result.data || []);
      setErrorMessage(null);
    } else {
      setErrorMessage(result.message || result.error || "Failed to load applications.");
    }
    setIsLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.headerSafe}>
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>My Applications</ThemedText>
        </View>
      </SafeAreaView>

      {!user ? (
        <View style={styles.centered}>
          <Ionicons name="lock-closed-outline" size={40} color={Colors.text} />
          <ThemedText style={styles.emptyTitle}>Log in to see your applications</ThemedText>
          <Pressable style={styles.loginButton} onPress={() => router.push("/(auth)/login")}>
            <ThemedText style={styles.loginButtonText}>Log In</ThemedText>
          </Pressable>
        </View>
      ) : isLoading ? (
        <ActivityIndicator style={styles.loading} color={Colors.primary} />
      ) : errorMessage ? (
        <ThemedText style={styles.error}>{errorMessage}</ThemedText>
      ) : bookings.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="document-text-outline" size={40} color={Colors.text} />
          <ThemedText style={styles.emptyTitle}>No applications yet</ThemedText>
          <ThemedText style={styles.emptyText}>
            Browse the catalog and apply for your first visa.
          </ThemedText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        >
          {bookings.map((b) => {
            const s = statusStyle(b.booking_status);
            return (
              <Pressable
                key={b.booking_number}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                onPress={() => router.push(`/application/${b.booking_number}`)}
              >
                <View style={styles.cardIconWrap}>
                  <Ionicons name="document-text" size={22} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTitleRow}>
                    <ThemedText style={styles.cardTitle}>{b.package_name}</ThemedText>
                    {!!b.is_renewal && (
                      <View style={styles.renewalTag}>
                        <ThemedText style={styles.renewalTagText}>Renewal</ThemedText>
                      </View>
                    )}
                  </View>
                  {!!b.visa_type_selected && (
                    <ThemedText style={styles.cardType}>{b.visa_type_selected}</ThemedText>
                  )}
                  <ThemedText style={styles.cardSub}>
                    {b.currency}
                    {Number(b.total_amount).toLocaleString()} • {b.number_of_travelers} guest(s) • {b.booking_number}
                  </ThemedText>
                </View>
                <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
                  <ThemedText style={[styles.statusText, { color: s.fg }]}>
                    {b.booking_status}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerSafe: { backgroundColor: Colors.white },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: "800", color: Colors.dark },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: Colors.dark },
  emptyText: { color: Colors.text, textAlign: "center", lineHeight: 20 },
  loginButton: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  loginButtonText: { color: Colors.white, fontWeight: "700" },
  loading: { marginTop: 60 },
  error: { color: "#B00020", textAlign: "center", marginTop: 60, paddingHorizontal: 24 },
  scrollContent: { padding: 20 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: Colors.black,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardPressed: { opacity: 0.9 },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#E8F0FE",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: Colors.dark },
  cardType: { color: Colors.primary, fontSize: 11.5, fontWeight: "600", marginTop: 2 },
  cardSub: { color: Colors.text, fontSize: 12, marginTop: 3 },
  renewalTag: { backgroundColor: "#FFF3E0", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  renewalTagText: { color: Colors.accent, fontSize: 9.5, fontWeight: "700" },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  statusText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
});
