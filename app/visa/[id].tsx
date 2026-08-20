// app/visa/[id].tsx
// Mirrors visa/details.php's customer-facing fields only. The details API
// (api/get-visa-details.php) also returns `stay_limits_by_type` for admin's
// package-preview table -- intentionally never read here, per
// project_visa_required_only_sales (no "visa-free"/stay-limit wording on
// customer sales pages).

import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import * as api from "@/api/client";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

interface ProcessingOption {
  id: number;
  visa_type: string;
  label: string;
  processing_time: string;
  price: number;
}

interface VisaDetails {
  id: number;
  title: string;
  category: string;
  description: string;
  currency: string;
  price: number;
  price_min?: number;
  price_max?: number;
  icon_type: string;
  icon_value: string;
  requirements?: string;
  disclaimer?: string;
  important_notes?: string;
  processing_options: ProcessingOption[];
}

export default function VisaDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [visa, setVisa] = useState<VisaDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const result = await api.getVisaDetails(id);
      if (result.success) {
        setVisa(result.data);
      } else {
        setErrorMessage(result.error || result.message || "Visa not found.");
      }
      setIsLoading(false);
    })();
  }, [id]);

  // requirements is either a legacy bare-string array or an array of
  // {label, types} objects (see lookupBookingRequiredDocuments in
  // config/email_functions.php) -- normalize both to plain label strings.
  // "Current Visa" is renewal-only and added server-side once a visa type
  // is chosen, so it's filtered out of this pre-application preview.
  const requirements: string[] = (() => {
    if (!visa?.requirements) return [];
    try {
      const parsed = JSON.parse(visa.requirements);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((r: any) => (typeof r === "string" ? r : r?.label))
        .filter((label: any) => typeof label === "string" && label && label !== "Current Visa");
    } catch {
      return [];
    }
  })();

  const handleApply = () => {
    if (!user) {
      router.push("/(auth)/login");
      return;
    }
    router.push(`/apply/${id}`);
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <StatusBar style="light" />
        <ScreenHeader title="Visa Details" />
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (errorMessage || !visa) {
    return (
      <View style={styles.centered}>
        <StatusBar style="light" />
        <ScreenHeader title="Visa Details" />
        <ThemedText style={styles.error}>{errorMessage}</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScreenHeader title={visa.title} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroRow}>
          {visa.icon_type === "image" && visa.icon_value ? (
            <Image source={{ uri: visa.icon_value }} style={styles.heroImage} contentFit="cover" />
          ) : (
            <View style={[styles.heroImage, styles.heroImagePlaceholder]} />
          )}
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.title}>{visa.title}</ThemedText>
            <View style={styles.categoryPill}>
              <ThemedText style={styles.categoryPillText}>{visa.category}</ThemedText>
            </View>
          </View>
        </View>

        <ThemedText style={styles.description}>{visa.description}</ThemedText>

        {visa.processing_options?.length > 0 && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Processing Options</ThemedText>
            {visa.processing_options.map((opt) => (
              <View key={opt.id} style={styles.optionRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.optionLabel}>{opt.label || opt.visa_type}</ThemedText>
                </View>
                <ThemedText style={styles.optionPrice}>
                  {visa.currency}
                  {Number(opt.price).toLocaleString()}
                </ThemedText>
              </View>
            ))}
          </View>
        )}

        {requirements.length > 0 && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Requirements</ThemedText>
            {requirements.map((req, idx) => (
              <View key={idx} style={styles.requirementRow}>
                <View style={styles.requirementDot} />
                <ThemedText style={styles.requirement}>{req}</ThemedText>
              </View>
            ))}
          </View>
        )}

        {!!visa.important_notes && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Important Notes</ThemedText>
            <ThemedText style={styles.description}>{visa.important_notes}</ThemedText>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.applyButton} onPress={handleApply}>
          <ThemedText style={styles.applyButtonText}>Apply Now</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  centered: { flex: 1, backgroundColor: Colors.white },
  error: { color: "#B00020", textAlign: "center", padding: 24 },
  scrollContent: { padding: 20, paddingBottom: 110 },
  heroRow: { flexDirection: "row", gap: 14, marginBottom: 16 },
  heroImage: { width: 72, height: 72, borderRadius: 14 },
  heroImagePlaceholder: { backgroundColor: Colors.lightGray },
  title: { fontSize: 22, fontWeight: "800", color: Colors.dark, marginBottom: 6 },
  categoryPill: {
    alignSelf: "flex-start",
    backgroundColor: "#E8F0FE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  categoryPillText: { color: Colors.primary, fontSize: 11, fontWeight: "700" },
  description: { color: Colors.text, lineHeight: 22, marginBottom: 16, fontSize: 14 },
  section: { marginTop: 12, marginBottom: 8 },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: Colors.dark, marginBottom: 12 },
  optionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },
  optionLabel: { fontWeight: "600", color: Colors.dark, fontSize: 14 },
  optionPrice: { color: Colors.primary, fontWeight: "800" },
  requirementRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  requirementDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
    marginTop: 7,
  },
  requirement: { flex: 1, color: Colors.text, lineHeight: 20, fontSize: 14 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
    backgroundColor: Colors.white,
  },
  applyButton: {
    backgroundColor: Colors.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  applyButtonText: { color: Colors.primary, fontWeight: "800", fontSize: 16 },
});
