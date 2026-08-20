export const Colors = {
  primary: "#0D47A1",
  accent: "#FF8F00",
  white: "#FFFFFF",
  black: "#000000",
  dark: "#1A1A1A",
  darkGray: "#333333",
  text: "#666666",
  lightGray: "#F5F5F5",
  background: "#F8FAFC",
};

export const ThemeColors = {
  light: {
    text: Colors.text,
    background: Colors.white,
    tint: Colors.primary,
    icon: Colors.darkGray,
    tabIconDefault: Colors.darkGray,
    tabIconSelected: Colors.primary,
  },
  dark: {
    text: Colors.white,
    background: Colors.dark,
    tint: Colors.accent,
    icon: Colors.lightGray,
    tabIconDefault: Colors.lightGray,
    tabIconSelected: Colors.accent,
  },
};
