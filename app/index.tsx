// app/index.tsx
// Visa catalog, grouped by category -- mirrors visa/index.php's card fields
// exactly (icon/flag, title, visa_types pills, description, price range).
// Deliberately never renders `processing_time` or `visa_status`: those
// columns carry admin-only "visa-free"/stay-limit wording that must not
// reach customer-facing sales pages (see project_visa_required_only_sales).

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import * as api from "@/api/client";
import { Image } from "expo-image";
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

interface Visa {
  id: number;
  title: string;
  category: string;
  description: string;
  currency: string;
  price: number;
  price_min: number;
  price_max: number;
  icon_type: string;
  icon_value: string;
  visa_types?: string;
  supports_renewal?: number;
}

interface CategoryGroup {
  category: string;
  visas: Visa[];
}

function formatPrice(v: Visa) {
  const min = v.price_min ?? v.price;
  const max = v.price_max ?? v.price;
  if (max > min) return `${v.currency}${min.toLocaleString()} - ${v.currency}${max.toLocaleString()}`;
  return `${v.currency}${min.toLocaleString()}`;
}

export default function VisaCatalogScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await api.getVisaList();
    if (result.success) {
      setGroups(result.data || []);
      setErrorMessage(null);
    } else {
      setErrorMessage(result.message || result.error || "Failed to load visas.");
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
        <ThemedText type="title">HeyDream Visa</ThemedText>
        {user ? (
          <View style={styles.headerActions}>
            <Pressable onPress={() => router.push("/my-applications")}>
              <ThemedText style={styles.headerLink}>My Applications</ThemedText>
            </Pressable>
            <Pressable onPress={logout}>
              <ThemedText style={styles.headerLink}>Log Out</ThemedText>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => router.push("/(auth)/login")}>
            <ThemedText style={styles.headerLink}>Log In</ThemedText>
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loading} color={Colors.primary} />
      ) : errorMessage ? (
        <ThemedText style={styles.error}>{errorMessage}</ThemedText>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        >
          {groups.map((group) => (
            <View key={group.category} style={styles.categoryBlock}>
              <ThemedText type="subtitle" style={styles.categoryTitle}>
                {group.category}
              </ThemedText>
              {group.visas.map((visa) => (
                <Pressable
                  key={visa.id}
                  style={styles.card}
                  onPress={() => router.push(`/visa/${visa.id}`)}
                >
                  {visa.icon_type === "image" && visa.icon_value ? (
                    <Image source={{ uri: visa.icon_value }} style={styles.icon} contentFit="cover" />
                  ) : (
                    <View style={[styles.icon, styles.iconPlaceholder]} />
                  )}
                  <View style={styles.cardBody}>
                    <ThemedText type="defaultSemiBold">{visa.title}</ThemedText>
                    <ThemedText numberOfLines={2} style={styles.cardDescription}>
                      {visa.description}
                    </ThemedText>
                    <ThemedText style={styles.cardPrice}>{formatPrice(visa)}</ThemedText>
                  </View>
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerActions: { flexDirection: "row", gap: 16 },
  headerLink: { color: Colors.primary, fontWeight: "600" },
  loading: { marginTop: 60 },
  error: { color: "#B00020", textAlign: "center", marginTop: 60, paddingHorizontal: 24 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  categoryBlock: { marginBottom: 24 },
  categoryTitle: { marginBottom: 12 },
  card: {
    flexDirection: "row",
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 12,
    shadowColor: Colors.black,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  icon: { width: 48, height: 48, borderRadius: 8 },
  iconPlaceholder: { backgroundColor: Colors.lightGray },
  cardBody: { flex: 1, justifyContent: "center" },
  cardDescription: { color: Colors.text, fontSize: 13, marginTop: 2 },
  cardPrice: { color: Colors.primary, fontWeight: "600", marginTop: 4 },
});
