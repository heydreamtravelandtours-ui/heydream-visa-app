// components/google-sign-in-button.tsx
// Verifies through the exact same path the website's own Google login uses
// (visa/firebase_auth.php's tokeninfo check + Auth::socialLogin(), mirrored
// server-side in api/mobile-google-login.php) -- this button just gets an
// ID token from Google and hands it to that endpoint via loginWithGoogle().
//
// Setup note: this uses the website's existing Firebase Web OAuth client
// (GOOGLE_WEB_CLIENT_ID in api/config.ts) via a browser-redirect flow, so
// no separate Android/iOS client ID is required to verify the token
// server-side. What IS required before this works on a real device: this
// app's redirect URI (shown by makeRedirectUri below, typically
// `heydreamvisa://` in a standalone build or an `auth.expo.io/@you/slug`
// proxy URL in Expo Go) must be added as an authorized redirect URI on
// that OAuth client in Google Cloud Console -- that's a one-time manual
// step in the console, not something this code can do on its own.

import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import { GOOGLE_ANDROID_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from "@/api/config";
import { showAlert } from "@/utils/cross-alert";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text } from "react-native";

WebBrowser.maybeCompleteAuthSession();

export function GoogleSignInButton({ onSuccess }: { onSuccess: () => void }) {
  const { loginWithGoogle } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    (async () => {
      if (response?.type !== "success") return;
      const idToken = response.params.id_token;
      if (!idToken) return;

      setIsSubmitting(true);
      const result = await loginWithGoogle(idToken);
      setIsSubmitting(false);

      if (result.success) {
        onSuccess();
      } else {
        showAlert("Google Sign-In Failed", result.message || "Please try again.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  return (
    <Pressable
      style={styles.button}
      disabled={!request || isSubmitting}
      onPress={() => promptAsync()}
    >
      {isSubmitting ? (
        <ActivityIndicator color={Colors.dark} />
      ) : (
        <>
          <Image
            source={{ uri: "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" }}
            style={styles.icon}
          />
          <Text style={styles.text}>Continue with Google</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: Colors.white,
  },
  icon: { width: 18, height: 18 },
  text: { fontSize: 15, fontWeight: "600", color: Colors.dark },
});
