import type { PlayerSave, UpgradeConfig, UpgradeId } from "../types";

export const upgrades: UpgradeConfig[] = [
  {
    id: "cooldown",
    label: "投币机构",
    description: "缩短投币冷却",
    baseCost: 90,
    growth: 1.36,
    maxLevel: 20
  },
  {
    id: "pusher",
    label: "推板稳定器",
    description: "提升推板厚重感",
    baseCost: 120,
    growth: 1.42,
    maxLevel: 20
  },
  {
    id: "slot",
    label: "图鉴槽",
    description: "提高中央槽收益",
    baseCost: 150,
    growth: 1.48,
    maxLevel: 20
  }
];

export function upgradeCost(config: UpgradeConfig, level: number): number {
  return Math.round(config.baseCost * Math.pow(config.growth, level - 1));
}

export function tryUpgrade(save: PlayerSave, id: UpgradeId): boolean {
  const config = upgrades.find((item) => item.id === id);
  if (!config) return false;
  const level = save.upgrades[id];
  if (level >= config.maxLevel) return false;
  const cost = upgradeCost(config, level);
  if (save.gold < cost) return false;
  save.gold -= cost;
  save.upgrades[id] += 1;
  return true;
}

export function coinCooldown(level: number): number {
  return Math.max(170, 520 - level * 18);
}

export function pusherSpeed(level: number): number {
  return 1.25 + level * 0.025;
}

export function centerReward(level: number): number {
  return 12 + level * 2;
}
