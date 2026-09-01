// hooks/use-push-notifications.ts
// Registers this device for OS-level push (the phone's notification tray),
// separate from the polling-driven badge in use-unread-count.ts -- that one
// stays untouched and keeps working as a fallback. Modeled on
// use-unread-count.ts's pattern of keying everything off `user` from
// useAuth() rather than a bespoke "auth event".
//
// Mobile app only -- the website keeps its existing bell, no browser push --
// so there's no cross-channel duplication to worry about here.

import { useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import * as secureStorage from "@/api/secure-storage";
import * as api from "@/api/client";
import { API_BASE_URL } from "@/api/config";
import { useAuth } from "@/contexts/auth-context";
import { resolveNotificationRoute } from "@/lib/notification-routing";

// Known project ID from app.json, used only if Constants.expoConfig comes
// back empty at runtime -- confirmed happening in production: registration
// was silently no-op'ing with zero tokens ever reaching push_tokens, and
// this early-return was the only step with no thrown error to explain why.
const FALLBACK_PROJECT_ID = "db387261-f43b-49a9-b804-62f757e164f4";

// Temporary -- see api/debug-log.php. Push failures here were previously
// swallowed with zero visibility; this reports the real reason server-side
// so it can be read without a device attached. Remove once push
// registration is confirmed reliable in production.
function reportPushDebug(message: string) {
  fetch(`${API_BASE_URL}/visa/api/debug-log.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  }).catch(() => {});
}

export const PUSH_TOKEN_KEY = "heydream_visa_push_token";

// Module scope, not per-render, and covers both foreground and background
// delivery -- a push shows its OS banner even while the app is open, on top
// of (not instead of) the existing 30s-polling badge.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Every early exit throws instead of silently returning, so the caller's
// catch always has a real reason to report -- a bare `return` here previously
// looked identical to success from the outside (no error, no token, no log).
async function registerDeviceForPush() {
  if (!Device.isDevice) throw new Error("not a physical device");

  const existing = await Notifications.getPermissionsAsync();
  let finalStatus = existing.status;
  if (finalStatus !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }
  if (finalStatus !== "granted") throw new Error(`permission not granted (status: ${finalStatus})`);

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    (Constants as any).easConfig?.projectId ||
    FALLBACK_PROJECT_ID;
  if (!projectId) throw new Error("no projectId available from any source");

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenResponse.data;
  if (!token) throw new Error("getExpoPushTokenAsync returned an empty token");

  await secureStorage.setItem(PUSH_TOKEN_KEY, token);
  const result = await api.registerPushToken(token, Platform.OS);
  if (!result?.success) throw new Error(`registerPushToken API call failed: ${JSON.stringify(result)}`);

  return token;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    registerDeviceForPush()
      .then((token) => reportPushDebug(`push registered ok: ${token.slice(0, 24)}...`))
      .catch((e: any) => reportPushDebug(`push register FAILED: ${e?.message || String(e)}`));
  }, [user]);

  // Registered once, not keyed on `user` -- a tap can cold-start the app
  // before auth state settles.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        type?: string;
        booking_number?: string;
      };
      if (!data?.type) return;
      const route = resolveNotificationRoute({ type: data.type, booking_number: data.booking_number });
      if (route) router.push(route as any);
    });

    // The response listener alone misses the tap that cold-started the app --
    // recover that case so deep-linking works whether the app was
    // foregrounded, backgrounded, or fully killed when the push was tapped.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      const data = response?.notification.request.content.data as
        | { type?: string; booking_number?: string }
        | undefined;
      if (!data?.type) return;
      const route = resolveNotificationRoute({ type: data.type, booking_number: data.booking_number });
      if (route) router.push(route as any);
    });

    return () => subscription.remove();
  }, [router]);
}
