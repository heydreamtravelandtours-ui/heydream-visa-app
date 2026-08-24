// components/alert-host.tsx
// On-brand replacement for the native Alert.alert()/window.confirm() gray
// system dialogs -- confirmed live on a real device that Android's default
// AlertDialog looks completely out of place next to the rest of this app's
// UI. Mount <AlertHost /> once at the root; utils/cross-alert.ts's
// showAlert/showConfirm call emitAlert() below instead of Alert.alert
// directly, so every existing call site across the app gets this for free
// without touching each one.

import { Colors } from "@/constants/theme";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
}

interface AlertState {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AlertButton[];
}

const initialState: AlertState = { visible: false, title: "", buttons: [] };

let listener: ((state: AlertState) => void) | null = null;

export function emitAlert(title: string, message: string | undefined, buttons: AlertButton[]) {
  listener?.({ visible: true, title, message, buttons });
}

export function AlertHost() {
  const [state, setState] = useState<AlertState>(initialState);

  useEffect(() => {
    listener = setState;
    return () => {
      listener = null;
    };
  }, []);

  const close = (button?: AlertButton) => {
    setState(initialState);
    button?.onPress?.();
  };

  return (
    <Modal visible={state.visible} transparent animationType="fade" onRequestClose={() => close()}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.card}>
          <Text style={styles.title}>{state.title}</Text>
          {!!state.message && <Text style={styles.message}>{state.message}</Text>}
          <View style={[styles.buttonRow, state.buttons.length > 2 && styles.buttonColumn]}>
            {(state.buttons.length ? state.buttons : [{ text: "OK" }]).map((b, idx) => (
              <Pressable
                key={idx}
                style={({ pressed }) => [
                  styles.button,
                  b.style === "cancel" && styles.buttonCancel,
                  b.style === "destructive" && styles.buttonDestructive,
                  b.style !== "cancel" && b.style !== "destructive" && styles.buttonPrimary,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => close(b)}
              >
                <Text
                  style={[
                    styles.buttonText,
                    b.style === "cancel" && styles.buttonTextCancel,
                    b.style === "destructive" && styles.buttonTextDestructive,
                  ]}
                >
                  {b.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,20,35,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 22,
    shadowColor: Colors.black,
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  title: { fontSize: 17, fontWeight: "800", color: Colors.dark, textAlign: "center" },
  message: {
    fontSize: 13.5,
    color: Colors.text,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 19,
  },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  buttonColumn: { flexDirection: "column" },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: { backgroundColor: Colors.gold },
  buttonCancel: { backgroundColor: "#F0F2F5" },
  buttonDestructive: { backgroundColor: "#FDECEA" },
  buttonPressed: { opacity: 0.8 },
  buttonText: { fontWeight: "800", fontSize: 14.5, color: Colors.primary },
  buttonTextCancel: { color: Colors.text },
  buttonTextDestructive: { color: "#B00020" },
});
