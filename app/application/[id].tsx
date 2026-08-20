// app/application/[id].tsx
// Booking status + payment resubmission, now carrying every field the
// website's visa/profile.php booking card shows (email, phone, partner
// notes, payment proof, traveler count, renewal/visa-type badges, and a
// real Chat/Email/Phone contact block) -- previously this screen silently
// dropped all of that even though get-my-visa-bookings.php already returns
// it. Deliberately still has NO cancel button: User Account/api/
// cancel-flight-booking.php only allows self-cancel for 'Flight Booking'
// and 'Cruise Vacation' bookings -- visa bookings can't self-cancel there
// by design, matching the "Contact staff for cancellation" note the
// website itself shows instead of a cancel button.

import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import * as api from "@/api/client";
import { API_BASE_URL } from "@/api/config";
import { appendFileToFormData } from "@/api/form-file";
import { showAlert } from "@/utils/cross-alert";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

const SUPPORT_EMAIL = "heydreamtravelandtours@gmail.com";
const SUPPORT_PHONE = "0945 776 4140";

interface Booking {
  booking_number: string;
  package_name: string;
  package_duration: string;
  travel_date: string;
  number_of_travelers: number;
  total_amount: number;
  currency: string;
  booking_status: string;
  payment_status: string;
  visa_status: string;
  visa_type_selected: string | null;
  is_renewal: number;
  email: string;
  phone: string;
  admin_notes: string | null;
  payment_proof: string | null;
  partner_approved: number;
  required_documents: string;
  travel_documents: number;
  ready_for_travel: number;
}

function statusStyle(status: string) {
  switch (status) {
    case "confirmed":
      return { bg: "#E8F5E9", fg: "#2E7D32" };
    case "cancelled":
      return { bg: "#FDECEA", fg: "#B00020" };
    case "completed":
      return { bg: "#E3F2FD", fg: "#1565C0" };
    default:
      return { bg: "#FFF3E0", fg: Colors.accent };
  }
}

type StepState = "completed" | "active" | "urgent" | "pending";

interface TrackingStep {
  label: string;
  description: string;
  state: StepState;
}

// Mirrors visa/profile.php's showTracking() step logic, derived from the
// same booking fields rather than any persisted event log -- there is no
// per-event history table for a customer to read (confirmed while
// investigating this repo). admin_notes IS a running text log though (see
// the "Notes from your travel partner" card below), just not step-shaped.
function getTrackingSteps(b: Booking): TrackingStep[] {
  if (b.booking_status === "cancelled") {
    return [
      { label: "Booking Received", description: "This booking has been cancelled.", state: "urgent" },
      { label: "Documents", description: "", state: "urgent" },
      { label: "Payment", description: "", state: "urgent" },
      { label: "Ready for Travel", description: "", state: "urgent" },
    ];
  }

  const visaNeedsAction = b.visa_status === "REQUESTED" || b.visa_status === "DECLINED";
  const documentsStep: TrackingStep = visaNeedsAction
    ? {
        label: "Documents",
        description:
          b.visa_status === "DECLINED"
            ? "Your visa submission was not approved. Please review and resubmit."
            : "A visa is required for this booking. Please submit it below.",
        state: "urgent",
      }
    : {
        label: "Documents",
        description: b.travel_documents
          ? "Your documents are on file."
          : "Please upload your travel requirements.",
        state: b.travel_documents ? "completed" : "active",
      };

  const approvalStep: TrackingStep =
    b.booking_status === "pending"
      ? { label: "Booking Review", description: "We're reviewing and confirming your request.", state: "active" }
      : { label: "Booking Review", description: "Your booking request has been confirmed.", state: "completed" };

  const awaitingVerification = !!b.payment_proof && b.payment_status !== "paid";
  let paymentStep: TrackingStep;
  if (b.payment_status === "paid") {
    paymentStep = { label: "Payment", description: "Payment verified.", state: "completed" };
  } else if (awaitingVerification) {
    paymentStep = { label: "Payment", description: "We're verifying your payment.", state: "active" };
  } else if (b.booking_status === "confirmed") {
    paymentStep = { label: "Payment", description: "Ready for you to submit payment.", state: "active" };
  } else {
    paymentStep = { label: "Payment", description: "Awaiting booking confirmation.", state: "pending" };
  }

  const readyStep: TrackingStep = b.ready_for_travel
    ? { label: "Ready for Travel", description: "You're all set!", state: "completed" }
    : { label: "Ready for Travel", description: "Final step once everything else is done.", state: "pending" };

  return [
    { label: "Booking Received", description: "Your request was submitted.", state: "completed" },
    documentsStep,
    approvalStep,
    paymentStep,
    readyStep,
  ];
}

const STEP_COLORS: Record<StepState, { bg: string; fg: string }> = {
  completed: { bg: "#2E7D32", fg: Colors.white },
  active: { bg: Colors.primary, fg: Colors.white },
  urgent: { bg: "#B00020", fg: Colors.white },
  pending: { bg: Colors.lightGray, fg: Colors.text },
};

function TrackingTracker({ steps }: { steps: TrackingStep[] }) {
  return (
    <View style={styles.tracker}>
      {steps.map((step, idx) => {
        const c = STEP_COLORS[step.state];
        return (
          <View key={step.label} style={styles.trackerRow}>
            <View style={styles.trackerRail}>
              <View style={[styles.trackerDot, { backgroundColor: c.bg }]}>
                {step.state === "completed" ? (
                  <Ionicons name="checkmark" size={13} color={c.fg} />
                ) : (
                  <View style={[styles.trackerDotInner, { backgroundColor: c.fg }]} />
                )}
              </View>
              {idx < steps.length - 1 && <View style={styles.trackerLine} />}
            </View>
            <View style={styles.trackerBody}>
              <ThemedText style={styles.trackerLabel}>{step.label}</ThemedText>
              {!!step.description && (
                <ThemedText style={styles.trackerDescription}>{step.description}</ThemedText>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function ApplicationDetailScreen() {
  const { id: bookingNumber } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [paymentReference, setPaymentReference] = useState("");
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const load = useCallback(async () => {
    const result = await api.getMyVisaBookings();
    if (result.success) {
      const found = (result.data || []).find((b: any) => b.booking_number === bookingNumber);
      if (found) {
        setBooking(found);
        setErrorMessage(null);
      } else {
        setErrorMessage("Application not found.");
      }
    } else {
      setErrorMessage(result.message || result.error || "Failed to load application.");
    }
  }, [bookingNumber]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await load();
      setIsLoading(false);
    })();
  }, [load]);

  const requirements = (booking?.required_documents || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const canPay =
    !!booking &&
    !!booking.partner_approved &&
    booking.booking_status === "confirmed" &&
    booking.payment_status !== "paid" &&
    !booking.payment_proof;

  const pickProof = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert("Permission needed", "Allow photo library access to attach your receipt.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setProofUri(result.assets[0].uri);
    }
  };

  const submitPayment = async () => {
    if (!paymentReference.trim() || !proofUri) {
      showAlert("Missing info", "Enter your payment reference and attach a receipt photo.");
      return;
    }
    setIsSubmittingPayment(true);
    const form = new FormData();
    form.append("booking_number", String(bookingNumber));
    form.append("payment_method", "GCash");
    form.append("payment_reference", paymentReference.trim());
    await appendFileToFormData(form, "payment_proof", {
      uri: proofUri,
      name: "receipt.jpg",
      type: "image/jpeg",
    });

    const result = await api.submitPayment(form);
    setIsSubmittingPayment(false);

    if (result.success) {
      showAlert("Payment Submitted", "We'll verify your payment shortly.");
      await load();
      setPaymentReference("");
      setProofUri(null);
    } else {
      showAlert("Submission Failed", result.message || "Please try again.");
    }
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <StatusBar style="light" />
        <ScreenHeader title="Application" />
        <ActivityIndicator color={Colors.primary} />
      </ThemedView>
    );
  }

  if (errorMessage || !booking) {
    return (
      <ThemedView style={styles.centered}>
        <StatusBar style="light" />
        <ScreenHeader title="Application" />
        <ThemedText style={styles.error}>{errorMessage}</ThemedText>
      </ThemedView>
    );
  }

  const s = statusStyle(booking.booking_status);
  const paymentProofUrl = booking.payment_proof ? `${API_BASE_URL}/${booking.payment_proof}` : null;

  return (
    <ThemedView style={styles.container}>
      <StatusBar style="light" />
      <ScreenHeader title={booking.package_name} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.subtitle}>{booking.booking_number}</ThemedText>
            <View style={styles.badgeRow}>
              {!!booking.is_renewal && (
                <View style={[styles.tag, styles.tagRenewal]}>
                  <Ionicons name="sync" size={11} color={Colors.primary} />
                  <ThemedText style={styles.tagRenewalText}>Renewal</ThemedText>
                </View>
              )}
              {!!booking.visa_type_selected && (
                <View style={styles.tag}>
                  <ThemedText style={styles.tagText}>{booking.visa_type_selected}</ThemedText>
                </View>
              )}
            </View>
          </View>
          <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
            <ThemedText style={[styles.statusText, { color: s.fg }]}>
              {booking.booking_status}
            </ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <TrackingTracker steps={getTrackingSteps(booking)} />
        </View>

        <View style={styles.section}>
          <Row label="Applicant" value={`${booking.email}${booking.phone ? " • " + booking.phone : ""}`} />
          <Row label="Travelers" value={`${booking.number_of_travelers} Guest(s)`} />
          <Row label="Visa Status" value={booking.visa_status} />
          <Row label="Payment" value={booking.payment_status} />
          <Row label="Processing" value={booking.package_duration} />
          <Row
            label="Total"
            value={`${booking.currency}${Number(booking.total_amount).toLocaleString()}`}
            last
          />
        </View>

        {!!booking.payment_proof && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Payment Proof Submitted</ThemedText>
            <Pressable
              style={styles.receiptRow}
              onPress={() => paymentProofUrl && Linking.openURL(paymentProofUrl)}
            >
              {paymentProofUrl && (
                <Image source={{ uri: paymentProofUrl }} style={styles.receiptThumb} contentFit="cover" />
              )}
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.secondaryButtonText}>View Receipt Screenshot</ThemedText>
              </View>
              <Ionicons name="open-outline" size={18} color={Colors.primary} />
            </Pressable>
          </View>
        )}

        {!!booking.admin_notes && (
          <View style={[styles.section, styles.notesSection]}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="chatbox-ellipses" size={16} color={Colors.accent} />
              <ThemedText style={styles.sectionTitle}>Notes From Your Travel Partner</ThemedText>
            </View>
            <ThemedText style={styles.notesText}>{booking.admin_notes}</ThemedText>
          </View>
        )}

        {requirements.length > 0 && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Documents</ThemedText>
            {requirements.map((label) => (
              <View key={label} style={styles.requirementRow}>
                <View style={styles.requirementDot} />
                <ThemedText style={styles.requirement}>{label}</ThemedText>
              </View>
            ))}
            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.push(`/documents/upload?bookingNumber=${booking.booking_number}`)}
            >
              <Ionicons name="cloud-upload-outline" size={16} color={Colors.primary} />
              <ThemedText style={styles.secondaryButtonText}>Manage Documents</ThemedText>
            </Pressable>
          </View>
        )}

        {canPay && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Submit Payment</ThemedText>
            <ThemedText style={styles.helperText}>
              Pay via GCash, then enter the reference number and attach your receipt.
            </ThemedText>
            <TextInput
              style={styles.input}
              placeholder="GCash Reference Number"
              placeholderTextColor="#94a3b8"
              value={paymentReference}
              onChangeText={setPaymentReference}
            />
            <Pressable style={styles.secondaryButton} onPress={pickProof}>
              <Ionicons
                name={proofUri ? "checkmark-circle" : "camera-outline"}
                size={16}
                color={proofUri ? "#2E7D32" : Colors.primary}
              />
              <ThemedText style={styles.secondaryButtonText}>
                {proofUri ? "Receipt Attached" : "Attach Receipt Photo"}
              </ThemedText>
            </Pressable>
            <Pressable
              style={styles.submitButton}
              onPress={submitPayment}
              disabled={isSubmittingPayment}
            >
              {isSubmittingPayment ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <ThemedText style={styles.submitButtonText}>Submit Payment</ThemedText>
              )}
            </Pressable>
          </View>
        )}

        {!canPay && booking.payment_status === "unpaid" && booking.booking_status !== "confirmed" && (
          <View style={styles.noticeBox}>
            <Ionicons name="time-outline" size={18} color={Colors.accent} />
            <ThemedText style={styles.noticeText}>
              Waiting for an agent to review and confirm pricing before payment can be submitted.
            </ThemedText>
          </View>
        )}

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Questions About This Booking?</ThemedText>
          <ThemedText style={styles.helperText}>
            This trip is handled directly by HeyDream Travel and Tours.
          </ThemedText>
          <Pressable
            style={[styles.secondaryButton, styles.chatButton]}
            onPress={() =>
              router.push({ pathname: "/chat/[bookingNumber]", params: { bookingNumber: booking.booking_number } })
            }
          >
            <Ionicons name="chatbubbles-outline" size={16} color={Colors.white} />
            <ThemedText style={styles.chatButtonText}>Chat with HeyDream</ThemedText>
          </Pressable>
          <View style={styles.contactRow}>
            <Pressable
              style={styles.contactPill}
              onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Booking " + booking.booking_number)}`)}
            >
              <Ionicons name="mail-outline" size={14} color={Colors.primary} />
              <ThemedText style={styles.contactPillText}>Email</ThemedText>
            </Pressable>
            <Pressable
              style={styles.contactPill}
              onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`)}
            >
              <Ionicons name="call-outline" size={14} color={Colors.primary} />
              <ThemedText style={styles.contactPillText}>{SUPPORT_PHONE}</ThemedText>
            </Pressable>
          </View>
          <ThemedText style={styles.cancelNote}>Contact staff for cancellation</ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <ThemedText style={styles.rowLabel}>{label}</ThemedText>
      <ThemedText style={styles.rowValue}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  centered: { flex: 1, backgroundColor: Colors.white },
  error: { color: "#B00020", textAlign: "center", padding: 24 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  subtitle: { color: Colors.text, fontSize: 13, marginBottom: 6 },
  badgeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  tag: { backgroundColor: "#E8F0FE", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3 },
  tagText: { color: Colors.primary, fontSize: 10.5, fontWeight: "700" },
  tagRenewal: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFF3E0" },
  tagRenewalText: { color: Colors.primary, fontSize: 10.5, fontWeight: "700" },
  statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  section: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  notesSection: { backgroundColor: "#FFF8E1" },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  notesText: { color: Colors.dark, lineHeight: 20, fontSize: 13 },
  sectionTitle: { marginBottom: 12, fontSize: 17, fontWeight: "800", color: Colors.dark },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E9F0",
  },
  rowLabel: { color: Colors.text },
  rowValue: { fontWeight: "700", color: Colors.dark, flexShrink: 1, textAlign: "right" },
  receiptRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  receiptThumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: Colors.lightGray },
  requirementRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  requirementDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accent, marginTop: 7 },
  requirement: { flex: 1, color: Colors.text, lineHeight: 20 },
  helperText: { color: Colors.text, lineHeight: 20, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    fontSize: 15,
    backgroundColor: Colors.white,
    color: Colors.dark,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
    backgroundColor: Colors.white,
  },
  secondaryButtonText: { color: Colors.primary, fontWeight: "700" },
  chatButton: { backgroundColor: Colors.primary, borderColor: Colors.primary, marginTop: 0 },
  chatButtonText: { color: Colors.white, fontWeight: "700" },
  contactRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  contactPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.white,
  },
  contactPillText: { color: Colors.dark, fontSize: 12.5, fontWeight: "600" },
  cancelNote: { color: Colors.text, fontSize: 12, marginTop: 10, textAlign: "right" },
  submitButton: {
    backgroundColor: Colors.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: { color: Colors.primary, fontWeight: "800", fontSize: 16 },
  noticeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#FFF3E0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  noticeText: { flex: 1, color: "#8A6100", lineHeight: 19, fontSize: 13 },
  tracker: {},
  trackerRow: { flexDirection: "row", gap: 12 },
  trackerRail: { alignItems: "center" },
  trackerDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  trackerDotInner: { width: 8, height: 8, borderRadius: 4 },
  trackerLine: { width: 2, flex: 1, backgroundColor: "#E5E9F0", marginVertical: 2 },
  trackerBody: { flex: 1, paddingBottom: 18 },
  trackerLabel: { fontWeight: "700", color: Colors.dark, fontSize: 14, marginBottom: 2 },
  trackerDescription: { color: Colors.text, fontSize: 12.5, lineHeight: 17 },
});
