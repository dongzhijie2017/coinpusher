export type UpgradeId = "cooldown" | "pusher" | "slot";
export type MissionId = "spawnCoin" | "hitCenter" | "earnGold";
export type SkinId = "classic" | "silver" | "ruby" | "emerald";
export type GiftTier = "gift5" | "gift10" | "gift14";

export interface PlayerSave {
  coin: number;
  gold: number;
  gem: number;
  fragments: number;
  mechanismTriggers: number;
  repairedCount: number;
  autoDrop: boolean;
  giftPacks: Record<GiftTier, number>;
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

// ===== 新系统类型 =====

export type SoundType =
  | "coinDrop"
  | "coinSpawn"
  | "coinCollect"
  | "centerHit"
  | "mechanismRoll"
  | "mechanismStop"
  | "upgrade"
  | "error"
  | "giftPack"
  | "offline"
  | "click";

export interface ParticleConfig {
  x: number;
  y: number;
  color: number;
  count?: number;
  speed?: number;
  lifetime?: number;
  gravity?: number;
}

export interface AdReward {
  type: "coin" | "goldBoost" | "autoCollect" | "upgradeDiscount" | "skinDiscount";
  value: number;
  duration?: number; // seconds, for buffs
}

export interface TutorialStepConfig {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  condition?: (save: PlayerSave) => boolean;
}

export interface VibrationPattern {
  duration: number;
  intensity?: "light" | "medium" | "heavy";
}
