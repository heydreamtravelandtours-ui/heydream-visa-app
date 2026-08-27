// components/typing-dots.tsx
// Three dots bouncing in sequence -- used for "assistant is thinking" and
// "the other person is typing" in both chat surfaces, matching the website
// widget's hd-typing-dots.

import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

export function TypingDots({ color = "#94A3B8" }: { color?: string }) {
  const a = useRef(new Animated.Value(0.3)).current;
  const b = useRef(new Animated.Value(0.3)).current;
  const c = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const mk = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          Animated.delay(450 - delay),
        ])
      );
    const anims = [mk(a, 0), mk(b, 150), mk(c, 300)];
    anims.forEach((x) => x.start());
    return () => anims.forEach((x) => x.stop());
  }, [a, b, c]);

  return (
    <View style={styles.row}>
      {[a, b, c].map((v, i) => (
        <Animated.View key={i} style={[styles.dot, { backgroundColor: color, opacity: v }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
