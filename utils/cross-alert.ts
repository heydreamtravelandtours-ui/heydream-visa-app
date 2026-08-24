// utils/cross-alert.ts
// react-native-web's Alert.alert is a literal no-op (confirmed by reading
// node_modules/react-native-web/dist/exports/Alert/index.js -- `static
// alert() {}`), so every Alert.alert call in this app silently did nothing
// in the web preview, including the logout confirm prompt. Web keeps the
// browser-native window.alert/confirm fallback below since it's only used
// for local dev preview.
//
// Native (the actual shipped app) used to hit Alert.alert too -- confirmed
// live on a real device that its default gray AlertDialog looks completely
// out of place next to the rest of the app's branded UI. Routes through
// components/alert-host.tsx's on-brand modal there instead, so every
// existing call site gets the better UI for free.

import { Platform } from "react-native";
import { emitAlert } from "@/components/alert-host";

export function showAlert(title: string, message?: string) {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    emitAlert(title, message, [{ text: "OK" }]);
  }
}

interface ConfirmButton {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
}

// Mirrors Alert.alert(title, message, buttons) for the common 2-button
// confirm pattern (Cancel + a destructive/primary action).
export function showConfirm(title: string, message: string, buttons: ConfirmButton[]) {
  if (Platform.OS === "web") {
    const confirmBtn = buttons.find((b) => b.style !== "cancel") || buttons[buttons.length - 1];
    if (window.confirm(message ? `${title}\n\n${message}` : title)) {
      confirmBtn?.onPress?.();
    } else {
      buttons.find((b) => b.style === "cancel")?.onPress?.();
    }
  } else {
    emitAlert(title, message, buttons);
  }
}
