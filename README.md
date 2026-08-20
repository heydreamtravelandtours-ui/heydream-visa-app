# HeyDream Visa

Standalone mobile app for visa applications -- browse, apply, upload documents,
track status, and submit payment. No backend of its own: it talks to the same
`heydream-travel-website` PHP API and MySQL database the main site and visa
subdomain already use, the same "independent surface, shared backend" pattern
the visa subdomain uses on web.

## Setup

```
npm install
npx expo start
```

Edit `api/config.ts` and set `LAN_FALLBACK_HOST` to your machine's LAN IP if
auto-detection doesn't find your dev server (needed for testing on a physical
device against a local XAMPP install of `heydream-travel-website`).

## Scope (v1)

- Email/password auth (register requires email verification, same as the web flow)
- Browse the visa catalog and view processing tiers/requirements
- Submit a visa application (single applicant)
- Upload required documents
- Track application status and resubmit payment proof

Not included: self-cancel (the backend doesn't allow visa bookings to
self-cancel -- see the comment in `app/application/[id].tsx`), in-app chat,
push notifications, and partner/agency features (visa applications are
staff-reviewed, not partner-reviewed).
