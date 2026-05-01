import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, TextInput,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, space } from "./theme";
import { api } from "./api";
import LilyGlyph from "./Lily";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function MeeraChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [lastActions, setLastActions] = useState<any[]>([]);
  const listRef = useRef<FlatList>(null);
  const recRef = useRef<any>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (open) {
      api.meeraMessages().then(setMessages).catch(() => {});
    }
  }, [open]);

  const push = (role: string, text: string) => {
    setMessages((m) => [...m, { id: "tmp" + Date.now() + Math.random(), role, text }]);
  };

  const sendText = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    push("user", text);
    try {
      const res = await api.meeraChat(text);
      setLastActions(res.actions || []);
      const all = await api.meeraMessages();
      setMessages(all);
    } catch {
      push("assistant", "Line dropped. Say that again.");
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  };

  const startRecording = async () => {
    if (Platform.OS !== "web") {
      Alert.alert("Voice", "Voice recording is available in the web preview. Type your message on native for now.");
      return;
    }
    // @ts-ignore
    if (!navigator?.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      Alert.alert("Voice", "Your browser doesn't support recording.");
      return;
    }
    try {
      // @ts-ignore
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // @ts-ignore
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e: any) => { if (e.data?.size) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t: any) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setSending(true);
        push("user", "🎙 (transcribing…)");
        try {
          const fd = new FormData();
          // @ts-ignore
          fd.append("audio", blob, "voice.webm");
          const res = await fetch(`${BASE}/api/meera/voice?session_id=meera-default`, { method: "POST", body: fd });
          if (!res.ok) throw new Error(await res.text());
          const data = await res.json();
          setLastActions(data.actions || []);
          const all = await api.meeraMessages();
          setMessages(all);
        } catch (e: any) {
          push("assistant", "Couldn't catch that — try typing it.");
        } finally {
          setSending(false);
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
        }
      };
      mr.start();
      recRef.current = mr;
      setRecording(true);
    } catch (e: any) {
      Alert.alert("Microphone", "Permission needed to record. Please allow microphone access.");
    }
  };

  const stopRecording = () => {
    try { recRef.current?.stop(); } catch {}
    setRecording(false);
  };

  return (
    <>
      <TouchableOpacity
        testID="meera-fab"
        style={styles.fab}
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
      >
        <LilyGlyph size={34} petal={colors.bg} center={colors.marigold} />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.headerIcon}><LilyGlyph size={30} petal={colors.bg} center={colors.marigold} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.headerTitle}>Meera</Text>
              <Text style={styles.headerSub}>you, five years from now</Text>
            </View>
            <TouchableOpacity onPress={() => setOpen(false)} testID="meera-close">
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m, i) => String(m.id || i)}
            contentContainerStyle={{ padding: space.lg, paddingBottom: space.md }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Hi Sandhya.</Text>
                <Text style={styles.emptyText}>
                  Principal, Stithi Architects · married to the cricketer · deadlift 90kg. Tell me what happened today. I can log leads, workouts, meals — just talk.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={[styles.bubble, item.role === "user" ? styles.bubbleUser : styles.bubbleBot]}>
                <Text style={[styles.bubbleText, item.role === "user" ? styles.bubbleTextUser : null]}>
                  {item.text}
                </Text>
              </View>
            )}
          />

          {lastActions.length > 0 && (
            <View style={styles.actionStrip}>
              {lastActions.map((a, i) => (
                <View key={i} style={[styles.chip, !a.ok && styles.chipFail]}>
                  <Ionicons name={a.ok ? "checkmark-circle" : "alert-circle"} size={14} color={a.ok ? colors.marigold : colors.kumkum} />
                  <Text style={styles.chipText}>{a.label}</Text>
                </View>
              ))}
            </View>
          )}

          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View style={styles.inputRow}>
              <TouchableOpacity
                testID="meera-mic"
                onPressIn={startRecording}
                onPressOut={stopRecording}
                style={[styles.micBtn, recording && styles.micBtnRec]}
                disabled={sending}
              >
                <Ionicons name={recording ? "stop" : "mic"} size={22} color={recording ? colors.bg : colors.fuchsia} />
              </TouchableOpacity>
              <TextInput
                testID="meera-input"
                value={input}
                onChangeText={setInput}
                placeholder={recording ? "Recording…" : "Tell Meera, or hold the mic…"}
                placeholderTextColor={colors.textSoft}
                style={styles.input}
                multiline
                editable={!recording}
              />
              <TouchableOpacity testID="meera-send" onPress={sendText} style={styles.sendBtn} disabled={sending || recording}>
                {sending ? <ActivityIndicator color={colors.textInverse} /> : <Ionicons name="arrow-up" size={22} color={colors.textInverse} />}
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>{Platform.OS === "web" ? "Hold 🎙 to record · release to send" : "Type for now · voice on web"}</Text>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute", right: 18, bottom: 92,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.fuchsia,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.fuchsia, shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
    elevation: 8, borderWidth: 2, borderColor: colors.marigold, zIndex: 100,
  },
  modal: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", padding: space.lg,
    borderBottomWidth: 1, borderBottomColor: colors.border, paddingTop: 56,
  },
  headerIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.fuchsia, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: fonts.headingBold, fontSize: 22, color: colors.text },
  headerSub: { fontFamily: fonts.body, fontSize: 12, color: colors.textSoft },
  empty: { padding: space.xl, alignItems: "center" },
  emptyTitle: { fontFamily: fonts.headingItalic, fontSize: 28, color: colors.fuchsia, marginBottom: 12 },
  emptyText: { fontFamily: fonts.body, fontSize: 15, color: colors.textSoft, textAlign: "center", lineHeight: 22 },
  bubble: { padding: 14, borderRadius: radii.lg, marginVertical: 6, maxWidth: "88%" },
  bubbleUser: { backgroundColor: colors.fuchsia, alignSelf: "flex-end", borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: colors.bgSoft, alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  bubbleText: { fontFamily: fonts.body, fontSize: 15, color: colors.text, lineHeight: 22 },
  bubbleTextUser: { color: colors.textInverse },
  actionStrip: {
    flexDirection: "row", flexWrap: "wrap", gap: 6,
    paddingHorizontal: space.lg, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.bgSoft,
  },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: colors.border },
  chipFail: { borderColor: colors.kumkum },
  chipText: { fontFamily: fonts.bodyMed, fontSize: 12, color: colors.text },
  inputRow: {
    flexDirection: "row", alignItems: "flex-end",
    padding: space.md, borderTopWidth: 1, borderTopColor: colors.border, gap: 8,
  },
  input: {
    flex: 1, backgroundColor: colors.bgSoft, borderRadius: radii.lg,
    paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.body, fontSize: 15,
    color: colors.text, maxHeight: 120,
  },
  micBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: colors.fuchsia, alignItems: "center", justifyContent: "center" },
  micBtnRec: { backgroundColor: colors.kumkum, borderColor: colors.kumkum },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.fuchsia, alignItems: "center", justifyContent: "center" },
  hint: { textAlign: "center", fontFamily: fonts.body, fontSize: 11, color: colors.textSoft, paddingBottom: 10 },
});
