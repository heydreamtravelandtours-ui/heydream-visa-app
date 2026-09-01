// app/_layout.tsx

import { AlertHost } from "@/components/alert-host";
import { AppUpdateGate } from "@/components/app-update-gate";
import { ChatAssistant } from "@/components/chat-assistant";
import { AuthProvider } from "@/contexts/auth-context";
import { GateProvider, useGateChoice, VisaGate } from "@/components/visa-gate";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

function GatedApp() {
  const { choice, choosePhOutbound, chooseForeignInbound } = useGateChoice();
  usePushNotifications();

  if (choice === "unknown") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.primary }}>
        <ActivityIndicator color={Colors.white} />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(auth)/register" />
        <Stack.Screen name="visa/[id]" />
        <Stack.Screen name="apply/[id]" />
        <Stack.Screen name="documents/upload" />
        <Stack.Screen name="application/[id]" />
        <Stack.Screen name="chat/[bookingNumber]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="oauthredirect" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="change-password" />
        <Stack.Screen name="support" />
        <Stack.Screen name="about" />
        <Stack.Screen name="social" />
        <Stack.Screen name="terms" />
      </Stack>
      {/* Above every screen, below the gate overlay -- so it's hidden while
          the direction gate is still up, then rides on top afterwards. */}
      <ChatAssistant />
      {choice !== "ph_outbound" && choice !== "foreign_inbound" && (
        // Overlays the Stack instead of replacing it -- mirrors
        // visa/index.php's gate-lock overlay, so reopening it (the
        // direction-switch pill on the home tab) doesn't lose whatever
        // screen/tab was already open underneath.
        <View style={StyleSheet.absoluteFillObject}>
          <VisaGate onChoosePhOutbound={choosePhOutbound} onChooseForeignInbound={chooseForeignInbound} />
        </View>
      )}
      {/* Last -- a forced update must cover the direction gate too. */}
      <AppUpdateGate />
    </>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <GateProvider>
          <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
            <GatedApp />
            <StatusBar style="dark" />
            <AlertHost />
          </ThemeProvider>
        </GateProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
