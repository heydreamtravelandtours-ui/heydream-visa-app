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
import { useAuth } from "@/contexts/auth-context";
import { resolveNotificationRoute } from "@/lib/notification-routing";

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

async function registerDeviceForPush() {
  if (!Device.isDevice) return; // simulators/emulators can't get a real token

  const existing = await Notifications.getPermissionsAsync();
  let finalStatus = existing.status;
  if (finalStatus !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }
  if (finalStatus !== "granted") return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return;

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenResponse.data;

  await secureStorage.setItem(PUSH_TOKEN_KEY, token);
  await api.registerPushToken(token, Platform.OS);
}

export function usePushNotifications() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    registerDeviceForPush().catch(() => {
      /* best-effort -- push is an enhancement, never block app usage */
    });
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
