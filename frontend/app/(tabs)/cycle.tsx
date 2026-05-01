import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, space } from "../../src/theme";
import { api } from "../../src/api";
import { getCyclePhase, phaseInfo } from "../../src/cycle";

const SYMPTOMS = ["Cramps", "Bloating", "Headache", "Tender breasts", "Acne", "Low energy", "Cravings"];
const FLOWS = ["light", "medium", "heavy"];
const MOODS = ["🌸 Calm", "🔥 Energetic", "🌧 Low", "🌪 Anxious", "💛 Joyful"];

export default function Cycle() {
  const [cycle, setCycle] = useState<any>({ last_period_start: null, cycle_length: 32, period_length: 5 });
  const [logs, setLogs] = useState<any[]>([]);
  const [editingDate, setEditingDate] = useState("");
  const [flow, setFlow] = useState<string | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [mood, setMood] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [c, l] = await Promise.all([api.getCycle(), api.listCycleLogs()]);
    setCycle(c); setLogs(l);
    setEditingDate(c.last_period_start || new Date().toISOString().slice(0, 10));
  }, []);

  useEffect(() => { load(); }, [load]);

  const phase = getCyclePhase(cycle.last_period_start, cycle.cycle_length, cycle.period_length);

  const setStart = async (iso: string) => {
    const updated = await api.setCycle({ ...cycle, last_period_start: iso });
    setCycle(updated);
  };

  const saveLog = async () => {
    const date = new Date().toISOString().slice(0, 10);
    await api.addCycleLog({ date, flow, symptoms, mood });
    setSymptoms([]); setFlow(null); setMood(null);
    load();
  };

  const toggleSymptom = (s: string) => {
    setSymptoms((arr) => arr.includes(s) ? arr.filter((x) => x !== s) : [...arr, s]);
  };

  // 32-day visual
  const days = Array.from({ length: cycle.cycle_length }, (_, i) => i + 1);

  return (
    <SafeAreaView style={styles.container} edges={["top"]} testID="screen-cycle">
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{cycle.cycle_length}-DAY RHYTHM</Text>
          <Text style={styles.h1}>Cycle</Text>
        </View>

        {phase.phase ? (
          <View style={[styles.phaseCard, { backgroundColor: phaseInfo[phase.phase].color }]}>
            <Text style={styles.phaseDay}>Day {phase.dayOfCycle}</Text>
            <Text style={styles.phaseTitle}>{phaseInfo[phase.phase].emoji} {phaseInfo[phase.phase].label}</Text>
            <Text style={styles.phaseVibe}>{phaseInfo[phase.phase].vibe}</Text>
            <Text style={styles.phaseSub}>Next period in {phase.daysToNext} days</Text>
          </View>
        ) : (
          <View style={[styles.card, { marginHorizontal: space.lg }]}>
            <Text style={styles.label}>SET STARTING POINT</Text>
            <Text style={styles.h3}>When did your last period start?</Text>
            <TextInput
              value={editingDate}
              onChangeText={setEditingDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSoft}
              style={styles.input}
              testID="cycle-date-input"
            />
            <TouchableOpacity onPress={() => setStart(editingDate)} style={styles.btnPrimary} testID="cycle-save">
              <Text style={styles.btnPrimaryText}>Save</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase.phase && (
          <View style={{ paddingHorizontal: space.lg, marginTop: space.lg }}>
            <Text style={styles.label}>32-DAY MAP</Text>
            <View style={styles.dotGrid}>
              {days.map((d) => {
                let color = colors.bgWarm;
                if (d <= cycle.period_length) color = phaseInfo.menstrual.color;
                else if (d <= cycle.cycle_length / 2 - 2) color = phaseInfo.follicular.color;
                else if (d <= cycle.cycle_length / 2 + 2) color = phaseInfo.ovulation.color;
                else color = phaseInfo.luteal.color;
                const isToday = d === phase.dayOfCycle;
                return (
                  <View
                    key={d}
                    style={[styles.dotCell, { backgroundColor: color, opacity: isToday ? 1 : 0.55 }, isToday && styles.dotCellToday]}
                  >
                    <Text style={[styles.dotNum, isToday && { color: colors.textInverse }]}>{d}</Text>
                  </View>
                );
              })}
            </View>

            <Text style={[styles.label, { marginTop: 24 }]}>LOG TODAY</Text>
            <View style={styles.card}>
              <Text style={styles.h3Small}>Flow</Text>
              <View style={styles.row}>
                {FLOWS.map((f) => (
                  <TouchableOpacity key={f} onPress={() => setFlow(f)} style={[styles.chip, flow === f && styles.chipActive]} testID={`flow-${f}`}>
                    <Text style={[styles.chipText, flow === f && styles.chipTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.h3Small, { marginTop: 16 }]}>Symptoms</Text>
              <View style={styles.row}>
                {SYMPTOMS.map((s) => (
                  <TouchableOpacity key={s} onPress={() => toggleSymptom(s)} style={[styles.chip, symptoms.includes(s) && styles.chipActive]}>
                    <Text style={[styles.chipText, symptoms.includes(s) && styles.chipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.h3Small, { marginTop: 16 }]}>Mood</Text>
              <View style={styles.row}>
                {MOODS.map((m) => (
                  <TouchableOpacity key={m} onPress={() => setMood(m)} style={[styles.chip, mood === m && styles.chipActive]}>
                    <Text style={[styles.chipText, mood === m && styles.chipTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity onPress={saveLog} style={[styles.btnPrimary, { marginTop: 16 }]} testID="cycle-log-save">
                <Text style={styles.btnPrimaryText}>Save log</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { marginTop: 24 }]}>RECENT LOGS</Text>
            {logs.slice(0, 5).map((l) => (
              <View key={l.id} style={[styles.card, { padding: 12 }]}>
                <Text style={styles.h3Small}>{l.date}</Text>
                <Text style={styles.muted}>
                  {l.flow ? `${l.flow} · ` : ""}{(l.symptoms || []).join(", ")}{l.mood ? ` · ${l.mood}` : ""}
                </Text>
              </View>
            ))}
            {logs.length === 0 && <Text style={styles.muted}>No logs yet.</Text>}

            <TouchableOpacity onPress={() => setCycle({ ...cycle, last_period_start: null })} style={{ marginTop: 24, alignItems: "center" }}>
              <Text style={styles.muted}>Reset start date</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { padding: space.lg, paddingBottom: 8 },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2, color: colors.terracotta },
  h1: { fontFamily: fonts.headingBold, fontSize: 44, color: colors.text, marginTop: 4 },
  h3: { fontFamily: fonts.heading, fontSize: 18, color: colors.text, marginTop: 6 },
  h3Small: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text, marginBottom: 8 },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft, marginTop: 4 },
  label: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2, color: colors.textSoft, marginBottom: 8 },
  card: { backgroundColor: "#fff", borderColor: colors.border, borderWidth: 1, borderRadius: radii.lg, padding: space.lg, marginBottom: space.md },
  phaseCard: { marginHorizontal: space.lg, padding: space.xl, borderRadius: radii.xl },
  phaseDay: { fontFamily: fonts.body, fontSize: 14, color: colors.bg, opacity: 0.85, letterSpacing: 1 },
  phaseTitle: { fontFamily: fonts.headingBold, fontSize: 32, color: colors.bg, marginTop: 6 },
  phaseVibe: { fontFamily: fonts.headingItalic, fontSize: 16, color: colors.bg, marginTop: 8, lineHeight: 22 },
  phaseSub: { fontFamily: fonts.body, fontSize: 13, color: colors.bg, opacity: 0.85, marginTop: 12 },
  dotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  dotCell: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  dotCellToday: { borderWidth: 2, borderColor: colors.text, transform: [{ scale: 1.1 }] },
  dotNum: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.text },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: colors.bgSoft },
  chipActive: { backgroundColor: colors.fuchsia },
  chipText: { fontFamily: fonts.bodyMed, fontSize: 13, color: colors.text },
  chipTextActive: { color: colors.textInverse },
  input: { backgroundColor: colors.bgSoft, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.body, fontSize: 15, marginTop: 12, color: colors.text },
  btnPrimary: { backgroundColor: colors.fuchsia, padding: 14, borderRadius: radii.pill, alignItems: "center", marginTop: 12 },
  btnPrimaryText: { fontFamily: fonts.bodyBold, color: colors.textInverse, fontSize: 15 },
});
