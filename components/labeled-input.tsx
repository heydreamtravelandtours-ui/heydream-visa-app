// components/labeled-input.tsx
// Same fix as date-field.tsx's label, applied to plain text fields: every
// TextInput in the apply wizard used the field name AS the placeholder
// (e.g. "First Name *"), which vanishes the instant something is typed --
// scanning a filled-in form left you with values and no idea which field
// was which. buttons/visa-book.php's real markup always has a persistent
// <label> above the input, separate from its own (optional, lowercase
// example-text) placeholder; this wraps TextInput to match that.

import { Colors } from "@/constants/theme";
import { StyleSheet, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { ThemedText } from "./themed-text";

interface LabeledInputProps extends TextInputProps {
  label: string;
  required?: boolean;
  containerStyle?: ViewStyle;
}

export function LabeledInput({ label, required, containerStyle, style, ...rest }: LabeledInputProps) {
  return (
    <View style={[styles.wrap, containerStyle]}>
      <ThemedText style={styles.label}>
        {label}
        {required && <ThemedText style={styles.required}> *</ThemedText>}
      </ThemedText>
      <TextInput
        style={[styles.input, rest.multiline && styles.inputMultiline, style]}
        placeholderTextColor={Colors.text}
        textAlignVertical={rest.multiline ? "top" : "center"}
        {...rest}
      />
    </View>
  );
}

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
    color: Colors.dark,
  },
  inputMultiline: { minHeight: 84, paddingTop: 14 },
});
