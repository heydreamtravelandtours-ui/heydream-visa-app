// app/change-password.tsx
// Mirrors visa/change-password.php's form (current/new/confirm, 8-char
// minimum) -- previously missing from the app entirely.

import { LabeledInput } from "@/components/labeled-input";
import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import * as api from "@/api/client";
import { showAlert } from "@/utils/cross-alert";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
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
      showAlert("Success", "Password changed successfully!");
      router.back();
    } else {
      showAlert("Error", result.message || "Failed to change password.");
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScreenHeader title="Change Password" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <LabeledInput
          label="Current Password"
          required
          secureTextEntry
          value={currentPassword}
          onChangeText={setCurrentPassword}
          placeholder="Enter current password"
        />
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
          {isSaving ? <ActivityIndicator color={Colors.primary} /> : <ThemedText style={styles.saveButtonText}>Update Password</ThemedText>}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 20, paddingBottom: 40 },
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
