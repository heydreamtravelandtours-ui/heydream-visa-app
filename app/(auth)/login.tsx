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

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing info", "Enter your email and password.");
      return;
    }
    setIsSubmitting(true);
    const result = await login(email.trim(), password);
    setIsSubmitting(false);
    if (result.success) {
      router.replace("/");
    } else {
      Alert.alert("Log In Failed", result.message || "Please try again.");
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Welcome Back
      </ThemedText>
      <ThemedText style={styles.subtitle}>
        Log in to manage your visa applications.
      </ThemedText>

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
        placeholder="Password"
        placeholderTextColor={Colors.text}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable style={styles.button} onPress={handleLogin} disabled={isSubmitting}>
        {isSubmitting ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <ThemedText style={styles.buttonText}>Log In</ThemedText>
        )}
      </Pressable>

      <Pressable onPress={() => router.push("/(auth)/register")} style={styles.linkRow}>
        <ThemedText style={styles.link}>Don&apos;t have an account? Sign up</ThemedText>
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
