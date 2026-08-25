// app/documents/upload.tsx
// Mirrors User Account/profile.php's tracking-modal document widget: an
// "Uploaded Documents" list (View/Remove per file, rejected ones flagged
// with the admin's reason) plus a "Still missing" diff against the
// booking's required_documents -- previously this screen only tracked
// uploads made in the CURRENT visit (a local Set, reset on every remount),
// so reopening it after leaving showed every requirement as un-uploaded
// even when documents were already on file. Now backed by
// visa/api/upload-api.php's own `list` action, the same one profile.php's
// modal calls, instead of re-deriving that state client-side.

import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { API_BASE_URL } from "@/api/config";
import * as api from "@/api/client";
import { appendFileToFormData } from "@/api/form-file";
import { showAlert, showConfirm } from "@/utils/cross-alert";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";

interface UploadedDoc {
  id: number;
  file_name: string;
  file_path: string;
  document_label: string | null;
  traveler_index: number | string | null;
  status: string;
  rejection_reason: string | null;
}

interface DocSlot {
  key: string;
  label: string;
  travelerIndex: number | null;
  travelerLabel: string;
}

export default function UploadDocumentsScreen() {
  const { bookingNumber } = useLocalSearchParams<{
    bookingNumber: string;
    visaId: string;
  }>();
  const router = useRouter();

  const [requirements, setRequirements] = useState<string[]>([]);
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  const [travelerCount, setTravelerCount] = useState(1);
  const [applicantNames, setApplicantNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [docsResult, bookingsResult] = await Promise.all([
      api.listDocuments(String(bookingNumber)),
      api.getMyVisaBookings(),
    ]);
    if (docsResult.success) {
      setDocuments(docsResult.documents || []);
      setRequirements(
        (docsResult.required_documents || "")
          .split("\n")
          .map((label: string) => label.trim())
          .filter(Boolean)
      );
    }
    if (bookingsResult.success) {
      const found = (bookingsResult.data || []).find(
        (b: any) => b.booking_number === bookingNumber
      );
      if (found) {
        setTravelerCount(Math.max(1, Number(found.number_of_travelers) || 1));
        setApplicantNames(found.applicant_names || []);
      }
    }
  }, [bookingNumber]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await load();
      setIsLoading(false);
    })();
  }, [load]);

  const travelerLabel = (n: number) => (applicantNames[n - 1] || "").trim() || `Traveler ${n}`;

  // One upload slot per (required document x traveler) once there's more
  // than one traveler on this booking -- matches the website Track modal's
  // traveler picker (visa/profile.php) and upload-api.php's traveler_index
  // column, so admins/partners can tell whose passport/photo/etc. each file
  // is instead of every upload landing unlabeled on a multi-applicant
  // booking.
  const slots: DocSlot[] = requirements.flatMap((label): DocSlot[] => {
    if (travelerCount <= 1) {
      return [{ key: label, label, travelerIndex: null, travelerLabel: "" }];
    }
    return Array.from({ length: travelerCount }, (_, i) => ({
      key: `${label}__${i + 1}`,
      label,
      travelerIndex: i + 1,
      travelerLabel: travelerLabel(i + 1),
    }));
  });

  const docForSlot = (slot: DocSlot): UploadedDoc | undefined =>
    documents.find((d) => {
      if (d.document_label !== slot.label) return false;
      const docTraveler = d.traveler_index ? Number(d.traveler_index) : 1;
      return docTraveler === (slot.travelerIndex || 1);
    });

  // A slot is satisfied by any non-rejected upload for that label+traveler --
  // a rejected one still counts as "still missing" until replaced, matching
  // renderMissingDocs()'s uploadedDocs.some(...status !== 'rejected') check.
  const missingSlots = slots.filter((slot) => {
    const doc = docForSlot(slot);
    return !doc || doc.status === "rejected";
  });
  const missingByLabel = requirements
    .map((label) => ({
      label,
      travelers: missingSlots.filter((s) => s.label === label).map((s) => s.travelerLabel).filter(Boolean),
    }))
    .filter((g) => missingSlots.some((s) => s.label === g.label));

  const handlePick = async (slot: DocSlot) => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;

    const asset = picked.assets[0];
    setUploadingKey(slot.key);

    const form = new FormData();
    form.append("action", "upload");
    form.append("booking_number", String(bookingNumber));
    form.append("document_label", slot.label);
    form.append("traveler_index", String(slot.travelerIndex || 1));
    await appendFileToFormData(form, "document", {
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType || "application/octet-stream",
    });

    const result = await api.uploadDocument(form);
    setUploadingKey(null);

    if (result.success) {
      await load();
    } else {
      showAlert("Upload Failed", result.message || "Please try again.");
    }
  };

  const handleDelete = (doc: UploadedDoc) => {
    showConfirm(
      "Remove Document?",
      "This will permanently delete this document. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Remove",
          style: "destructive",
          onPress: async () => {
            setDeletingId(doc.id);
            const result = await api.deleteDocument(doc.id, String(bookingNumber));
            setDeletingId(null);
            if (result.success) {
              await load();
            } else {
              showAlert("Failed to Remove", result.message || "Please try again.");
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <StatusBar style="light" />
        <ScreenHeader title="Documents" />
        <ActivityIndicator color={Colors.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <StatusBar style="light" />
      <ScreenHeader title="Documents" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText style={styles.subtitle}>Application {bookingNumber}</ThemedText>

        {requirements.length > 0 && (
          <View style={styles.neededBox}>
            <ThemedText style={styles.neededTitle}>Documents needed:</ThemedText>
            <ThemedText style={styles.neededText}>{requirements.join(", ")}</ThemedText>
          </View>
        )}

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>
            {documents.length > 0 ? `Uploaded Documents (${documents.length})` : "Uploaded Documents"}
          </ThemedText>
          {documents.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="file-tray-outline" size={22} color={Colors.text} />
              <ThemedText style={styles.emptyText}>
                No documents uploaded yet. Use the requirements below to get started.
              </ThemedText>
            </View>
          ) : (
            documents.map((doc) => {
              const isRejected = doc.status === "rejected";
              const isPdf = /\.pdf$/i.test(doc.file_name);
              const docTravelerName = doc.traveler_index
                ? travelerLabel(Number(doc.traveler_index))
                : "";
              const docTag =
                travelerCount > 1
                  ? [docTravelerName, doc.document_label].filter(Boolean).join(" — ")
                  : doc.document_label;
              return (
                <View
                  key={doc.id}
                  style={[styles.docRow, isRejected ? styles.docRowRejected : styles.docRowOk]}
                >
                  <Ionicons
                    name={isPdf ? "document-text" : "image"}
                    size={18}
                    color={isRejected ? "#DC2626" : "#22C55E"}
                  />
                  <View style={{ flex: 1 }}>
                    {!!docTag && (
                      <ThemedText
                        style={[styles.docLabel, isRejected ? styles.docLabelRejected : styles.docLabelOk]}
                      >
                        {docTag}
                      </ThemedText>
                    )}
                    <ThemedText
                      style={[styles.docFileName, isRejected ? styles.docFileNameRejected : styles.docFileNameOk]}
                      numberOfLines={1}
                    >
                      {doc.file_name}
                    </ThemedText>
                    {isRejected && (
                      <ThemedText style={styles.docRejectedNote}>
                        <Ionicons name="warning" size={11} color="#B91C1C" /> Rejected
                        {doc.rejection_reason ? `: ${doc.rejection_reason}` : ""} -- please upload a
                        replacement
                      </ThemedText>
                    )}
                  </View>
                  <Pressable
                    style={[styles.docActionBtn, isRejected ? styles.docActionBtnRejected : styles.docActionBtnOk]}
                    onPress={() => Linking.openURL(`${API_BASE_URL}/${doc.file_path}`)}
                  >
                    <Ionicons name="eye" size={13} color={isRejected ? "#B91C1C" : "#15803D"} />
                    <ThemedText style={[styles.docActionText, { color: isRejected ? "#B91C1C" : "#15803D" }]}>
                      View
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={styles.docDeleteBtn}
                    onPress={() => handleDelete(doc)}
                    disabled={deletingId === doc.id}
                  >
                    {deletingId === doc.id ? (
                      <ActivityIndicator size="small" color="#DC2626" />
                    ) : (
                      <Ionicons name="trash" size={13} color="#DC2626" />
                    )}
                  </Pressable>
                </View>
              );
            })
          )}
        </View>

        {missingByLabel.length > 0 && (
          <View style={styles.missingBox}>
            <ThemedText style={styles.missingTitle}>
              <Ionicons name="warning" size={13} color="#C2410C" /> Still missing:
            </ThemedText>
            {missingByLabel.map((group) => (
              <View key={group.label} style={{ marginTop: 4 }}>
                <ThemedText style={styles.missingItem}>{group.label}</ThemedText>
                {group.travelers.length > 0 && (
                  <ThemedText style={styles.missingTravelers}>
                    {group.travelers.join(", ")}
                  </ThemedText>
                )}
              </View>
            ))}
            <ThemedText style={styles.missingNote}>
              Accepted file types: JPG, PNG, WEBP, or PDF (max 10MB each).
            </ThemedText>
          </View>
        )}

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Upload a Document</ThemedText>
          {requirements.length === 0 ? (
            <ThemedText style={styles.subtitle}>
              No specific document list for this visa -- an agent will contact you if anything is
              needed.
            </ThemedText>
          ) : (
            requirements.map((label) => (
              <View key={label}>
                {travelerCount > 1 && <ThemedText style={styles.pickGroupTitle}>{label}</ThemedText>}
                {slots
                  .filter((s) => s.label === label)
                  .map((slot) => {
                    const isUploading = uploadingKey === slot.key;
                    return (
                      <Pressable
                        key={slot.key}
                        style={styles.pickRow}
                        onPress={() => handlePick(slot)}
                        disabled={isUploading}
                      >
                        <Ionicons name="cloud-upload-outline" size={18} color={Colors.primary} />
                        <ThemedText style={{ flex: 1 }}>
                          {travelerCount > 1 ? slot.travelerLabel : label}
                        </ThemedText>
                        {isUploading ? (
                          <ActivityIndicator color={Colors.primary} size="small" />
                        ) : (
                          <ThemedText style={styles.pickRowAction}>Choose File</ThemedText>
                        )}
                      </Pressable>
                    );
                  })}
              </View>
            ))
          )}
        </View>

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
  subtitle: { color: Colors.text, marginBottom: 16, lineHeight: 20 },
  neededBox: { backgroundColor: "#EFF6FF", borderRadius: 12, padding: 14, marginBottom: 20 },
  neededTitle: { color: Colors.primary, fontWeight: "800", fontSize: 13, marginBottom: 4 },
  neededText: { color: Colors.dark, fontSize: 13, lineHeight: 19 },
  section: { marginBottom: 22 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: Colors.dark, marginBottom: 10 },
  emptyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderStyle: "dashed",
    padding: 14,
  },
  emptyText: { flex: 1, color: Colors.text, fontSize: 12.5, lineHeight: 18 },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  docRowOk: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
  docRowRejected: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  docLabel: { fontSize: 10.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3 },
  docLabelOk: { color: "#15803D" },
  docLabelRejected: { color: "#B91C1C" },
  docFileName: { fontSize: 12.5, fontWeight: "500" },
  docFileNameOk: { color: "#166534" },
  docFileNameRejected: { color: "#7F1D1D" },
  docRejectedNote: { fontSize: 11, color: "#B91C1C", marginTop: 2 },
  docActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  docActionBtnOk: { borderColor: "#BBF7D0" },
  docActionBtnRejected: { borderColor: "#FECACA" },
  docActionText: { fontSize: 11.5, fontWeight: "700" },
  docDeleteBtn: {
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 6,
    padding: 7,
  },
  missingBox: {
    backgroundColor: "#FFF7ED",
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  missingTitle: { color: "#C2410C", fontWeight: "800", fontSize: 13, marginBottom: 6 },
  missingItem: { color: "#7C2D12", fontWeight: "700", fontSize: 12.5, marginTop: 4 },
  missingTravelers: { color: "#9A3412", fontSize: 12, marginTop: 2 },
  missingNote: { color: "#9A3412", fontSize: 11, marginTop: 10 },
  pickGroupTitle: {
    fontSize: 11.5,
    fontWeight: "800",
    color: Colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginTop: 10,
  },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
    paddingVertical: 12,
    gap: 12,
  },
  pickRowAction: { color: Colors.primary, fontWeight: "700", fontSize: 13 },
  doneButton: {
    marginTop: 8,
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
