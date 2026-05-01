import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, space } from "../../src/theme";
import { api } from "../../src/api";

type Cat = { key: string; label: string; color: string };

const CATEGORIES: Cat[] = [
  { key: "gym",      label: "Gym",      color: colors.fuchsia },
  { key: "work",     label: "Firm",     color: colors.marigold },
  { key: "content",  label: "Content",  color: "#8E44AD" },
  { key: "aecom",    label: "AECOM",    color: "#2E8B57" },
  { key: "personal", label: "Personal", color: colors.saffron },
];
const CAT_MAP: Record<string, Cat> = Object.fromEntries(CATEGORIES.map((c) => [c.key, c])) as any;

// Cycle phase legend (soft tints)
const PHASE_TINTS = {
  menstrual:  { bg: "rgba(216, 17, 89, 0.14)",  border: "rgba(216, 17, 89, 0.32)",  label: "Period",    swatch: "#D81159" },
  ovulation:  { bg: "rgba(255, 183, 3, 0.18)",  border: "rgba(255, 183, 3, 0.38)",  label: "Ovulation", swatch: "#FFB703" },
  luteal:     { bg: "rgba(142, 68, 173, 0.12)", border: "rgba(142, 68, 173, 0.30)", label: "Luteal · PMS", swatch: "#8E44AD" },
} as const;

type PhaseKey = keyof typeof PHASE_TINTS | "follicular" | "none";

function dayOfCycle(iso: string, lastStartIso: string | null, cycleLength: number): number | null {
  if (!lastStartIso) return null;
  const start = new Date(lastStartIso + "T00:00:00").getTime();
  const d = new Date(iso + "T00:00:00").getTime();
  const diff = Math.floor((d - start) / 86400000);
  if (diff < 0) {
    // before recorded start: project backwards
    const mod = ((diff % cycleLength) + cycleLength) % cycleLength;
    return mod + 1;
  }
  return (diff % cycleLength) + 1;
}

function phaseFor(day: number, cycleLength: number, periodLength: number): PhaseKey {
  if (day <= periodLength) return "menstrual";
  // ovulation centered around mid-cycle (±1 day)
  const ov = Math.round(cycleLength / 2);
  if (day >= ov - 1 && day <= ov + 1) return "ovulation";
  if (day > ov + 1) return "luteal";
  return "follicular";
}

export default function Planner() {
  const [cursor, setCursor] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>(new Date().toISOString().slice(0, 10));
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newCat, setNewCat] = useState("personal");
  const [cycle, setCycle] = useState<{ last_period_start: string | null; cycle_length: number; period_length: number }>({
    last_period_start: null, cycle_length: 32, period_length: 5,
  });

  const monthKey = useMemo(
    () => `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
    [cursor]
  );

  const load = useCallback(async () => {
    const [list, c] = await Promise.all([api.listEvents(monthKey), api.getCycle()]);
    setEvents(list);
    setCycle({
      last_period_start: c?.last_period_start || null,
      cycle_length: c?.cycle_length || 32,
      period_length: c?.period_length || 5,
    });
  }, [monthKey]);
  useEffect(() => { load(); }, [load]);

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startWd = first.getDay();
    const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: ({ d: number; iso: string; wd: number } | null)[] = [];
    for (let i = 0; i < startWd; i++) cells.push(null);
    for (let d = 1; d <= days; d++) {
      const iso = `${monthKey}-${String(d).padStart(2, "0")}`;
      const wd = new Date(iso + "T00:00:00").getDay();
      cells.push({ d, iso, wd });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor, monthKey]);

  const eventsByDate = useMemo(() => {
    const m: Record<string, any[]> = {};
    events.forEach((e) => { (m[e.date] ||= []).push(e); });
    return m;
  }, [events]);

  const dotsForDate = (iso: string, wd: number): string[] => {
    const cats = new Set<string>();
    (eventsByDate[iso] || []).forEach((e) => { if (CAT_MAP[e.category]) cats.add(e.category); });
    if (wd >= 1 && wd <= 5) cats.add("gym");
    return CATEGORIES.filter((c) => cats.has(c.key)).map((c) => c.color);
  };

  const phaseForCell = (iso: string): PhaseKey => {
    const day = dayOfCycle(iso, cycle.last_period_start, cycle.cycle_length);
    if (day === null) return "none";
    return phaseFor(day, cycle.cycle_length, cycle.period_length);
  };

  // Predicted next-period start = day 1 of cycle. Render 🌸 only if date is today or later.
  const isPredictedStart = (iso: string): boolean => {
    if (!cycle.last_period_start) return false;
    const day = dayOfCycle(iso, cycle.last_period_start, cycle.cycle_length);
    if (day !== 1) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return new Date(iso + "T00:00:00").getTime() >= today.getTime();
  };

  const todayIso = new Date().toISOString().slice(0, 10);
  const dayEvents = eventsByDate[selected] || [];
  const monthLabel = cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const selectedWd = new Date(selected + "T00:00:00").getDay();
  const isGymDay = selectedWd >= 1 && selectedWd <= 5;
  const selectedDay = dayOfCycle(selected, cycle.last_period_start, cycle.cycle_length);
  const selectedPhase = phaseForCell(selected);

  const addEvent = async () => {
    if (!newTitle.trim()) return;
    await api.createEvent({ date: selected, title: newTitle.trim(), time: newTime || null, category: newCat });
    setNewTitle(""); setNewTime(""); setAdding(false);
    load();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]} testID="screen-planner">
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} testID="planner-prev">
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={{ alignItems: "center" }}>
            <Text style={styles.eyebrow}>PLANNER</Text>
            <Text style={styles.h1}>{monthLabel}</Text>
          </View>
          <TouchableOpacity onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} testID="planner-next">
            <Ionicons name="chevron-forward" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.weekRow}>
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <Text key={i} style={styles.weekLetter}>{d}</Text>
          ))}
        </View>

        <View style={styles.grid}>
          {grid.map((c, i) => {
            if (!c) return <View key={i} style={styles.cell} />;
            const isSelected = c.iso === selected;
            const isToday = c.iso === todayIso;
            const dots = dotsForDate(c.iso, c.wd);
            const ph = phaseForCell(c.iso);
            const tint = ph !== "none" && ph !== "follicular" ? PHASE_TINTS[ph] : null;
            const showFlower = isPredictedStart(c.iso);
            return (
              <View key={i} style={styles.cell}>
                <TouchableOpacity
                  style={[
                    styles.cellInner,
                    tint && !isSelected && { backgroundColor: tint.bg, borderColor: tint.border, borderWidth: 1 },
                    isToday && !isSelected && styles.cellToday,
                    isSelected && styles.cellSelected,
                  ]}
                  onPress={() => setSelected(c.iso)}
                  testID={`day-${c.iso}`}
                >
                  <Text style={[styles.cellNum, isSelected && styles.cellNumSelected]}>{c.d}</Text>
                  <View style={styles.dotRow}>
                    {dots.slice(0, 5).map((color, k) => (
                      <View key={k} style={[styles.dot, { backgroundColor: isSelected ? colors.bg : color }]} />
                    ))}
                  </View>
                  {showFlower && (
                    <Text style={styles.flower}>🌸</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* Category legend */}
        <View style={styles.legendRow}>
          {CATEGORIES.map((c) => (
            <View key={c.key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: c.color }]} />
              <Text style={styles.legendLabel}>{c.label}</Text>
            </View>
          ))}
        </View>

        {/* Cycle phase legend */}
        <View style={styles.legendRow}>
          {(["menstrual", "ovulation", "luteal"] as const).map((k) => (
            <View key={k} style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: PHASE_TINTS[k].bg, borderColor: PHASE_TINTS[k].border }]} />
              <Text style={styles.legendLabel}>{PHASE_TINTS[k].label}</Text>
            </View>
          ))}
          {cycle.last_period_start && (
            <View style={styles.legendItem}>
              <Text style={{ fontSize: 14 }}>🌸</Text>
              <Text style={styles.legendLabel}>Next start</Text>
            </View>
          )}
        </View>

        {/* Day agenda */}
        <View style={{ paddingHorizontal: space.lg, marginTop: 12 }}>
          <View style={styles.dayHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.h3}>
                {new Date(selected + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
              </Text>
              {selectedDay !== null && (
                <Text style={styles.dayCycle}>
                  Cycle day {selectedDay}
                  {selectedPhase !== "none" && selectedPhase !== "follicular" && ` · ${PHASE_TINTS[selectedPhase as keyof typeof PHASE_TINTS].label}`}
                  {selectedPhase === "follicular" && ` · Follicular`}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={() => setAdding(true)} style={styles.addPill} testID="planner-add">
              <Ionicons name="add" size={16} color={colors.textInverse} />
              <Text style={styles.addPillText}>Add</Text>
            </TouchableOpacity>
          </View>

          {isGymDay && (
            <View style={[styles.eventCard, { borderLeftColor: CAT_MAP.gym.color, backgroundColor: colors.bgSoft }]}>
              <View style={[styles.catBar, { backgroundColor: CAT_MAP.gym.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle}>Gym · {["Push Chest+Sh", "Pull Back+Bi", "Legs Glutes+Ham", "Push Chest+Tri", "Legs Quads+Core"][selectedWd - 1]}</Text>
                <Text style={styles.muted}>Auto · weekday</Text>
              </View>
            </View>
          )}

          {dayEvents.length === 0 && !isGymDay && <Text style={styles.muted}>Nothing scheduled. Sacred whitespace.</Text>}

          {dayEvents.map((e) => {
            const cat = CAT_MAP[e.category] || CAT_MAP.personal;
            return (
              <View key={e.id} style={[styles.eventCard, { borderLeftColor: cat.color }]} testID={`event-${e.id}`}>
                <View style={[styles.catBar, { backgroundColor: cat.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventTitle}>{e.title}</Text>
                  <Text style={styles.muted}>{cat.label}{e.time ? ` · ${e.time}` : ""}{e.notes ? ` · ${e.notes}` : ""}</Text>
                </View>
                <TouchableOpacity onPress={async () => { await api.deleteEvent(e.id); load(); }} testID={`event-del-${e.id}`}>
                  <Ionicons name="close" size={18} color={colors.textSoft} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.h2}>New event</Text>
            <Text style={styles.muted}>{selected}</Text>
            <TextInput value={newTitle} onChangeText={setNewTitle} placeholder="Title" placeholderTextColor={colors.textSoft} style={styles.modalInput} testID="event-title" />
            <TextInput value={newTime} onChangeText={setNewTime} placeholder="Time (e.g. 10:30 AM)" placeholderTextColor={colors.textSoft} style={styles.modalInput} testID="event-time" />
            <View style={styles.catRow}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity key={c.key} onPress={() => setNewCat(c.key)} style={[styles.catChip, { borderColor: c.color }, newCat === c.key && { backgroundColor: c.color }]}>
                  <Text style={[styles.catChipText, newCat === c.key && { color: colors.textInverse }]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <TouchableOpacity onPress={() => setAdding(false)} style={[styles.btn, styles.btnGhost]}><Text style={styles.btnGhostText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={addEvent} style={[styles.btn, styles.btnPrimary]} testID="event-save"><Text style={styles.btnPrimaryText}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: space.lg },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2, color: colors.terracotta },
  h1: { fontFamily: fonts.headingBold, fontSize: 28, color: colors.text },
  h2: { fontFamily: fonts.headingBold, fontSize: 22, color: colors.text, marginBottom: 6 },
  h3: { fontFamily: fonts.heading, fontSize: 20, color: colors.text },
  dayCycle: { fontFamily: fonts.bodyMed, fontSize: 12, color: colors.terracotta, marginTop: 2, letterSpacing: 0.5 },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft },
  weekRow: { flexDirection: "row", paddingHorizontal: space.lg },
  weekLetter: { flex: 1, textAlign: "center", fontFamily: fonts.bodyBold, fontSize: 11, color: colors.textSoft, letterSpacing: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: space.md, marginTop: 8 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  cellInner: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: radii.md, paddingVertical: 4 },
  cellSelected: { backgroundColor: colors.fuchsia },
  cellToday: { borderWidth: 1, borderColor: colors.marigold },
  cellNum: { fontFamily: fonts.heading, fontSize: 16, color: colors.text },
  cellNumSelected: { color: colors.textInverse },
  dotRow: { flexDirection: "row", gap: 3, marginTop: 3, minHeight: 6 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  flower: { position: "absolute", top: 2, right: 4, fontSize: 11 },
  legendRow: {
    flexDirection: "row", flexWrap: "wrap", gap: 14,
    paddingHorizontal: space.lg, paddingVertical: 8,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendSwatch: { width: 12, height: 12, borderRadius: 4, borderWidth: 1 },
  legendLabel: { fontFamily: fonts.bodyMed, fontSize: 11, color: colors.textSoft, letterSpacing: 0.4 },
  dayHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, marginTop: 4 },
  addPill: { flexDirection: "row", alignItems: "center", backgroundColor: colors.fuchsia, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill, gap: 4 },
  addPillText: { fontFamily: fonts.bodyMed, color: colors.textInverse, fontSize: 13 },
  eventCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderRadius: radii.md, padding: 12, marginBottom: 10, gap: 12,
  },
  catBar: { width: 4, height: 36, borderRadius: 2 },
  eventTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.bg, padding: space.xl, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl },
  modalInput: { backgroundColor: colors.bgSoft, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.body, fontSize: 15, marginTop: 12, color: colors.text },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderRadius: radii.pill },
  catChipText: { fontFamily: fonts.bodyMed, fontSize: 13, color: colors.text },
  btn: { flex: 1, paddingVertical: 14, borderRadius: radii.pill, alignItems: "center" },
  btnPrimary: { backgroundColor: colors.fuchsia },
  btnPrimaryText: { fontFamily: fonts.bodyBold, color: colors.textInverse },
  btnGhost: { backgroundColor: colors.bgSoft },
  btnGhostText: { fontFamily: fonts.bodyMed, color: colors.text },
});
