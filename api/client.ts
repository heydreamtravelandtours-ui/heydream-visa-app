// api/client.ts
// Thin fetch wrapper shared by every screen. Every authenticated call
// attaches `Authorization: Bearer <token>` -- the backend's
// config/token_auth.php reads that header and resolves it against the same
// user_sessions table the website's cookie-based login already uses.

import * as secureStorage from "./secure-storage";
import { API_ENDPOINTS } from "./config";

const TOKEN_KEY = "heydream_visa_token";

export async function getToken(): Promise<string | null> {
  return secureStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await secureStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await secureStorage.removeItem(TOKEN_KEY);
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

// Every backend endpoint this app calls fails auth the same two ways (see
// api/get-my-visa-bookings.php, User Account/api/{pay-flight-booking,
// upload-api}.php -> 'Unauthorized'; visa/api/booking-chat.php -> 'Please
// sign in.'). A stale/invalid token (e.g. its user_sessions row got wiped
// by a database reset, or just naturally expired) previously looked
// identical to a real network error on every screen, and `user` stayed
// populated in local storage regardless, so the UI kept claiming you were
// logged in while every request silently failed. Detecting this centrally
// lets AuthProvider clear the stale session automatically instead of each
// screen showing a raw "Unauthorized" string forever.
function isAuthFailure(result: ApiResult): boolean {
  return result?.success === false && (result.message === "Unauthorized" || result.message === "Please sign in.");
}

let authFailureHandler: (() => void) | null = null;
export function registerAuthFailureHandler(fn: () => void) {
  authFailureHandler = fn;
}

function checkAuthFailure<T>(result: ApiResult<T>): ApiResult<T> {
  if (isAuthFailure(result)) {
    authFailureHandler?.();
  }
  return result;
}

export async function apiGet<T = any>(url: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, { headers: await authHeaders() });
    return checkAuthFailure(await res.json());
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
    return checkAuthFailure(await res.json());
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
    return checkAuthFailure(await res.json());
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

export function googleLogin(idToken: string) {
  return apiPostJson(API_ENDPOINTS.GOOGLE_LOGIN, { id_token: idToken });
}

export function register(fullName: string, email: string, password: string, phone?: string) {
  return apiPostJson(API_ENDPOINTS.REGISTER, {
    full_name: fullName,
    email,
    password,
    phone: phone || "",
  });
}

// direction: 'outbound' (default, Filipino traveling abroad) or 'inbound'
// (Foreign Visitor to the Philippines, see components/visa-gate.tsx) --
// forwarded to get-visa-list.php/get-visa-details.php, which branch between
// the visas and visitor_visas tables.
export function getVisaList(direction: "outbound" | "inbound" = "outbound") {
  return apiGet(`${API_ENDPOINTS.VISA_LIST}?direction=${direction}`);
}

export function getVisaDetails(idOrTitle: string | number, direction: "outbound" | "inbound" = "outbound") {
  return apiGet(`${API_ENDPOINTS.VISA_DETAILS}?id=${encodeURIComponent(String(idOrTitle))}&direction=${direction}`);
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

export function listDocuments(bookingNumber: string) {
  return apiGet(`${API_ENDPOINTS.UPLOAD_DOCUMENT}?action=list&booking_number=${encodeURIComponent(bookingNumber)}`);
}

export function deleteDocument(docId: number, bookingNumber: string) {
  const form = new FormData();
  form.append("action", "delete");
  form.append("id", String(docId));
  form.append("booking_number", bookingNumber);
  return apiPostForm(API_ENDPOINTS.UPLOAD_DOCUMENT, form);
}

export function submitPayment(form: FormData) {
  return apiPostForm(API_ENDPOINTS.PAY_BOOKING, form);
}

export function getNotifications() {
  return apiGet(`${API_ENDPOINTS.NOTIFICATIONS}?action=list`);
}

export function markNotificationRead(id: number) {
  // notifications-api.php reads $_POST['id'], which PHP only populates from
  // a urlencoded/multipart body -- not apiPostJson's JSON body -- hence
  // FormData here instead.
  const form = new FormData();
  form.append("action", "mark_read");
  form.append("id", String(id));
  return apiPostForm(API_ENDPOINTS.NOTIFICATIONS, form);
}

export function markAllNotificationsRead() {
  const form = new FormData();
  form.append("action", "mark_all_read");
  return apiPostForm(API_ENDPOINTS.NOTIFICATIONS, form);
}

export function getBookingCount() {
  return apiGet(API_ENDPOINTS.BOOKING_COUNT);
}

export function openBookingChat(bookingNumber: string) {
  return apiGet(`${API_ENDPOINTS.BOOKING_CHAT}?action=open&booking_number=${encodeURIComponent(bookingNumber)}`);
}

export function sendBookingChatMessage(bookingNumber: string, message: string) {
  const form = new FormData();
  form.append("action", "send");
  form.append("booking_number", bookingNumber);
  form.append("message", message);
  return apiPostForm(API_ENDPOINTS.BOOKING_CHAT, form);
}

export function getProfile() {
  return apiGet(API_ENDPOINTS.GET_PROFILE);
}

export function updateProfile(payload: {
  title: string;
  full_name: string;
  dob: string;
  country: string;
  phone: string;
}) {
  return apiPostJson(API_ENDPOINTS.UPDATE_PROFILE, payload);
}

export function changePassword(currentPassword: string, newPassword: string, confirmPassword: string) {
  return apiPostJson(API_ENDPOINTS.CHANGE_PASSWORD, {
    current_password: currentPassword,
    new_password: newPassword,
    confirm_password: confirmPassword,
  });
}

export function submitReport(form: FormData) {
  return apiPostForm(API_ENDPOINTS.SUBMIT_REPORT, form);
}
