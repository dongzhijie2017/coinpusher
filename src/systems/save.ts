import type { PlayerSave } from "../types";

const KEY = "coin-pusher-save-v1";

export const defaultSave = (): PlayerSave => ({
  coin: 50,
  gold: 0,
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
