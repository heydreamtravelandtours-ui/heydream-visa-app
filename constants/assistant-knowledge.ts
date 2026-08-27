// constants/assistant-knowledge.ts
// Curated answer tree for the in-app help assistant (components/chat-
// assistant.tsx). The assistant has NO free-text input on purpose -- every
// path is a tappable chip that resolves to one of these answers, so it can
// never be fed a question it wasn't built for. Keep this in sync with the
// "VISA APPLICATION PROCESS" / "PAGES GUIDE" knowledge-base sections in
// inquiry/ai_chat.php, which is what the website + subdomain chatbot reads
// for the same questions.

export const SUPPORT_PHONE = "0945 776 4140";
export const SUPPORT_EMAIL = "heydreamtravelandtours@gmail.com";

export interface AssistantAnswer {
  // Plain text. Blank lines separate paragraphs; lines starting with "• "
  // render as bullets.
  body: string;
  // Opens an external URL in the device browser.
  link?: { label: string; url: string };
  // Navigates within the app (and closes the assistant).
  route?: { label: string; path: string };
  // IDs of follow-up questions offered as chips under the answer.
  followUps?: string[];
}

export interface AssistantTopic {
  id: string;
  question: string;
  answer: AssistantAnswer;
}

// Chips shown the moment the assistant is opened.
export const STARTER_TOPIC_IDS = [
  "apply-how",
  "documents-what",
  "documents-upload",
  "payment-how",
  "track-status",
  "find-things",
];

export const ASSISTANT_TOPICS: AssistantTopic[] = [
  {
    id: "apply-how",
    question: "How do I apply for a visa?",
    answer: {
      body:
        "Applying takes 5 steps:\n\n" +
        "• Trip Info — pick the visa type and processing option, then enter your email, destination and target travel date.\n" +
        "• Applicants — add everyone travelling. Each person needs their name, phone, date of birth, passport number and expiry, and address.\n" +
        "• Documents — optional here. You can attach files now to speed up review, or add them later.\n" +
        "• Review — check everything and see the fee (charged per applicant).\n" +
        "• Submit — an agent reviews your application and contacts you for payment and any remaining documents.",
      route: { label: "Browse visas", path: "/(tabs)" },
      followUps: ["documents-what", "add-applicants", "payment-how", "processing-time"],
    },
  },
  {
    id: "documents-what",
    question: "What documents do I need?",
    answer: {
      body:
        "Every visa lists its own requirements — for example a passport valid for 6 months, a confirmed hotel booking, and proof of sufficient funds. Open the visa (or your application) to see the exact list for your case.\n\n" +
        "Accepted file types: JPG, PNG, WEBP or PDF, up to 10MB each.",
      followUps: ["documents-upload", "apply-how"],
    },
  },
  {
    id: "documents-upload",
    question: "How do I upload documents?",
    answer: {
      body:
        "Open the Applications tab, tap your application, then open Documents. (You can also tap \"Upload a document\" inside the blue \"Documents needed\" box.)\n\n" +
        "Tap a requirement and choose Take Photo, Choose from Gallery, or Choose File. If a document is rejected, the reason is shown right on it — just upload a replacement.",
      route: { label: "Go to My Applications", path: "/(tabs)/applications" },
      followUps: ["documents-what", "track-status"],
    },
  },
  {
    id: "payment-how",
    question: "How does payment work?",
    answer: {
      body:
        "You don't pay when you submit. An agent first reviews your application and confirms the final fee.\n\n" +
        "Once approved, the agent guides you through payment (GCash). You then submit your payment reference and upload a photo of the receipt from your application screen, and the agent verifies it.",
      followUps: ["track-status", "apply-how"],
    },
  },
  {
    id: "track-status",
    question: "How do I track my application?",
    answer: {
      body:
        "Open the Applications tab and tap an application to see its current stage — from agent review, to processing, to ready.\n\n" +
        "You'll also get a notification (the bell icon) and an email each time the status changes.",
      route: { label: "Go to My Applications", path: "/(tabs)/applications" },
      followUps: ["find-notifications", "payment-how"],
    },
  },
  {
    id: "processing-time",
    question: "How long does processing take?",
    answer: {
      body:
        "Each visa offers processing tiers (for example Regular or Express), each with its own price and timeframe. You'll see them as \"Processing Option\" on the first step of the application, and again on the Review step.",
      followUps: ["apply-how", "country-missing"],
    },
  },
  {
    id: "add-applicants",
    question: "Can I apply for more than one person?",
    answer: {
      body:
        "Yes. On the Applicants step, tap \"Add Applicant\" for each extra traveller.\n\n" +
        "The fee is charged per applicant, and every person needs their own passport details and their own set of documents.",
      followUps: ["documents-what", "payment-how"],
    },
  },
  {
    id: "renewal",
    question: "How do I renew an existing visa?",
    answer: {
      body:
        "Open the visa you want to renew and choose Renew instead of Apply. The steps are the same, except you'll also be asked to upload your current visa.",
      followUps: ["documents-what", "apply-how"],
    },
  },
  {
    id: "country-missing",
    question: "My country or visa isn't listed",
    answer: {
      body:
        "If the visa or destination you need isn't in the catalog, an agent can still help you directly.\n\n" +
        `• Call ${SUPPORT_PHONE}\n` +
        `• Email ${SUPPORT_EMAIL}`,
      followUps: ["live-agent"],
    },
  },
  {
    id: "find-things",
    question: "Where do I find things in the app?",
    answer: {
      body: "Tap a section to see where it lives:",
      followUps: [
        "find-applications",
        "find-notifications",
        "find-support",
        "find-profile",
        "find-edit-profile",
      ],
    },
  },
  {
    id: "find-applications",
    question: "My applications",
    answer: {
      body:
        "The Applications tab at the bottom of the screen. Each card opens the full application, where you can view status, open Documents, and submit payment.",
      route: { label: "Open My Applications", path: "/(tabs)/applications" },
      followUps: ["track-status", "documents-upload"],
    },
  },
  {
    id: "find-notifications",
    question: "Notifications",
    answer: {
      body:
        "The bell icon in the top-right of the Home and Profile screens. It shows status updates, agent messages and payment reminders.",
      route: { label: "Open Notifications", path: "/notifications" },
      followUps: ["track-status"],
    },
  },
  {
    id: "find-support",
    question: "Contact Support / report a problem",
    answer: {
      body:
        "Profile tab → Contact Support. Use it to report an account, payment or app problem with a description and an optional screenshot.",
      route: { label: "Open Contact Support", path: "/support" },
      followUps: ["live-agent"],
    },
  },
  {
    id: "find-profile",
    question: "My profile",
    answer: {
      body: "The Profile tab at the bottom-right. It holds your account details, password, and links to Support, About and Terms.",
      route: { label: "Open Profile", path: "/(tabs)/profile" },
      followUps: ["find-edit-profile"],
    },
  },
  {
    id: "find-edit-profile",
    question: "Edit my details / change password",
    answer: {
      body:
        "Profile tab → Edit Profile to change your name, phone, country and date of birth. Profile tab → Change Password (or Set Up Password if you signed in with Google) for your password.",
      route: { label: "Open Profile", path: "/(tabs)/profile" },
    },
  },
];

export const TOPICS_BY_ID: Record<string, AssistantTopic> = Object.fromEntries(
  ASSISTANT_TOPICS.map((t) => [t.id, t])
);
