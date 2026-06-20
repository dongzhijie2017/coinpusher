import type { ArcadeGoal, MissionConfig, MissionId, PlayerSave, SkinConfig, SkinId, UpgradeConfig, UpgradeId } from "../types";

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

export const missions: MissionConfig[] = [
  { id: "spawnCoin", label: "今日投币 20 次", target: 20, rewardGem: 5 },
  { id: "hitCenter", label: "命中中央槽 5 次", target: 5, rewardGem: 8 },
  { id: "earnGold", label: "单局收集 150 Gold", target: 150, rewardGem: 12 }
];

export const skins: SkinConfig[] = [
  {
    id: "classic",
    label: "原版金币",
    costGem: 0,
    colors: { outer: 0xffd86a, middle: 0xf5a928, inner: 0xffd86a, shine: 0xfff7b0, rim: 0xbe7418 }
  },
  {
    id: "silver",
    label: "钛钢银币",
    costGem: 10,
    colors: { outer: 0xf1f5f9, middle: 0x94a3b8, inner: 0xdbeafe, shine: 0xffffff, rim: 0x475569 }
  },
  {
    id: "ruby",
    label: "熔岩红晶",
    costGem: 20,
    colors: { outer: 0xfecaca, middle: 0xef4444, inner: 0xfb7185, shine: 0xffe4e6, rim: 0x991b1b }
  },
  {
    id: "emerald",
    label: "翡翠流光",
    costGem: 35,
    colors: { outer: 0xdcfce7, middle: 0x22c55e, inner: 0x86efac, shine: 0xf0fdf4, rim: 0x166534 }
  }
];

export const arcadeGoals: ArcadeGoal[] = [
  { id: "basket", label: "街头篮球机", costGold: 200, description: "第一台街机等待修复", color: 0xf97316 },
  { id: "maze", label: "像素迷宫机", costGold: 600, description: "点亮复古迷宫灯箱", color: 0xeab308 },
  { id: "space", label: "太空防卫机", costGold: 1500, description: "重启霓虹射击机台", color: 0xa855f7 },
  { id: "racer", label: "极速赛车机", costGold: 3500, description: "修复最后的竞速座舱", color: 0x38bdf8 }
];

export function upgradeCost(config: UpgradeConfig, level: number): number {
  return Math.round(config.baseCost * Math.pow(config.growth, level - 1));
}

export function effectiveUpgradeCost(save: PlayerSave, config: UpgradeConfig, now = Date.now()): number {
  const cost = upgradeCost(config, save.upgrades[config.id]);
  if (save.buffs.upgradeDiscountUntil > now) {
    return Math.max(1, Math.floor(cost * 0.9));
  }
  return cost;
}

export function tryUpgrade(save: PlayerSave, id: UpgradeId): boolean {
  const config = upgrades.find((item) => item.id === id);
  if (!config) return false;
  const level = save.upgrades[id];
  if (level >= config.maxLevel) return false;
  const cost = effectiveUpgradeCost(save, config);
  if (save.gold < cost) return false;
  save.gold -= cost;
  save.upgrades[id] += 1;
  return true;
}

export function increaseMission(save: PlayerSave, id: MissionId, amount: number): void {
  const mission = save.missions[id];
  const config = missions.find((item) => item.id === id);
  if (!mission || !config || mission.claimed) return;
  mission.progress = Math.min(config.target, mission.progress + amount);
}

export function claimMission(save: PlayerSave, id: MissionId): boolean {
  const mission = save.missions[id];
  const config = missions.find((item) => item.id === id);
  if (!mission || !config || mission.claimed || mission.progress < config.target) return false;
  mission.claimed = true;
  save.gem += config.rewardGem;
  return true;
}

export function buyOrEquipSkin(save: PlayerSave, id: SkinId): "equipped" | "bought" | "locked" {
  const skin = skins.find((item) => item.id === id);
  if (!skin) return "locked";
  if (save.unlockedSkins.includes(id)) {
    save.activeSkin = id;
    return "equipped";
  }
  const discountedCost = save.buffs.skinDiscountUntil > Date.now() ? Math.floor(skin.costGem * 0.8) : skin.costGem;
  if (save.gem < discountedCost) return "locked";
  save.gem -= discountedCost;
  save.unlockedSkins.push(id);
  save.activeSkin = id;
  return "bought";
}

export function repairNextArcade(save: PlayerSave): ArcadeGoal | null {
  const goal = arcadeGoals[Math.min(save.repairedCount, arcadeGoals.length - 1)];
  if (!goal || save.repairedCount >= arcadeGoals.length || save.gold < goal.costGold) return null;
  save.gold -= goal.costGold;
  save.repairedCount += 1;
  return goal;
}

export function currentArcadeGoal(save: PlayerSave): ArcadeGoal {
  return arcadeGoals[Math.min(save.repairedCount, arcadeGoals.length - 1)];
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
