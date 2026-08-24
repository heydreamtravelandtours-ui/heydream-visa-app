// app/apply/[id].tsx
// Mirrors buttons/visa-book.php's real 4-step wizard (Details -> Documents
// -> Review -> Confirmation, js/visa-booking.js) instead of the single flat
// form this screen used to be -- that version hardcoded exactly one
// applicant and had no review/confirmation step at all. Adapted for mobile
// as one screen with internal step state (a horizontal stepper bar) rather
// than the site's four separate DOM containers, since that's the native
// pattern for a paginated form on a phone. Document files are staged
// locally per applicant+requirement and only actually uploaded after the
// booking is created -- same sequencing submitVisaApplication() /
// uploadVisaDocuments() use, just held in React state instead of a
// <input type="file"> + DataTransfer trick.

import { DateField, toLocalDateString } from "@/components/date-field";
import { LabeledInput } from "@/components/labeled-input";
import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { HOME_ROUTE } from "@/constants/routes";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import * as api from "@/api/client";
import { appendFileToFormData } from "@/api/form-file";
import { showAlert } from "@/utils/cross-alert";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
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
  requirements?: string;
}

interface ApplicantDraft {
  firstName: string;
  lastName: string;
  middleName: string;
  suffix: string;
  phone: string;
  dob: Date | null;
  passportNum: string;
  passportExpiry: Date | null;
  address: string;
  occupation: string;
  travelHistory: string;
  expanded: boolean;
}

interface StagedFile {
  uri: string;
  name: string;
  mimeType: string;
}

const EMBASSIES = [
  { value: "manila", label: "Manila" },
  { value: "cebu", label: "Cebu" },
  { value: "davao", label: "Davao" },
];

const STEPS = ["Details", "Documents", "Review", "Confirmation"] as const;

function emptyApplicant(): ApplicantDraft {
  return {
    firstName: "",
    lastName: "",
    middleName: "",
    suffix: "",
    phone: "",
    dob: null,
    passportNum: "",
    passportExpiry: null,
    address: "",
    occupation: "",
    travelHistory: "",
    expanded: true,
  };
}

function formatApplicantName(a: ApplicantDraft) {
  return [a.firstName, a.middleName, a.lastName, a.suffix]
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .join(" ");
}

export default function ApplyScreen() {
  const { id, renewal, direction: directionParam } = useLocalSearchParams<{ id: string; renewal?: string; direction?: string }>();
  const isRenewal = renewal === "1";
  const direction = directionParam === "inbound" ? "inbound" : "outbound";
  const router = useRouter();
  const { user } = useAuth();

  const [visa, setVisa] = useState<VisaDetails | null>(null);
  const [isLoadingVisa, setIsLoadingVisa] = useState(true);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<ProcessingOption | null>(null);

  const [applicants, setApplicants] = useState<ApplicantDraft[]>([emptyApplicant()]);
  const [email, setEmail] = useState("");
  const [destination, setDestination] = useState("");
  const [embassy, setEmbassy] = useState(direction === "inbound" ? "" : "manila");
  const [travelDate, setTravelDate] = useState<Date | null>(null);

  // Keyed "${applicantIndex}_${label}" -- staged, not yet uploaded.
  const [stagedFiles, setStagedFiles] = useState<Record<string, StagedFile>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultBookingNumber, setResultBookingNumber] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setIsLoadingVisa(true);
      const result = await api.getVisaDetails(id, direction);
      if (result.success) {
        setVisa(result.data);
        setDestination(result.data.title);
        const first = result.data.processing_options?.[0];
        if (first) {
          setSelectedType(first.visa_type);
          setSelectedOption(first);
        }
      }
      setIsLoadingVisa(false);
    })();
  }, [id, direction]);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user]);

  const groupedOptions = useMemo(() => {
    const groups = new Map<string, ProcessingOption[]>();
    (visa?.processing_options || []).forEach((opt) => {
      const list = groups.get(opt.visa_type) || [];
      list.push(opt);
      groups.set(opt.visa_type, list);
    });
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visa]);

  const optionsForSelectedType = groupedOptions.find(([t]) => t === selectedType)?.[1] || [];

  // Mirrors visaEffectiveRequirements() in js/visa-booking.js: each entry is
  // `{label, types}` (a bare string is legacy, treated as types: ['*']),
  // filtered down to whichever Visa Type is currently selected, with
  // "Current Visa" stripped then re-added only for a renewal, and
  // "In-Person Meet-up" always excluded since it has no file to upload --
  // previously this list showed every requirement for every type
  // unconditionally, generating a bogus upload slot for meet-up too.
  const requirements: string[] = useMemo(() => {
    if (!visa?.requirements) return [];
    try {
      const parsed = JSON.parse(visa.requirements);
      if (!Array.isArray(parsed)) return [];
      const items: { label: string; types: string[] }[] = parsed
        .map((r: any) => (typeof r === "string" ? { label: r, types: ["*"] } : { label: r?.label, types: r?.types || ["*"] }))
        .filter((r: any) => typeof r.label === "string" && r.label);
      const uploadable = items.filter((r) => r.label !== "In-Person Meet-up");
      const withoutCurrentVisa = uploadable.filter((r) => r.label !== "Current Visa");
      const withRenewal = isRenewal
        ? [...withoutCurrentVisa, { label: "Current Visa", types: ["*"] }]
        : withoutCurrentVisa;
      return withRenewal
        .filter((r) => !selectedType || r.types.includes("*") || r.types.includes(selectedType))
        .map((r) => r.label);
    } catch {
      return [];
    }
  }, [visa, isRenewal, selectedType]);

  const unitPrice = selectedOption ? Number(selectedOption.price) : visa?.price ?? 0;
  const currency = visa?.currency ?? "₱";
  const total = unitPrice * applicants.length;
  const stagedCount = Object.keys(stagedFiles).length;
  const totalDocSlots = requirements.length * applicants.length;

  const updateApplicant = (idx: number, patch: Partial<ApplicantDraft>) => {
    setApplicants((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };

  const addApplicant = () => setApplicants((prev) => [...prev, emptyApplicant()]);
  const removeApplicant = (idx: number) => setApplicants((prev) => prev.filter((_, i) => i !== idx));

  const validateStep1 = () => {
    if (!email.trim()) {
      showAlert("Missing info", "Enter your email address.");
      return false;
    }
    if (!destination.trim()) {
      showAlert("Missing info", "Enter your destination.");
      return false;
    }
    if (!travelDate) {
      showAlert("Missing info", "Choose your target travel date.");
      return false;
    }
    for (let i = 0; i < applicants.length; i++) {
      const a = applicants[i];
      if (!a.firstName.trim() || !a.lastName.trim() || !a.phone.trim() || !a.dob || !a.passportNum.trim() || !a.passportExpiry || !a.address.trim()) {
        showAlert("Missing info", `Fill in all required fields for Applicant ${i + 1}.`);
        return false;
      }
    }
    return true;
  };

  const pickDocument = async (applicantIdx: number, label: string) => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    const key = `${applicantIdx}_${label}`;
    setStagedFiles((prev) => ({
      ...prev,
      [key]: { uri: asset.uri, name: asset.name, mimeType: asset.mimeType || "application/octet-stream" },
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    const applicantsJson = JSON.stringify(
      applicants.map((a, idx) => ({
        index: idx + 1,
        first_name: a.firstName.trim(),
        last_name: a.lastName.trim(),
        middle_name: a.middleName.trim() || null,
        suffix: a.suffix.trim() || null,
        phone: a.phone.trim(),
        dob: toLocalDateString(a.dob) ?? null,
        passport_number: a.passportNum.trim(),
        passport_expiry: toLocalDateString(a.passportExpiry) ?? null,
        address: a.address.trim(),
        occupation: a.occupation.trim() || null,
        travel_history: a.travelHistory.trim() || null,
      }))
    );

    const specialRequestsParts = [
      `Destination: ${destination.trim()}`,
      `Embassy: ${embassy}`,
    ];
    const otherTravelers = applicants.slice(1).map(formatApplicantName).filter(Boolean);
    if (otherTravelers.length > 0) {
      specialRequestsParts.push(`Other Travelers: ${otherTravelers.join(", ")}`);
    }

    const lead = applicants[0];
    const result = await api.saveVisaBooking({
      service_type: direction === "inbound" ? "Foreign Visitor Visa" : "Visa Assistance",
      package_name: visa?.title,
      package_duration: selectedOption
        ? `${selectedOption.visa_type} - ${selectedOption.label} (${selectedOption.processing_time})`
        : "Standard",
      price_per_person: unitPrice,
      full_name: formatApplicantName(lead),
      email: email.trim(),
      phone: lead.phone.trim(),
      travelers: applicants.length,
      travel_date: toLocalDateString(travelDate) ?? null,
      special_requests: specialRequestsParts.join(", "),
      applicants_json: applicantsJson,
      total_amount: total,
      payment_method: "Manual Agent Approval",
      payment_reference: "PENDING_AGENT",
      processing_option_id: selectedOption?.id ?? null,
      visa_type_selected: selectedOption?.visa_type ?? null,
      package_source_id: visa?.id ?? null,
      package_source_type: direction === "inbound" ? "visitor_visa" : "visa",
      is_renewal: isRenewal ? 1 : 0,
    });

    if (!result.success) {
      setIsSubmitting(false);
      showAlert("Submission Failed", result.message || "Please try again.");
      return;
    }

    const bookingNumber = result.booking_number;
    const fileEntries = Object.entries(stagedFiles);
    if (fileEntries.length > 0) {
      await Promise.all(
        fileEntries.map(async ([key, file]) => {
          const [applicantIdxStr, ...labelParts] = key.split("_");
          const label = labelParts.join("_");
          const form = new FormData();
          form.append("action", "upload");
          form.append("booking_number", bookingNumber);
          form.append("document_label", label);
          form.append("traveler_index", String(Number(applicantIdxStr) + 1));
          await appendFileToFormData(form, "document", {
            uri: file.uri,
            name: file.name,
            type: file.mimeType,
          });
          return api.uploadDocument(form);
        })
      );
    }

    setIsSubmitting(false);
    setResultBookingNumber(bookingNumber);
    setStep(4);
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
      <ScreenHeader title={`${isRenewal ? "Renew" : "Apply for"} ${visa?.title ?? ""}`} />

      {step < 4 && (
        <View style={styles.stepper}>
          {STEPS.slice(0, 3).map((label, idx) => {
            const n = idx + 1;
            const isDone = n < step;
            const isActive = n === step;
            return (
              <View key={label} style={styles.stepperItem}>
                <View style={styles.stepperRow}>
                  <View style={[styles.stepDot, isDone && styles.stepDotDone, isActive && styles.stepDotActive]}>
                    {isDone ? (
                      <Ionicons name="checkmark" size={12} color={Colors.white} />
                    ) : (
                      <ThemedText style={[styles.stepDotText, isActive && styles.stepDotTextActive]}>{n}</ThemedText>
                    )}
                  </View>
                  {idx < 2 && <View style={[styles.stepLine, isDone && styles.stepLineDone]} />}
                </View>
                <ThemedText style={[styles.stepLabel, isActive && styles.stepLabelActive]}>{label}</ThemedText>
              </View>
            );
          })}
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {step === 1 && (
          <>
            {groupedOptions.length > 0 && (
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>Visa Type</ThemedText>
                <View style={styles.typeTabsWrap}>
                  <ScrollView horizontal showsHorizontalScrollIndicator style={styles.typeTabsRow}>
                  {groupedOptions.map(([type]) => (
                    <Pressable
                      key={type}
                      style={[styles.typeTab, selectedType === type && styles.typeTabActive]}
                      onPress={() => {
                        setSelectedType(type);
                        const opts = groupedOptions.find(([t]) => t === type)?.[1] || [];
                        setSelectedOption(opts[0] || null);
                      }}
                    >
                      <ThemedText style={[styles.typeTabText, selectedType === type && styles.typeTabTextActive]}>
                        {type}
                      </ThemedText>
                    </Pressable>
                  ))}
                  </ScrollView>
                  {groupedOptions.length > 2 && (
                    <LinearGradient
                      colors={["rgba(255,255,255,0)", Colors.white]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.typeTabsFade}
                      pointerEvents="none"
                    />
                  )}
                </View>

                <ThemedText style={styles.sectionTitle}>Processing Option</ThemedText>
                {optionsForSelectedType.map((opt) => (
                  <Pressable
                    key={opt.id}
                    style={[styles.optionRow, selectedOption?.id === opt.id && styles.optionRowSelected]}
                    onPress={() => setSelectedOption(opt)}
                  >
                    <View style={{ flex: 1 }}>
                      <ThemedText type="defaultSemiBold">{opt.label}</ThemedText>
                      <ThemedText style={styles.optionTime}>{opt.processing_time}</ThemedText>
                    </View>
                    <ThemedText style={styles.optionPrice}>
                      {currency}
                      {Number(opt.price).toLocaleString()}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <ThemedText style={styles.sectionTitle}>
                  Applicants ({applicants.length})
                </ThemedText>
                <Pressable style={styles.addApplicantBtn} onPress={addApplicant}>
                  <Ionicons name="add" size={14} color={Colors.primary} />
                  <ThemedText style={styles.addApplicantText}>Add Applicant</ThemedText>
                </Pressable>
              </View>

              {applicants.map((a, idx) => (
                <View key={idx} style={styles.applicantCard}>
                  <Pressable
                    style={styles.applicantHeader}
                    onPress={() => updateApplicant(idx, { expanded: !a.expanded })}
                  >
                    <Ionicons name="person-circle-outline" size={18} color={Colors.primary} />
                    <ThemedText style={styles.applicantHeaderText}>
                      {formatApplicantName(a) || `Applicant ${idx + 1}`}
                    </ThemedText>
                    {applicants.length > 1 && (
                      <Pressable onPress={() => removeApplicant(idx)} hitSlop={8}>
                        <Ionicons name="trash-outline" size={16} color="#B00020" />
                      </Pressable>
                    )}
                    <Ionicons
                      name={a.expanded ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={Colors.text}
                    />
                  </Pressable>
                  {a.expanded && (
                    <View style={styles.applicantBody}>
                      <LabeledInput
                        label="First Name"
                        required
                        placeholder="First name"
                        value={a.firstName}
                        onChangeText={(v) => updateApplicant(idx, { firstName: v })}
                      />
                      <LabeledInput
                        label="Last Name"
                        required
                        placeholder="Last name"
                        value={a.lastName}
                        onChangeText={(v) => updateApplicant(idx, { lastName: v })}
                      />
                      <View style={styles.rowFields}>
                        <LabeledInput
                          label="Middle Name"
                          placeholder="Middle name"
                          value={a.middleName}
                          onChangeText={(v) => updateApplicant(idx, { middleName: v })}
                          containerStyle={styles.inputHalf}
                        />
                        <LabeledInput
                          label="Suffix"
                          placeholder="Jr., Sr., III"
                          value={a.suffix}
                          onChangeText={(v) => updateApplicant(idx, { suffix: v })}
                          containerStyle={styles.inputHalf}
                        />
                      </View>
                      <LabeledInput
                        label="Phone"
                        required
                        placeholder="+63 912 345 6789"
                        keyboardType="phone-pad"
                        value={a.phone}
                        onChangeText={(v) => updateApplicant(idx, { phone: v })}
                      />
                      <DateField
                        label="Date of Birth"
                        required
                        value={a.dob}
                        maximumDate={new Date()}
                        onChange={(date) => updateApplicant(idx, { dob: date })}
                      />
                      <LabeledInput
                        label="Passport Number"
                        required
                        placeholder="Passport number"
                        autoCapitalize="characters"
                        value={a.passportNum}
                        onChangeText={(v) => updateApplicant(idx, { passportNum: v })}
                      />
                      <DateField
                        label="Passport Expiry"
                        required
                        value={a.passportExpiry}
                        minimumDate={new Date()}
                        onChange={(date) => updateApplicant(idx, { passportExpiry: date })}
                      />
                      <LabeledInput
                        label="Address"
                        required
                        placeholder="Complete address"
                        value={a.address}
                        onChangeText={(v) => updateApplicant(idx, { address: v })}
                      />
                      <View style={styles.rowFields}>
                        <LabeledInput
                          label="Occupation"
                          placeholder="Job title"
                          value={a.occupation}
                          onChangeText={(v) => updateApplicant(idx, { occupation: v })}
                          containerStyle={styles.inputHalf}
                        />
                        <LabeledInput
                          label="Travel History"
                          placeholder="Countries visited"
                          value={a.travelHistory}
                          onChangeText={(v) => updateApplicant(idx, { travelHistory: v })}
                          containerStyle={styles.inputHalf}
                        />
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Trip Info</ThemedText>
              <LabeledInput
                label="Email Address"
                required
                placeholder="Your email address"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
              <LabeledInput
                label={direction === "inbound" ? "Your Home Country" : "Destination"}
                required
                placeholder="Country name"
                value={destination}
                onChangeText={setDestination}
                editable={direction !== "inbound"}
                style={direction === "inbound" ? styles.inputLocked : undefined}
              />
              {direction === "inbound" ? (
                // A foreign applicant entering the Philippines wouldn't pick
                // from a fixed list of PH cities (that's outbound-only --
                // where a Filipino goes to apply for a FOREIGN visa) -- free
                // text instead, since HeyDream can't maintain a dropdown of
                // every country's PH embassy.
                <LabeledInput
                  label="PH Embassy/Consulate Used"
                  placeholder="e.g. Philippine Embassy in your country (if applicable)"
                  value={embassy}
                  onChangeText={setEmbassy}
                />
              ) : (
                <View style={styles.fieldWrap}>
                  <ThemedText style={styles.fieldLabel}>Embassy/Consulate</ThemedText>
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
                </View>
              )}
              <DateField
                label="Target Travel Date"
                required
                value={travelDate}
                minimumDate={new Date()}
                onChange={setTravelDate}
              />
            </View>

            <Pressable
              style={styles.nextButton}
              onPress={() => {
                if (validateStep1()) setStep(2);
              }}
            >
              <ThemedText style={styles.nextButtonText}>Continue to Documents</ThemedText>
              <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
            </Pressable>
          </>
        )}

        {step === 2 && (
          <>
            <View style={styles.infoBanner}>
              <Ionicons name="information-circle" size={16} color={Colors.primary} />
              <ThemedText style={styles.infoBannerText}>
                Uploading now is optional and helps speed up review -- you can also add or update
                these later from My Applications.
              </ThemedText>
            </View>

            {requirements.length === 0 ? (
              <ThemedText style={styles.helperText}>
                No specific document list for this visa -- an agent will contact you if anything is
                needed.
              </ThemedText>
            ) : (
              applicants.map((a, idx) => (
                <View key={idx} style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>
                    Applicant {idx + 1}
                    {formatApplicantName(a) ? ` — ${formatApplicantName(a)}` : ""} — Documents
                  </ThemedText>
                  {requirements.map((label) => {
                    const key = `${idx}_${label}`;
                    const staged = stagedFiles[key];
                    return (
                      <Pressable
                        key={label}
                        style={styles.docPickRow}
                        onPress={() => pickDocument(idx, label)}
                      >
                        <Ionicons
                          name={staged ? "checkmark-circle" : "cloud-upload-outline"}
                          size={18}
                          color={staged ? "#2E7D32" : Colors.primary}
                        />
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.docPickLabel}>{label}</ThemedText>
                          <ThemedText style={styles.docPickFileName} numberOfLines={1}>
                            {staged ? staged.name : "No file selected"}
                          </ThemedText>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))
            )}

            <View style={styles.stepNavRow}>
              <Pressable style={styles.backButton} onPress={() => setStep(1)}>
                <Ionicons name="arrow-back" size={16} color={Colors.dark} />
                <ThemedText style={styles.backButtonText}>Back</ThemedText>
              </Pressable>
              <Pressable style={[styles.nextButton, { flex: 1 }]} onPress={() => setStep(3)}>
                <ThemedText style={styles.nextButtonText}>Continue to Review</ThemedText>
                <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
              </Pressable>
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Applicant Info</ThemedText>
              {!!selectedOption && <Row label="Visa Type" value={selectedOption.visa_type} />}
              <Row label="Applicants" value={`${applicants.length} Person${applicants.length > 1 ? "s" : ""}`} />
              {applicants.map((a, idx) => (
                <Row
                  key={idx}
                  label={`Applicant ${idx + 1}`}
                  value={`${formatApplicantName(a)} — Passport ${a.passportNum}${
                    a.passportExpiry ? ` (Exp: ${a.passportExpiry.toLocaleDateString()})` : ""
                  }`}
                />
              ))}
              <Row label="Email" value={email} last />
            </View>

            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Travel Details</ThemedText>
              <Row label="Destination" value={destination} />
              <Row label="Embassy" value={EMBASSIES.find((e) => e.value === embassy)?.label ?? embassy} />
              <Row label="Travel Date" value={travelDate ? travelDate.toLocaleDateString() : "To be determined"} />
              <Row
                label="Processing"
                value={selectedOption ? `${selectedOption.label} (${selectedOption.processing_time})` : "Standard"}
                last
              />
            </View>

            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Documents</ThemedText>
              <Row label="Uploaded" value={`${stagedCount} of ${totalDocSlots} document${totalDocSlots > 1 ? "s" : ""}`} last />
            </View>

            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Fee Summary</ThemedText>
              <Row label="Fee" value={`${currency}${unitPrice.toLocaleString()} x ${applicants.length}`} />
              <View style={[styles.row, { borderBottomWidth: 0 }]}>
                <ThemedText style={styles.rowLabel}>Total to Pay</ThemedText>
                <ThemedText style={styles.totalValue}>
                  {currency}
                  {total.toLocaleString()}
                </ThemedText>
              </View>
            </View>

            <View style={styles.infoBanner}>
              <Ionicons name="information-circle" size={16} color={Colors.primary} />
              <ThemedText style={styles.infoBannerText}>
                After submitting, an agent will review your application and contact you for the
                payment process and remaining document collection.
              </ThemedText>
            </View>

            <View style={styles.stepNavRow}>
              <Pressable style={styles.backButton} onPress={() => setStep(2)} disabled={isSubmitting}>
                <Ionicons name="arrow-back" size={16} color={Colors.dark} />
                <ThemedText style={styles.backButtonText}>Back</ThemedText>
              </Pressable>
              <Pressable style={[styles.submitButton, { flex: 1 }]} onPress={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator color={Colors.primary} />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={16} color={Colors.primary} />
                    <ThemedText style={styles.submitButtonText}>Submit Application</ThemedText>
                  </>
                )}
              </Pressable>
            </View>
          </>
        )}

        {step === 4 && resultBookingNumber && (
          <View style={styles.confirmWrap}>
            <View style={styles.confirmIconWrap}>
              <Ionicons name="time" size={36} color={Colors.accent} />
            </View>
            <ThemedText style={styles.confirmTitle}>Application Received!</ThemedText>
            <ThemedText style={styles.confirmText}>
              Your application is now being reviewed by our agents.
            </ThemedText>
            <View style={styles.confirmRefBox}>
              <ThemedText style={styles.confirmRefText}>
                Application Reference: {resultBookingNumber}
              </ThemedText>
            </View>
            <View style={styles.confirmDetailsCard}>
              <ThemedText style={styles.confirmDetailsTitle}>Next Steps:</ThemedText>
              <ThemedText style={styles.confirmDetailsItem}>
                1. Our expert agents will review your details manually.
              </ThemedText>
              <ThemedText style={styles.confirmDetailsItem}>
                2. You will receive an email at {email} once approved.
              </ThemedText>
              <ThemedText style={styles.confirmDetailsItem}>
                3. Upon approval, we will guide you through the document collection and final
                payment.
              </ThemedText>
            </View>
            <Pressable
              style={styles.nextButton}
              onPress={() => router.replace(`/application/${resultBookingNumber}`)}
            >
              <Ionicons name="document-text-outline" size={16} color={Colors.primary} />
              <ThemedText style={styles.nextButtonText}>View My Application</ThemedText>
            </Pressable>
            <Pressable style={styles.backButton} onPress={() => router.replace(HOME_ROUTE)}>
              <ThemedText style={styles.backButtonText}>Done</ThemedText>
            </Pressable>
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
  scrollContent: { padding: 20, paddingBottom: 60 },
  stepper: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  stepperItem: { flex: 1, alignItems: "center" },
  stepperRow: { flexDirection: "row", alignItems: "center", width: "100%" },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.lightGray,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotActive: { backgroundColor: Colors.gold },
  stepDotDone: { backgroundColor: "#2E7D32" },
  stepDotText: { fontSize: 12, fontWeight: "700", color: Colors.text },
  stepDotTextActive: { color: Colors.primary },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.lightGray },
  stepLineDone: { backgroundColor: "#2E7D32" },
  stepLabel: { fontSize: 10.5, color: Colors.text, marginTop: 4 },
  stepLabelActive: { color: Colors.dark, fontWeight: "700" },
  section: { marginBottom: 24 },
  sectionTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: Colors.dark, marginBottom: 12 },
  addApplicantBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  addApplicantText: { color: Colors.primary, fontWeight: "700", fontSize: 12 },
  applicantCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    marginBottom: 10,
    overflow: "hidden",
  },
  applicantHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.background,
    padding: 12,
  },
  applicantHeaderText: { flex: 1, fontWeight: "700", color: Colors.primary, fontSize: 13.5 },
  applicantBody: { padding: 14, backgroundColor: Colors.white },
  fieldWrap: { marginBottom: 12 },
  fieldLabel: { fontSize: 12.5, fontWeight: "700", color: Colors.dark, marginBottom: 6 },
  rowFields: { flexDirection: "row", gap: 10 },
  inputHalf: { flex: 1 },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  typeTabsWrap: { position: "relative", marginBottom: 16 },
  typeTabsRow: {},
  // A row of pills with more off-screen to the right had no visual hint
  // that it scrolls -- the native indicator is subtle on Android and this
  // fade makes it obvious there's more without needing to discover it by
  // accident.
  typeTabsFade: { position: "absolute", right: 0, top: 0, bottom: 0, width: 28 },
  typeTab: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
    backgroundColor: Colors.white,
  },
  typeTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeTabText: { fontSize: 12.5, fontWeight: "700", color: Colors.dark },
  typeTabTextActive: { color: Colors.white },
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
  optionTime: { color: Colors.text, fontSize: 12, marginTop: 2 },
  embassyRow: { flexDirection: "row", gap: 8 },
  embassyPill: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  embassyPillSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  embassyTextSelected: { color: Colors.white },
  helperText: { color: Colors.text, lineHeight: 20, marginBottom: 16 },
  infoBanner: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#E8F0FE",
    borderRadius: 10,
    padding: 12,
    marginBottom: 18,
    alignItems: "flex-start",
  },
  infoBannerText: { flex: 1, color: Colors.primary, fontSize: 12.5, lineHeight: 18 },
  docPickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  docPickLabel: { fontWeight: "600", color: Colors.dark, fontSize: 13.5 },
  docPickFileName: { color: Colors.text, fontSize: 11.5, marginTop: 2 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E9F0",
  },
  rowLabel: { color: Colors.text, flexShrink: 0, marginRight: 10 },
  rowValue: { fontWeight: "700", color: Colors.dark, flex: 1, textAlign: "right" },
  totalValue: { fontSize: 18, fontWeight: "900", color: Colors.accent },
  stepNavRow: { flexDirection: "row", gap: 10 },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  backButtonText: { color: Colors.dark, fontWeight: "700", fontSize: 14 },
  nextButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.gold,
    borderRadius: 14,
    paddingVertical: 16,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonText: { color: Colors.primary, fontWeight: "800", fontSize: 15 },
  inputLocked: { backgroundColor: "#f0f2f5", color: "#666" },
  submitButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.gold,
    borderRadius: 14,
    paddingVertical: 16,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: { color: Colors.primary, fontWeight: "800", fontSize: 15 },
  confirmWrap: { alignItems: "center", paddingTop: 20 },
  confirmIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFF3E0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  confirmTitle: { fontSize: 21, fontWeight: "800", color: Colors.dark, marginBottom: 8, textAlign: "center" },
  confirmText: { color: Colors.text, textAlign: "center", lineHeight: 20, marginBottom: 18 },
  confirmRefBox: {
    backgroundColor: "#E8F0FE",
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginBottom: 20,
  },
  confirmRefText: { color: Colors.primary, fontWeight: "700", fontSize: 13.5 },
  confirmDetailsCard: {
    width: "100%",
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  confirmDetailsTitle: { fontWeight: "800", color: Colors.dark, marginBottom: 8, fontSize: 13.5 },
  confirmDetailsItem: { color: Colors.text, fontSize: 13, lineHeight: 20, marginBottom: 4 },
});
