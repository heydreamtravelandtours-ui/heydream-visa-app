// components/chat-assistant.tsx
// Floating in-app help assistant, mounted once in app/_layout.tsx so it
// rides on top of every screen the same way chatbot_widget.php's bubble
// does on the website. The user can type a question freely OR tap a
// suggested one; every message goes to the same ai_chat.php the website
// chatbot uses (source: "visa"), which already handles smart answers, an
// offline fallback, and steering off-topic / unanswerable ("stupid")
// questions back to something useful. Admin replies from a live-agent
// handoff are polled from get_chat_updates.php, same as the website widget.

import { ThemedText } from "@/components/themed-text";
import { VISA_WEB_BASE_URL } from "@/api/config";
import * as api from "@/api/client";
import type { AssistantHistoryTurn } from "@/api/client";
import { useAuth } from "@/contexts/auth-context";
import * as secureStorage from "@/api/secure-storage";
import { STARTER_QUESTIONS, SUPPORT_EMAIL, SUPPORT_PHONE } from "@/constants/assistant-knowledge";
import { Colors } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { usePathname, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SESSION_KEY = "heydream_visa_assistant_session";
const POLL_MS = 4000;
const HISTORY_LIMIT = 12;

// Screens where a floating helper would get in the way (a bubble sitting on
// top of form fields), duplicate an existing chat surface, or sit over the
// auth flow. Mirrors chatbot_widget.php bailing out on the website's
// ?id=/booking pages.
const HIDDEN_PREFIXES = [
  "/login",
  "/register",
  "/oauthredirect",
  "/chat/",
  "/apply/",
  "/documents/",
  "/visa/",
  "/support",
  "/edit-profile",
  "/change-password",
];
const TAB_PATHS = ["/", "/applications", "/profile"];

interface Link {
  label: string;
  url: string;
}

type Message =
  | { id: string; kind: "bot"; text: string; links?: Link[] }
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "agent"; text: string }
  | { id: string; kind: "note"; text: string };

let msgSeq = 0;
const nextId = () => `m${Date.now()}_${msgSeq++}`;

function htmlToText(s?: string): string {
  if (!s) return "";
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Pull <a href> and [label](url) out into tappable link buttons, leaving
// just their label text inline (RN <Text> can't render either form).
function parseReply(html?: string): { text: string; links: Link[] } {
  if (!html) return { text: "", links: [] };
  const links: Link[] = [];
  let s = html.replace(
    /<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_m, url: string, inner: string) => {
      const label = inner.replace(/<[^>]+>/g, "").trim();
      links.push({ label: label || url, url });
      return label;
    }
  );
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label: string, url: string) => {
    links.push({ label, url });
    return label;
  });
  return { text: htmlToText(s), links };
}

// A HeyDream web link the assistant hands back gets routed to the matching
// native screen instead of kicking the user out to a browser. Anything not
// recognised (or off-site) still opens externally.
function mapUrlToRoute(url: string): { path: string; label: string } | null {
  // Hand-parsed rather than `new URL()` -- RN/Hermes's URL support is
  // patchy across versions and this only needs host + filename + ?id.
  const m = url.match(/^(?:https?:\/\/([^/]+))?([^?#]*)(?:\?([^#]*))?/i);
  if (!m) return null;
  const host = (m[1] || "").toLowerCase().replace(/:\d+$/, "");
  if (host && !/(^|\.)heydreamtravel\.com$/.test(host)) return null;
  const file = ((m[2] || "").split("/").pop() || "").toLowerCase();
  const idMatch = (m[3] || "").match(/(?:^|&)id=([^&]+)/);
  const id = idMatch ? decodeURIComponent(idMatch[1]) : null;

  switch (file) {
    case "about.php":
      return { path: "/about", label: "Open About" };
    case "terms.php":
      return { path: "/terms", label: "Open Terms" };
    case "help-support.php":
    case "support.php":
      return { path: "/support", label: "Open Contact Support" };
    case "profile.php":
    case "my-profile.php":
      return { path: "/(tabs)/applications", label: "Open My Applications" };
    case "index.php":
    case "download-app.php":
    case "":
      return { path: "/(tabs)", label: "Go to Home" };
    case "details.php":
    case "visitor-details.php":
      return id ? { path: `/visa/${id}`, label: "View this visa" } : { path: "/(tabs)", label: "Browse visas" };
    case "book.php":
    case "visitor-book.php":
      return id ? { path: `/apply/${id}`, label: "Start this application" } : { path: "/(tabs)", label: "Browse visas" };
    default:
      return null;
  }
}

export function ChatAssistant() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [kb, setKb] = useState(0);

  const scrollRef = useRef<ScrollView>(null);
  const sessionRef = useRef<string | null>(null);
  const lastAgentIdRef = useRef(0);
  const agentJoinedRef = useRef(false);
  const historyRef = useRef<AssistantHistoryTurn[]>([]);
  const anim = useRef(new Animated.Value(0)).current;

  const hidden = useMemo(
    () => !pathname || HIDDEN_PREFIXES.some((p) => pathname.startsWith(p)),
    [pathname]
  );
  const onTab = pathname ? TAB_PATHS.includes(pathname) : false;
  const bubbleBottom = onTab
    ? (Platform.OS === "ios" ? 96 + insets.bottom : 80 + insets.bottom)
    : insets.bottom + 22;

  const firstName = user?.full_name ? user.full_name.trim().split(/\s+/)[0] : "";

  useEffect(() => {
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    if (!open) {
      setMenuOpen(false);
      Keyboard.dismiss();
    }
  }, [open, anim]);

  // iOS doesn't resize the window for the keyboard, so lift the panel by its
  // height. Android's adjustResize already shrinks the window, which keeps a
  // bottom-anchored absolute panel above the keyboard on its own.
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const show = Keyboard.addListener("keyboardWillShow", (e) => setKb(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardWillHide", () => setKb(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [messages, suggestions, kb]);

  // ---------- helpers ----------
  const pushBot = (text: string, links?: Link[]) =>
    setMessages((prev) => [...prev, { id: nextId(), kind: "bot", text, links }]);
  const pushUser = (text: string) =>
    setMessages((prev) => [...prev, { id: nextId(), kind: "user", text }]);

  async function ensureSession() {
    if (sessionRef.current) return sessionRef.current;
    let s = await secureStorage.getItem(SESSION_KEY);
    if (!s) {
      s = `hd_visaapp_${Math.random().toString(36).slice(2, 11)}_${Date.now()}`;
      await secureStorage.setItem(SESSION_KEY, s);
    }
    sessionRef.current = s;
    return s;
  }

  const customerName = user?.full_name || "HeyDream Visa app user";
  const customerEmail = user?.email || "";

  function greet() {
    if (started) return;
    setStarted(true);
    pushBot(
      `Hi${firstName ? ` ${firstName}` : ""}! I'm the HeyDream Visa assistant. Ask me anything about visas, documents, payment or tracking — or tap a question below.`
    );
    setSuggestions(STARTER_QUESTIONS);
    // Register the session with the backend so it shows up for agents, and
    // anchor polling past the logged greeting.
    ensureSession().then((session) => {
      api
        .sendAssistantMessage({ message: "[GREETING]", session_id: session, customer_name: customerName, customer_email: customerEmail })
        .then((res) => {
          if (res?.last_msg_id) lastAgentIdRef.current = Math.max(lastAgentIdRef.current, res.last_msg_id);
        });
    });
  }

  function openPanel() {
    setOpen(true);
    if (!started) setTimeout(greet, 260);
  }

  async function send(raw: string) {
    const message = raw.trim();
    if (!message || busy) return;
    setInput("");
    setMenuOpen(false);
    setSuggestions([]);
    pushUser(message);
    historyRef.current.push({ role: "user", parts: [{ text: message }] });
    setBusy(true);

    const session = await ensureSession();
    const res = await api.sendAssistantMessage({
      message,
      session_id: session,
      customer_name: customerName,
      customer_email: customerEmail,
      history: historyRef.current.slice(-HISTORY_LIMIT),
    });

    // ai_chat.php couldn't reach Gemini itself -- finish the call here.
    if (res?.status === "needs_client_call" && res.api_url && res.payload) {
      const direct = await api.callGeminiDirect(res.api_url, res.payload);
      setBusy(false);
      if (direct) {
        const parsed = parseReply(direct);
        pushBot(parsed.text || direct, parsed.links);
        historyRef.current.push({ role: "model", parts: [{ text: parsed.text || direct }] });
        setSuggestions(["Talk to a live agent"]);
        api
          .logAssistantReply({ message, ai_reply: direct, session_id: session, customer_name: customerName, customer_email: customerEmail })
          .then((r) => {
            if (r?.last_msg_id) lastAgentIdRef.current = Math.max(lastAgentIdRef.current, r.last_msg_id);
          });
        return;
      }
      fallbackReply();
      return;
    }

    setBusy(false);

    if (!res || (!res.reply && !(res.suggestions && res.suggestions.length))) {
      fallbackReply();
      return;
    }

    const { text, links } = parseReply(res.reply);
    if (text) {
      pushBot(text, links);
      historyRef.current.push({ role: "model", parts: [{ text }] });
    }
    const next = [...(res.suggestions ?? [])];
    if (!next.some((s) => /live agent/i.test(s))) next.push("Talk to a live agent");
    setSuggestions(next);
  }

  // A typed question we couldn't answer (blank/offline) doesn't dead-end --
  // point the user at the live team and a couple of things that do work.
  function fallbackReply() {
    pushBot(
      `I'm having trouble answering that right now. You can call ${SUPPORT_PHONE}, email ${SUPPORT_EMAIL}, or talk to a live agent.`
    );
    setSuggestions(["Talk to a live agent", "How do I apply for a visa?", "What documents do I need?"]);
  }

  // Poll for agent/admin replies while the panel is open and a session
  // exists -- matches the website widget, which polls unconditionally once
  // it has a session id.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const markJoined = () => {
      if (!agentJoinedRef.current) {
        agentJoinedRef.current = true;
        setMessages((prev) => [...prev, { id: nextId(), kind: "note", text: "A live agent has joined the chat." }]);
      }
    };

    const tick = async () => {
      const session = sessionRef.current;
      if (!session) return;
      const { messages: updates, deleted } = await api.getAssistantUpdates(session, lastAgentIdRef.current);
      if (cancelled) return;
      if (deleted) {
        agentJoinedRef.current = false;
        setMessages((prev) => [
          ...prev,
          { id: nextId(), kind: "note", text: "This chat session was closed. Ask a new question any time." },
        ]);
        return;
      }
      for (const m of updates) {
        lastAgentIdRef.current = Math.max(lastAgentIdRef.current, m.id);
        if (m.sender === "customer") continue;
        if (m.message === "[AGENT_JOINED]") {
          markJoined();
          continue;
        }
        if (m.sender === "admin") {
          markJoined();
          const { text } = parseReply(m.message);
          setMessages((prev) => [...prev, { id: `agent_${m.id}`, kind: "agent", text }]);
        }
      }
    };

    const iv = setInterval(tick, POLL_MS);
    tick();
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [open]);

  // ---------- menu actions ----------
  async function visitWebsite() {
    setMenuOpen(false);
    try {
      await WebBrowser.openBrowserAsync(VISA_WEB_BASE_URL);
    } catch {
      Linking.openURL(VISA_WEB_BASE_URL).catch(() => {});
    }
  }
  function reportIssue() {
    setMenuOpen(false);
    setOpen(false);
    router.push("/support");
  }

  if (hidden) return null;

  const panelTranslate = anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {open && (
        <Animated.View
          style={[
            styles.panel,
            {
              top: insets.top + 44,
              bottom: bubbleBottom + 74 + kb,
              opacity: anim,
              transform: [{ translateY: panelTranslate }],
            },
          ]}
        >
          <LinearGradient
            colors={[Colors.primary, "#1667d6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.headerAvatar}>
              <Image
                source={require("@/assets/images/heydream-logo.png")}
                style={styles.headerAvatarImg}
                contentFit="contain"
              />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.headerTitle}>HeyDream Help</ThemedText>
              <View style={styles.headerStatusRow}>
                <View style={styles.onlineDot} />
                <ThemedText style={styles.headerStatus}>Online</ThemedText>
              </View>
            </View>
            <Pressable style={styles.headerBtn} onPress={() => setMenuOpen((v) => !v)} hitSlop={8}>
              <Ionicons name={menuOpen ? "close" : "menu"} size={18} color={Colors.white} />
            </Pressable>
            <Pressable style={styles.headerBtn} onPress={() => setOpen(false)} hitSlop={8}>
              <Ionicons name="chevron-down" size={20} color={Colors.white} />
            </Pressable>
          </LinearGradient>

          {menuOpen && (
            <View style={styles.menu}>
              <MenuItem icon="headset" label="Live Agents" onPress={() => send("Talk to a live agent")} />
              <MenuItem icon="globe-outline" label="Visit Our Website" onPress={visitWebsite} />
              <MenuItem icon="alert-circle-outline" label="Report Issue" onPress={reportIssue} />
            </View>
          )}

          <ScrollView
            ref={scrollRef}
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((m) => {
              if (m.kind === "note") {
                return (
                  <View key={m.id} style={styles.noteRow}>
                    <ThemedText style={styles.noteText}>{m.text}</ThemedText>
                  </View>
                );
              }
              if (m.kind === "user") {
                return (
                  <View key={m.id} style={[styles.bubbleRow, styles.bubbleRowRight]}>
                    <View style={[styles.bubble, styles.bubbleUser]}>
                      <ThemedText style={styles.bubbleUserText}>{m.text}</ThemedText>
                    </View>
                  </View>
                );
              }
              const isAgent = m.kind === "agent";
              return (
                <View key={m.id} style={[styles.bubbleRow, styles.bubbleRowLeft]}>
                  <View style={[styles.bubble, isAgent ? styles.bubbleAgent : styles.bubbleBot]}>
                    {isAgent && <ThemedText style={styles.agentName}>Agent</ThemedText>}
                    <ThemedText style={styles.bubbleBotText}>{m.text}</ThemedText>
                    {m.kind === "bot" &&
                      m.links?.map((l, i) => {
                        const route = mapUrlToRoute(l.url);
                        return (
                          <Pressable
                            key={`${m.id}_l${i}`}
                            style={styles.linkAction}
                            onPress={() => {
                              if (route) {
                                setOpen(false);
                                router.push(route.path as any);
                              } else {
                                WebBrowser.openBrowserAsync(l.url);
                              }
                            }}
                          >
                            <Ionicons
                              name={route ? "arrow-forward" : "open-outline"}
                              size={14}
                              color={Colors.primary}
                            />
                            <ThemedText style={styles.linkActionText}>
                              {route ? route.label : l.label}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                  </View>
                </View>
              );
            })}

            {busy && (
              <View style={[styles.bubbleRow, styles.bubbleRowLeft]}>
                <View style={[styles.bubble, styles.bubbleBot]}>
                  <ThemedText style={styles.bubbleBotText}>…</ThemedText>
                </View>
              </View>
            )}

            {suggestions.length > 0 && (
              <View style={styles.chipWrap}>
                {suggestions.map((s, i) => {
                  const isAgent = /live agent/i.test(s);
                  return (
                    <Pressable
                      key={`${i}_${s}`}
                      style={[styles.chip, isAgent && styles.chipAgent]}
                      onPress={() => send(s)}
                      disabled={busy}
                    >
                      {isAgent && (
                        <Ionicons name="headset" size={12} color={Colors.primary} style={{ marginRight: 5 }} />
                      )}
                      <ThemedText style={styles.chipText}>{s}</ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Ask a question…"
              placeholderTextColor="#94A3B8"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => send(input)}
              returnKeyType="send"
              multiline
              maxLength={500}
            />
            <Pressable
              style={[styles.sendBtn, (!input.trim() || busy) && styles.sendBtnDisabled]}
              onPress={() => send(input)}
              disabled={!input.trim() || busy}
            >
              <Ionicons name="send" size={16} color={Colors.white} />
            </Pressable>
          </View>
        </Animated.View>
      )}

      <Pressable
        style={[styles.fab, { bottom: bubbleBottom + kb, right: 18 }]}
        onPress={() => (open ? setOpen(false) : openPanel())}
      >
        {open ? (
          <Ionicons name="close" size={26} color={Colors.primary} />
        ) : (
          <Image
            source={require("@/assets/images/heydream-logo.png")}
            style={styles.fabLogo}
            contentFit="contain"
          />
        )}
        {!open && !started && <View style={styles.fabBadge} />}
      </Pressable>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={17} color={Colors.primary} />
      <ThemedText style={styles.menuItemText}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    left: 12,
    right: 12,
    backgroundColor: Colors.white,
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
    padding: 5,
  },
  headerAvatarImg: { width: "100%", height: "100%" },
  headerTitle: { color: Colors.white, fontSize: 15, fontWeight: "800" },
  headerStatusRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#4ade80" },
  headerStatus: { color: "rgba(255,255,255,0.85)", fontSize: 11 },
  headerBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  menu: {
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: "#E7EDF5",
    padding: 10,
    gap: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  menuItemPressed: { backgroundColor: "#F0F6FF" },
  menuItemText: { fontSize: 13.5, fontWeight: "700", color: Colors.dark },
  body: { flex: 1, backgroundColor: "#F4F7FB" },
  bodyContent: { padding: 14, paddingBottom: 8 },
  bubbleRow: { flexDirection: "row", marginBottom: 10, maxWidth: "100%" },
  bubbleRowLeft: { justifyContent: "flex-start" },
  bubbleRowRight: { justifyContent: "flex-end" },
  bubble: { maxWidth: "86%", borderRadius: 16, paddingHorizontal: 13, paddingVertical: 10 },
  bubbleBot: {
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 4,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  bubbleAgent: {
    backgroundColor: "#E8F0FE",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(13,71,161,0.14)",
  },
  bubbleUser: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleBotText: { color: Colors.dark, fontSize: 13.5, lineHeight: 20 },
  bubbleUserText: { color: Colors.white, fontSize: 13.5, lineHeight: 20 },
  agentName: { color: Colors.primary, fontSize: 11, fontWeight: "800", marginBottom: 3 },
  linkAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 9,
    alignSelf: "flex-start",
    backgroundColor: "#EEF4FF",
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  linkActionText: { color: Colors.primary, fontSize: 12, fontWeight: "700" },
  noteRow: { alignItems: "center", marginVertical: 8, paddingHorizontal: 12 },
  noteText: {
    fontSize: 11.5,
    color: Colors.text,
    textAlign: "center",
    backgroundColor: "#EEF2F7",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: "hidden",
    lineHeight: 16,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4, paddingBottom: 4 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { color: Colors.primary, fontSize: 12.5, fontWeight: "700" },
  chipAgent: { backgroundColor: "#FFF7E6", borderColor: Colors.accent },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#E7EDF5",
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    maxHeight: 96,
    minHeight: 38,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 19,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === "ios" ? 10 : 6,
    paddingBottom: Platform.OS === "ios" ? 10 : 6,
    fontSize: 13.5,
    color: Colors.dark,
    backgroundColor: "#F8FAFC",
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
  fab: {
    position: "absolute",
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.white,
    borderWidth: 3,
    borderColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  fabLogo: { width: 34, height: 34 },
  fabBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.white,
  },
});
