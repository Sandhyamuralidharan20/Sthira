import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, space } from "../src/theme";
import { api } from "../src/api";

export default function Reels() {
  const router = useRouter();
  const [reels, setReels] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [suggestion, setSuggestion] = useState<string>("");
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);

  const [adding, setAdding] = useState(false);
  const [topic, setTopic] = useState("");
  const [views, setViews] = useState("");
  const [saves, setSaves] = useState("");
  const [shares, setShares] = useState("");
  const [followers, setFollowers] = useState("");

  const load = useCallback(async () => {
    const [r, a] = await Promise.all([api.listReels(), api.reelsAnalytics()]);
    setReels(r); setAnalytics(a);
  }, []);
  useEffect(() => { load(); }, [load]);

  const fetchSuggestion = async () => {
    setLoadingSuggestion(true);
    try {
      const s = await api.reelsMeeraSuggestion();
      setSuggestion(s.suggestion);
    } catch {
      setSuggestion("Couldn't reach Meera right now. Try again in a minute.");
    } finally {
      setLoadingSuggestion(false);
    }
  };

  const save = async () => {
    if (!topic.trim()) return;
    await api.createReel({
      topic: topic.trim(),
      views: parseInt(views || "0") || 0,
      saves: parseInt(saves || "0") || 0,
      shares: parseInt(shares || "0") || 0,
      new_followers: parseInt(followers || "0") || 0,
    });
    setTopic(""); setViews(""); setSaves(""); setShares(""); setFollowers("");
    setAdding(false);
    load();
  };

  const maxViews = useMemo(() => {
    const m = Math.max(1, ...(analytics?.by_day || []).map((d: any) => d.views));
    return m;
  }, [analytics]);

  const streakColor = (days: number | null) => {
    if (days === null || days === undefined) return colors.textSoft;
    if (days >= 3) return colors.kumkum;
    if (days >= 1) return colors.marigold;
    return "#2E8B57";
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]} testID="screen-reels">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={28} color={colors.text} /></TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.eyebrow}>MARKETING · INSTAGRAM</Text>
          <Text style={styles.h1}>Reels</Text>
        </View>
        <TouchableOpacity onPress={() => setAdding(true)} style={styles.addBtn} testID="reel-add">
          <Ionicons name="add" size={22} color={colors.textInverse} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 140 }}>
        {/* Streak card */}
        <View style={[styles.streakCard, { backgroundColor: streakColor(analytics?.days_since_last_post) + "22", borderColor: streakColor(analytics?.days_since_last_post) }]}>
          <Text style={styles.label}>CONTENT STREAK</Text>
          {analytics?.days_since_last_post === null && <Text style={styles.h3}>Nothing posted yet. Start today.</Text>}
          {analytics?.days_since_last_post === 0 && <Text style={styles.h3}>Posted today. Keep the engine warm.</Text>}
          {typeof analytics?.days_since_last_post === "number" && analytics.days_since_last_post > 0 && (
            <Text style={[styles.h3, analytics.days_since_last_post >= 3 && { color: colors.kumkum }]}>
              {analytics.days_since_last_post} {analytics.days_since_last_post === 1 ? "day" : "days"} since last post
              {analytics.days_since_last_post >= 3 && " — post something tomorrow."}
            </Text>
          )}
          <Text style={styles.muted}>{analytics?.posted_this_week || 0} this week · {analytics?.total_reels || 0} total</Text>
        </View>

        {/* Weekly views bars */}
        <View style={styles.card}>
          <Text style={styles.label}>LAST 7 DAYS · VIEWS</Text>
          <View style={styles.barsRow}>
            {(analytics?.by_day || []).map((d: any, i: number) => {
              const h = 12 + (d.views / maxViews) * 90;
              const day = new Date(d.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" })[0];
              return (
                <View key={i} style={styles.barWrap}>
                  <Text style={styles.barLabel}>{d.views || ""}</Text>
                  <View style={[styles.bar, { height: h, backgroundColor: d.count ? colors.fuchsia : colors.border }]} />
                  <Text style={styles.barDay}>{day}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Meera weekly suggestion */}
        <View style={[styles.card, { backgroundColor: colors.kumkum }]}>
          <Text style={[styles.label, { color: colors.marigold }]}>MEERA · WHAT TO POST NEXT</Text>
          {suggestion ? (
            <Text style={styles.quoteText}>{suggestion}</Text>
          ) : (
            <Text style={[styles.muted, { color: colors.bg, opacity: 0.8 }]}>
              {loadingSuggestion ? "Thinking…" : "Tap below to get this week's shoot idea from Meera based on your top performing content."}
            </Text>
          )}
          <TouchableOpacity onPress={fetchSuggestion} style={styles.suggestBtn} disabled={loadingSuggestion} testID="reel-suggest">
            {loadingSuggestion ? <ActivityIndicator color={colors.text} /> : <Text style={styles.suggestText}>{suggestion ? "Get a new idea" : "Ask Meera"}</Text>}
          </TouchableOpacity>
        </View>

        {/* Top performer */}
        {analytics?.top_performer && (
          <View style={styles.topCard}>
            <Text style={styles.label}>TOP PERFORMER · LAST 14 DAYS</Text>
            <Text style={styles.h3}>{analytics.top_performer.topic}</Text>
            <Text style={styles.muted}>
              {analytics.top_performer.views} views · {analytics.top_performer.saves} saves · {analytics.top_performer.shares} shares · +{analytics.top_performer.new_followers} followers
            </Text>
          </View>
        )}

        {/* Recent reels */}
        <Text style={styles.section}>All reels</Text>
        {reels.length === 0 && <Text style={styles.muted}>No reels yet. Log your first one.</Text>}
        {reels.map((r) => (
          <View key={r.id} style={styles.reelCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.reelTopic}>{r.topic}</Text>
              <Text style={styles.muted}>{r.date}</Text>
              <View style={styles.metricsRow}>
                <Metric label="views" value={r.views} color={colors.fuchsia} />
                <Metric label="saves" value={r.saves} color={colors.marigold} />
                <Metric label="shares" value={r.shares} color={colors.terracotta} />
                <Metric label="new" value={`+${r.new_followers}`} color="#2E8B57" />
              </View>
            </View>
            <TouchableOpacity onPress={async () => { await api.deleteReel(r.id); load(); }}>
              <Ionicons name="close" size={20} color={colors.textSoft} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <Modal visible={adding} transparent animationType="slide">
        <View style={styles.modalBg}>
          <ScrollView style={{ maxHeight: "85%" }} contentContainerStyle={styles.modalCard}>
            <Text style={styles.h2}>Log a reel</Text>
            <TextInput value={topic} onChangeText={setTopic} placeholder="Topic (e.g. Material palette for Kerala)" placeholderTextColor={colors.textSoft} style={styles.input} testID="reel-topic" />
            <View style={styles.gridInputs}>
              <TextInput value={views} onChangeText={setViews} placeholder="Views" keyboardType="number-pad" placeholderTextColor={colors.textSoft} style={[styles.input, styles.half]} />
              <TextInput value={saves} onChangeText={setSaves} placeholder="Saves" keyboardType="number-pad" placeholderTextColor={colors.textSoft} style={[styles.input, styles.half]} />
            </View>
            <View style={styles.gridInputs}>
              <TextInput value={shares} onChangeText={setShares} placeholder="Shares" keyboardType="number-pad" placeholderTextColor={colors.textSoft} style={[styles.input, styles.half]} />
              <TextInput value={followers} onChangeText={setFollowers} placeholder="+ Followers" keyboardType="number-pad" placeholderTextColor={colors.textSoft} style={[styles.input, styles.half]} />
            </View>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <TouchableOpacity onPress={() => setAdding(false)} style={[styles.btn, styles.btnGhost]}><Text style={styles.btnGhostText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={save} style={[styles.btn, styles.btnPrimary]} testID="reel-save"><Text style={styles.btnPrimaryText}>Save</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Metric({ label, value, color }: any) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: space.lg },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2, color: colors.terracotta },
  h1: { fontFamily: fonts.headingBold, fontSize: 32, color: colors.text },
  h2: { fontFamily: fonts.headingBold, fontSize: 22, color: colors.text, marginBottom: 6 },
  h3: { fontFamily: fonts.heading, fontSize: 18, color: colors.text, marginTop: 6, lineHeight: 26 },
  label: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2, color: colors.textSoft, marginBottom: 6 },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft, marginTop: 4 },
  section: { fontFamily: fonts.headingBold, fontSize: 22, color: colors.text, marginTop: 20, marginBottom: 10 },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.fuchsia, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: space.lg, marginBottom: 12 },
  streakCard: { borderWidth: 1, borderRadius: radii.lg, padding: space.lg, marginBottom: 12 },
  topCard: { backgroundColor: colors.marigold, borderRadius: radii.lg, padding: space.lg, marginBottom: 12 },
  quoteText: { fontFamily: fonts.headingItalic, fontSize: 18, color: colors.bg, lineHeight: 26, marginVertical: 6 },
  suggestBtn: { marginTop: 12, backgroundColor: colors.marigold, paddingVertical: 12, borderRadius: radii.pill, alignItems: "center" },
  suggestText: { fontFamily: fonts.bodyBold, color: colors.text, fontSize: 14 },
  barsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 120, marginTop: 6 },
  barWrap: { flex: 1, alignItems: "center" },
  bar: { width: 22, borderRadius: 4 },
  barLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.textSoft, marginBottom: 4 },
  barDay: { fontFamily: fonts.bodyMed, fontSize: 11, color: colors.textSoft, marginTop: 4 },
  reelCard: { flexDirection: "row", backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 14, marginBottom: 10 },
  reelTopic: { fontFamily: fonts.headingBold, fontSize: 17, color: colors.text },
  metricsRow: { flexDirection: "row", gap: 14, marginTop: 8 },
  metric: { alignItems: "flex-start" },
  metricValue: { fontFamily: fonts.headingBold, fontSize: 18 },
  metricLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.textSoft, letterSpacing: 0.5 },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.bg, padding: space.xl, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl },
  input: { backgroundColor: colors.bgSoft, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.body, fontSize: 15, marginTop: 10, color: colors.text },
  gridInputs: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: radii.pill, alignItems: "center" },
  btnPrimary: { backgroundColor: colors.fuchsia },
  btnPrimaryText: { fontFamily: fonts.bodyBold, color: colors.textInverse },
  btnGhost: { backgroundColor: colors.bgSoft },
  btnGhostText: { fontFamily: fonts.bodyMed, color: colors.text },
});
