// app/my-applications.tsx
// List from api/get-my-visa-bookings.php (already scoped server-side to
// this user's visa bookings only).

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import * as api from "@/api/client";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

interface Booking {
  booking_number: string;
  package_name: string;
  travel_date: string;
  total_amount: number;
  currency: string;
  booking_status: string;
  payment_status: string;
  visa_status: string;
  created_at: string;
}

function statusColor(status: string) {
  switch (status) {
    case "confirmed":
      return "#2E7D32";
    case "cancelled":
      return "#B00020";
    case "completed":
      return "#1565C0";
    default:
      return Colors.accent;
  }
}

export default function MyApplicationsScreen() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await api.getMyVisaBookings();
    if (result.success) {
      setBookings(result.data || []);
      setErrorMessage(null);
    } else {
      setErrorMessage(result.message || result.error || "Failed to load applications.");
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

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">My Applications</ThemedText>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loading} color={Colors.primary} />
      ) : errorMessage ? (
        <ThemedText style={styles.error}>{errorMessage}</ThemedText>
      ) : bookings.length === 0 ? (
        <ThemedText style={styles.empty}>
          You haven&apos;t applied for a visa yet.
        </ThemedText>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        >
          {bookings.map((b) => (
            <Pressable
              key={b.booking_number}
              style={styles.card}
              onPress={() => router.push(`/application/${b.booking_number}`)}
            >
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold">{b.package_name}</ThemedText>
                <ThemedText style={styles.cardSub}>
                  {b.currency}
                  {Number(b.total_amount).toLocaleString()} • {b.booking_number}
                </ThemedText>
              </View>
              <ThemedText style={[styles.status, { color: statusColor(b.booking_status) }]}>
                {b.booking_status}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  loading: { marginTop: 60 },
  error: { color: "#B00020", textAlign: "center", marginTop: 60, paddingHorizontal: 24 },
  empty: { color: Colors.text, textAlign: "center", marginTop: 60, paddingHorizontal: 24 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: Colors.black,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardSub: { color: Colors.text, fontSize: 13, marginTop: 4 },
  status: { fontWeight: "700", fontSize: 12, textTransform: "uppercase" },
});
