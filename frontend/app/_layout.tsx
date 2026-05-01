import React from "react";
import { Stack } from "expo-router";
import { useFonts, Fraunces_400Regular, Fraunces_500Medium, Fraunces_700Bold, Fraunces_400Regular_Italic } from "@expo-google-fonts/fraunces";
import { Manrope_400Regular, Manrope_500Medium, Manrope_700Bold } from "@expo-google-fonts/manrope";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { colors } from "../src/theme";
import MeeraChat from "../src/MeeraChat";

export default function RootLayout() {
  const [loaded] = useFonts({
    Fraunces_400Regular,
    Fraunces_500Medium,
    Fraunces_700Bold,
    Fraunces_400Regular_Italic,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_700Bold,
  });

  if (!loaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.fuchsia} />
        <Text style={styles.loadingText}>Sthira</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="firm" options={{ presentation: "modal", headerShown: false }} />
          <Stack.Screen name="progress" options={{ presentation: "modal", headerShown: false }} />
          <Stack.Screen name="mind" options={{ presentation: "modal", headerShown: false }} />
        </Stack>
        <MeeraChat />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  loadingText: { color: colors.fuchsia, marginTop: 14, fontSize: 24, fontStyle: "italic" },
});
