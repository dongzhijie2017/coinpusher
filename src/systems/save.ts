import type { PlayerSave } from "../types";

const KEY = "coin-pusher-save-v1";

export const defaultSave = (): PlayerSave => ({
  coin: 50,
  gold: 0,
  gem: 10,
  fragments: 0,
  mechanismTriggers: 0,
  repairedCount: 0,
  autoDrop: false,
  giftPacks: {
    gift5: 0,
    gift10: 0,
    gift14: 0
  },
  activeSkin: "classic",
  unlockedSkins: ["classic"],
  missions: {
    spawnCoin: { progress: 0, claimed: false },
    hitCenter: { progress: 0, claimed: false },
    earnGold: { progress: 0, claimed: false }
  },
  buffs: {
    goldBoostUntil: 0,
    autoCollectUntil: 0,
    upgradeDiscountUntil: 0,
    skinDiscountUntil: 0
  },
  upgrades: {
    cooldown: 1,
    pusher: 1,
    slot: 1
  },
  lastSaveAt: Date.now()
});

export function loadSave(): PlayerSave {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as PlayerSave;
    return {
      ...defaultSave(),
      ...parsed,
      buffs: {
        ...defaultSave().buffs,
        ...parsed.buffs
      },
      missions: {
        ...defaultSave().missions,
        ...parsed.missions
      },
      giftPacks: {
        ...defaultSave().giftPacks,
        ...parsed.giftPacks
      },
      unlockedSkins: parsed.unlockedSkins?.length ? parsed.unlockedSkins : defaultSave().unlockedSkins,
      upgrades: {
        ...defaultSave().upgrades,
        ...parsed.upgrades
      }
    };
  } catch {
    return defaultSave();
  }
}

export function saveGame(save: PlayerSave): void {
  localStorage.setItem(
    KEY,
    JSON.stringify({
      ...save,
      lastSaveAt: Date.now()
    })
  );
}
