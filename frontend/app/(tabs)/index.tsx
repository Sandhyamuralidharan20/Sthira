import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, RefreshControl, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, space } from "../../src/theme";
import { api, todayStr } from "../../src/api";
import { getCyclePhase, phaseInfo } from "../../src/cycle";
import MarigoldBurst from "../../src/Marigold";

export default function Today() {
  const [insp, setInsp] = useState<{ quote: string; nutrition_tip: string } | null>(null);
  const [priorities, setPriorities] = useState<any[]>([]);
  const [watch, setWatch] = useState<any>({ steps: 0, water_glasses: 0, sleep_hours: 0 });
  const [cycle, setCycle] = useState<any>(null);
  const [newP, setNewP] = useState("");
  const [burst, setBurst] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [i, p, w, c] = await Promise.all([
        api.inspiration(), api.listPriorities(todayStr()), api.getWatchGoal(todayStr()), api.getCycle(),
      ]);
      setInsp(i); setPriorities(p); setWatch(w); setCycle(c);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const addPriority = async () => {
    if (!newP.trim()) return;
    if (priorities.length >= 5) return;
    const item = await api.createPriority(todayStr(), newP.trim(), priorities.length);
    setPriorities((p) => [...p, item]);
    setNewP("");
  };

  const togglePriority = async (id: string, done: boolean) => {
    setPriorities((p) => p.map((x) => (x.id === id ? { ...x, done } : x)));
    await api.updatePriority(id, { done });
    if (done) setBurst(Date.now());
  };

  const incWatch = async (key: string, delta: number) => {
    const next = { ...watch, [key]: Math.max(0, (watch[key] || 0) + delta) };
    setWatch(next);
    const updated = await api.updateWatchGoal(todayStr(), { [key]: next[key] });
    setWatch(updated);
  };

  const phase = cycle ? getCyclePhase(cycle.last_period_start, cycle.cycle_length, cycle.period_length) : null;
  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.container} edges={["top"]} testID="screen-today">
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.fuchsia} />}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>SANDHYA · CHENNAI</Text>
          <Text style={styles.h1}>Sthira</Text>
          <Text style={styles.date}>{dateLabel}</Text>
        </View>

        {/* Quote */}
        <View style={[styles.card, styles.quoteCard]} testID="card-quote">
          <Text style={styles.quoteMark}>“</Text>
          <Text style={styles.quoteText}>{insp?.quote || "Steady, kanna."}</Text>
          <Text style={styles.quoteAttr}>— Meera</Text>
        </View>

        {/* Cycle phase */}
        {phase?.phase && (
          <View style={[styles.card, { backgroundColor: phaseInfo[phase.phase].color + "1A", borderColor: phaseInfo[phase.phase].color }]} testID="card-cycle">
            <Text style={styles.label}>CYCLE · DAY {phase.dayOfCycle} OF {cycle?.cycle_length}</Text>
            <Text style={[styles.h2, { color: phaseInfo[phase.phase].color }]}>
              {phaseInfo[phase.phase].emoji}  {phaseInfo[phase.phase].label}
            </Text>
            <Text style={styles.muted}>{phaseInfo[phase.phase].vibe}</Text>
            <Text style={styles.muted}>Next period in {phase.daysToNext} days.</Text>
          </View>
        )}
        {!phase?.phase && (
          <View style={styles.card}>
            <Text style={styles.label}>CYCLE</Text>
            <Text style={styles.h3}>Set your last period start in the Cycle tab</Text>
          </View>
        )}

        {/* Priorities */}
        <View style={styles.card} testID="card-priorities">
          <Text style={styles.label}>3 PRIORITIES TODAY</Text>
          {priorities.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.row}
              onPress={() => togglePriority(p.id, !p.done)}
              testID={`priority-${p.id}`}
            >
              <View style={[styles.check, p.done && styles.checkDone]}>
                {p.done && <Ionicons name="checkmark" size={16} color={colors.textInverse} />}
              </View>
              <Text style={[styles.rowText, p.done && styles.rowTextDone]}>{p.text}</Text>
            </TouchableOpacity>
          ))}
          {priorities.length < 5 && (
            <View style={styles.addRow}>
              <TextInput
                value={newP}
                onChangeText={setNewP}
                placeholder="Add a priority…"
                placeholderTextColor={colors.textSoft}
                style={styles.input}
                onSubmitEditing={addPriority}
                returnKeyType="done"
                testID="priority-input"
              />
              <TouchableOpacity onPress={addPriority} style={styles.addBtn} testID="priority-add">
                <Ionicons name="add" size={22} color={colors.textInverse} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Nutrition */}
        <View style={[styles.card, styles.nutritionCard]} testID="card-nutrition">
          <Text style={styles.label}>NUTRITION TIP</Text>
          <Text style={styles.h3}>{insp?.nutrition_tip}</Text>
          <Text style={styles.muted}>Vegetarian · eggs okay · no shakes</Text>
        </View>

        {/* Watch goals */}
        <View style={styles.card} testID="card-watch">
          <Text style={styles.label}>WATCH GOALS</Text>
          <View style={styles.goalsRow}>
            <Goal label="Steps" value={watch.steps} target={8000} unit="" onMinus={() => incWatch("steps", -500)} onPlus={() => incWatch("steps", 500)} color={colors.marigold} />
            <Goal label="Water" value={watch.water_glasses} target={8} unit=" glass" onMinus={() => incWatch("water_glasses", -1)} onPlus={() => incWatch("water_glasses", 1)} color={colors.fuchsia} />
            <Goal label="Sleep" value={watch.sleep_hours} target={8} unit=" hr" onMinus={() => incWatch("sleep_hours", -0.5)} onPlus={() => incWatch("sleep_hours", 0.5)} color={colors.terracotta} />
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
      <MarigoldBurst trigger={burst} />
    </SafeAreaView>
  );
}

function Goal({ label, value, target, unit, onMinus, onPlus, color }: any) {
  const pct = Math.min(100, Math.round((value / target) * 100));
  return (
    <View style={styles.goal}>
      <Text style={styles.goalLabel}>{label}</Text>
      <Text style={[styles.goalValue, { color }]}>{value}{unit}</Text>
      <View style={styles.bar}><View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} /></View>
      <View style={styles.goalBtns}>
        <TouchableOpacity onPress={onMinus} style={styles.smallBtn}><Ionicons name="remove" size={14} color={colors.text} /></TouchableOpacity>
        <TouchableOpacity onPress={onPlus} style={styles.smallBtn}><Ionicons name="add" size={14} color={colors.text} /></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: space.lg, paddingBottom: 120 },
  header: { marginBottom: space.lg },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2, color: colors.terracotta },
  h1: { fontFamily: fonts.headingBold, fontSize: 56, color: colors.text, lineHeight: 60, marginTop: 4 },
  h2: { fontFamily: fonts.headingBold, fontSize: 28, color: colors.text, marginTop: 6 },
  h3: { fontFamily: fonts.heading, fontSize: 18, color: colors.text, marginTop: 6, lineHeight: 26 },
  date: { fontFamily: fonts.body, fontSize: 14, color: colors.textSoft, marginTop: 4 },
  card: {
    backgroundColor: "#FFFFFF", borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.lg, padding: space.lg, marginBottom: space.md,
  },
  quoteCard: { backgroundColor: colors.kumkum },
  quoteMark: { fontFamily: fonts.headingBold, fontSize: 64, color: colors.marigold, lineHeight: 50, marginBottom: -12 },
  quoteText: { fontFamily: fonts.headingItalic, fontSize: 22, color: colors.bg, lineHeight: 30 },
  quoteAttr: { fontFamily: fonts.body, fontSize: 13, color: colors.marigold, marginTop: 12, letterSpacing: 1 },
  nutritionCard: { backgroundColor: colors.bgSoft },
  label: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2, color: colors.textSoft, marginBottom: 8 },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft, marginTop: 6 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  check: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.fuchsia,
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  checkDone: { backgroundColor: colors.fuchsia },
  rowText: { fontFamily: fonts.body, fontSize: 16, color: colors.text, flex: 1 },
  rowTextDone: { textDecorationLine: "line-through", color: colors.textSoft },
  addRow: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 8 },
  input: {
    flex: 1, backgroundColor: colors.bgSoft, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: fonts.body, fontSize: 15, color: colors.text,
  },
  addBtn: { backgroundColor: colors.fuchsia, width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  goalsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  goal: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  goalLabel: { fontFamily: fonts.bodyMed, fontSize: 12, color: colors.textSoft, letterSpacing: 1 },
  goalValue: { fontFamily: fonts.headingBold, fontSize: 22, marginTop: 4 },
  bar: { width: "100%", height: 6, borderRadius: 3, backgroundColor: colors.bgSoft, marginTop: 8 },
  barFill: { height: "100%", borderRadius: 3 },
  goalBtns: { flexDirection: "row", marginTop: 8, gap: 8 },
  smallBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.bgSoft, alignItems: "center", justifyContent: "center" },
});
