// app/application/[id].tsx
// Booking status + payment resubmission. Deliberately has NO cancel
// button: User Account/api/cancel-flight-booking.php only allows
// self-cancel for 'Flight Booking' and 'Cruise Vacation' bookings (see its
// own type check) -- visa bookings can't self-cancel there by design, so a
// cancel button here would just always fail. Same limitation the visa
// subdomain's own profile.php silently runs into today.

import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import * as api from "@/api/client";
import { appendFileToFormData } from "@/api/form-file";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

interface Booking {
  booking_number: string;
  package_name: string;
  package_duration: string;
  travel_date: string;
  total_amount: number;
  currency: string;
  booking_status: string;
  payment_status: string;
  visa_status: string;
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

// Mirrors visa/profile.php's showTracking() 4-step progress tracker
// (Booking Received -> Documents -> Payment -> Ready for Travel), derived
// from the same booking fields rather than any persisted event log --
// there is no per-event history table for a customer to read (confirmed
// while investigating this repo).
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
      Alert.alert("Permission needed", "Allow photo library access to attach your receipt.");
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
      Alert.alert("Missing info", "Enter your payment reference and attach a receipt photo.");
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
      Alert.alert("Payment Submitted", "We'll verify your payment shortly.");
      await load();
      setPaymentReference("");
      setProofUri(null);
    } else {
      Alert.alert("Submission Failed", result.message || "Please try again.");
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

  return (
    <ThemedView style={styles.container}>
      <StatusBar style="light" />
      <ScreenHeader title={booking.package_name} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.titleRow}>
          <View>
            <ThemedText style={styles.subtitle}>{booking.booking_number}</ThemedText>
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
          <Row label="Visa Status" value={booking.visa_status} />
          <Row label="Payment" value={booking.payment_status} />
          <Row label="Processing" value={booking.package_duration} />
          <Row
            label="Total"
            value={`${booking.currency}${Number(booking.total_amount).toLocaleString()}`}
            last
          />
        </View>

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
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  subtitle: { color: Colors.text, fontSize: 13 },
  statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  section: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: { marginBottom: 12, fontSize: 17, fontWeight: "800", color: Colors.dark },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E9F0",
  },
  rowLabel: { color: Colors.text },
  rowValue: { fontWeight: "700", color: Colors.dark },
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
