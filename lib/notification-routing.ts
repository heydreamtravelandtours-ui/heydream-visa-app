// lib/notification-routing.ts
// Shared route-resolution for a notification -- used by the in-app
// notification list (app/notifications.tsx) and by the push
// tap-handler (hooks/use-push-notifications.ts), so tapping a push
// deep-links to exactly the same place tapping the bell item would.

export function resolveNotificationRoute(n: {
  type: string;
  booking_number?: string | null;
}): string | null {
  if (!n.booking_number) return null;
  // Document-related notifications (missing_documents, document_rejected,
  // additional_documents_requested) jump straight to Manage Documents
  // instead of the general Application Details screen.
  if (n.type.includes("document")) {
    return `/documents/upload?bookingNumber=${n.booking_number}`;
  }
  return `/application/${n.booking_number}`;
}
