// app/_layout.tsx

import { AuthProvider } from "@/contexts/auth-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

export const unstable_settings = {
  initialRouteName: "index",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)/login" options={{ title: "Log In" }} />
            <Stack.Screen name="(auth)/register" options={{ title: "Create Account" }} />
            <Stack.Screen name="visa/[id]" options={{ title: "Visa Details" }} />
            <Stack.Screen name="apply/[id]" options={{ title: "Apply" }} />
            <Stack.Screen name="my-applications" options={{ title: "My Applications" }} />
            <Stack.Screen name="application/[id]" options={{ title: "Application Status" }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
