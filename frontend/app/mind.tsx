import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, space } from "../src/theme";
import { api } from "../src/api";

export default function Mind() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [text, setText] = useState("");

  const load = useCallback(async () => setItems(await api.listMind()), []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!text.trim()) return;
    await api.addMind(text.trim());
    setText("");
    load();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]} testID="screen-mind">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={28} color={colors.text} /></TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.eyebrow}>BRAIN DUMP</Text>
          <Text style={styles.h1}>Mind</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.composer}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Empty your head onto this page. Anything. No sentences needed."
            placeholderTextColor={colors.textSoft}
            multiline
            style={styles.input}
            testID="mind-input"
          />
          <TouchableOpacity onPress={save} style={styles.saveBtn} testID="mind-save">
            <Ionicons name="arrow-up" size={22} color={colors.textInverse} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 140 }}>
          {items.length === 0 && <Text style={styles.muted}>The page is open. Begin where you are.</Text>}
          {items.map((m) => (
            <View key={m.id} style={styles.entry}>
              <Text style={styles.entryDate}>{new Date(m.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</Text>
              <Text style={styles.entryText}>{m.text}</Text>
              <TouchableOpacity onPress={async () => { await api.deleteMind(m.id); load(); }} style={styles.del}>
                <Ionicons name="close" size={16} color={colors.textSoft} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: space.lg, paddingBottom: 8 },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2, color: colors.terracotta },
  h1: { fontFamily: fonts.headingBold, fontSize: 32, color: colors.text },
  muted: { fontFamily: fonts.headingItalic, fontSize: 16, color: colors.textSoft, textAlign: "center", marginTop: 60 },
  composer: { flexDirection: "row", padding: space.lg, gap: 8, alignItems: "flex-end" },
  input: {
    flex: 1, minHeight: 100, maxHeight: 200, backgroundColor: colors.bgSoft, borderRadius: radii.lg,
    padding: 14, fontFamily: fonts.body, fontSize: 16, color: colors.text, lineHeight: 24,
  },
  saveBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.fuchsia, alignItems: "center", justifyContent: "center" },
  entry: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 14, marginBottom: 10 },
  entryDate: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1, color: colors.terracotta, marginBottom: 6 },
  entryText: { fontFamily: fonts.body, fontSize: 15, color: colors.text, lineHeight: 22 },
  del: { position: "absolute", top: 10, right: 10, padding: 4 },
});
