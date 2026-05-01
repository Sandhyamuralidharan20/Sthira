import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, space } from "../../src/theme";
import { api } from "../../src/api";

type Cat = { key: string; label: string; color: string };

const CATEGORIES: Cat[] = [
  { key: "gym",      label: "Gym",      color: colors.fuchsia },       // fuchsia
  { key: "work",     label: "Firm",     color: colors.marigold },      // orange
  { key: "content",  label: "Content",  color: "#8E44AD" },            // purple
  { key: "aecom",    label: "AECOM",    color: "#2E8B57" },            // green
  { key: "personal", label: "Personal", color: colors.saffron },       // gold
];

const CAT_MAP: Record<string, Cat> = Object.fromEntries(CATEGORIES.map((c) => [c.key, c])) as any;

export default function Planner() {
  const [cursor, setCursor] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>(new Date().toISOString().slice(0, 10));
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newCat, setNewCat] = useState("personal");

  const monthKey = useMemo(
    () => `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
    [cursor]
  );

  const load = useCallback(async () => {
    const list = await api.listEvents(monthKey);
    setEvents(list);
  }, [monthKey]);

  useEffect(() => { load(); }, [load]);

  // Build month grid
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

  // For a given date: collect distinct category colors. Auto-add 'gym' for Mon–Fri.
  const dotsForDate = (iso: string, wd: number): string[] => {
    const cats = new Set<string>();
    (eventsByDate[iso] || []).forEach((e) => {
      if (CAT_MAP[e.category]) cats.add(e.category);
    });
    if (wd >= 1 && wd <= 5) cats.add("gym"); // Mon–Fri auto
    return CATEGORIES.filter((c) => cats.has(c.key)).map((c) => c.color);
  };

  const todayIso = new Date().toISOString().slice(0, 10);
  const dayEvents = eventsByDate[selected] || [];
  const monthLabel = cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const selectedWd = new Date(selected + "T00:00:00").getDay();
  const isGymDay = selectedWd >= 1 && selectedWd <= 5;

  const addEvent = async () => {
    if (!newTitle.trim()) return;
    await api.createEvent({ date: selected, title: newTitle.trim(), time: newTime || null, category: newCat });
    setNewTitle(""); setNewTime(""); setAdding(false);
    load();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]} testID="screen-planner">
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
          return (
            <TouchableOpacity
              key={i}
              style={[styles.cell, isSelected && styles.cellSelected, isToday && !isSelected && styles.cellToday]}
              onPress={() => setSelected(c.iso)}
              testID={`day-${c.iso}`}
            >
              <Text style={[styles.cellNum, isSelected && styles.cellNumSelected]}>{c.d}</Text>
              <View style={styles.dotRow}>
                {dots.slice(0, 5).map((color, k) => (
                  <View key={k} style={[styles.dot, { backgroundColor: isSelected ? colors.bg : color }]} />
                ))}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Legend */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.legend}>
        {CATEGORIES.map((c) => (
          <View key={c.key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: c.color }]} />
            <Text style={styles.legendLabel}>{c.label}</Text>
          </View>
        ))}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}>
        <View style={styles.dayHeader}>
          <Text style={styles.h3}>
            {new Date(selected + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
          </Text>
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
            <View key={e.id} style={[styles.eventCard, { borderLeftColor: cat.color }]}>
              <View style={[styles.catBar, { backgroundColor: cat.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle}>{e.title}</Text>
                <Text style={styles.muted}>{cat.label}{e.time ? ` · ${e.time}` : ""}</Text>
              </View>
              <TouchableOpacity onPress={async () => { await api.deleteEvent(e.id); load(); }}>
                <Ionicons name="close" size={18} color={colors.textSoft} />
              </TouchableOpacity>
            </View>
          );
        })}
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
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft },
  weekRow: { flexDirection: "row", paddingHorizontal: space.lg },
  weekLetter: { flex: 1, textAlign: "center", fontFamily: fonts.bodyBold, fontSize: 11, color: colors.textSoft, letterSpacing: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: space.md, marginTop: 8 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center", paddingVertical: 4 },
  cellSelected: { backgroundColor: colors.fuchsia, borderRadius: radii.md },
  cellToday: { borderWidth: 1, borderColor: colors.marigold, borderRadius: radii.md },
  cellNum: { fontFamily: fonts.heading, fontSize: 16, color: colors.text },
  cellNumSelected: { color: colors.textInverse },
  dotRow: { flexDirection: "row", gap: 3, marginTop: 4, minHeight: 6 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  legend: { paddingHorizontal: space.lg, paddingVertical: 10, gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6, marginRight: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontFamily: fonts.bodyMed, fontSize: 11, color: colors.textSoft, letterSpacing: 0.5 },
  dayHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
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
