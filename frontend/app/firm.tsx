import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, space } from "../src/theme";
import { api } from "../src/api";

const STATUSES = [
  { key: "active", label: "Active", color: colors.marigold },
  { key: "warm_lead", label: "Warm Lead", color: colors.fuchsia },
  { key: "cold_lead", label: "Cold Lead", color: colors.terracotta },
  { key: "completed", label: "Completed", color: colors.textSoft },
];

export default function Firm() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [next, setNext] = useState("");
  const [status, setStatus] = useState("warm_lead");

  const load = useCallback(async () => setProjects(await api.listProjects()), []);
  useEffect(() => { load(); }, [load]);

  const cycleStatus = async (p: any) => {
    const idx = STATUSES.findIndex((s) => s.key === p.status);
    const next = STATUSES[(idx + 1) % STATUSES.length].key;
    await api.updateProject(p.id, { status: next });
    load();
  };

  const add = async () => {
    if (!name.trim()) return;
    await api.createProject({ name: name.trim(), value: value || null, next_action: next || null, status });
    setName(""); setValue(""); setNext(""); setStatus("warm_lead"); setAdding(false);
    load();
  };

  const grouped: Record<string, any[]> = {};
  STATUSES.forEach((s) => (grouped[s.key] = []));
  projects.forEach((p) => (grouped[p.status] ||= []).push(p));

  return (
    <SafeAreaView style={styles.container} edges={["top"]} testID="screen-firm">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="firm-back"><Ionicons name="chevron-back" size={28} color={colors.text} /></TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.eyebrow}>STITHI ARCHITECTS</Text>
          <Text style={styles.h1}>Firm</Text>
        </View>
        <TouchableOpacity onPress={() => setAdding(true)} style={styles.addBtn} testID="firm-add">
          <Ionicons name="add" size={22} color={colors.textInverse} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 140 }}>
        {STATUSES.map((s) => (
          <View key={s.key} style={{ marginBottom: 24 }}>
            <View style={[styles.statusHeader]}>
              <View style={[styles.statusDot, { backgroundColor: s.color }]} />
              <Text style={styles.label}>{s.label.toUpperCase()} · {grouped[s.key].length}</Text>
            </View>
            {grouped[s.key].length === 0 && <Text style={styles.muted}>—</Text>}
            {grouped[s.key].map((p) => (
              <TouchableOpacity key={p.id} style={[styles.projCard, { borderLeftColor: s.color }]} onPress={() => cycleStatus(p)} testID={`proj-${p.id}`}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.projName}>{p.name}</Text>
                  {p.value && <Text style={styles.muted}>{p.value}</Text>}
                  {p.next_action && <Text style={styles.next}>→ {p.next_action}</Text>}
                </View>
                <TouchableOpacity onPress={async () => { await api.deleteProject(p.id); load(); }}>
                  <Ionicons name="close" size={20} color={colors.textSoft} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>

      <Modal visible={adding} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.h2}>New project</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Project name" placeholderTextColor={colors.textSoft} style={styles.input} testID="proj-name" />
            <TextInput value={value} onChangeText={setValue} placeholder="Value (e.g. ₹15L)" placeholderTextColor={colors.textSoft} style={styles.input} />
            <TextInput value={next} onChangeText={setNext} placeholder="Next action" placeholderTextColor={colors.textSoft} style={styles.input} />
            <View style={styles.row}>
              {STATUSES.map((s) => (
                <TouchableOpacity key={s.key} onPress={() => setStatus(s.key)} style={[styles.chip, status === s.key && { backgroundColor: s.color }]}>
                  <Text style={[styles.chipText, status === s.key && { color: colors.textInverse }]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <TouchableOpacity onPress={() => setAdding(false)} style={[styles.btn, styles.btnGhost]}><Text style={styles.btnGhostText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={add} style={[styles.btn, styles.btnPrimary]} testID="proj-save"><Text style={styles.btnPrimaryText}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: space.lg },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2, color: colors.terracotta },
  h1: { fontFamily: fonts.headingBold, fontSize: 32, color: colors.text },
  h2: { fontFamily: fonts.headingBold, fontSize: 22, color: colors.text, marginBottom: 12 },
  label: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2, color: colors.textSoft },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft, marginTop: 4 },
  next: { fontFamily: fonts.bodyMed, fontSize: 13, color: colors.fuchsia, marginTop: 6 },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.fuchsia, alignItems: "center", justifyContent: "center" },
  statusHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  projCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderRadius: radii.md,
    padding: 14, marginBottom: 10, gap: 12,
  },
  projName: { fontFamily: fonts.headingBold, fontSize: 17, color: colors.text },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.bg, padding: space.xl, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl },
  input: { backgroundColor: colors.bgSoft, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.body, fontSize: 15, marginTop: 10, color: colors.text },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: colors.bgSoft },
  chipText: { fontFamily: fonts.bodyMed, fontSize: 13, color: colors.text },
  btn: { flex: 1, paddingVertical: 14, borderRadius: radii.pill, alignItems: "center" },
  btnPrimary: { backgroundColor: colors.fuchsia },
  btnPrimaryText: { fontFamily: fonts.bodyBold, color: colors.textInverse },
  btnGhost: { backgroundColor: colors.bgSoft },
  btnGhostText: { fontFamily: fonts.bodyMed, color: colors.text },
});
