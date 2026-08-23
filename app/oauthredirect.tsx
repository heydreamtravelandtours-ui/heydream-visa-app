// app/oauthredirect.tsx
// Google's sign-in redirect briefly opens this exact in-app address (see
// components/google-sign-in-button.tsx's redirect override) before
// expo-auth-session's own listener finishes resolving the sign-in -- without
// a real screen registered here, expo-router showed its generic "Unmatched
// Route" page instead. This screen doesn't need to do anything with the
// token itself (the button's own effect handles that once the promise
// resolves); it only needs to exist so the router has somewhere valid to
// land, then bounce back to the tabs.

import { HOME_ROUTE } from "@/constants/routes";
import { Redirect } from "expo-router";

export default function OAuthRedirectScreen() {
  return <Redirect href={HOME_ROUTE} />;
}
