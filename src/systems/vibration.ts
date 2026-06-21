import type { VibrationPattern } from "../types";

export function canVibrate(): boolean {
  return typeof navigator !== "undefined" && "vibrate" in navigator;
}

export function vibrate(pattern: VibrationPattern | number): void {
  if (!canVibrate()) return;
  const ms = typeof pattern === "number" ? pattern : pattern.duration;
  try {
    navigator.vibrate(ms);
  } catch {
    // ignore
  }
}

export const VibrationPresets = {
  coinDrop: { duration: 15, intensity: "light" },
  coinCollect: { duration: 25, intensity: "light" },
  centerHit: { duration: 60, intensity: "medium" },
  mechanismTrigger: { duration: 40, intensity: "medium" },
  upgrade: { duration: 80, intensity: "medium" },
  giftPack: { duration: 50, intensity: "medium" },
  error: { duration: 30, intensity: "light" },
  click: { duration: 10, intensity: "light" }
} as const;

export function vibratePreset(name: keyof typeof VibrationPresets): void {
  vibrate(VibrationPresets[name]);
}
