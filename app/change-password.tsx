// app/change-password.tsx
// Mirrors visa/change-password.php's form (current/new/confirm, 8-char
// minimum) -- previously missing from the app entirely. Also handles
// Google-only accounts (null password column): there's no "current"
// password to verify, so this becomes a "Set Up Password" flow instead --
// the API rejects a current_password check server-side in that case too,
// this just matches the UI to it instead of asking for something that
// doesn't exist.

import { LabeledInput } from "@/components/labeled-input";
import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import * as api from "@/api/client";
import { showAlert } from "@/utils/cross-alert";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    api.getProfile().then((result) => {
      setHasPassword(result.success ? !!result.data.has_password : true);
    });
  }, []);

  const handleSubmit = async () => {
    if ((hasPassword && !currentPassword) || !newPassword || !confirmPassword) {
      showAlert("Missing info", "All fields are required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert("Error", "New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      showAlert("Error", "New password must be at least 8 characters long.");
      return;
    }
    setIsSaving(true);
    const result = await api.changePassword(currentPassword, newPassword, confirmPassword);
    setIsSaving(false);
    if (result.success) {
      showAlert("Success", result.message || "Password saved successfully!");
      router.back();
    } else {
      showAlert("Error", result.message || "Failed to save password.");
    }
  };

  if (hasPassword === null) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <ScreenHeader title="Password" />
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScreenHeader title={hasPassword ? "Change Password" : "Set Up Password"} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {!hasPassword && (
          <View style={styles.infoBanner}>
            <ThemedText style={styles.infoBannerText}>
              Your account signed in with Google and has no password yet. Set one up here if
              you&apos;d also like to log in with an email and password.
            </ThemedText>
          </View>
        )}
        {hasPassword && (
          <LabeledInput
            label="Current Password"
            required
            secureTextEntry
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Enter current password"
          />
        )}
        <LabeledInput
          label="New Password"
          required
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="At least 8 characters"
        />
        <LabeledInput
          label="Confirm New Password"
          required
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Re-enter new password"
        />
        <Pressable style={styles.saveButton} onPress={handleSubmit} disabled={isSaving}>
          {isSaving ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <ThemedText style={styles.saveButtonText}>
              {hasPassword ? "Update Password" : "Set Password"}
            </ThemedText>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 20, paddingBottom: 40 },
  infoBanner: {
    backgroundColor: "#E8F0FE",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  infoBannerText: { color: Colors.primary, fontSize: 13, lineHeight: 19 },
  saveButton: {
    backgroundColor: Colors.gold,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  saveButtonText: { color: Colors.primary, fontWeight: "800", fontSize: 15 },
});
