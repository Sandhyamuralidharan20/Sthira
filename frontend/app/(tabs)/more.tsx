import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, space } from "../../src/theme";

const TILES = [
  { route: "/firm", title: "Firm", subtitle: "Stithi Architects pipeline", icon: "business-outline" as const, color: colors.kumkum },
  { route: "/progress", title: "Progress", subtitle: "Graphs · measurements", icon: "trending-up-outline" as const, color: colors.marigold },
  { route: "/mind", title: "Mind", subtitle: "Brain dump · journal", icon: "leaf-outline" as const, color: colors.terracotta },
];

export default function More() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container} edges={["top"]} testID="screen-more">
      <ScrollView contentContainerStyle={{ padding: space.lg }}>
        <Text style={styles.eyebrow}>SANDHYA · ARCHITECT</Text>
        <Text style={styles.h1}>More</Text>
        <Text style={styles.muted}>Three more rooms in your sthira.</Text>

        <View style={styles.tiles}>
          {TILES.map((t) => (
            <TouchableOpacity
              key={t.route}
              style={[styles.tile, { backgroundColor: t.color }]}
              onPress={() => router.push(t.route as any)}
              testID={`more-${t.title.toLowerCase()}`}
            >
              <Ionicons name={t.icon} size={32} color={colors.bg} />
              <Text style={styles.tileTitle}>{t.title}</Text>
              <Text style={styles.tileSub}>{t.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.card]}>
          <Text style={styles.label}>ABOUT STHIRA</Text>
          <Text style={styles.h3}>Stithi means stability. You're building it day by day — one logged set, one warm lead, one calm cycle at a time.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2, color: colors.terracotta },
  h1: { fontFamily: fonts.headingBold, fontSize: 44, color: colors.text, marginTop: 4 },
  h3: { fontFamily: fonts.heading, fontSize: 18, color: colors.text, lineHeight: 26 },
  muted: { fontFamily: fonts.body, fontSize: 14, color: colors.textSoft, marginTop: 4, marginBottom: 24 },
  label: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2, color: colors.textSoft, marginBottom: 8 },
  tiles: { gap: 12 },
  tile: { borderRadius: radii.xl, padding: space.xl, marginBottom: 6 },
  tileTitle: { fontFamily: fonts.headingBold, fontSize: 28, color: colors.bg, marginTop: 12 },
  tileSub: { fontFamily: fonts.body, fontSize: 13, color: colors.bg, opacity: 0.85, marginTop: 4 },
  card: { backgroundColor: colors.bgSoft, borderRadius: radii.lg, padding: space.lg, marginTop: 24 },
});
