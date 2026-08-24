// app/terms.tsx
// In-app Terms & Conditions, mirroring visa/terms.php's copy -- previously
// the app's "Terms of Service" row just opened that page in an external
// in-app browser via VISA_WEB_BASE_URL (the visa.heydreamtravel.com
// subdomain), which meant leaving the app (and occasionally 404ing/falling
// back to a Google search, see api/config.ts's history on that) instead of
// staying native. Kept as a static copy here rather than fetched from the
// website so the screen works offline and never depends on that subdomain.

import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { ScrollView, StyleSheet, View } from "react-native";

interface TermsSection {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
}

const SECTIONS: TermsSection[] = [
  {
    icon: "checkmark-done-outline",
    title: "1. Acceptance of Terms",
    paragraphs: [
      "Welcome to HeyDream Travel & Tours. By accessing, browsing, or using our website, or by booking any travel package, flight, accommodation, or service through our agency (whether online, by phone, or in-person), you explicitly agree to be bound by these Terms and Conditions (\"Terms\"). If you do not agree with any part of these Terms, you must not proceed with your booking or use of our services.",
      "We act as an agent on behalf of third-party suppliers (such as airlines, hotels, tour operators, and cruise lines). Your booking is subject to both our Terms and the specific terms and conditions of these respective suppliers.",
    ],
  },
  {
    icon: "calendar-outline",
    title: "2. Booking Procedures and Reservations",
    paragraphs: [
      "All bookings are strictly subject to availability at the time of processing. A booking is only considered confirmed once you receive a formal \"Booking Confirmation\" email or document from us, accompanied by an invoice or receipt.",
    ],
    bullets: [
      "You must be at least 18 years of age to make a booking.",
      "You are entirely responsible for ensuring that all names (exactly as they appear on passports/IDs), dates, and travel details are correct at the time of booking.",
      "Name changes after ticketing are generally not permitted by airlines and may result in the forfeiture of the ticket value.",
    ],
  },
  {
    icon: "pricetag-outline",
    title: "3. Pricing, Taxes, and Fees",
    paragraphs: [
      "Prices quoted on our website or by our travel consultants are subject to change without prior notice until full payment is received and the booking is ticketed or confirmed. Fluctuations in currency exchange rates, fuel surcharges, government taxes, and supplier tariffs can impact the final price.",
    ],
    bullets: [
      "Inclusions: Items included in your package will be explicitly stated in your itinerary. If it is not listed, it is not included.",
      "Exclusions: Unless otherwise stated, prices generally exclude personal expenses, tipping, optional tours, visa fees, travel insurance, and resort fees payable directly to the hotel.",
    ],
  },
  {
    icon: "card-outline",
    title: "4. Payment Terms",
    paragraphs: [
      "We require a downpayment (deposit) or full payment to secure a booking, depending on the promotion or supplier requirements. Specific payment deadlines will be outlined in your invoice.",
    ],
    bullets: [
      "Failure to pay the balance by the specified due date will result in automatic cancellation of the booking, and forfeiture of the initial deposit.",
      "We accept payments via bank transfer, major credit cards (subject to processing fees), and authorized e-wallets.",
      "In cases of fraudulent transactions or chargebacks, we reserve the right to cancel your booking and report the incident to authorities.",
    ],
  },
  {
    icon: "refresh-outline",
    title: "5. Cancellations, Refunds, and Alterations",
    paragraphs: [
      "Cancellations by You: Cancellation requests must be submitted in writing. Cancellation penalties apply and depend strictly on the policies of the third-party suppliers (airlines, hotels, etc.) and how close the cancellation is to the departure date. Promotional deals and low-cost carrier flights are generally 100% non-refundable.",
      "Cancellations by Us or Suppliers: We reserve the right to cancel a tour or booking due to insufficient participation, operational reasons, or unforeseen supplier issues. In such cases, we will offer an alternative date/package or a full refund of the amount paid to us. We are not liable for incidental expenses you may have incurred (e.g., non-refundable connecting flights, visa fees).",
    ],
  },
  {
    icon: "document-text-outline",
    title: "6. Travel Documents, Visas, and Passports",
    paragraphs: [
      "It is your sole responsibility to ensure you have all necessary travel documents. We accept no liability if you are denied boarding or entry into a country due to inadequate documentation.",
    ],
    bullets: [
      "Passports: Your passport must be valid for at least six (6) months beyond your intended return date.",
      "Visas: While we offer visa assistance services, the issuance of a visa is entirely at the discretion of the respective embassy or consulate. We cannot guarantee visa approval. Visa application fees and our processing fees are non-refundable, regardless of the outcome.",
    ],
  },
  {
    icon: "umbrella-outline",
    title: "7. Travel Insurance",
    paragraphs: [
      "We strongly recommend purchasing comprehensive travel insurance at the time of booking to cover unforeseen events such as medical emergencies, trip cancellations, lost baggage, or flight delays. If you choose to decline travel insurance, you assume full financial responsibility for any related losses or expenses.",
    ],
  },
  {
    icon: "medkit-outline",
    title: "8. Health, Safety, and Medical Conditions",
    paragraphs: [
      "You must ensure you are medically and physically fit to travel. Certain tours or destinations may have health requirements (e.g., specific vaccinations or PCR testing). It is your responsibility to consult with a medical professional regarding these requirements prior to travel.",
      "If you have a medical condition, disability, or dietary requirement, you must inform us at the time of booking so we can relay this to the suppliers. However, we cannot guarantee that all specific needs will be accommodated by third-party providers.",
    ],
  },
  {
    icon: "warning-outline",
    title: "9. Limitation of Liability",
    paragraphs: [
      "HeyDream Travel & Tours acts solely as an intermediary and agent for independent suppliers (airlines, transport operators, hotels, etc.). We do not own, manage, or control these suppliers. Therefore, we shall not be held liable for:",
    ],
    bullets: [
      "Any injury, damage, loss, accident, delay, or irregularity caused by the negligence, default, or omission of any supplier.",
      "Changes in itineraries, flight schedules, or accommodations initiated by the suppliers.",
      "Loss of enjoyment, mental distress, or incidental damages resulting from your travel arrangements.",
    ],
  },
  {
    icon: "flash-outline",
    title: "10. Force Majeure",
    paragraphs: [
      "We shall not be liable for any failure to perform our obligations, cancellations, or delays resulting from \"Force Majeure\" events. This includes, but is not limited to: acts of God, extreme weather conditions, natural disasters, war, terrorism, civil unrest, labor strikes, pandemics, epidemics, government mandates, border closures, or any other circumstances beyond our reasonable control.",
    ],
  },
  {
    icon: "laptop-outline",
    title: "11. Website Use and Intellectual Property",
    paragraphs: [
      "All content on this website, including text, graphics, logos, images, and software, is the property of HeyDream Travel & Tours or its content suppliers and is protected by intellectual property laws. You may not reproduce, distribute, or modify any content without our express written consent. Unauthorized use of this website may give rise to a claim for damages and/or be a criminal offense.",
    ],
  },
  {
    icon: "library-outline",
    title: "12. Governing Law and Dispute Resolution",
    paragraphs: [
      "These Terms and Conditions shall be governed by and construed in accordance with the laws of the Republic of the Philippines. Any disputes, claims, or controversies arising out of or relating to these Terms or your booking shall be subject to the exclusive jurisdiction of the competent courts of Pasig City, Philippines.",
    ],
  },
  {
    icon: "create-outline",
    title: "13. Amendments to Terms",
    paragraphs: [
      "We reserve the right to update or modify these Terms and Conditions at any time without prior notice. Any changes will be effective immediately upon posting on our website. Your continued use of our services following the posting of changes constitutes your acceptance of such changes.",
    ],
  },
  {
    icon: "mail-outline",
    title: "14. Contact Information",
    paragraphs: [
      "If you have any questions or concerns regarding these Terms and Conditions, please contact us:",
    ],
    bullets: [
      "HeyDream Travel & Tours Legal Department",
      "Email: legal@heydreamtravel.com",
      "Phone: 0945 776 4140",
      "Address: 3104 Tektite East Tower, Philippine Stock Exchange, Ortigas, Philippines",
    ],
  },
];

export default function TermsScreen() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScreenHeader title="Terms & Conditions" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText style={styles.lastUpdated}>Last Updated: April 23, 2026</ThemedText>
        {SECTIONS.map((s) => (
          <View key={s.title} style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons name={s.icon} size={18} color={Colors.gold} />
              <ThemedText style={styles.cardTitle}>{s.title}</ThemedText>
            </View>
            {s.paragraphs?.map((p, i) => (
              <ThemedText key={i} style={styles.paragraph}>
                {p}
              </ThemedText>
            ))}
            {s.bullets?.map((b, i) => (
              <View key={i} style={styles.bulletRow}>
                <ThemedText style={styles.bulletDot}>{"•"}</ThemedText>
                <ThemedText style={styles.bulletText}>{b}</ThemedText>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 20, paddingBottom: 40 },
  lastUpdated: { fontSize: 12, color: Colors.text, fontStyle: "italic", textAlign: "right", marginBottom: 16 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: Colors.black,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  cardTitle: { fontSize: 14.5, fontWeight: "800", color: Colors.dark, flex: 1 },
  paragraph: { fontSize: 13.5, lineHeight: 20, color: Colors.text, marginBottom: 8 },
  bulletRow: { flexDirection: "row", gap: 8, marginBottom: 6, paddingLeft: 2 },
  bulletDot: { fontSize: 13.5, color: Colors.primary },
  bulletText: { flex: 1, fontSize: 13.5, lineHeight: 19, color: Colors.text },
});
