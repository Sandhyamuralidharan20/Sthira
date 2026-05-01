import React from "react";
import { View, Text } from "react-native";
import { colors, fonts } from "./theme";

/**
 * Simple stylized lily glyph rendered with views (no SVG dependency).
 * Three white petals + center dot on fuchsia surface.
 */
export default function LilyGlyph({ size = 40, petal = "#FDFBF7", center = "#FFB703" }: { size?: number; petal?: string; center?: string }) {
  const p = size * 0.55;
  const w = size * 0.22;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {/* top petal */}
      <View style={{ position: "absolute", width: w, height: p, borderRadius: w, backgroundColor: petal, transform: [{ translateY: -size * 0.18 }] }} />
      {/* left petal */}
      <View style={{ position: "absolute", width: w, height: p, borderRadius: w, backgroundColor: petal, transform: [{ rotate: "-55deg" }, { translateY: -size * 0.05 }] }} />
      {/* right petal */}
      <View style={{ position: "absolute", width: w, height: p, borderRadius: w, backgroundColor: petal, transform: [{ rotate: "55deg" }, { translateY: -size * 0.05 }] }} />
      {/* center */}
      <View style={{ width: size * 0.15, height: size * 0.15, borderRadius: size * 0.08, backgroundColor: center }} />
    </View>
  );
}
