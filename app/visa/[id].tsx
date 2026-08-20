// app/visa/[id].tsx
// Mirrors visa/details.php's customer-facing fields only. The details API
// (api/get-visa-details.php) also returns `stay_limits_by_type` for admin's
// package-preview table -- intentionally never read here, per
// project_visa_required_only_sales (no "visa-free"/stay-limit wording on
// customer sales pages).

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import * as api from "@/api/client";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
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
      <ThemedView style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </ThemedView>
    );
  }

  if (errorMessage || !visa) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText style={styles.error}>{errorMessage}</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          {visa.icon_type === "image" && visa.icon_value ? (
            <Image source={{ uri: visa.icon_value }} style={styles.icon} contentFit="cover" />
          ) : (
            <View style={[styles.icon, styles.iconPlaceholder]} />
          )}
          <View style={{ flex: 1 }}>
            <ThemedText type="title">{visa.title}</ThemedText>
            <ThemedText style={styles.category}>{visa.category}</ThemedText>
          </View>
        </View>

        <ThemedText style={styles.description}>{visa.description}</ThemedText>

        {visa.processing_options?.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Processing Options
            </ThemedText>
            {visa.processing_options.map((opt) => (
              <View key={opt.id} style={styles.optionRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="defaultSemiBold">{opt.label || opt.visa_type}</ThemedText>
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
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Requirements
            </ThemedText>
            {requirements.map((req, idx) => (
              <ThemedText key={idx} style={styles.requirement}>
                • {req}
              </ThemedText>
            ))}
          </View>
        )}

        {visa.important_notes && (
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Important Notes
            </ThemedText>
            <ThemedText style={styles.description}>{visa.important_notes}</ThemedText>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.applyButton} onPress={handleApply}>
          <ThemedText style={styles.applyButtonText}>Apply Now</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  error: { color: "#B00020", textAlign: "center" },
  scrollContent: { padding: 20, paddingBottom: 100 },
  headerRow: { flexDirection: "row", gap: 14, marginBottom: 16 },
  icon: { width: 64, height: 64, borderRadius: 10 },
  iconPlaceholder: { backgroundColor: Colors.lightGray },
  category: { color: Colors.text, marginTop: 4 },
  description: { color: Colors.text, lineHeight: 22, marginBottom: 16 },
  section: { marginTop: 12, marginBottom: 8 },
  sectionTitle: { marginBottom: 10, fontSize: 18 },
  optionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  optionPrice: { color: Colors.primary, fontWeight: "700" },
  requirement: { color: Colors.text, marginBottom: 6, lineHeight: 20 },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
    backgroundColor: Colors.white,
  },
  applyButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
  },
  applyButtonText: { color: Colors.white, fontWeight: "700", fontSize: 16 },
});
