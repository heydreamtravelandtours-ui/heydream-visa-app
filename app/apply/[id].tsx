// app/apply/[id].tsx
// Application form, posting the exact same payload shape
// js/visa-booking.js's web wizard sends to api/save-service-booking.php
// (see submitVisaApplication() there). v1 supports a single applicant --
// the web wizard's multi-applicant support isn't replicated here yet.

import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import * as api from "@/api/client";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

interface ProcessingOption {
  id: number;
  visa_type: string;
  label: string;
  processing_time: string;
  price: number;
}

interface VisaDetails {
  id: number;
  title: string;
  currency: string;
  price: number;
  processing_options: ProcessingOption[];
}

const EMBASSIES = [
  { value: "manila", label: "Manila" },
  { value: "cebu", label: "Cebu" },
  { value: "davao", label: "Davao" },
];

export default function ApplyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [visa, setVisa] = useState<VisaDetails | null>(null);
  const [isLoadingVisa, setIsLoadingVisa] = useState(true);
  const [selectedOption, setSelectedOption] = useState<ProcessingOption | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState<Date | null>(null);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [passportNum, setPassportNum] = useState("");
  const [passportExpiry, setPassportExpiry] = useState<Date | null>(null);
  const [showPassportExpiryPicker, setShowPassportExpiryPicker] = useState(false);
  const [address, setAddress] = useState("");

  const [destination, setDestination] = useState("");
  const [embassy, setEmbassy] = useState("manila");
  const [travelDate, setTravelDate] = useState<Date | null>(null);
  const [showTravelDatePicker, setShowTravelDatePicker] = useState(false);
  const [occupation, setOccupation] = useState("");
  const [travelHistory, setTravelHistory] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      setIsLoadingVisa(true);
      const result = await api.getVisaDetails(id);
      if (result.success) {
        setVisa(result.data);
        setDestination(result.data.title);
        if (result.data.processing_options?.length > 0) {
          setSelectedOption(result.data.processing_options[0]);
        }
      }
      setIsLoadingVisa(false);
    })();
  }, [id]);

  const unitPrice = selectedOption ? Number(selectedOption.price) : visa?.price ?? 0;
  const currency = visa?.currency ?? "₱";

  const handleSubmit = async () => {
    if (!user) {
      router.push("/(auth)/login");
      return;
    }
    if (!firstName.trim() || !lastName.trim() || !passportNum.trim()) {
      Alert.alert("Missing info", "Enter applicant name and passport number.");
      return;
    }
    if (!phone.trim()) {
      Alert.alert("Missing info", "Enter a contact phone number.");
      return;
    }

    setIsSubmitting(true);

    const applicant = {
      index: 1,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      middle_name: null,
      suffix: null,
      phone: phone.trim(),
      dob: dob ? dob.toISOString().slice(0, 10) : null,
      passport_number: passportNum.trim(),
      passport_expiry: passportExpiry ? passportExpiry.toISOString().slice(0, 10) : null,
      address: address.trim(),
    };

    const specialRequests = [
      `Destination: ${destination}`,
      `Embassy: ${embassy}`,
      `Occupation: ${occupation}`,
      `Travel History: ${travelHistory}`,
    ].join(", ");

    const result = await api.saveVisaBooking({
      service_type: "Visa Assistance",
      package_name: visa?.title,
      package_duration: selectedOption
        ? `${selectedOption.visa_type} - ${selectedOption.label} (${selectedOption.processing_time})`
        : "Standard",
      price_per_person: unitPrice,
      full_name: `${firstName.trim()} ${lastName.trim()}`,
      email: user.email,
      phone: phone.trim(),
      travelers: 1,
      travel_date: travelDate ? travelDate.toISOString().slice(0, 10) : null,
      special_requests: specialRequests,
      applicants_json: JSON.stringify([applicant]),
      total_amount: unitPrice,
      payment_method: "Manual Agent Approval",
      payment_reference: "PENDING_AGENT",
      processing_option_id: selectedOption?.id ?? null,
      visa_type_selected: selectedOption?.visa_type ?? null,
      package_source_id: visa?.id ?? null,
      package_source_type: "visa",
      is_renewal: 0,
    });

    setIsSubmitting(false);

    if (result.success) {
      Alert.alert(
        "Application Submitted",
        "An agent will review your application and contact you for payment and any remaining documents.",
        [
          {
            text: "Upload Documents",
            onPress: () =>
              router.replace(`/documents/upload?bookingNumber=${result.booking_number}&visaId=${id}`),
          },
        ]
      );
    } else {
      Alert.alert("Submission Failed", result.message || "Please try again.");
    }
  };

  if (isLoadingVisa) {
    return (
      <ThemedView style={styles.centered}>
        <StatusBar style="light" />
        <ScreenHeader title="Apply" />
        <ActivityIndicator color={Colors.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <StatusBar style="light" />
      <ScreenHeader title={`Apply for ${visa?.title ?? ""}`} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {visa && visa.processing_options.length > 0 && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Processing Option</ThemedText>
            {visa.processing_options.map((opt) => (
              <Pressable
                key={opt.id}
                style={[
                  styles.optionRow,
                  selectedOption?.id === opt.id && styles.optionRowSelected,
                ]}
                onPress={() => setSelectedOption(opt)}
              >
                <ThemedText type="defaultSemiBold">{opt.label || opt.visa_type}</ThemedText>
                <ThemedText style={styles.optionPrice}>
                  {currency}
                  {Number(opt.price).toLocaleString()}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Applicant Info</ThemedText>
          <TextInput style={styles.input} placeholder="First Name" placeholderTextColor={Colors.text} value={firstName} onChangeText={setFirstName} />
          <TextInput style={styles.input} placeholder="Last Name" placeholderTextColor={Colors.text} value={lastName} onChangeText={setLastName} />
          <TextInput style={styles.input} placeholder="Phone Number" placeholderTextColor={Colors.text} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          <DateField label="Date of Birth" value={dob} onPress={() => setShowDobPicker(true)} />
          {showDobPicker && (
            <DateTimePicker
              value={dob ?? new Date(1990, 0, 1)}
              mode="date"
              maximumDate={new Date()}
              onChange={(_, date) => {
                setShowDobPicker(Platform.OS === "ios");
                if (date) setDob(date);
              }}
            />
          )}
          <TextInput style={styles.input} placeholder="Passport Number" placeholderTextColor={Colors.text} autoCapitalize="characters" value={passportNum} onChangeText={setPassportNum} />
          <DateField label="Passport Expiry" value={passportExpiry} onPress={() => setShowPassportExpiryPicker(true)} />
          {showPassportExpiryPicker && (
            <DateTimePicker
              value={passportExpiry ?? new Date()}
              mode="date"
              minimumDate={new Date()}
              onChange={(_, date) => {
                setShowPassportExpiryPicker(Platform.OS === "ios");
                if (date) setPassportExpiry(date);
              }}
            />
          )}
          <TextInput style={styles.input} placeholder="Address" placeholderTextColor={Colors.text} value={address} onChangeText={setAddress} />
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Trip Info</ThemedText>
          <View style={styles.embassyRow}>
            {EMBASSIES.map((e) => (
              <Pressable
                key={e.value}
                style={[styles.embassyPill, embassy === e.value && styles.embassyPillSelected]}
                onPress={() => setEmbassy(e.value)}
              >
                <ThemedText style={embassy === e.value ? styles.embassyTextSelected : undefined}>
                  {e.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
          <DateField label="Target Travel Date" value={travelDate} onPress={() => setShowTravelDatePicker(true)} />
          {showTravelDatePicker && (
            <DateTimePicker
              value={travelDate ?? new Date()}
              mode="date"
              minimumDate={new Date()}
              onChange={(_, date) => {
                setShowTravelDatePicker(Platform.OS === "ios");
                if (date) setTravelDate(date);
              }}
            />
          )}
          <TextInput style={styles.input} placeholder="Occupation" placeholderTextColor={Colors.text} value={occupation} onChangeText={setOccupation} />
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Travel History (previous countries visited)"
            placeholderTextColor={Colors.text}
            multiline
            value={travelHistory}
            onChangeText={setTravelHistory}
          />
        </View>

        <View style={styles.totalRow}>
          <ThemedText style={styles.totalLabel}>Total</ThemedText>
          <ThemedText style={styles.totalValue}>
            {currency}
            {unitPrice.toLocaleString()}
          </ThemedText>
        </View>

        <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <ThemedText style={styles.submitButtonText}>Submit Application</ThemedText>
          )}
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

function DateField({
  label,
  value,
  onPress,
}: {
  label: string;
  value: Date | null;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.input} onPress={onPress}>
      <ThemedText style={value ? undefined : { color: Colors.text }}>
        {value ? value.toLocaleDateString() : label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  centered: { flex: 1, backgroundColor: Colors.white },
  scrollContent: { padding: 20, paddingBottom: 60 },
  section: { marginBottom: 24 },
  sectionTitle: { marginBottom: 12, fontSize: 17, fontWeight: "800", color: Colors.dark },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    fontSize: 15,
    justifyContent: "center",
    color: Colors.dark,
  },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  optionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  optionRowSelected: { borderColor: Colors.primary, backgroundColor: "#E8F0FE" },
  optionPrice: { color: Colors.primary, fontWeight: "800" },
  embassyRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  embassyPill: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  embassyPillSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  embassyTextSelected: { color: Colors.white },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
  },
  totalLabel: { fontWeight: "700", color: Colors.dark, fontSize: 15 },
  totalValue: { fontSize: 22, fontWeight: "800", color: Colors.primary },
  submitButton: {
    backgroundColor: Colors.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: { color: Colors.primary, fontWeight: "800", fontSize: 16 },
});
