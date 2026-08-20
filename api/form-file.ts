// api/form-file.ts
// React Native's fetch polyfill accepts `{ uri, name, type }` as a FormData
// file part on native (iOS/Android) -- that's the documented Expo pattern.
// The browser's real FormData/fetch (used when this app runs on web) has no
// idea what to do with that shape and silently sends nothing useful, which
// is why a picked file upload succeeds on device but fails with "Missing
// file" when tested via `expo start --web`. Route through this helper
// instead of appending the RN file object directly.

import { Platform } from "react-native";

export async function appendFileToFormData(
  form: FormData,
  fieldName: string,
  file: { uri: string; name: string; type: string }
): Promise<void> {
  if (Platform.OS === "web") {
    const response = await fetch(file.uri);
    const blob = await response.blob();
    form.append(fieldName, blob, file.name);
    return;
  }
  form.append(fieldName, {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as any);
}
