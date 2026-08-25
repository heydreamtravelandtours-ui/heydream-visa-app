// plugins/withTwoLineAppName.js
// Android's home-screen label ellipsizes "HeyDream Visa" to "HeyDream..."
// on a single line -- most stock/AOSP-derived launchers (Pixel, Samsung,
// etc.) will instead wrap onto a real second line if the compiled
// app_name string resource contains a literal `\n` escape (a raw newline
// character in the XML gets collapsed as whitespace by aapt, so it has to
// be the two-character `\n` escape sequence, not an actual line break).
// There's no equivalent override for iOS -- it always auto-wraps/ellipsizes
// CFBundleDisplayName based on available width with no way to force a
// break point, so this only targets Android.
const { withStringsXml } = require("@expo/config-plugins");

module.exports = function withTwoLineAppName(config) {
  return withStringsXml(config, (config) => {
    const strings = config.modResults.resources.string;
    if (Array.isArray(strings)) {
      const appNameEntry = strings.find((s) => s.$ && s.$.name === "app_name");
      if (appNameEntry) {
        appNameEntry._ = "HeyDream\\nVisa";
      }
    }
    return config;
  });
};
