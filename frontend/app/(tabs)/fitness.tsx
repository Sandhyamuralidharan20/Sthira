import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, space } from "../../src/theme";
import { api, todayStr } from "../../src/api";
import MarigoldBurst from "../../src/Marigold";

const DAYS = [
  { key: "mon_push", label: "Mon", short: "Push · Chest+Sh." },
  { key: "tue_pull", label: "Tue", short: "Pull · Back+Bi." },
  { key: "wed_legs", label: "Wed", short: "Legs · Glutes+Ham." },
  { key: "thu_push", label: "Thu", short: "Push · Chest+Tri." },
  { key: "fri_legs", label: "Fri", short: "Legs · Quads+Core" },
];

export default function Fitness() {
  const [program, setProgram] = useState<any>(null);
  const [active, setActive] = useState("mon_push");
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [burst, setBurst] = useState(0);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    api.getProgram().then(setProgram);
  }, []);

  const loadLogs = useCallback(async () => {
    const l = await api.listFitnessLogs(active);
    setLogs(l);
  }, [active]);

  useEffect(() => { loadLogs(); setCompleted({}); }, [active, loadLogs]);

  const toggle = async (idx: number, ex: any) => {
    const next = !completed[idx];
    setCompleted((c) => ({ ...c, [idx]: next }));
    if (next) {
      setBurst(Date.now());
      await api.addFitnessLog({
        date: todayStr(), day_key: active, exercise: ex.name,
        weight_kg: ex.weight_kg, sets: ex.sets, reps: ex.reps,
      });
      loadLogs();
    }
  };

  const day = program?.[active];
  const lastLogByExercise: Record<string, any> = {};
  logs.forEach((l) => { if (!lastLogByExercise[l.exercise]) lastLogByExercise[l.exercise] = l; });

  return (
    <SafeAreaView style={styles.container} edges={["top"]} testID="screen-fitness">
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>5-DAY SPLIT</Text>
          <Text style={styles.h1}>Fitness</Text>
          <Text style={styles.muted}>Mon–Fri · vegetarian fuel · no shakes</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayPills}>
          {DAYS.map((d) => {
            const isActive = active === d.key;
            return (
              <TouchableOpacity key={d.key} onPress={() => setActive(d.key)} style={[styles.dayPill, isActive && styles.dayPillActive]} testID={`day-${d.key}`}>
                <Text style={[styles.dayPillLabel, isActive && styles.dayPillLabelActive]}>{d.label}</Text>
                <Text style={[styles.dayPillShort, isActive && { color: colors.bg }]}>{d.short}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {day && (
          <View style={{ paddingHorizontal: space.lg }}>
            <Text style={styles.h2}>{day.name}</Text>
            {day.exercises.map((ex: any, i: number) => {
              const last = lastLogByExercise[ex.name];
              const done = completed[i];
              return (
                <TouchableOpacity key={i} style={[styles.exCard, done && styles.exCardDone]} onPress={() => toggle(i, ex)} testID={`ex-${i}`}>
                  <View style={[styles.exCheck, done && styles.exCheckDone]}>
                    {done && <Ionicons name="checkmark" size={18} color={colors.textInverse} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.exName, done && styles.exNameDone]}>{ex.name}</Text>
                    <Text style={styles.muted}>
                      {ex.weight_kg > 0 ? `${ex.weight_kg} kg · ` : ""}{ex.sets} × {ex.reps}{ex.notes ? ` · ${ex.notes}` : ""}
                    </Text>
                    {last && <Text style={styles.lastLog}>last: {last.weight_kg}kg · {last.date}</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
            <View style={styles.tip}>
              <Text style={styles.label}>FORM CUE</Text>
              <Text style={styles.h3}>
                {active === "wed_legs" ? "Deadlift: bar over mid-foot, brace, lats tight. PB at 60kg — today is a working day, not a hero day."
                  : active === "fri_legs" ? "Goblet squat: heels grounded, knees track over toes. Core stays braced for plank too."
                  : active === "tue_pull" ? "Lat pulldown: shoulder blades down + back, drive elbows toward hips."
                  : "Press from a stable shelf: ribs down, glutes engaged, full ROM."}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
      <MarigoldBurst trigger={burst} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { padding: space.lg, paddingBottom: 8 },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2, color: colors.terracotta },
  h1: { fontFamily: fonts.headingBold, fontSize: 44, color: colors.text, marginTop: 4 },
  h2: { fontFamily: fonts.heading, fontSize: 22, color: colors.text, marginVertical: 16 },
  h3: { fontFamily: fonts.heading, fontSize: 16, color: colors.text, lineHeight: 24, marginTop: 6 },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft },
  label: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2, color: colors.textSoft },
  lastLog: { fontFamily: fonts.body, fontSize: 11, color: colors.marigold, marginTop: 4 },
  dayPills: { paddingHorizontal: space.lg, paddingVertical: 8, gap: 10 },
  dayPill: {
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: radii.lg,
    backgroundColor: colors.bgSoft, marginRight: 8, minWidth: 130,
  },
  dayPillActive: { backgroundColor: colors.fuchsia },
  dayPillLabel: { fontFamily: fonts.headingBold, fontSize: 18, color: colors.text },
  dayPillLabelActive: { color: colors.bg },
  dayPillShort: { fontFamily: fonts.body, fontSize: 12, color: colors.textSoft, marginTop: 2 },
  exCard: {
    flexDirection: "row", alignItems: "center", padding: 14, marginBottom: 10,
    backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderRadius: radii.md,
  },
  exCardDone: { backgroundColor: colors.bgSoft, borderColor: colors.marigold },
  exCheck: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.fuchsia,
    alignItems: "center", justifyContent: "center", marginRight: 14,
  },
  exCheckDone: { backgroundColor: colors.marigold, borderColor: colors.marigold },
  exName: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
  exNameDone: { textDecorationLine: "line-through", color: colors.textSoft },
  tip: {
    backgroundColor: colors.kumkum, padding: space.lg, borderRadius: radii.lg, marginTop: 16,
  },
});
