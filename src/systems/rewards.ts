import type { MechanismReward, RewardId } from "../types";

export const mechanismRewards: MechanismReward[] = [
  {
    id: "gold-small",
    label: "5 Gold",
    shortLabel: "+5G",
    description: "发现少量修复材料",
    weight: 18,
    color: 0xf7d56b
  },
  {
    id: "gold-medium",
    label: "10 Gold",
    shortLabel: "+10G",
    description: "发现一组修复材料",
    weight: 10,
    color: 0xf7c04a
  },
  {
    id: "gold-large",
    label: "30 Gold",
    shortLabel: "+30G",
    description: "发现稀有修复材料",
    weight: 4,
    color: 0xffa629
  },
  {
    id: "coin",
    label: "1 Coin",
    shortLabel: "+1C",
    description: "回收一枚投币",
    weight: 8,
    color: 0x85d7ff
  },
  {
    id: "gold-boost",
    label: "Gold +50%",
    shortLabel: "增幅",
    description: "5 分钟 Gold 产出提升",
    weight: 3,
    color: 0xaef27a
  },
  {
    id: "auto-collect",
    label: "自动收集",
    shortLabel: "收集",
    description: "30 秒掉落自动回收",
    weight: 2,
    color: 0x78f4d2
  },
  {
    id: "fragment",
    label: "图鉴碎片",
    shortLabel: "碎片",
    description: "获得 1 个主题图鉴碎片",
    weight: 2,
    color: 0xd8a4ff
  },
  {
    id: "upgrade-discount",
    label: "升级 9 折",
    shortLabel: "9折",
    description: "5 分钟内升级消耗降低",
    weight: 1,
    color: 0xff93c6
  },
  {
    id: "skin-discount",
    label: "皮肤 8 折",
    shortLabel: "皮肤",
    description: "解锁一张低风险外观折扣券",
    weight: 0.5,
    color: 0xb6a2ff
  },
  {
    id: "blank",
    label: "继续检索",
    shortLabel: "...",
    description: "机关继续运行",
    weight: 51.5,
    color: 0x465875
  }
];

export function pickMechanismReward(random = Math.random()): MechanismReward {
  const total = mechanismRewards.reduce((sum, reward) => sum + reward.weight, 0);
  let cursor = random * total;
  for (const reward of mechanismRewards) {
    cursor -= reward.weight;
    if (cursor <= 0) return reward;
  }
  return mechanismRewards[mechanismRewards.length - 1];
}

export function rewardById(id: RewardId): MechanismReward {
  return mechanismRewards.find((reward) => reward.id === id) ?? mechanismRewards[mechanismRewards.length - 1];
}
