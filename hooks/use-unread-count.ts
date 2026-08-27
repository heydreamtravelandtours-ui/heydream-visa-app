// hooks/use-unread-count.ts
// Single source of truth for the notification badge count, shared by every
// tab header (Home, Applications, Profile) so they all show the same number
// instead of each screen fetching its own -- previously only index.tsx did
// this, which is why the bell/badge only ever showed up on the Home tab.
//
// Refetches on every focus (not just mount): tabs stay mounted once
// visited, so without this, reading a notification and switching back to a
// tab left its badge showing the stale pre-read count -- confirmed on a
// real device the badge never went down after opening Notifications.

import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import * as api from "@/api/client";
import { useAuth } from "@/contexts/auth-context";

// Re-checks while a tab is focused, not only on focus, so a reply that
// lands from the admin side (which drops a 'chat_reply' notification) shows
// on the bell within ~30s without the user switching tabs.
const POLL_MS = 30000;

export function useUnreadCount() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    api.getNotifications().then((result) => {
      if (result.success) setUnreadCount(result.unread_count || 0);
    });
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      if (!user) return;
      const id = setInterval(refresh, POLL_MS);
      return () => clearInterval(id);
    }, [refresh, user])
  );

  return { unreadCount, refresh };
}
