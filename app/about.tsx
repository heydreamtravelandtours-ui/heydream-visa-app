// app/about.tsx
// Mirrors visa/about.php's story/mission/vision copy -- previously nowhere
// in the app.

import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { ScrollView, StyleSheet, View } from "react-native";

export default function AboutScreen() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScreenHeader title="About Us" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.logoWrap}>
          <Image
            source={require("@/assets/images/heydream-logo.png")}
            style={styles.logo}
            contentFit="contain"
          />
        </View>
        <ThemedText style={styles.brand}>HeyDream Travel & Tours</ThemedText>
        <ThemedText style={styles.tagline}>Making Travel Easy, Affordable, and Memorable.</ThemedText>

        <View style={styles.card}>
          <ThemedText style={styles.paragraph}>
            HeyDream Travel and Tours is a modern travel agency based in the Philippines dedicated to
            providing seamless travel solutions for individuals, families, and corporate clients. Our
            company focuses on delivering reliable travel services with competitive pricing and
            personalized customer support.
          </ThemedText>
          <ThemedText style={[styles.paragraph, { marginTop: 12 }]}>
            We specialize in international and domestic travel packages, airline ticketing, visa
            assistance, hotel reservations, and customized travel planning. Our goal is to make travel
            planning convenient, efficient, and enjoyable.
          </ThemedText>
        </View>

        <View style={styles.mvRow}>
          <View style={styles.mvCard}>
            <Ionicons name="locate" size={22} color={Colors.gold} />
            <ThemedText style={styles.mvTitle}>Mission</ThemedText>
            <ThemedText style={styles.mvItem}>• Provide reliable and affordable travel services.</ThemedText>
            <ThemedText style={styles.mvItem}>• Create personalized travel experiences for every client.</ThemedText>
            <ThemedText style={styles.mvItem}>• Build strong partnerships with international travel suppliers.</ThemedText>
            <ThemedText style={styles.mvItem}>• Maintain excellent customer service and travel support.</ThemedText>
          </View>
          <View style={styles.mvCard}>
            <Ionicons name="eye" size={22} color={Colors.gold} />
            <ThemedText style={styles.mvTitle}>Vision</ThemedText>
            <ThemedText style={styles.mvItem}>
              To become a trusted and recognized travel agency known for delivering excellent travel
              services and unforgettable experiences worldwide.
            </ThemedText>
          </View>
        </View>

        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>Contact</ThemedText>
          <ContactRow icon="location-outline" text="3104 Tektite East Tower, Philippine Stock Exchange" />
          <ContactRow icon="call-outline" text="0945 776 4140" />
          <ContactRow icon="mail-outline" text="heydreamtravelandtours@gmail.com" />
          <ContactRow icon="time-outline" text="Mon-Fri: 9AM-6PM, Sat: 9AM-1PM" />
        </View>
      </ScrollView>
    </View>
  );
}

function ContactRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.contactRow}>
      <Ionicons name={icon} size={16} color={Colors.primary} />
      <ThemedText style={styles.contactText}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 20, paddingBottom: 40, alignItems: "center" },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    marginBottom: 12,
  },
  logo: { width: "100%", height: "100%" },
  brand: { fontSize: 20, fontWeight: "800", color: Colors.dark, textAlign: "center" },
  tagline: { fontSize: 13, color: Colors.text, marginTop: 4, marginBottom: 20, textAlign: "center" },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 18,
    width: "100%",
    marginBottom: 16,
    shadowColor: Colors.black,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardTitle: { fontSize: 15, fontWeight: "800", color: Colors.dark, marginBottom: 10 },
  paragraph: { fontSize: 13.5, lineHeight: 20, color: Colors.text },
  mvRow: { flexDirection: "row", gap: 12, width: "100%", marginBottom: 16 },
  mvCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    shadowColor: Colors.black,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  mvTitle: { fontSize: 13.5, fontWeight: "800", color: Colors.dark, marginTop: 8, marginBottom: 6 },
  mvItem: { fontSize: 11.5, lineHeight: 16, color: Colors.text, marginBottom: 3 },
  contactRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  contactText: { fontSize: 13, color: Colors.dark, flex: 1 },
});
