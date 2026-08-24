// app/support.tsx
// Mirrors visa/support.php's "Report an Issue" ticket form (report type,
// subject, description, optional screenshot -> reported_issues table)
// instead of the previous Contact Support row, which just opened a bare
// mailto: link and didn't behave like the website at all.

import { LabeledInput } from "@/components/labeled-input";
import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import * as api from "@/api/client";
import { appendFileToFormData } from "@/api/form-file";
import { showAlert } from "@/utils/cross-alert";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from "react-native";

const REPORT_TYPES = [
  { id: "partner_hoster", label: "Report Partner Hoster", icon: "🏢", requiresHostName: true },
  { id: "account_problem", label: "Account Problem", icon: "🔐", requiresHostName: false },
  { id: "payment_problem", label: "Payment Problem", icon: "💳", requiresHostName: false },
  { id: "app_error", label: "App Error or Issues", icon: "🐛", requiresHostName: false },
  { id: "other", label: "Other", icon: "📌", requiresHostName: false },
];

export default function SupportScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [reportType, setReportType] = useState("");
  const [hostName, setHostName] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [reporterName, setReporterName] = useState(user?.full_name || "");
  const [reporterEmail, setReporterEmail] = useState(user?.email || "");
  const [reporterPhone, setReporterPhone] = useState(user?.phone || "");
  const [screenshot, setScreenshot] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedType = REPORT_TYPES.find((t) => t.id === reportType);

  const pickScreenshot = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const filename = asset.uri.split("/").pop() || "screenshot.jpg";
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : "image/jpeg";
      setScreenshot({ uri: asset.uri, name: filename, type });
    }
  };

  const handleSubmit = async () => {
    if (!reportType) return showAlert("Missing info", "Please select a report type.");
    if (!subject.trim()) return showAlert("Missing info", "Please enter a subject.");
    if (!description.trim()) return showAlert("Missing info", "Please describe the issue.");
    if (!reporterName.trim() || !reporterEmail.trim()) {
      return showAlert("Missing info", "Your name and email are required.");
    }
    if (selectedType?.requiresHostName && !hostName.trim()) {
      return showAlert("Missing info", "Please enter the host/partner name.");
    }

    setIsSubmitting(true);
    const form = new FormData();
    form.append("report_type", reportType);
    form.append("host_name", hostName.trim());
    form.append("subject", subject.trim());
    form.append("description", description.trim());
    form.append("reporter_name", reporterName.trim());
    form.append("reporter_email", reporterEmail.trim());
    form.append("reporter_phone", reporterPhone.trim());
    if (screenshot) {
      await appendFileToFormData(form, "screenshot", screenshot);
    }

    const result = await api.submitReport(form);
    setIsSubmitting(false);

    if (result.success) {
      showAlert("Report Submitted", result.message || "Thank you for your report.");
      router.back();
    } else {
      showAlert("Error", result.message || "Failed to submit report.");
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScreenHeader title="Contact Support" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText style={styles.sectionLabel}>Report Type *</ThemedText>
        <View style={styles.typeGrid}>
          {REPORT_TYPES.map((t) => (
            <Pressable
              key={t.id}
              style={[styles.typeChip, reportType === t.id && styles.typeChipActive]}
              onPress={() => setReportType(t.id)}
            >
              <ThemedText style={styles.typeChipIcon}>{t.icon}</ThemedText>
              <ThemedText style={[styles.typeChipText, reportType === t.id && styles.typeChipTextActive]}>
                {t.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {selectedType?.requiresHostName && (
          <LabeledInput label="Host/Partner Name" required value={hostName} onChangeText={setHostName} placeholder="Enter host name" />
        )}

        <LabeledInput label="Subject" required value={subject} onChangeText={setSubject} placeholder="Brief subject of your report" />
        <LabeledInput
          label="Description"
          required
          value={description}
          onChangeText={setDescription}
          placeholder="Please describe the issue in detail..."
          multiline
          numberOfLines={6}
          style={styles.textArea}
        />
        <LabeledInput label="Your Name" required value={reporterName} onChangeText={setReporterName} placeholder="Your full name" />
        <LabeledInput
          label="Your Email"
          required
          value={reporterEmail}
          onChangeText={setReporterEmail}
          placeholder="your@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <LabeledInput
          label="Phone (Optional)"
          value={reporterPhone}
          onChangeText={setReporterPhone}
          placeholder="+63 912 345 6789"
          keyboardType="phone-pad"
        />

        <ThemedText style={styles.sectionLabel}>Screenshot (Optional)</ThemedText>
        {screenshot ? (
          <View style={styles.screenshotPreview}>
            <Image source={{ uri: screenshot.uri }} style={styles.screenshotImage} />
            <Pressable style={styles.screenshotRemove} onPress={() => setScreenshot(null)}>
              <Ionicons name="close" size={16} color={Colors.white} />
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.screenshotUpload} onPress={pickScreenshot}>
            <Ionicons name="camera-outline" size={28} color={Colors.text} />
            <ThemedText style={styles.screenshotUploadText}>Upload Screenshot</ThemedText>
          </Pressable>
        )}

        <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <ThemedText style={styles.submitButtonText}>Submit Report</ThemedText>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 20, paddingBottom: 40 },
  sectionLabel: { fontSize: 12.5, fontWeight: "700", color: Colors.dark, marginBottom: 8, marginTop: 4 },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: Colors.white,
  },
  typeChipActive: { backgroundColor: "#FFF3E0", borderColor: Colors.accent },
  typeChipIcon: { fontSize: 14 },
  typeChipText: { fontSize: 12.5, fontWeight: "600", color: Colors.dark },
  typeChipTextActive: { color: Colors.accent },
  textArea: { minHeight: 120, textAlignVertical: "top" },
  screenshotUpload: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingVertical: 24,
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
    backgroundColor: Colors.white,
  },
  screenshotUploadText: { fontSize: 13, color: Colors.text, fontWeight: "600" },
  screenshotPreview: { marginBottom: 16 },
  screenshotImage: { width: "100%", height: 160, borderRadius: 14 },
  screenshotRemove: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  submitButton: {
    backgroundColor: Colors.gold,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  submitButtonText: { color: Colors.primary, fontWeight: "800", fontSize: 15 },
});
