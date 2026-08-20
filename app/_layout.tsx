// app/_layout.tsx

import { AuthProvider } from "@/contexts/auth-context";
import { useGateChoice, VisaGate } from "@/components/visa-gate";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

function GatedApp() {
  const { choice, choosePhOutbound } = useGateChoice();

  if (choice === "unknown") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.primary }}>
        <ActivityIndicator color={Colors.white} />
      </View>
    );
  }

  if (choice !== "ph_outbound") {
    return <VisaGate onChoose={choosePhOutbound} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)/login" />
      <Stack.Screen name="(auth)/register" />
      <Stack.Screen name="visa/[id]" />
      <Stack.Screen name="apply/[id]" />
      <Stack.Screen name="documents/upload" />
      <Stack.Screen name="application/[id]" />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
          <GatedApp />
          <StatusBar style="dark" />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
