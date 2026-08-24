// app/(tabs)/index.tsx
// Visa catalog home tab -- redesigned to match heydream-app's actual look
// (hero image + floating search pill, navy "package card" style listings
// with gold price/CTA) instead of a bare list. See heydream-app's
// app/(tabs)/index.tsx for the source of this visual language.

import { HeaderActions } from "@/components/header-actions";
import { ThemedText } from "@/components/themed-text";
import { useGateChoice } from "@/components/visa-gate";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import { useUnreadCount } from "@/hooks/use-unread-count";
import * as api from "@/api/client";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { choice, reopenGate } = useGateChoice();
  const direction = choice === "foreign_inbound" ? "inbound" : "outbound";
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const { unreadCount } = useUnreadCount();
  // Fixed at 240 regardless of device used to eat over a third of an iPhone
  // SE's screen (667pt tall) before any visa card was visible. Scaling with
  // window height keeps roughly the same proportion on tall phones while
  // shrinking it on short ones, clamped so it never gets cramped or huge.
  const { height: windowHeight } = useWindowDimensions();
  const heroHeight = Math.min(240, Math.max(190, windowHeight * 0.28));

  const load = useCallback(async () => {
    const result = await api.getVisaList(direction);
    if (result.success) {
      setGroups(result.data || []);
      setErrorMessage(null);
    } else {
      setErrorMessage(result.message || result.error || "Failed to load visas.");
    }
  }, [direction]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await load();
      setIsLoading(false);
    })();
    // Categories differ between directions (e.g. outbound's continents vs
    // inbound's countries) -- a category chip selected before switching
    // could match nothing in the new list, silently showing "no results"
    // instead of the full list.
    setActiveCategory(null);
  }, [load]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  const categories = groups.map((g) => g.category);
  const q = query.trim().toLowerCase();
  const visibleGroups = groups
    .filter((g) => !activeCategory || g.category === activeCategory)
    .map((g) => ({
      ...g,
      visas: g.visas.filter(
        (v) =>
          !q ||
          v.title.toLowerCase().includes(q) ||
          v.category.toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q)
      ),
    }))
    .filter((g) => g.visas.length > 0);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={[styles.hero, { height: heroHeight }]}>
        <Image
          source={{
            uri: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=900&h=600&fit=crop",
          }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
        />
        <View style={styles.heroOverlay} />
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroBrandRow}>
              <View style={styles.heroLogoBadge}>
                <Image
                  source={require("@/assets/images/heydream-logo.png")}
                  style={styles.heroLogoImage}
                  contentFit="contain"
                />
              </View>
              <View>
                <ThemedText style={styles.heroBrand}>HeyDream Visa</ThemedText>
                <ThemedText style={styles.heroTagline}>
                  {direction === "inbound" ? "Entering the Philippines" : "Your passport to the world"}
                </ThemedText>
              </View>
            </View>
            <HeaderActions unreadCount={unreadCount} variant="dark" />
          </View>
        </SafeAreaView>

        <Pressable
          style={({ pressed }) => [styles.gateSwitchPill, pressed && styles.gateSwitchPillPressed]}
          onPress={reopenGate}
        >
          <Ionicons name="swap-horizontal" size={13} color="#6C5CE7" />
          <ThemedText style={styles.gateSwitchPillText} numberOfLines={1}>
            {direction === "inbound"
              ? "Filipino traveling abroad instead?"
              : "Applying as a foreign visitor instead?"}
          </ThemedText>
        </Pressable>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={Colors.accent} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search a country or region..."
            placeholderTextColor="#999"
            value={query}
            onChangeText={setQuery}
          />
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loading} color={Colors.primary} />
      ) : errorMessage ? (
        <ThemedText style={styles.error}>{errorMessage}</ThemedText>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsRow}
            contentContainerStyle={styles.chipsContent}
          >
            <Pressable
              style={[styles.chip, !activeCategory && styles.chipActive]}
              onPress={() => setActiveCategory(null)}
            >
              <ThemedText style={[styles.chipText, !activeCategory && styles.chipTextActive]}>
                All
              </ThemedText>
            </Pressable>
            {categories.map((cat) => (
              <Pressable
                key={cat}
                style={[styles.chip, activeCategory === cat && styles.chipActive]}
                onPress={() => setActiveCategory(cat === activeCategory ? null : cat)}
              >
                <ThemedText
                  style={[styles.chipText, activeCategory === cat && styles.chipTextActive]}
                >
                  {cat}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>

          {visibleGroups.length === 0 ? (
            <ThemedText style={styles.empty}>No visas match your search.</ThemedText>
          ) : (
            visibleGroups.map((group) => (
              <View key={group.category} style={styles.categoryBlock}>
                <ThemedText style={styles.categoryTitle}>{group.category}</ThemedText>
                {group.visas.map((visa) => (
                  <Pressable
                    key={visa.id}
                    style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                    onPress={() => router.push(`/visa/${visa.id}?direction=${direction}`)}
                  >
                    <View style={styles.cardFlagWrap}>
                      {visa.icon_type === "image" && visa.icon_value ? (
                        <Image
                          source={{ uri: visa.icon_value }}
                          style={styles.cardFlag}
                          contentFit="cover"
                        />
                      ) : (
                        <Ionicons name="flag" size={24} color={Colors.white} />
                      )}
                    </View>
                    <View style={styles.cardBody}>
                      <ThemedText style={styles.cardTitle}>{visa.title}</ThemedText>
                      <ThemedText style={styles.cardDescription} numberOfLines={2}>
                        {visa.description}
                      </ThemedText>
                      <View style={styles.cardFooter}>
                        <View>
                          <ThemedText style={styles.cardFrom}>From</ThemedText>
                          <ThemedText style={styles.cardPrice}>{formatPrice(visa)}</ThemedText>
                        </View>
                        <View style={styles.cardButton}>
                          <ThemedText style={styles.cardButtonText}>APPLY NOW</ThemedText>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  hero: { overflow: "hidden" },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(13,71,161,0.55)" },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  heroBrandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroLogoBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
    padding: 5,
  },
  heroLogoImage: { width: "100%", height: "100%" },
  heroBrand: { color: Colors.white, fontSize: 22, fontWeight: "800" },
  heroTagline: { color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 2 },
  gateSwitchPill: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 7,
    maxWidth: "78%",
    backgroundColor: Colors.white,
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 14,
    marginBottom: 16,
    marginLeft: 20,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  gateSwitchPillPressed: { opacity: 0.85, transform: [{ translateY: -1 }] },
  gateSwitchPillText: { color: "#6C5CE7", fontSize: 12.5, fontWeight: "700" },
  searchWrap: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.dark },
  loading: { marginTop: 60 },
  error: { color: "#B00020", textAlign: "center", marginTop: 40, paddingHorizontal: 24 },
  empty: { color: Colors.text, textAlign: "center", marginTop: 20, paddingHorizontal: 24 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  chipsRow: { marginTop: 16 },
  chipsContent: { paddingHorizontal: 20, gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.lightGray,
  },
  chipActive: { backgroundColor: Colors.primary },
  chipText: { fontSize: 13, fontWeight: "600", color: Colors.text },
  chipTextActive: { color: Colors.white },
  categoryBlock: { marginTop: 20, paddingHorizontal: 20 },
  categoryTitle: { fontSize: 18, fontWeight: "800", color: Colors.dark, marginBottom: 12 },
  card: {
    flexDirection: "row",
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    gap: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  cardPressed: { opacity: 0.92 },
  cardFlagWrap: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardFlag: { width: "100%", height: "100%" },
  cardBody: { flex: 1 },
  cardTitle: { color: Colors.white, fontSize: 16, fontWeight: "800", marginBottom: 4 },
  cardDescription: { color: "rgba(255,255,255,0.8)", fontSize: 12, lineHeight: 16, marginBottom: 10 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardFrom: { color: "rgba(255,255,255,0.7)", fontSize: 9 },
  cardPrice: { color: Colors.gold, fontSize: 16, fontWeight: "800" },
  cardButton: { backgroundColor: Colors.gold, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  cardButtonText: { color: Colors.primary, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
});
