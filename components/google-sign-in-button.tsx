// components/google-sign-in-button.tsx
// Verifies through the exact same path the website's own Google login uses
// (visa/firebase_auth.php's tokeninfo check + Auth::socialLogin(), mirrored
// server-side in api/mobile-google-login.php) -- this button just gets an
// ID token from Google and hands it to that endpoint via loginWithGoogle().
//
// Setup note: the ID token gets verified server-side against the website's
// existing Firebase Web OAuth client (GOOGLE_WEB_CLIENT_ID), but actually
// *launching* sign-in on Android needs its own separate Android-type OAuth
// client (GOOGLE_ANDROID_CLIENT_ID, both in api/config.ts) -- Google's
// library throws immediately on render without one (postmortem: the app's
// first release crashed on every screen reaching this button because of
// exactly that). That Android client also needs "Enable custom URI scheme"
// turned on in Google Cloud Console (off by default), or Google rejects the
// whole request with Error 400: invalid_request before the account picker
// even opens.
//
// The `native` override below matters just as much: expo-auth-session's own
// default redirect is built from the Android package name
// (com.heydreamtravel.visa:/oauthredirect), which has no intent-filter
// registered anywhere, so Android has nothing to hand Google's redirect back
// to and the browser just hangs after you pick an account. Redirecting to
// app.json's actual registered scheme (heydreamvisa) instead is what lets
// control return to the app at all.

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

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
    {
      webClientId: GOOGLE_WEB_CLIENT_ID,
      androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    },
    // The library's own default native redirect is built from the Android
    // package name (com.heydreamtravel.visa:/oauthredirect), which has no
    // intent-filter registered anywhere -- Android has nothing to hand
    // Google's redirect back to, so the browser just gets stuck after
    // account selection. app.json's top-level "scheme" (heydreamvisa) IS
    // registered (that's what makes expo-router's own deep links work), so
    // redirect there instead.
    { native: "heydreamvisa:/oauthredirect" }
  );

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
