export type UpgradeId = "cooldown" | "pusher" | "slot";

export interface PlayerSave {
  coin: number;
  gold: number;
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
