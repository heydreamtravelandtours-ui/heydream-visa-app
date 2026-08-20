// app/application/[id].tsx
// Booking status + payment resubmission. Deliberately has NO cancel
// button: User Account/api/cancel-flight-booking.php only allows
// self-cancel for 'Flight Booking' and 'Cruise Vacation' bookings (see its
// own type check) -- visa bookings can't self-cancel there by design, so a
// cancel button here would just always fail. Same limitation the visa
// subdomain's own profile.php silently runs into today.

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import * as api from "@/api/client";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
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
    form.append("payment_proof", {
      uri: proofUri,
      name: "receipt.jpg",
      type: "image/jpeg",
    } as any);

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
        <ActivityIndicator color={Colors.primary} />
      </ThemedView>
    );
  }

  if (errorMessage || !booking) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText style={styles.error}>{errorMessage}</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText type="title" style={styles.title}>
          {booking.package_name}
        </ThemedText>
        <ThemedText style={styles.subtitle}>{booking.booking_number}</ThemedText>

        <View style={styles.section}>
          <Row label="Status" value={booking.booking_status} />
          <Row label="Visa Status" value={booking.visa_status} />
          <Row label="Payment" value={booking.payment_status} />
          <Row label="Processing" value={booking.package_duration} />
          <Row
            label="Total"
            value={`${booking.currency}${Number(booking.total_amount).toLocaleString()}`}
          />
        </View>

        {requirements.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Documents
            </ThemedText>
            {requirements.map((label) => (
              <ThemedText key={label} style={styles.requirement}>
                • {label}
              </ThemedText>
            ))}
            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.push(`/documents/upload?bookingNumber=${booking.booking_number}`)}
            >
              <ThemedText style={styles.secondaryButtonText}>Manage Documents</ThemedText>
            </Pressable>
          </View>
        )}

        {canPay && (
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Submit Payment
            </ThemedText>
            <ThemedText style={styles.helperText}>
              Pay via GCash, then enter the reference number and attach your receipt.
            </ThemedText>
            <TextInput
              style={styles.input}
              placeholder="GCash Reference Number"
              placeholderTextColor={Colors.text}
              value={paymentReference}
              onChangeText={setPaymentReference}
            />
            <Pressable style={styles.secondaryButton} onPress={pickProof}>
              <ThemedText style={styles.secondaryButtonText}>
                {proofUri ? "Receipt Attached ✓" : "Attach Receipt Photo"}
              </ThemedText>
            </Pressable>
            <Pressable
              style={styles.submitButton}
              onPress={submitPayment}
              disabled={isSubmittingPayment}
            >
              {isSubmittingPayment ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <ThemedText style={styles.submitButtonText}>Submit Payment</ThemedText>
              )}
            </Pressable>
          </View>
        )}

        {!canPay && booking.payment_status === "unpaid" && !booking.partner_approved && (
          <ThemedText style={styles.helperText}>
            Waiting for an agent to review and confirm pricing before payment can be submitted.
          </ThemedText>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText style={styles.rowLabel}>{label}</ThemedText>
      <ThemedText type="defaultSemiBold">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  error: { color: "#B00020", textAlign: "center" },
  scrollContent: { padding: 20, paddingBottom: 60 },
  title: { marginBottom: 4 },
  subtitle: { color: Colors.text, marginBottom: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { marginBottom: 10, fontSize: 18 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  rowLabel: { color: Colors.text },
  requirement: { color: Colors.text, marginBottom: 6, lineHeight: 20 },
  helperText: { color: Colors.text, lineHeight: 20, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: Colors.lightGray,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    fontSize: 15,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  secondaryButtonText: { color: Colors.primary, fontWeight: "600" },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
  },
  submitButtonText: { color: Colors.white, fontWeight: "700", fontSize: 16 },
});
