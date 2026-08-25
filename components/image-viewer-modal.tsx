// components/image-viewer-modal.tsx
// Full-screen in-app viewer for a document/receipt image -- screens
// previously used Linking.openURL() for this, which backgrounds the app
// entirely and opens the phone's default browser, a jarring "left the app"
// moment for something as routine as checking a photo you just uploaded.
// Pinch-to-zoom comes free from ScrollView's built-in zoom support, no
// extra gesture library needed.

import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";

const { width, height } = Dimensions.get("window");

export function ImageViewerModal({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <StatusBar style="light" />
      <View style={styles.backdrop}>
        <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <ScrollView
          style={StyleSheet.absoluteFill}
          contentContainerStyle={styles.scrollContent}
          maximumZoomScale={4}
          minimumZoomScale={1}
          centerContent
        >
          {!!uri && <Image source={{ uri }} style={styles.image} contentFit="contain" />}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(10,12,20,0.94)" },
  closeBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  image: { width, height: height * 0.85 },
});
