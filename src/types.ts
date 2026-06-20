export type UpgradeId = "cooldown" | "pusher" | "slot";
export type MissionId = "spawnCoin" | "hitCenter" | "earnGold";
export type SkinId = "classic" | "silver" | "ruby" | "emerald";

export type RewardId =
  | "gold-small"
  | "gold-medium"
  | "gold-large"
  | "coin"
  | "gold-boost"
  | "auto-collect"
  | "fragment"
  | "upgrade-discount"
  | "skin-discount"
  | "blank";

export interface PlayerSave {
  coin: number;
  gold: number;
  gem: number;
  fragments: number;
  mechanismTriggers: number;
  repairedCount: number;
  autoDrop: boolean;
  activeSkin: SkinId;
  unlockedSkins: SkinId[];
  missions: Record<MissionId, MissionProgress>;
  buffs: {
    goldBoostUntil: number;
    autoCollectUntil: number;
    upgradeDiscountUntil: number;
    skinDiscountUntil: number;
  };
  upgrades: Record<UpgradeId, number>;
  lastSaveAt: number;
}

export interface UpgradeConfig {
  id: UpgradeId;
  label: string;
  description: string;
  baseCost: number;
  growth: number;
  maxLevel: number;
}

export interface MechanismReward {
  id: RewardId;
  label: string;
  shortLabel: string;
  description: string;
  weight: number;
  color: number;
}

export interface MissionProgress {
  progress: number;
  claimed: boolean;
}

export interface MissionConfig {
  id: MissionId;
  label: string;
  target: number;
  rewardGem: number;
}

export interface SkinConfig {
  id: SkinId;
  label: string;
  costGem: number;
  colors: {
    outer: number;
    middle: number;
    inner: number;
    shine: number;
    rim: number;
  };
}

export interface ArcadeGoal {
  id: string;
  label: string;
  costGold: number;
  description: string;
  color: number;
}
