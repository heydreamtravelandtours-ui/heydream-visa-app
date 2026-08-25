// app/edit-profile.tsx
// Mirrors visa/my-profile.php's editable fields (title, full_name, dob,
// country, phone) plus its profile_pic upload -- the app previously had no
// way to correct any of these after registering, and no way at all to set
// a profile photo even though the DB column and website upload flow have
// existed all along (see visa/api/upload-profile-photo.php).

import { DateField } from "@/components/date-field";
import { LabeledInput } from "@/components/labeled-input";
import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import { API_BASE_URL } from "@/api/config";
import * as api from "@/api/client";
import { appendFileToFormData } from "@/api/form-file";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { showAlert, showConfirm } from "@/utils/cross-alert";

const TITLES = ["Mr.", "Ms.", "Mrs.", "Dr."];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

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
  const [profilePic, setProfilePic] = useState(user?.profile_pic || "");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  useEffect(() => {
    (async () => {
      const result = await api.getProfile();
      if (result.success) {
        setTitle(result.data.title || "");
        setFullName(result.data.full_name || "");
        setDob(result.data.dob ? new Date(`${result.data.dob}T00:00:00`) : null);
        setCountry(result.data.country || "");
        setPhone(result.data.phone || "");
        setProfilePic(result.data.profile_pic || "");
      }
      setIsLoading(false);
    })();
  }, []);

  // Uploads immediately on pick (like the document-upload screens), rather
  // than staging it for the Save button -- a photo isn't part of the
  // title/name/dob/country/phone form state at all, it's its own request
  // against a dedicated multipart endpoint, so there's nothing to gain by
  // waiting for Save.
  const uploadPhoto = async (file: { uri: string; name: string; type: string }) => {
    setIsUploadingPhoto(true);
    const form = new FormData();
    await appendFileToFormData(form, "profile_pic", file);
    const result = await api.uploadProfilePhoto(form);
    setIsUploadingPhoto(false);
    if (result.success) {
      setProfilePic(result.profile_pic);
      await updateUser({ profile_pic: result.profile_pic });
    } else {
      showAlert("Upload Failed", result.message || "Please try again.");
    }
  };

  const captureFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showAlert("Permission needed", "Allow camera access to take a profile photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await uploadPhoto({
      uri: asset.uri,
      name: asset.fileName || `photo-${Date.now()}.jpg`,
      type: asset.mimeType || "image/jpeg",
    });
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert("Permission needed", "Allow photo library access to attach an image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await uploadPhoto({
      uri: asset.uri,
      name: asset.fileName || `photo-${Date.now()}.jpg`,
      type: asset.mimeType || "image/jpeg",
    });
  };

  const chooseSource = () => {
    showConfirm("Profile Photo", "How would you like to add your photo?", [
      { text: "Take Photo", onPress: captureFromCamera },
      { text: "Choose from Gallery", onPress: pickFromLibrary },
      { text: "Cancel", style: "cancel" },
    ]);
  };

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
        <Pressable style={styles.avatarWrap} onPress={chooseSource} disabled={isUploadingPhoto}>
          <View style={styles.avatar}>
            {profilePic ? (
              <Image source={{ uri: `${API_BASE_URL}/${profilePic}` }} style={styles.avatarImage} />
            ) : (
              <ThemedText style={styles.avatarText}>{initials(fullName || "?")}</ThemedText>
            )}
            {isUploadingPhoto && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color={Colors.white} />
              </View>
            )}
          </View>
          <View style={styles.avatarBadge}>
            <Ionicons name="camera" size={14} color={Colors.white} />
          </View>
          <ThemedText style={styles.avatarHint}>Tap to change photo</ThemedText>
        </Pressable>

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
  avatarWrap: { alignItems: "center", marginBottom: 24 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: 88, height: 88 },
  avatarText: { color: Colors.white, fontSize: 28, fontWeight: "800" },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBadge: {
    position: "absolute",
    right: 4,
    bottom: 26,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.white,
  },
  avatarHint: { fontSize: 12, color: Colors.text, marginTop: 8 },
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
