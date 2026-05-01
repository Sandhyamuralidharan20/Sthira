import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, space } from "../src/theme";
import { api, todayStr } from "../src/api";

const FIELDS = [
  { key: "weight_kg", label: "Weight", unit: "kg", color: colors.fuchsia },
  { key: "waist_cm", label: "Waist", unit: "cm", color: colors.marigold },
  { key: "hips_cm", label: "Hips", unit: "cm", color: colors.terracotta },
  { key: "chest_cm", label: "Chest", unit: "cm", color: colors.kumkum },
  { key: "arm_cm", label: "Arm", unit: "cm", color: colors.saffron },
  { key: "thigh_cm", label: "Thigh", unit: "cm", color: colors.textSoft },
];

export default function Progress() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<any[]>([]);
  const [program, setProgram] = useState<any>(null);

  const load = useCallback(async () => {
    const [m, l, p] = await Promise.all([api.listMeasurements(), api.listFitnessLogs(), api.getProgram()]);
    setItems(m); setLogs(l); setProgram(p);
  }, []);
  useEffect(() => { load(); }, [load]);

  const series = useMemo(() => {
    const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
    return sorted;
  }, [items]);

  const lastBy = (key: string) => {
    for (let i = series.length - 1; i >= 0; i--) if (series[i][key] != null) return series[i][key];
    return null;
  };

  const save = async () => {
    const payload: any = { date: todayStr() };
    Object.entries(vals).forEach(([k, v]) => {
      if (v.trim()) payload[k] = parseFloat(v);
    });
    await api.addMeasurement(payload);
    setVals({}); setAdding(false);
    load();
  };

  // Workout consistency: count logs in last 7 days
  const last7 = logs.filter((l) => {
    const d = new Date(l.date);
    return d.getTime() > Date.now() - 7 * 86400000;
  }).length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]} testID="screen-progress">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={28} color={colors.text} /></TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.eyebrow}>BODY · MIND · WORK</Text>
          <Text style={styles.h1}>Progress</Text>
        </View>
        <TouchableOpacity onPress={() => setAdding(true)} style={styles.addBtn} testID="progress-add">
          <Ionicons name="add" size={22} color={colors.textInverse} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 140 }}>
        <View style={[styles.heroCard]}>
          <Text style={styles.label}>THIS WEEK</Text>
          <Text style={styles.hero}>{last7}</Text>
          <Text style={styles.heroSub}>workout sets logged in last 7 days</Text>
        </View>

        <Text style={styles.section}>Measurements</Text>
        <View style={styles.measGrid}>
          {FIELDS.map((f) => {
            const last = lastBy(f.key);
            const data = series.filter((s) => s[f.key] != null).map((s) => s[f.key] as number);
            return (
              <View key={f.key} style={styles.measCard}>
                <Text style={styles.label}>{f.label.toUpperCase()}</Text>
                <Text style={[styles.measValue, { color: f.color }]}>{last ?? "—"}<Text style={styles.measUnit}> {f.unit}</Text></Text>
                <Sparkline data={data} color={f.color} />
              </View>
            );
          })}
        </View>

        <Text style={styles.section}>Recent entries</Text>
        {items.slice(0, 8).map((m) => (
          <View key={m.id} style={styles.row}>
            <Text style={styles.rowDate}>{m.date}</Text>
            <Text style={styles.rowText}>
              {FIELDS.filter((f) => m[f.key] != null).map((f) => `${f.label} ${m[f.key]}${f.unit}`).join(" · ") || "—"}
            </Text>
          </View>
        ))}
        {items.length === 0 && <Text style={styles.muted}>Log your first measurement.</Text>}
      </ScrollView>

      <Modal visible={adding} transparent animationType="slide">
        <View style={styles.modalBg}>
          <ScrollView style={{ maxHeight: "85%" }} contentContainerStyle={styles.modalCard}>
            <Text style={styles.h2}>Log measurements</Text>
            <Text style={styles.muted}>Leave blank to skip a field.</Text>
            {FIELDS.map((f) => (
              <View key={f.key}>
                <Text style={styles.fieldLabel}>{f.label} ({f.unit})</Text>
                <TextInput
                  value={vals[f.key] || ""}
                  onChangeText={(t) => setVals((v) => ({ ...v, [f.key]: t }))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textSoft}
                  style={styles.input}
                  testID={`meas-${f.key}`}
                />
              </View>
            ))}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <TouchableOpacity onPress={() => setAdding(false)} style={[styles.btn, styles.btnGhost]}><Text style={styles.btnGhostText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={save} style={[styles.btn, styles.btnPrimary]} testID="meas-save"><Text style={styles.btnPrimaryText}>Save</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return <View style={{ height: 30 }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  return (
    <View style={{ height: 30, flexDirection: "row", alignItems: "flex-end", gap: 2, marginTop: 6 }}>
      {data.slice(-12).map((v, i) => {
        const h = 4 + ((v - min) / range) * 22;
        return <View key={i} style={{ flex: 1, height: h, backgroundColor: color, borderRadius: 2, opacity: 0.6 + (i / data.length) * 0.4 }} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: space.lg },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2, color: colors.terracotta },
  h1: { fontFamily: fonts.headingBold, fontSize: 32, color: colors.text },
  h2: { fontFamily: fonts.headingBold, fontSize: 22, color: colors.text, marginBottom: 8 },
  label: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 2, color: colors.textSoft },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft, marginTop: 4 },
  fieldLabel: { fontFamily: fonts.bodyMed, fontSize: 13, color: colors.text, marginTop: 12 },
  section: { fontFamily: fonts.headingBold, fontSize: 22, color: colors.text, marginTop: 24, marginBottom: 12 },
  heroCard: { backgroundColor: colors.fuchsia, padding: space.xl, borderRadius: radii.xl },
  hero: { fontFamily: fonts.headingBold, fontSize: 64, color: colors.bg, lineHeight: 70 },
  heroSub: { fontFamily: fonts.body, fontSize: 14, color: colors.bg, opacity: 0.85 },
  measGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  measCard: { width: "48%", backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 14 },
  measValue: { fontFamily: fonts.headingBold, fontSize: 28, marginTop: 6 },
  measUnit: { fontFamily: fonts.body, fontSize: 14, color: colors.textSoft },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.fuchsia, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowDate: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.text, width: 96 },
  rowText: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft, flex: 1 },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.bg, padding: space.xl, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl },
  input: { backgroundColor: colors.bgSoft, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.body, fontSize: 15, marginTop: 6, color: colors.text },
  btn: { flex: 1, paddingVertical: 14, borderRadius: radii.pill, alignItems: "center" },
  btnPrimary: { backgroundColor: colors.fuchsia },
  btnPrimaryText: { fontFamily: fonts.bodyBold, color: colors.textInverse },
  btnGhost: { backgroundColor: colors.bgSoft },
  btnGhostText: { fontFamily: fonts.bodyMed, color: colors.text },
});
