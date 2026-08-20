import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  TextInput,
} from "react-native";

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password) {
      Alert.alert("Missing info", "Fill in your name, email, and password.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Passwords don't match", "Double-check both password fields.");
      return;
    }
    setIsSubmitting(true);
    const result = await register(fullName.trim(), email.trim(), password, phone.trim());
    setIsSubmitting(false);
    if (result.success) {
      Alert.alert(
        "Check your email",
        "We sent a verification link to your email. Verify your account, then log in.",
        [{ text: "OK", onPress: () => router.replace("/(auth)/login") }]
      );
    } else {
      Alert.alert("Registration Failed", result.message || "Please try again.");
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Create Account
      </ThemedText>
      <ThemedText style={styles.subtitle}>
        Sign up to start your visa application.
      </ThemedText>

      <TextInput
        style={styles.input}
        placeholder="Full Name"
        placeholderTextColor={Colors.text}
        value={fullName}
        onChangeText={setFullName}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={Colors.text}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Phone (optional)"
        placeholderTextColor={Colors.text}
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={Colors.text}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        placeholderTextColor={Colors.text}
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      <Pressable style={styles.button} onPress={handleRegister} disabled={isSubmitting}>
        {isSubmitting ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <ThemedText style={styles.buttonText}>Sign Up</ThemedText>
        )}
      </Pressable>

      <Pressable onPress={() => router.push("/(auth)/login")} style={styles.linkRow}>
        <ThemedText style={styles.link}>Already have an account? Log in</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center" },
  title: { marginBottom: 8 },
  subtitle: { color: Colors.text, marginBottom: 32 },
  input: {
    borderWidth: 1,
    borderColor: Colors.lightGray,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    fontSize: 16,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: Colors.white, fontWeight: "600", fontSize: 16 },
  linkRow: { marginTop: 20, alignItems: "center" },
  link: { color: Colors.primary, fontWeight: "500" },
});
