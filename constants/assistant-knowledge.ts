// constants/assistant-knowledge.ts
// Starter prompts + contact details for the in-app help assistant
// (components/chat-assistant.tsx). The assistant lets the user type freely;
// every message (typed or tapped) goes to the same ai_chat.php the website
// chatbot uses (source: "visa"), which already handles smart answers, an
// offline fallback, and redirecting off-topic / unanswerable questions to
// something useful. These are just the quick-tap suggestions shown before
// the user has asked anything.

export const SUPPORT_PHONE = "0945 776 4140";
export const SUPPORT_EMAIL = "heydreamtravelandtours@gmail.com";

export const STARTER_QUESTIONS: string[] = [
  "How do I apply for a visa?",
  "What documents do I need?",
  "How does payment work?",
  "How do I track my application?",
  "Talk to a live agent",
];
