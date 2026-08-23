// components/date-field.tsx
// @react-native-community/datetimepicker has NO web implementation -- its
// generic fallback (node_modules/@react-native-community/datetimepicker/
// src/datetimepicker.js) just renders null and console.warns
// "DateTimePicker is not supported on: web" (confirmed by reading the
// library source). Every date field in the app -- applicant DOB, passport
// expiry, target travel date -- silently did nothing when tapped in the web
// preview as a result, the same class of bug as react-native-web's
// Alert.alert no-op found earlier. Native platforms keep the real picker;
// web gets an actual <input type="date">, created via React.createElement
// rather than JSX since react-native's JSX namespace doesn't recognize
// "input" as a valid intrinsic element.
//
// Renders a persistent label above the field (matching every other
// form-group on buttons/visa-book.php: <label>First Name <span
// class="required">*</span></label>, always visible, separate from the
// input itself) -- the original version used the field name AS the
// placeholder, which vanished the moment a date was picked, leaving a bare
// "05/15/1995" (or the browser's own unlabeled "mm/dd/yyyy" while empty)
// with nothing to say which date it even was.

import { Colors } from "@/constants/theme";
import RNDateTimePicker from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, View, ViewStyle } from "react-native";
import { ThemedText } from "./themed-text";

interface DateFieldProps {
  label: string;
  required?: boolean;
  value: Date | null;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  style?: ViewStyle;
}

// Builds YYYY-MM-DD from the Date's LOCAL components, not
// toISOString().slice(0, 10) -- that converts to UTC first, which shifts
// the displayed day backward by one for any positive UTC offset (e.g. the
// Philippines' UTC+8 this whole project is built around: config/database.php
// forces date_default_timezone_set('Asia/Manila')). Caught by round-tripping
// a filled-in date through this function and seeing it redisplay a day
// early.
export function toLocalDateString(d: Date | null | undefined): string | undefined {
  if (!d) return undefined;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const toInputValue = toLocalDateString;

export function DateField({ label, required, value, onChange, minimumDate, maximumDate, style }: DateFieldProps) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <View style={[styles.wrap, style]}>
      <ThemedText style={styles.label}>
        {label}
        {required && <ThemedText style={styles.required}> *</ThemedText>}
      </ThemedText>
      {Platform.OS === "web" ? (
        React.createElement("input", {
          type: "date",
          value: toInputValue(value) || "",
          min: toInputValue(minimumDate),
          max: toInputValue(maximumDate),
          onChange: (e: any) => {
            const v = e.target.value;
            if (v) onChange(new Date(`${v}T00:00:00`));
          },
          style: webInputStyle,
        })
      ) : (
        <>
          <Pressable style={styles.input} onPress={() => setShowPicker(true)}>
            <ThemedText style={value ? undefined : { color: Colors.text }}>
              {value ? value.toLocaleDateString() : "Select date"}
            </ThemedText>
          </Pressable>
          {showPicker && (
            <RNDateTimePicker
              value={value ?? minimumDate ?? new Date()}
              mode="date"
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              onChange={(_, date) => {
                setShowPicker(Platform.OS === "ios");
                if (date) onChange(date);
              }}
            />
          )}
        </>
      )}
    </View>
  );
}

const webInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  fontSize: 15,
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  color: Colors.dark,
  fontFamily: "inherit",
  backgroundColor: "#fff",
  boxSizing: "border-box",
};

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: 12.5, fontWeight: "700", color: Colors.dark, marginBottom: 6 },
  required: { color: "#DC2626" },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    justifyContent: "center",
    color: Colors.dark,
  },
});
