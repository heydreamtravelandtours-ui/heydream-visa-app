// components/visa-gate.tsx
// Mirrors visa/index.php's "Who's applying?" direction gate exactly:
// Filipino Traveling Abroad -> straight into the app (remembered), Foreign
// Visitor to the Philippines -> Coming Soon panel with an email fallback,
// since the catalog is PH-outbound only. Choice persisted the same way the
// website does (localStorage there, AsyncStorage here) so a returning
// Filipino user never sees this again.

import { Colors } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const GATE_CHOICE_KEY = "heydream_visa_gate_choice_v1";

export function useGateChoice() {
  const [choice, setChoice] = useState<"ph_outbound" | null | "unknown">("unknown");

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(GATE_CHOICE_KEY);
      setChoice(stored === "ph_outbound" ? "ph_outbound" : null);
    })();
  }, []);

  const choosePhOutbound = async () => {
    await AsyncStorage.setItem(GATE_CHOICE_KEY, "ph_outbound");
    setChoice("ph_outbound");
  };

  return { choice, choosePhOutbound };
}

export function VisaGate({ onChoose }: { onChoose: () => void }) {
  const [view, setView] = useState<"picker" | "coming-soon">("picker");

  if (view === "coming-soon") {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.comingSoon}>
          <View style={styles.comingSoonIconWrap}>
            <Ionicons name="airplane" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.comingSoonTitle}>Coming Soon</Text>
          <Text style={styles.comingSoonText}>
            We&apos;re not yet processing Philippine visas for foreign visitors online,
            but our team can still help you directly.
          </Text>
          <Pressable
            style={styles.emailButton}
            onPress={() =>
              Linking.openURL(
                "mailto:heydreamtravelandtours@gmail.com?subject=Foreign%20Visitor%20Visa%20Inquiry"
              )
            }
          >
            <Ionicons name="mail" size={18} color={Colors.white} />
            <Text style={styles.emailButtonText}>Email Us Directly</Text>
          </Pressable>
          <Pressable style={styles.backButton} onPress={() => setView("picker")}>
            <Ionicons name="arrow-back" size={16} color={Colors.text} />
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.brand}>
        <View style={styles.logoBadge}>
          <Ionicons name="airplane" size={22} color={Colors.primary} />
        </View>
        <Text style={styles.brandText}>HeyDream Visa</Text>
      </View>

      <Text style={styles.title}>Who&apos;s applying?</Text>
      <Text style={styles.subtitle}>
        Tell us which one you are so we can show you the right visa options.
      </Text>

      <View style={styles.cards}>
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={onChoose}
        >
          <Image
            source={{ uri: "https://flagcdn.com/w320/ph.png" }}
            style={styles.cardImage}
            contentFit="cover"
          />
          <View style={styles.cardOverlay} />
          <View style={styles.cardBody}>
            <View style={styles.cardIconWrap}>
              <Ionicons name="document-text" size={20} color={Colors.white} />
            </View>
            <Text style={styles.cardTitle}>Filipino Traveling Abroad</Text>
            <Text style={styles.cardDesc}>
              Philippine passport holder applying for a visa to visit another country.
            </Text>
            <View style={styles.cardCta}>
              <Text style={styles.cardCtaText}>Get Started</Text>
              <Ionicons name="arrow-forward" size={14} color={Colors.gold} />
            </View>
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => setView("coming-soon")}
        >
          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1518509562904-e7ef99cddff9?w=600&h=400&fit=crop",
            }}
            style={styles.cardImage}
            contentFit="cover"
          />
          <View style={styles.cardOverlay} />
          <View style={styles.cardBody}>
            <View style={styles.cardIconWrap}>
              <Ionicons name="airplane" size={20} color={Colors.white} />
            </View>
            <Text style={styles.cardTitle}>Foreign Visitor to the Philippines</Text>
            <Text style={styles.cardDesc}>
              Non-Filipino traveler applying for a visa to enter the Philippines.
            </Text>
            <View style={styles.cardCta}>
              <Text style={styles.cardCtaText}>Get Started</Text>
              <Ionicons name="arrow-forward" size={14} color={Colors.gold} />
            </View>
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary, padding: 24, justifyContent: "center" },
  brand: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 40 },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: { color: Colors.white, fontSize: 18, fontWeight: "700" },
  title: { color: Colors.white, fontSize: 28, fontWeight: "800", marginBottom: 8 },
  subtitle: { color: "rgba(255,255,255,0.8)", fontSize: 15, lineHeight: 21, marginBottom: 28 },
  cards: { gap: 16 },
  card: {
    height: 190,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: Colors.dark,
  },
  cardPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  cardImage: { ...StyleSheet.absoluteFillObject },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(13,71,161,0.55)",
  },
  cardBody: { flex: 1, padding: 18, justifyContent: "flex-end" },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  cardTitle: { color: Colors.white, fontSize: 18, fontWeight: "800", marginBottom: 4 },
  cardDesc: { color: "rgba(255,255,255,0.85)", fontSize: 12.5, lineHeight: 17, marginBottom: 10 },
  cardCta: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardCtaText: { color: Colors.gold, fontWeight: "700", fontSize: 13 },
  comingSoon: { alignItems: "center", padding: 12 },
  comingSoonIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  comingSoonTitle: { color: Colors.white, fontSize: 24, fontWeight: "800", marginBottom: 10 },
  comingSoonText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 24,
  },
  emailButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.gold,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  emailButtonText: { color: Colors.primary, fontWeight: "700", fontSize: 15 },
  backButton: { flexDirection: "row", alignItems: "center", gap: 6, padding: 8 },
  backButtonText: { color: "rgba(255,255,255,0.8)", fontSize: 14 },
});
