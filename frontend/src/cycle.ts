export type Phase = "menstrual" | "follicular" | "ovulation" | "luteal";

export const phaseInfo: Record<Phase, { label: string; emoji: string; vibe: string; color: string }> = {
  menstrual: { label: "Menstrual", emoji: "🌑", vibe: "Rest, soft food, slow walks.", color: "#B9123D" },
  follicular: { label: "Follicular", emoji: "🌱", vibe: "Build energy. Good for new ideas + heavy lifts.", color: "#FF9F1C" },
  ovulation: { label: "Ovulation", emoji: "🌕", vibe: "Peak power. PR day. Pitch the lead.", color: "#FFB703" },
  luteal: { label: "Luteal", emoji: "🌗", vibe: "Wind down. Steady reps, warm meals.", color: "#E2725B" },
};

export function getCyclePhase(lastPeriodStart: string | null, cycleLength = 32, periodLength = 5) {
  if (!lastPeriodStart) return { phase: null as Phase | null, dayOfCycle: 0, daysToNext: 0 };
  const start = new Date(lastPeriodStart + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - start.getTime()) / 86400000);
  const dayOfCycle = ((diffDays % cycleLength) + cycleLength) % cycleLength + 1;

  let phase: Phase;
  if (dayOfCycle <= periodLength) phase = "menstrual";
  else if (dayOfCycle <= cycleLength / 2 - 2) phase = "follicular";
  else if (dayOfCycle <= cycleLength / 2 + 2) phase = "ovulation";
  else phase = "luteal";

  const daysToNext = cycleLength - dayOfCycle + 1;
  return { phase, dayOfCycle, daysToNext };
}
