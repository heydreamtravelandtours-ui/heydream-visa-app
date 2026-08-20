// utils/cross-alert.ts
// react-native-web's Alert.alert is a literal no-op (confirmed by reading
// node_modules/react-native-web/dist/exports/Alert/index.js -- `static
// alert() {}`), so every Alert.alert call in this app silently did nothing
// in the web preview, including the logout confirm prompt. Native platforms
// don't have this problem (Alert.alert there hits the real OS dialog), but
// since web is the only environment testable without a physical device,
// route through this cross-platform wrapper instead everywhere in the app.

import { Alert, Platform } from "react-native";

export function showAlert(title: string, message?: string) {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
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
    Alert.alert(title, message, buttons);
  }
}
