import type { AdReward } from "../types";

export type AdType = "rewarded" | "interstitial" | "banner";

export interface AdCallback {
  onProgress?: (remainingMs: number) => void;
  onReward?: (reward: AdReward) => void;
  onClose?: () => void;
  onError?: (msg: string) => void;
}

export class AdSystem {
  private interstitialCooldown = 0;
  private readonly INTERSTITIAL_INTERVAL = 120_000; // 120s
  private bannerVisible = false;
  private rewardedPlaying = false;

  /** 模拟激励视频 */
  showRewardedAd(callback: AdCallback, reward: AdReward = { type: "coin", value: 30 }): void {
    if (this.rewardedPlaying) {
      callback.onError?.("已有广告正在播放");
      return;
    }
    this.rewardedPlaying = true;
    const durationMs = 2500;
    const startedAt = Date.now();
    callback.onProgress?.(durationMs);
    const progressTimer = window.setInterval(() => {
      const remainingMs = Math.max(0, durationMs - (Date.now() - startedAt));
      callback.onProgress?.(remainingMs);
      if (remainingMs <= 0) {
        window.clearInterval(progressTimer);
      }
    }, 500);
    window.setTimeout(() => {
      window.clearInterval(progressTimer);
      this.rewardedPlaying = false;
      callback.onReward?.(reward);
      callback.onClose?.();
    }, durationMs);
  }

  /** 模拟插屏广告（带冷却） */
  showInterstitialAd(callback?: AdCallback): boolean {
    const now = Date.now();
    if (now - this.interstitialCooldown < this.INTERSTITIAL_INTERVAL) {
      return false;
    }
    this.interstitialCooldown = now;
    // 模拟 1.5 秒后关闭
    setTimeout(() => {
      callback?.onClose?.();
    }, 1500);
    return true;
  }

  /** 检查是否允许触发插屏 */
  canShowInterstitial(): boolean {
    return Date.now() - this.interstitialCooldown >= this.INTERSTITIAL_INTERVAL;
  }

  /** Banner 开关 */
  setBannerVisible(visible: boolean): void {
    this.bannerVisible = visible;
  }

  isBannerVisible(): boolean {
    return this.bannerVisible;
  }
}

export const adSystem = new AdSystem();
