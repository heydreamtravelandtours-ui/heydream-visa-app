// app/documents/upload.tsx
// Uploads against visa/api/upload-api.php (action=upload), matching the
// exact form fields js/visa-booking.js's uploadVisaDocuments() sends:
// document, booking_number, document_label, traveler_index.
//
// The document checklist itself comes from get-my-visa-bookings.php's
// per-booking `required_documents` field (a newline-joined string), not by
// re-reading the visa's raw `requirements` JSON here -- the backend
// (lookupBookingRequiredDocuments in config/email_functions.php) already
// filters that JSON down to the applicant's chosen visa_type_selected and
// adds "Current Visa" for renewals, so re-deriving it client-side would
// drift from what the backend/admin actually expects for this booking.

import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import * as api from "@/api/client";
import { appendFileToFormData } from "@/api/form-file";
import { showAlert } from "@/utils/cross-alert";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

export default function UploadDocumentsScreen() {
  const { bookingNumber } = useLocalSearchParams<{
    bookingNumber: string;
    visaId: string;
  }>();
  const router = useRouter();

  const [requirements, setRequirements] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadedLabels, setUploadedLabels] = useState<Set<string>>(new Set());
  const [uploadingLabel, setUploadingLabel] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const result = await api.getMyVisaBookings();
      if (result.success) {
        const booking = (result.data || []).find(
          (b: any) => b.booking_number === bookingNumber
        );
        const doc = (booking?.required_documents || "") as string;
        setRequirements(
          doc
            .split("\n")
            .map((label: string) => label.trim())
            .filter(Boolean)
        );
      }
      setIsLoading(false);
    })();
  }, [bookingNumber]);

  const handlePick = async (label: string) => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;

    const asset = picked.assets[0];
    setUploadingLabel(label);

    const form = new FormData();
    form.append("action", "upload");
    form.append("booking_number", String(bookingNumber));
    form.append("document_label", label);
    form.append("traveler_index", "1");
    await appendFileToFormData(form, "document", {
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType || "application/octet-stream",
    });

    const result = await api.uploadDocument(form);
    setUploadingLabel(null);

    if (result.success) {
      setUploadedLabels((prev) => new Set(prev).add(label));
    } else {
      showAlert("Upload Failed", result.message || "Please try again.");
    }
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <StatusBar style="light" />
        <ScreenHeader title="Upload Documents" />
        <ActivityIndicator color={Colors.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <StatusBar style="light" />
      <ScreenHeader title="Upload Documents" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText style={styles.subtitle}>
          Application {bookingNumber}. You can also add documents later from My Applications.
        </ThemedText>

        {requirements.length === 0 ? (
          <ThemedText style={styles.subtitle}>
            No specific document list for this visa -- an agent will contact you if anything is
            needed.
          </ThemedText>
        ) : (
          requirements.map((label) => {
            const isDone = uploadedLabels.has(label);
            const isUploading = uploadingLabel === label;
            return (
              <View key={label} style={styles.row}>
                <View style={styles.rowIconWrap}>
                  <Ionicons
                    name={isDone ? "checkmark-circle" : "document-outline"}
                    size={20}
                    color={isDone ? "#2E7D32" : Colors.primary}
                  />
                </View>
                <ThemedText style={{ flex: 1 }}>{label}</ThemedText>
                <Pressable
                  style={[styles.pickButton, isDone && styles.pickButtonDone]}
                  onPress={() => handlePick(label)}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <ActivityIndicator color={Colors.white} size="small" />
                  ) : (
                    <ThemedText style={styles.pickButtonText}>
                      {isDone ? "Uploaded" : "Choose File"}
                    </ThemedText>
                  )}
                </Pressable>
              </View>
            );
          })
        )}

        <Pressable
          style={styles.doneButton}
          onPress={() => router.replace(`/application/${bookingNumber}`)}
        >
          <ThemedText style={styles.doneButtonText}>Done</ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  centered: { flex: 1, backgroundColor: Colors.white },
  scrollContent: { padding: 20, paddingBottom: 60 },
  subtitle: { color: Colors.text, marginBottom: 20, lineHeight: 20, marginTop: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
    paddingVertical: 14,
    gap: 12,
  },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  pickButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 110,
    alignItems: "center",
  },
  pickButtonDone: { backgroundColor: "#2E7D32" },
  pickButtonText: { color: Colors.white, fontWeight: "600", fontSize: 13 },
  doneButton: {
    marginTop: 28,
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
  doneButtonText: { color: Colors.primary, fontWeight: "800", fontSize: 16 },
});
