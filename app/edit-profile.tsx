// app/edit-profile.tsx
// Mirrors visa/my-profile.php's editable fields (title, full_name, dob,
// country, phone) -- previously nowhere in the app, so a user had no way to
// correct/update these after registering.

import { DateField } from "@/components/date-field";
import { LabeledInput } from "@/components/labeled-input";
import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import * as api from "@/api/client";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { showAlert } from "@/utils/cross-alert";

const TITLES = ["Mr.", "Ms.", "Mrs.", "Dr."];

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [dob, setDob] = useState<Date | null>(null);
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    (async () => {
      const result = await api.getProfile();
      if (result.success) {
        setTitle(result.data.title || "");
        setFullName(result.data.full_name || "");
        setDob(result.data.dob ? new Date(`${result.data.dob}T00:00:00`) : null);
        setCountry(result.data.country || "");
        setPhone(result.data.phone || "");
      }
      setIsLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (!fullName.trim()) {
      showAlert("Missing info", "Name is required.");
      return;
    }
    setIsSaving(true);
    const dobString = dob
      ? `${dob.getFullYear()}-${String(dob.getMonth() + 1).padStart(2, "0")}-${String(dob.getDate()).padStart(2, "0")}`
      : "";
    const result = await api.updateProfile({
      title,
      full_name: fullName.trim(),
      dob: dobString,
      country: country.trim(),
      phone: phone.trim(),
    });
    setIsSaving(false);
    if (result.success) {
      await updateUser({ title, full_name: fullName.trim(), dob: dobString, country: country.trim(), phone: phone.trim() });
      showAlert("Saved", "Your profile has been updated.");
      router.back();
    } else {
      showAlert("Error", result.message || "Failed to update profile.");
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <StatusBar style="light" />
        <ScreenHeader title="Edit Profile" />
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScreenHeader title="Edit Profile" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.titleRow}>
          {TITLES.map((t) => (
            <Pressable
              key={t}
              style={[styles.titleChip, title === t && styles.titleChipActive]}
              onPress={() => setTitle(t === title ? "" : t)}
            >
              <ThemedText style={[styles.titleChipText, title === t && styles.titleChipTextActive]}>
                {t}
              </ThemedText>
            </Pressable>
          ))}
        </View>
        <LabeledInput label="Full Name" required value={fullName} onChangeText={setFullName} placeholder="Your full name" />
        <DateField label="Date of Birth" value={dob} onChange={setDob} maximumDate={new Date()} />
        <LabeledInput label="Country" value={country} onChangeText={setCountry} placeholder="Your country" />
        <LabeledInput
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          placeholder="+63 917 123 4567"
          keyboardType="phone-pad"
        />

        <Pressable style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
          {isSaving ? <ActivityIndicator color={Colors.primary} /> : <ThemedText style={styles.saveButtonText}>Save Changes</ThemedText>}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, backgroundColor: Colors.white },
  scrollContent: { padding: 20, paddingBottom: 40 },
  titleRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  titleChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: Colors.white,
  },
  titleChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  titleChipText: { fontSize: 13, fontWeight: "700", color: Colors.dark },
  titleChipTextActive: { color: Colors.white },
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
