// components/screen-header.tsx
// Consistent navy brand header used on every pushed screen, replacing the
// default plain native header so sub-screens still feel like the same app
// as the tab bar / hero sections instead of a bare system title bar.

import { Colors } from "@/constants/theme";
import { HOME_ROUTE } from "@/constants/routes";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function ScreenHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  const router = useRouter();
  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.row}>
        <Pressable
          style={styles.backButton}
          onPress={() => (router.canGoBack() ? router.back() : router.replace(HOME_ROUTE))}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.white} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.right}>{right}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: Colors.primary },
  row: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    paddingHorizontal: 8,
  },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, color: Colors.white, fontSize: 17, fontWeight: "700" },
  right: { minWidth: 40, alignItems: "flex-end" },
});
