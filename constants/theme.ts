export const Colors = {
  primary: "#0D47A1",
  accent: "#FF8F00",
  gold: "#FFD700",
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
    // Deliberately NOT Colors.white: this app has no dark-mode-aware
    // backgrounds (every card/screen is a fixed light color regardless of
    // system theme), so a bare <ThemedText> picking up a real "dark theme"
    // text color here renders invisible white-on-white the moment the
    // device's system theme is dark -- confirmed live on a real device
    // (processing-option cards, among others). Keep this the same readable
    // dark color as light mode until the app actually grows dark surfaces.
    text: Colors.text,
    background: Colors.dark,
    tint: Colors.accent,
    icon: Colors.lightGray,
    tabIconDefault: Colors.lightGray,
    tabIconSelected: Colors.accent,
  },
};
