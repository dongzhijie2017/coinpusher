# 推币机体验增强完成记录

## 本次完成

- 物理手感：重力调整为 `y: 1.0`，空气阻力调整为 `0.025`，密度调整为 `0.002`，推板摩擦调整为 `0.15`。
- 音效系统：新增 `src/systems/audio.ts`，使用 Web Audio API 合成投币、掉落、收集、中央命中、机关滚动/停止、升级、礼盒、离线收益、错误和点击音效。
- 粒子系统：新增 `src/systems/particles.ts`，覆盖投币闪光、收集飘散、中央命中爆发、升级光环、礼盒拖尾、小黄鸭闪烁、环境微光和金币飞入 HUD。
- 触觉反馈：新增 `src/systems/vibration.ts`，通过 `navigator.vibrate` 在移动端触发投币、收集、中央命中、机关、升级、礼盒、错误和点击震动。
- 视觉增强：新增玻璃挡板、高光条、底部边缘光、中央命中屏幕微震和金币飞入 HUD 轨迹。
- 新手引导：新增 `src/systems/tutorial.ts`，提供 6 步遮罩引导，并将进度持久化到 `localStorage`。
- 广告框架：新增 `src/systems/ads.ts`，补给中心接入 2.5 秒激励视频模拟，完成后发放 Coin。
- PWA：新增 `public/manifest.json` 和 `public/sw.js`，`index.html` 接入 manifest、theme-color、apple-touch-icon 和 service worker。
- 类型扩展：`src/types.ts` 新增音效、粒子、广告、教程和震动相关类型。

## 验证

- `npm run build` 通过。
- 本地开发服务器可通过 `http://localhost:5173/` 访问。
- Chrome headless 已确认 Phaser canvas 正常注入页面。

## 备注

- `game/.obsidian/graph.json` 和 `game/.obsidian/workspace.json` 是本地 Obsidian 状态变更，不纳入本次提交。
