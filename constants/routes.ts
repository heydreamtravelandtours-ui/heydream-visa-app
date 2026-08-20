// constants/routes.ts

import type { Href } from "expo-router";

// expo-router's typed-routes generator doesn't emit a bare-group href type
// for "/(tabs)" (only leaf screens like "/(tabs)/index" show up as valid
// literals), even though it's the correct runtime target for returning to
// the tabs' own index screen -- heydream-app's identical (auth) screens use
// this exact string successfully (router.replace("/(tabs)")). Confirmed
// here too: "/(tabs)/index" and "/index" both resolve to expo-router's
// "Unmatched Route" page on web; only the bare group path actually works.
export const HOME_ROUTE = "/(tabs)" as Href;
