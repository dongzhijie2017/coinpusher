export type UpgradeId = "cooldown" | "pusher" | "slot";

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
  fragments: number;
  mechanismTriggers: number;
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
