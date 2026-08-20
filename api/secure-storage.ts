// api/secure-storage.ts
// expo-secure-store's web build is an empty stub (no getValueWithKeyAsync
// at all -- see node_modules/expo-secure-store/build/ExpoSecureStore.web.js),
// so calling it on web throws immediately. This app's real target is
// native (Android/iOS), but the web build is still useful for local dev
// preview, so fall back to localStorage there instead of crashing.

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
  }
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function removeItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
