// components/ui/icon-symbol.tsx - Fixed with message icon

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<string, ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = string;

const MAPPING: Record<string, any> = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  magnifyingglass: "search",
  calendar: "calendar-today",
  airplane: "flight",
  "person.fill": "person",
  heart: "favorite",
  message: "message",
  "message.fill": "message",
  chatbubble: "chat",
  "chatbubble.fill": "chat",
};

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  const iconName = MAPPING[name] || "message";
  return (
    <MaterialIcons color={color} size={size} name={iconName} style={style} />
  );
}
