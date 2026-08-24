// app/visa/[id].tsx
// Mirrors visa/details.php's full customer-facing layout: type-filtered
// document checklist, processing options grouped by visa type with max-stay
// badges, important notes, disclaimer, and an Apply/Renew footer. Stay
// limits ARE shown here -- confirmed live on visa/details.php itself, so
// project_visa_required_only_sales's "never show stay-limit wording"
// applies to sales/marketing surfaces, not this details page.

import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import * as api from "@/api/client";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ProcessingOption {
  id: number;
  visa_type: string;
  label: string;
  processing_time: string;
  price: number;
}

interface RequirementItem {
  label: string;
  types: string[];
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
  supports_renewal?: number;
  visa_types?: string;
  stay_limits_by_type?: Record<string, number>;
}

function formatPrice(v: VisaDetails) {
  const min = v.price_min ?? v.price;
  const max = v.price_max ?? v.price;
  if (max > min) return `${v.currency}${min.toLocaleString()} - ${v.currency}${max.toLocaleString()}`;
  return `${v.currency}${min.toLocaleString()}`;
}

export default function VisaDetailsScreen() {
  const { id, direction: directionParam } = useLocalSearchParams<{ id: string; direction?: string }>();
  const direction = directionParam === "inbound" ? "inbound" : "outbound";
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [visa, setVisa] = useState<VisaDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeDocType, setActiveDocType] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const result = await api.getVisaDetails(id, direction);
      if (result.success) {
        setVisa(result.data);
        const firstType = (result.data.visa_types || "").split(",").map((t: string) => t.trim()).filter(Boolean)[0];
        setActiveDocType(firstType || null);
      } else {
        setErrorMessage(result.error || result.message || "Visa not found.");
      }
      setIsLoading(false);
    })();
  }, [id, direction]);

  const visaTypeList: string[] = useMemo(
    () => (visa?.visa_types || "").split(",").map((t) => t.trim()).filter(Boolean),
    [visa]
  );

  // requirements is either a legacy bare-string array or an array of
  // {label, types} objects (see lookupBookingRequiredDocuments in
  // config/email_functions.php). "*" in types means "applies to every type".
  const allRequirements: RequirementItem[] = useMemo(() => {
    if (!visa?.requirements) return [];
    try {
      const parsed = JSON.parse(visa.requirements);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((r: any) => (typeof r === "string" ? { label: r, types: ["*"] } : { label: r?.label, types: r?.types || ["*"] }))
        .filter((r: RequirementItem) => typeof r.label === "string" && r.label);
    } catch {
      return [];
    }
  }, [visa]);

  const visibleRequirements = useMemo(
    () =>
      allRequirements.filter(
        (r) => !activeDocType || r.types.includes("*") || r.types.includes(activeDocType)
      ),
    [allRequirements, activeDocType]
  );

  const groupedOptions = useMemo(() => {
    const groups = new Map<string, ProcessingOption[]>();
    (visa?.processing_options || []).forEach((opt) => {
      const list = groups.get(opt.visa_type) || [];
      list.push(opt);
      groups.set(opt.visa_type, list);
    });
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visa]);

  const handleApply = (renewal: boolean) => {
    if (!user) {
      router.push("/(auth)/login");
      return;
    }
    const params = `direction=${direction}${renewal ? "&renewal=1" : ""}`;
    router.push(`/apply/${id}?${params}`);
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

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="information-circle" size={18} color={Colors.gold} />
            <ThemedText style={styles.cardTitle}>Overview</ThemedText>
          </View>
          <ThemedText style={styles.description}>{visa.description}</ThemedText>
        </View>

        {allRequirements.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="document-text" size={18} color={Colors.gold} />
              <ThemedText style={styles.cardTitle}>Required Documents</ThemedText>
            </View>

            {visaTypeList.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeTabsRow}>
                {visaTypeList.map((t) => (
                  <Pressable
                    key={t}
                    style={[styles.typeTab, activeDocType === t && styles.typeTabActive]}
                    onPress={() => setActiveDocType(t)}
                  >
                    <ThemedText style={[styles.typeTabText, activeDocType === t && styles.typeTabTextActive]}>
                      {t}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {visibleRequirements.map((r, idx) => (
              <View key={idx} style={styles.requirementRow}>
                <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
                <ThemedText style={styles.requirement}>
                  {r.label}
                  {r.label === "Current Visa" && (
                    <ThemedText style={styles.renewalTag}> (Renewal)</ThemedText>
                  )}
                </ThemedText>
              </View>
            ))}
          </View>
        )}

        {groupedOptions.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="hourglass" size={18} color={Colors.gold} />
              <ThemedText style={styles.cardTitle}>Visa Types & Processing Options</ThemedText>
            </View>

            {groupedOptions.map(([type, options]) => (
              <View key={type} style={styles.typeGroup}>
                <View style={styles.typeGroupHeader}>
                  <ThemedText style={styles.typeGroupTitle}>{type}</ThemedText>
                  {!!visa.stay_limits_by_type?.[type] && (
                    <View style={styles.stayBadge}>
                      <ThemedText style={styles.stayBadgeText}>
                        Max Stay: {visa.stay_limits_by_type[type]} Days
                      </ThemedText>
                    </View>
                  )}
                </View>
                <View style={styles.optionTableHeader}>
                  <ThemedText style={[styles.optionTableHeaderText, { flex: 1.2 }]}>OPTION</ThemedText>
                  <ThemedText style={[styles.optionTableHeaderText, { flex: 1.4 }]}>TIME</ThemedText>
                  <ThemedText style={[styles.optionTableHeaderText, { textAlign: "right" }]}>PRICE</ThemedText>
                </View>
                {options.map((opt) => (
                  <View key={opt.id} style={styles.optionRow}>
                    <ThemedText style={[styles.optionLabel, { flex: 1.2 }]}>{opt.label}</ThemedText>
                    <ThemedText style={[styles.optionTime, { flex: 1.4 }]}>{opt.processing_time}</ThemedText>
                    <ThemedText style={styles.optionPrice}>
                      {visa.currency}
                      {Number(opt.price).toLocaleString()}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ))}
            <ThemedText style={styles.footnote}>
              Each option&apos;s price is its own total. You&apos;ll choose one of these when applying.
            </ThemedText>
          </View>
        )}

        {!!visa.important_notes && (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="alert-circle" size={18} color={Colors.gold} />
              <ThemedText style={styles.cardTitle}>Important Notes</ThemedText>
            </View>
            <ThemedText style={styles.description}>{visa.important_notes}</ThemedText>
          </View>
        )}

        {!!visa.disclaimer && (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="shield-checkmark" size={18} color={Colors.gold} />
              <ThemedText style={styles.cardTitle}>Disclaimer</ThemedText>
            </View>
            <ThemedText style={styles.description}>{visa.disclaimer}</ThemedText>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 18 + insets.bottom }]}>
        <ThemedText style={styles.footerPrice}>{formatPrice(visa)}</ThemedText>
        <ThemedText style={styles.footerPriceCaption}>
          per applicant -- exact fee depends on the type/tier you pick
        </ThemedText>
        <Pressable style={styles.applyButton} onPress={() => handleApply(false)}>
          <Ionicons name="flash" size={16} color={Colors.primary} />
          <ThemedText style={styles.applyButtonText}>Apply Now</ThemedText>
        </Pressable>
        {!!visa.supports_renewal && (
          <Pressable style={styles.renewButton} onPress={() => handleApply(true)}>
            <Ionicons name="sync" size={16} color={Colors.primary} />
            <ThemedText style={styles.renewButtonText}>Renew Visa</ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, backgroundColor: Colors.white },
  error: { color: "#B00020", textAlign: "center", padding: 24 },
  scrollContent: { padding: 20, paddingBottom: 220 },
  heroRow: { flexDirection: "row", gap: 14, marginBottom: 16, alignItems: "center" },
  heroImage: { width: 64, height: 64, borderRadius: 14 },
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
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: Colors.black,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: Colors.dark },
  description: { color: Colors.text, lineHeight: 21, fontSize: 14 },
  typeTabsRow: { marginBottom: 14 },
  typeTab: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
    backgroundColor: Colors.white,
  },
  typeTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeTabText: { fontSize: 12.5, fontWeight: "700", color: Colors.dark },
  typeTabTextActive: { color: Colors.white },
  requirementRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  requirement: { flex: 1, color: Colors.dark, lineHeight: 20, fontSize: 14 },
  renewalTag: { color: Colors.text, fontStyle: "italic", fontSize: 12.5 },
  typeGroup: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#eef1f6",
    borderRadius: 12,
    padding: 12,
  },
  typeGroupHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  typeGroupTitle: { fontSize: 14.5, fontWeight: "800", color: Colors.primary },
  stayBadge: { backgroundColor: "#E8F5E9", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3 },
  stayBadgeText: { color: "#2E7D32", fontSize: 10.5, fontWeight: "700" },
  optionTableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eef1f6",
    paddingBottom: 6,
    marginBottom: 4,
  },
  optionTableHeaderText: { fontSize: 10, fontWeight: "700", color: Colors.text, letterSpacing: 0.4 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f6f9",
  },
  optionLabel: { fontWeight: "600", color: Colors.dark, fontSize: 13.5 },
  optionTime: { color: Colors.text, fontSize: 12.5 },
  optionPrice: { color: Colors.primary, fontWeight: "800", fontSize: 13.5, textAlign: "right" },
  footnote: { color: Colors.text, fontSize: 12, fontStyle: "italic", marginTop: 2 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 18,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
    backgroundColor: Colors.white,
  },
  footerPrice: { color: Colors.gold === "#FFD700" ? "#B8860B" : Colors.gold, fontSize: 20, fontWeight: "900" },
  footerPriceCaption: { color: Colors.text, fontSize: 11.5, marginTop: 2, marginBottom: 10 },
  applyButton: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: Colors.gold,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  applyButtonText: { color: Colors.primary, fontWeight: "800", fontSize: 15 },
  renewButton: {
    flexDirection: "row",
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    backgroundColor: Colors.white,
  },
  renewButtonText: { color: Colors.primary, fontWeight: "800", fontSize: 14 },
});
