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

  useFocusEffect(refresh);

  return { unreadCount, refresh };
}
