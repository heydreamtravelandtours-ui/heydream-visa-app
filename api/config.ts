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

export const API_ENDPOINTS = {
  LOGIN: `${API_BASE_URL}/api/mobile-login.php`,
  REGISTER: `${API_BASE_URL}/api/mobile-register.php`,
  VISA_LIST: `${API_BASE_URL}/api/get-visa-list.php`,
  VISA_DETAILS: `${API_BASE_URL}/api/get-visa-details.php`,
  MY_VISA_BOOKINGS: `${API_BASE_URL}/api/get-my-visa-bookings.php`,
  SAVE_SERVICE_BOOKING: `${API_BASE_URL}/api/save-service-booking.php`,
  UPLOAD_DOCUMENT: `${API_BASE_URL}/visa/api/upload-api.php`,
  PAY_BOOKING: `${API_BASE_URL}/User%20Account/api/pay-flight-booking.php`,
} as const;
