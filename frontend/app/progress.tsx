import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, ActivityIndicator } from "react-native";
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
];

export default function Progress() {
  const router = useRouter();
  const [weekly, setWeekly] = useState<any>(null);
  const [verdict, setVerdict] = useState<string>("");
  const [loadingVerdict, setLoadingVerdict] = useState(true);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [w, m] = await Promise.all([api.progressWeekly(), api.listMeasurements()]);
    setWeekly(w); setMeasurements(m);
    setLoadingVerdict(true);
    try {
      const v = await api.progressVerdict();
      setVerdict(v.verdict);
    } catch { setVerdict(""); }
    finally { setLoadingVerdict(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const payload: any = { date: todayStr() };
    Object.entries(vals).forEach(([k, v]) => { if (v.trim()) payload[k] = parseFloat(v); });
    await api.addMeasurement(payload);
    setVals({}); setAdding(false);
    load();
  };

  if (!weekly) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ActivityIndicator color={colors.fuchsia} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  const b = weekly.breakdown;
  const score = weekly.effort_score;
  const scoreColor = score >= 7 ? "#2E8B57" : score >= 4 ? colors.marigold : colors.kumkum;
  const moodMax = Math.max(1, ...(weekly.mood_by_day || []).map((m: any) => m.score || 0));

  return (
    <SafeAreaView style={styles.container} edges={["top"]} testID="screen-progress">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={28} color={colors.text} /></TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.eyebrow}>WEEK · {new Date(weekly.week_start).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} → {new Date(weekly.week_end).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</Text>
          <Text style={styles.h1}>Progress</Text>
        </View>
        <TouchableOpacity onPress={() => setAdding(true)} style={styles.addBtn} testID="progress-add">
          <Ionicons name="add" size={22} color={colors.textInverse} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 140 }}>
        {/* Meera verdict */}
        <View style={[styles.verdictCard, { backgroundColor: scoreColor }]} testID="verdict-card">
          <Text style={[styles.label, { color: colors.bg, opacity: 0.9 }]}>MEERA · WEEK VERDICT</Text>
          {loadingVerdict ? (
            <ActivityIndicator color={colors.bg} style={{ marginVertical: 12 }} />
          ) : (
            <Text style={styles.verdictText}>{verdict || "Keep logging — next week's verdict will be richer."}</Text>
          )}
          <View style={styles.scoreRow}>
            <Text style={styles.scoreNum}>{score}</Text>
            <Text style={styles.scoreDenom}>/ {weekly.max_score}</Text>
          </View>
          <Text style={[styles.muted, { color: colors.bg, opacity: 0.85 }]}>WEEKLY EFFORT SCORE</Text>
        </View>

        {/* Breakdown tiles */}
        <Text style={styles.section}>Breakdown</Text>
        <View style={styles.tiles}>
          <Tile label="Gym" value={`${b.gym.value}/5`} points={b.gym.points} max={b.gym.max} color={colors.fuchsia} testID="tile-gym" />
          <Tile label="Stithi" value={`${b.stithi.value}`} points={b.stithi.points} max={b.stithi.max} color={colors.marigold} testID="tile-stithi" />
          <Tile label="Reels" value={`${b.reels.value}`} points={b.reels.points} max={b.reels.max} color="#8E44AD" testID="tile-reels" />
          <Tile label="Mood" value={b.mood.value ? String(b.mood.value) : "—"} points={b.mood.points} max={b.mood.max} color={colors.terracotta} testID="tile-mood" />
          <Tile label="Water" value={`${b.water.value}d`} points={b.water.points} max={b.water.max} color="#2E8B57" testID="tile-water" />
          <Tile label="Nutrition" value={`${b.nutrition.value}d`} points={b.nutrition.points} max={b.nutrition.max} color={colors.saffron} testID="tile-nutrition" />
        </View>

        {/* Mood graph */}
        <View style={styles.card}>
          <Text style={styles.label}>MOOD · LAST 7 DAYS</Text>
          <View style={styles.moodRow}>
            {weekly.mood_by_day.map((m: any, i: number) => {
              const h = m.score ? 12 + (m.score / 5) * 90 : 6;
              const label = new Date(m.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" })[0];
              return (
                <View key={i} style={styles.moodCol}>
                  <Text style={styles.barLabel}>{m.score ? m.score.toFixed(1) : ""}</Text>
                  <View style={[styles.moodBar, { height: h, backgroundColor: m.score ? colors.terracotta : colors.border }]} />
                  <Text style={styles.barDay}>{label}</Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.muted}>Logged from the Cycle tab · mood pill</Text>
        </View>

        {/* Priorities summary */}
        <View style={styles.card}>
          <Text style={styles.label}>PRIORITIES COMPLETED</Text>
          <Text style={styles.h2}>{weekly.priorities_done}<Text style={styles.soft}> / {weekly.priorities_total || "—"}</Text></Text>
          <Text style={styles.muted}>this week</Text>
        </View>

        {/* Measurements */}
        <Text style={styles.section}>Measurements</Text>
        <View style={styles.measGrid}>
          {FIELDS.map((f) => {
            const last = [...measurements].reverse().find((m) => m[f.key] != null);
            const data = measurements.filter((s) => s[f.key] != null).map((s) => s[f.key] as number).reverse();
            return (
              <View key={f.key} style={styles.measCard}>
                <Text style={styles.label}>{f.label.toUpperCase()}</Text>
                <Text style={[styles.measValue, { color: f.color }]}>{last?.[f.key] ?? "—"}<Text style={styles.measUnit}> {f.unit}</Text></Text>
                <Sparkline data={data} color={f.color} />
              </View>
            );
          })}
        </View>
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

function Tile({ label, value, points, max, color, testID }: any) {
  const pct = max > 0 ? (points / max) * 100 : 0;
  return (
    <View style={styles.tile} testID={testID}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, { color }]}>{value}</Text>
      <View style={styles.tileBar}>
        <View style={[styles.tileBarFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.tilePts}>{points}/{max} pts</Text>
    </View>
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
  h2: { fontFamily: fonts.headingBold, fontSize: 32, color: colors.text },
  soft: { fontFamily: fonts.body, fontSize: 18, color: colors.textSoft },
  label: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2, color: colors.textSoft, marginBottom: 6 },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft, marginTop: 4 },
  section: { fontFamily: fonts.headingBold, fontSize: 22, color: colors.text, marginTop: 20, marginBottom: 10 },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.fuchsia, alignItems: "center", justifyContent: "center" },
  verdictCard: { borderRadius: radii.xl, padding: space.xl, marginBottom: 20 },
  verdictText: { fontFamily: fonts.headingItalic, fontSize: 20, color: colors.bg, lineHeight: 28, marginTop: 6 },
  scoreRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 18 },
  scoreNum: { fontFamily: fonts.headingBold, fontSize: 72, color: colors.bg, lineHeight: 76 },
  scoreDenom: { fontFamily: fonts.heading, fontSize: 28, color: colors.bg, opacity: 0.8, marginLeft: 6, paddingBottom: 10 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { width: "48%", backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 14 },
  tileLabel: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2, color: colors.textSoft },
  tileValue: { fontFamily: fonts.headingBold, fontSize: 28, marginTop: 4 },
  tileBar: { marginTop: 10, height: 6, borderRadius: 3, backgroundColor: colors.bgSoft, overflow: "hidden" },
  tileBarFill: { height: "100%", borderRadius: 3 },
  tilePts: { fontFamily: fonts.body, fontSize: 11, color: colors.textSoft, marginTop: 6 },
  card: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: space.lg, marginTop: 12 },
  moodRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 120, marginTop: 8 },
  moodCol: { flex: 1, alignItems: "center" },
  moodBar: { width: 22, borderRadius: 4 },
  barLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.textSoft, marginBottom: 4 },
  barDay: { fontFamily: fonts.bodyMed, fontSize: 11, color: colors.textSoft, marginTop: 4 },
  measGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  measCard: { width: "48%", backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 14 },
  measValue: { fontFamily: fonts.headingBold, fontSize: 28, marginTop: 6 },
  measUnit: { fontFamily: fonts.body, fontSize: 14, color: colors.textSoft },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.bg, padding: space.xl, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl },
  input: { backgroundColor: colors.bgSoft, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.body, fontSize: 15, marginTop: 6, color: colors.text },
  fieldLabel: { fontFamily: fonts.bodyMed, fontSize: 13, color: colors.text, marginTop: 12 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: radii.pill, alignItems: "center" },
  btnPrimary: { backgroundColor: colors.fuchsia },
  btnPrimaryText: { fontFamily: fonts.bodyBold, color: colors.textInverse },
  btnGhost: { backgroundColor: colors.bgSoft },
  btnGhostText: { fontFamily: fonts.bodyMed, color: colors.text },
});
