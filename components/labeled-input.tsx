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
  // Muted "(optional)" hint after the label -- the counterpart to `required`'s
  // red asterisk, so a form scanned top-to-bottom makes clear which fields
  // can be safely skipped instead of leaving it ambiguous.
  optional?: boolean;
  containerStyle?: ViewStyle;
}

export function LabeledInput({ label, required, optional, containerStyle, style, ...rest }: LabeledInputProps) {
  return (
    <View style={[styles.wrap, containerStyle]}>
      <ThemedText style={styles.label}>
        {label}
        {required && <ThemedText style={styles.required}> *</ThemedText>}
        {optional && !required && <ThemedText style={styles.optional}> (optional)</ThemedText>}
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
  optional: { color: "#94A3B8", fontWeight: "500", fontSize: 11.5 },
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
