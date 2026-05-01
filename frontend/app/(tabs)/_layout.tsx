import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../src/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.fuchsia,
        tabBarInactiveTintColor: colors.textSoft,
        tabBarLabelStyle: { fontFamily: fonts.bodyMed, fontSize: 11, letterSpacing: 0.3 },
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          height: 78,
          paddingTop: 8,
          paddingBottom: 18,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: ({ color, size }) => <Ionicons name="sunny-outline" size={size} color={color} />,
          tabBarTestID: "tab-today",
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: "Planner",
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
          tabBarTestID: "tab-planner",
        }}
      />
      <Tabs.Screen
        name="fitness"
        options={{
          title: "Fitness",
          tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline" size={size} color={color} />,
          tabBarTestID: "tab-fitness",
        }}
      />
      <Tabs.Screen
        name="cycle"
        options={{
          title: "Cycle",
          tabBarIcon: ({ color, size }) => <Ionicons name="flower-outline" size={size} color={color} />,
          tabBarTestID: "tab-cycle",
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
          tabBarTestID: "tab-more",
        }}
      />
    </Tabs>
  );
}
