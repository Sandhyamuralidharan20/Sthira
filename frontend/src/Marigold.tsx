import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing, Dimensions, Text } from "react-native";

const { width, height } = Dimensions.get("window");

type Props = { trigger: number; onDone?: () => void };

export default function MarigoldBurst({ trigger, onDone }: Props) {
  const anims = useRef(
    Array.from({ length: 18 }).map(() => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      r: new Animated.Value(0),
      o: new Animated.Value(0),
      s: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (!trigger) return;
    const animations = anims.map((a, i) => {
      const angle = (i / anims.length) * Math.PI * 2 + Math.random() * 0.4;
      const distance = 140 + Math.random() * 80;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance - 40;
      a.x.setValue(0); a.y.setValue(0); a.r.setValue(0); a.o.setValue(0); a.s.setValue(0);
      return Animated.parallel([
        Animated.timing(a.x, { toValue: dx, duration: 1400, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
        Animated.timing(a.y, { toValue: dy + 220, duration: 1400, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
        Animated.timing(a.r, { toValue: 720 + Math.random() * 360, duration: 1400, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(a.s, { toValue: 1, duration: 250, useNativeDriver: true, easing: Easing.out(Easing.back(2)) }),
          Animated.timing(a.s, { toValue: 0.6, duration: 1100, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(a.o, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.delay(700),
          Animated.timing(a.o, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]),
      ]);
    });
    Animated.parallel(animations).start(() => onDone && onDone());
  }, [trigger]);

  if (!trigger) return null;
  return (
    <View style={styles.layer} pointerEvents="none" testID="marigold-celebration">
      {anims.map((a, i) => {
        const colors = ["#FF9F1C", "#FFB703", "#D81159", "#E2725B", "#B9123D"];
        const c = colors[i % colors.length];
        const size = 22 + (i % 5) * 4;
        return (
          <Animated.View
            key={i}
            style={[
              styles.flower,
              {
                backgroundColor: c,
                width: size, height: size, borderRadius: size / 2,
                opacity: a.o,
                transform: [
                  { translateX: a.x },
                  { translateY: a.y },
                  { rotate: a.r.interpolate({ inputRange: [0, 360], outputRange: ["0deg", "360deg"] }) },
                  { scale: a.s },
                ],
              },
            ]}
          >
            <Text style={styles.petal}>✺</Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center", zIndex: 999,
  },
  flower: {
    position: "absolute",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#FF9F1C", shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  petal: { color: "#FDFBF7", fontSize: 14, fontWeight: "900" },
});
