// api/config.ts
// Base URL for the shared heydream-travel-website backend -- this app has
// no backend of its own, it's a second frontend against the exact same
// PHP API + database the main site and visa subdomain already use.

import Constants from "expo-constants";
import { Platform } from "react-native";

// Auto-detect the Metro/Expo dev host's IP so a physical device on the same
// LAN can reach your XAMPP server without editing this file every time.
const DEBUGGER_HOST =
  (Constants.expoConfig?.hostUri ?? "").split(":")[0] || null;

// Fallback for when auto-detection fails (e.g. Android emulator, which
// can't resolve the host machine's real LAN IP as "localhost").
const EMULATOR_HOST = Platform.OS === "android" ? "10.0.2.2" : "localhost";

// TODO: set this to your machine's LAN IP (same one heydream-app's
// app/api/api_config.ts uses) if DEBUGGER_HOST auto-detection doesn't work
// for a physical device.
const LAN_FALLBACK_HOST = "";

const DEV_HOST = DEBUGGER_HOST || LAN_FALLBACK_HOST || EMULATOR_HOST;

// The XAMPP htdocs folder name for the website repo -- adjust if you rename it.
const DEV_BASE_URL = `http://${DEV_HOST}/heydream-travel-website`;

// TODO: fill in once the site's production/staging domain for this backend
// is known. Until then, builds outside of Expo Go/dev client will fail
// closed rather than silently pointing at a wrong host.
const PROD_BASE_URL = (Constants.expoConfig?.extra?.apiBaseUrl as string) || "";

export const API_BASE_URL = __DEV__ ? DEV_BASE_URL : PROD_BASE_URL;

// Public visa pages (Terms of Service, etc.) are served from their own
// subdomain in production -- visa/index.php's own canonical tag points at
// visa.heydreamtravel.com, not heydreamtravel.com/visa/. Opening
// `${API_BASE_URL}/visa/terms.php` in production hit a 404 there and the
// device's browser fell back to a Google search instead of the real page.
export const VISA_WEB_BASE_URL = __DEV__ ? `${DEV_BASE_URL}/visa` : "https://visa.heydreamtravel.com";

// Same Firebase Web OAuth client the website already verifies Google
// sign-ins against (config/firebase_config.php's FIREBASE_CLIENT_ID) --
// using it here too means api/mobile-google-login.php needs no separate
// native client ID to accept this app's tokens. Still required alongside
// GOOGLE_ANDROID_CLIENT_ID below -- expo-auth-session's Google provider only
// ever looks up androidClientId on Android (see components/google-sign-in-
// button.tsx), but falls back to this one on web (the local dev preview).
export const GOOGLE_WEB_CLIENT_ID =
  "462077710045-1j3bq6f5cc55b80gt6ab9sh89tp23hkg.apps.googleusercontent.com";

// A separate "Android" OAuth client (same Google Cloud project, tied to this
// app's package name + release keystore's SHA-1 fingerprint) -- Google
// requires this distinct client type for native Android sign-in; the Web
// client above isn't accepted there and expo-auth-session throws immediately
// on render if it's missing (see the "Google Sign-In crash" postmortem).
export const GOOGLE_ANDROID_CLIENT_ID =
  "462077710045-2ekdfb6pjd5uqqfa14eovgqnffeodiqg.apps.googleusercontent.com";

export const API_ENDPOINTS = {
  LOGIN: `${API_BASE_URL}/api/mobile-login.php`,
  REGISTER: `${API_BASE_URL}/api/mobile-register.php`,
  GOOGLE_LOGIN: `${API_BASE_URL}/api/mobile-google-login.php`,
  VISA_LIST: `${API_BASE_URL}/api/get-visa-list.php`,
  VISA_DETAILS: `${API_BASE_URL}/api/get-visa-details.php`,
  MY_VISA_BOOKINGS: `${API_BASE_URL}/api/get-my-visa-bookings.php`,
  SAVE_SERVICE_BOOKING: `${API_BASE_URL}/api/save-service-booking.php`,
  UPLOAD_DOCUMENT: `${API_BASE_URL}/visa/api/upload-api.php`,
  PAY_BOOKING: `${API_BASE_URL}/User%20Account/api/pay-flight-booking.php`,
  // The visa/ proxies, not api/ directly -- they set HD_NOTIFICATIONS_VISA_ONLY
  // / HD_BOOKING_COUNT_VISA_ONLY so this app only ever sees visa-scoped rows.
  NOTIFICATIONS: `${API_BASE_URL}/visa/api/notifications-api.php`,
  BOOKING_COUNT: `${API_BASE_URL}/visa/api/get-booking-count.php`,
  BOOKING_CHAT: `${API_BASE_URL}/visa/api/booking-chat.php`,
  GET_PROFILE: `${API_BASE_URL}/visa/api/get-profile.php`,
  UPDATE_PROFILE: `${API_BASE_URL}/visa/api/update-profile.php`,
  UPLOAD_PROFILE_PHOTO: `${API_BASE_URL}/visa/api/upload-profile-photo.php`,
  CHANGE_PASSWORD: `${API_BASE_URL}/visa/api/change-password.php`,
  SUBMIT_REPORT: `${API_BASE_URL}/visa/api/submit-report.php`,
} as const;
