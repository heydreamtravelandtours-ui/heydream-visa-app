// components/visa-gate.tsx
// Mirrors visa/index.php's "Who's applying?" direction gate exactly:
// Filipino Traveling Abroad -> outbound catalog, Foreign Visitor to the
// Philippines -> inbound catalog (visitor_visas table, see get-visa-list.php/
// get-visa-details.php's direction param). Choice persisted the same way the
// website does (localStorage there, AsyncStorage here) so a returning user
// never sees this again -- BUT the website also keeps a permanent "switch"
// pill in its hero (reopenDirectionGate() in visa/index.php) so the gate is
// never a one-way door; the Home tab's pill mirrors that here. This context
// (rather than a plain hook) exists so that pill, living deep in the tabs
// navigator, can reopen the exact same gate instance the root layout renders.

import { Colors } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { createContext, useContext, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const GATE_CHOICE_KEY = "heydream_visa_gate_choice_v1";

export type GateChoice = "ph_outbound" | "foreign_inbound";

interface GateContextType {
  choice: GateChoice | null | "unknown";
  choosePhOutbound: () => Promise<void>;
  chooseForeignInbound: () => Promise<void>;
  reopenGate: () => void;
}

const GateContext = createContext<GateContextType | undefined>(undefined);

export function GateProvider({ children }: { children: React.ReactNode }) {
  const [choice, setChoice] = useState<GateChoice | null | "unknown">("unknown");

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(GATE_CHOICE_KEY);
      setChoice(stored === "ph_outbound" || stored === "foreign_inbound" ? stored : null);
    })();
  }, []);

  const choosePhOutbound = async () => {
    await AsyncStorage.setItem(GATE_CHOICE_KEY, "ph_outbound");
    setChoice("ph_outbound");
  };

  const chooseForeignInbound = async () => {
    await AsyncStorage.setItem(GATE_CHOICE_KEY, "foreign_inbound");
    setChoice("foreign_inbound");
  };

  // Mirrors reopenDirectionGate() -- doesn't clear the stored choice (a
  // re-tap of the same card just re-confirms the same value), it only
  // re-shows the gate UI on top of whatever's currently open.
  const reopenGate = () => setChoice(null);

  return (
    <GateContext.Provider value={{ choice, choosePhOutbound, chooseForeignInbound, reopenGate }}>
      {children}
    </GateContext.Provider>
  );
}

export function useGateChoice(): GateContextType {
  const ctx = useContext(GateContext);
  if (!ctx) throw new Error("useGateChoice must be used within GateProvider");
  return ctx;
}

export function VisaGate({
  onChoosePhOutbound,
  onChooseForeignInbound,
}: {
  onChoosePhOutbound: () => void;
  onChooseForeignInbound: () => void;
}) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.brand}>
        <View style={styles.logoBadge}>
          <Image
            source={require("../assets/images/heydream-logo.png")}
            style={styles.logoImage}
            contentFit="contain"
          />
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
          onPress={onChoosePhOutbound}
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
          onPress={onChooseForeignInbound}
        >
          <Image
            source={{ uri: "https://flagcdn.com/w640/ph.png" }}
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
    padding: 6,
  },
  logoImage: { width: "100%", height: "100%" },
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
});
