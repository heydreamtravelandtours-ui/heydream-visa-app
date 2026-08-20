// api/client.ts
// Thin fetch wrapper shared by every screen. Every authenticated call
// attaches `Authorization: Bearer <token>` -- the backend's
// config/token_auth.php reads that header and resolves it against the same
// user_sessions table the website's cookie-based login already uses.

import * as SecureStore from "expo-secure-store";
import { API_ENDPOINTS } from "./config";

const TOKEN_KEY = "heydream_visa_token";

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export interface ApiResult<T = any> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
  [key: string]: any;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiGet<T = any>(url: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, { headers: await authHeaders() });
    return await res.json();
  } catch (e: any) {
    return { success: false, message: e?.message || "Network error" };
  }
}

export async function apiPostJson<T = any>(
  url: string,
  body: Record<string, any>
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (e: any) {
    return { success: false, message: e?.message || "Network error" };
  }
}

export async function apiPostForm<T = any>(
  url: string,
  form: FormData
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: await authHeaders(),
      body: form,
    });
    return await res.json();
  } catch (e: any) {
    return { success: false, message: e?.message || "Network error" };
  }
}

// ============================================================
// Endpoint functions
// ============================================================

export function login(email: string, password: string) {
  return apiPostJson(API_ENDPOINTS.LOGIN, { email, password });
}

export function register(fullName: string, email: string, password: string, phone?: string) {
  return apiPostJson(API_ENDPOINTS.REGISTER, {
    full_name: fullName,
    email,
    password,
    phone: phone || "",
  });
}

export function getVisaList() {
  return apiGet(API_ENDPOINTS.VISA_LIST);
}

export function getVisaDetails(idOrTitle: string | number) {
  return apiGet(`${API_ENDPOINTS.VISA_DETAILS}?id=${encodeURIComponent(String(idOrTitle))}`);
}

export function getMyVisaBookings() {
  return apiGet(API_ENDPOINTS.MY_VISA_BOOKINGS);
}

export function saveVisaBooking(payload: Record<string, any>) {
  return apiPostJson(API_ENDPOINTS.SAVE_SERVICE_BOOKING, payload);
}

export function uploadDocument(form: FormData) {
  return apiPostForm(API_ENDPOINTS.UPLOAD_DOCUMENT, form);
}

export function submitPayment(form: FormData) {
  return apiPostForm(API_ENDPOINTS.PAY_BOOKING, form);
}
