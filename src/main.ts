import Phaser from "phaser";
import "./style.css";
import { audioSystem } from "./systems/audio";
import { ParticleSystem } from "./systems/particles";
import { vibratePreset } from "./systems/vibration";
import { adSystem } from "./systems/ads";
import { tutorialSystem } from "./systems/tutorial";
import {
  arcadeGoals,
  buyOrEquipSkin,
  centerReward,
  claimMission,
  coinCooldown,
  currentArcadeGoal,
  effectiveUpgradeCost,
  increaseMission,
  missions,
  pusherSpeed,
  repairNextArcade,
  skins,
  tryUpgrade,
  upgrades
} from "./systems/economy";
import { loadSave, saveGame } from "./systems/save";
import type { AdReward, GiftTier, MissionId, PlayerSave, SkinConfig, SkinId, UpgradeId } from "./types";

const WIDTH = 430;
const HEIGHT = 760;
const MAX_COINS = 96;
const NATURAL_COIN_CAP = 50;
const SUPPLY_COIN_CAP = 80;
const DROP_LINE_Y = 634;
const AUTO_COLLECT_LINE_Y = 596;
const CENTER_SLOT_LEFT = 154;
const CENTER_SLOT_RIGHT = 276;
const PUSHER_MIN_Y = 510;
const PUSHER_MAX_Y = 548;
const FEEDER_LEFT = 132;
const FEEDER_RIGHT = 298;
const DUCK_LEFT = 122;
const DUCK_RIGHT = 308;
const DUCK_Y = 486;
const DUCK_HIT_Y = 466;
const DUCK_SCALE = 0.82;
const DUCK_HIT_SCALE = 0.98;
const COIN_BODY_RADIUS = 14;
const COIN_DISPLAY_SCALE = 0.46;

type ReelOutcome =
  | { kind: "gold"; gold: 80 | 100 | 120; label: string; color: number; weight: number }
  | { kind: "gift"; tier: GiftTier; multiplier: 5 | 10 | 14; label: string; color: number; weight: number };

const GIFT_PACKS: Record<GiftTier, { label: string; multiplier: 5 | 10 | 14; costGold: number; fragments: number; color: number }> = {
  gift5: { label: "5倍礼盒", multiplier: 5, costGold: 80, fragments: 1, color: 0xf7c04a },
  gift10: { label: "10倍礼盒", multiplier: 10, costGold: 120, fragments: 2, color: 0xff93c6 },
  gift14: { label: "14倍礼盒", multiplier: 14, costGold: 180, fragments: 3, color: 0xb6a2ff }
};

const REEL_OUTCOMES: ReelOutcome[] = [
  { kind: "gold", gold: 80, label: "80 Gold", color: 0xf7d56b, weight: 34 },
  { kind: "gold", gold: 120, label: "120 Gold", color: 0xffe08a, weight: 26 },
  { kind: "gold", gold: 100, label: "100 Gold", color: 0xf7c04a, weight: 30 },
  { kind: "gift", tier: "gift5", multiplier: 5, label: "5倍礼盒", color: 0xf7c04a, weight: 6 },
  { kind: "gift", tier: "gift10", multiplier: 10, label: "10倍礼盒", color: 0xff93c6, weight: 3 },
  { kind: "gift", tier: "gift14", multiplier: 14, label: "14倍礼盒", color: 0xb6a2ff, weight: 1 }
];

const REEL_SYMBOLS = ["80", "120", "100", "5倍", "10倍", "14倍"];

class GameScene extends Phaser.Scene {
  private save!: PlayerSave;
  private coins: Phaser.Physics.Matter.Image[] = [];
  private pusher!: MatterJS.BodyType;
  private pusherVisual!: Phaser.GameObjects.Rectangle;
  private pusherShine!: Phaser.GameObjects.Rectangle;
  private duckSprite!: Phaser.GameObjects.Image;
  private luckySensorBody!: MatterJS.BodyType;
  private lastDrop = 0;
  private pusherDirection = 1;
  private mechanismBusy = false;
  private hud!: Phaser.GameObjects.Text;
  private tip!: Phaser.GameObjects.Text;
  private buffText!: Phaser.GameObjects.Text;
  private goalText!: Phaser.GameObjects.Text;
  private goalBar!: Phaser.GameObjects.Rectangle;
  private spawnX = WIDTH / 2;
  private dropGuide!: Phaser.GameObjects.Rectangle;
  private dropHead!: Phaser.GameObjects.Rectangle;
  private dropGlow!: Phaser.GameObjects.Arc;
  private feederX = WIDTH / 2;
  private feederDirection = 1;
  private duckX = WIDTH / 2;
  private duckDirection = 1;
  private panel?: Phaser.GameObjects.Container;
  private autoDropText!: Phaser.GameObjects.Text;
  private autoDropIndicator!: Phaser.GameObjects.Arc;
  private reelTexts: Phaser.GameObjects.Text[] = [];
  private particleSystem!: ParticleSystem;
  private tutorialOverlay?: Phaser.GameObjects.Container;
  private ambientTimer?: Phaser.Time.TimerEvent;
  private glassWalls: Phaser.GameObjects.Rectangle[] = [];
  private tipResetEvent?: Phaser.Time.TimerEvent;
  private adRewardPending = false;
  private collisionHandler?: (event: Phaser.Physics.Matter.Events.CollisionStartEvent) => void;
  private sceneCleanedUp = false;

  constructor() {
    super("game");
  }

  create(): void {
    this.save = loadSave();
    this.applyOfflineProgress();
    this.matter.world.setBounds(54, 104, WIDTH - 108, 582, 32, true, true, false, false);
    this.matter.world.engine.positionIterations = 8;
    this.matter.world.engine.velocityIterations = 6;
    this.matter.world.engine.constraintIterations = 2;

    audioSystem.init();
    this.createTextures();
    ParticleSystem.createTextures(this);
    this.particleSystem = new ParticleSystem(this);
    this.createBackdrop();
    this.createMachine();
    this.createGlassWalls();
    this.createPusher();
    this.createLuckySensor();
    this.createHud();
    this.createControls();
    this.createCollisionHandlers();
    this.bindSceneLifecycle();
    this.seedCoinPile();
    this.startAmbientEffects();
    this.showTutorialIfNeeded();

    this.time.addEvent({
      delay: 60000,
      loop: true,
      callback: () => {
        if (this.save.coin < NATURAL_COIN_CAP) {
          this.save.coin = Math.min(NATURAL_COIN_CAP, this.save.coin + 1);
          this.persist();
        }
      }
    });

    this.time.addEvent({
      delay: 2500,
      loop: true,
      callback: () => this.persist()
    });

    this.time.addEvent({
      delay: 950,
      loop: true,
      callback: () => {
        if (!this.save.autoDrop) return;
        if (this.save.coin <= 0) {
          this.save.autoDrop = false;
          this.autoDropText?.setText("自动关");
          this.autoDropIndicator?.setFillStyle(0xffffff, 0.24);
          this.flashTip("Coin 不足，自动投币已暂停");
          this.persist();
          return;
        }
        this.dropCoin(this.spawnX);
      }
    });
  }

  update(_time: number, delta: number): void {
    this.updateFeeder(delta);
    this.updateDuck(delta);
    this.updatePusher(delta);
    this.checkDrops();
    this.updateHud();
  }

  private createTextures(): void {
    this.createCoinTexture("coin", skins.find((skin) => skin.id === this.save.activeSkin) ?? skins[0]);
    skins.forEach((skin) => this.createCoinTexture(`coin-${skin.id}`, skin));

    const sensor = this.add.graphics();
    sensor.fillStyle(0xffd34f, 1);
    sensor.fillCircle(32, 32, 27);
    sensor.fillStyle(0xfff7b0, 1);
    sensor.fillEllipse(28, 26, 28, 18);
    sensor.fillStyle(0xf08f2d, 1);
    sensor.fillTriangle(48, 28, 62, 34, 48, 40);
    sensor.fillStyle(0x1e2a3c, 1);
    sensor.fillCircle(23, 24, 3);
    sensor.generateTexture("lucky-sensor", 64, 64);
    sensor.destroy();
  }

  private createCoinTexture(key: string, skin: SkinConfig): void {
    if (this.textures.exists(key)) this.textures.remove(key);
    const coin = this.add.graphics();
    coin.fillStyle(skin.colors.outer, 1);
    coin.fillCircle(32, 32, 30);
    coin.fillStyle(skin.colors.middle, 1);
    coin.fillCircle(32, 32, 24);
    coin.fillStyle(skin.colors.inner, 1);
    coin.fillCircle(32, 32, 20);
    coin.lineStyle(4, skin.colors.shine, 0.95);
    coin.strokeCircle(32, 32, 28);
    coin.lineStyle(3, skin.colors.rim, 0.8);
    coin.strokeCircle(32, 32, 23);
    coin.lineStyle(2, skin.colors.shine, 0.9);
    coin.strokeCircle(32, 32, 18);
    coin.fillStyle(skin.colors.shine, 0.8);
    coin.fillEllipse(23, 22, 15, 9);
    coin.generateTexture(key, 64, 64);
    coin.destroy();
  }

  private createBackdrop(): void {
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x07111f);
    this.add.rectangle(WIDTH / 2, 74, WIDTH, 148, 0x132b40, 0.98);
    this.add.rectangle(WIDTH / 2, 354, WIDTH, 560, 0x1aa7d8, 0.9);
    this.add.rectangle(WIDTH / 2, 652, WIDTH, 216, 0xd9b287, 0.98);
    this.add.rectangle(WIDTH / 2, 650, WIDTH, 138, 0x8f5a3a, 0.18);
    this.add.rectangle(WIDTH / 2, 742, WIDTH, 36, 0x07111f, 0.9);
  }

  private createMachine(): void {
    this.add.rectangle(WIDTH / 2, 40, 384, 40, 0x091526, 0.96).setStrokeStyle(2, 0x63d5ff);
    this.add.text(WIDTH / 2, 40, "街机修复计划", {
      color: "#f6fbff",
      fontSize: "23px",
      fontStyle: "700"
    }).setOrigin(0.5);
    this.add.rectangle(WIDTH / 2, 359, 382, 520, 0xf5b642).setStrokeStyle(5, 0xffefb2);
    this.add.rectangle(WIDTH / 2, 361, 348, 492, 0x0a8cd3).setStrokeStyle(4, 0x65ddff);
    this.add.rectangle(48, 363, 30, 456, 0xf8cf63).setStrokeStyle(3, 0xfff1ab);
    this.add.rectangle(WIDTH - 48, 363, 30, 456, 0xf8cf63).setStrokeStyle(3, 0xfff1ab);

    for (let i = 0; i < 9; i += 1) {
      this.add.circle(48, 182 + i * 42, 7, 0xfff6a8, 0.9);
      this.add.circle(WIDTH - 48, 182 + i * 42, 7, 0xfff6a8, 0.9);
    }

    this.add.rectangle(WIDTH / 2, 130, 292, 70, 0xe64837).setStrokeStyle(5, 0xffe3a1);
    this.add.rectangle(WIDTH / 2, 130, 246, 42, 0xb91f2e, 0.95).setStrokeStyle(2, 0xfff0a6);
    this.add.text(WIDTH / 2, 130, "全民推币机", {
      color: "#fff5d6",
      fontSize: "25px",
      fontStyle: "700"
    }).setOrigin(0.5);
    this.add.rectangle(WIDTH / 2, 168, 244, 16, 0x9b1c2a, 0.76).setStrokeStyle(1, 0xffd36e, 0.62);

    this.add.rectangle(WIDTH / 2, 392, 314, 376, 0xd8fbff, 0.15).setStrokeStyle(3, 0xf4fdff, 0.74);
    this.add.rectangle(WIDTH / 2, 390, 276, 344, 0x9b1c2a, 0.94);
    this.add.rectangle(WIDTH / 2, 388, 248, 318, 0xb91f2e, 0.62);
    this.createMechanismBoard();
    this.add.rectangle(108, 394, 10, 314, 0xffffff, 0.13).setAngle(12);
    this.add.rectangle(WIDTH - 108, 394, 10, 314, 0xffffff, 0.1).setAngle(-12);

    this.add.rectangle(WIDTH / 2, 199, 176, 24, 0x4b1020, 0.96).setStrokeStyle(2, 0xffd36e);
    this.add.text(WIDTH / 2, 196, "摆臂出币口", {
      color: "#fff1c7",
      fontSize: "11px",
      fontStyle: "700"
    }).setOrigin(0.5).setDepth(9);
    this.dropHead = this.add.rectangle(this.feederX, 216, 54, 12, 0xf8e68d, 0.98).setStrokeStyle(2, 0xffffff).setDepth(8);
    this.dropGuide = this.add.rectangle(this.feederX, 246, 7, 48, 0xffd84d, 0.96).setStrokeStyle(2, 0xfff2a8).setDepth(8);
    this.dropGlow = this.add.circle(this.feederX, 274, 6, 0xfff2a8, 0.95).setDepth(9);
    this.createGoldDeflectors();

    this.createStaticCoinBed();
    this.add.rectangle(WIDTH / 2, 576, 286, 46, 0xe6edf2, 0.96).setStrokeStyle(3, 0xffdf63).setDepth(3);
    this.add.rectangle(WIDTH / 2, 605, 310, 24, 0xf8cf63, 0.98).setStrokeStyle(2, 0xfff2a8).setDepth(4);
    this.add.rectangle(WIDTH / 2, 644, 130, 54, 0xf7f7f2).setStrokeStyle(3, 0x25344a).setDepth(8);
    this.add.text(WIDTH / 2, 644, "中央槽", {
      color: "#07315f",
      fontSize: "13px",
      fontStyle: "700"
    }).setOrigin(0.5).setDepth(9);
    this.add.rectangle(103, 644, 78, 54, 0x0067cb).setStrokeStyle(3, 0x6ed7ff).setDepth(8);
    this.add.rectangle(WIDTH - 103, 644, 78, 54, 0x0067cb).setStrokeStyle(3, 0x6ed7ff).setDepth(8);
    this.add.text(103, 644, "回收", {
      color: "#d8f7ff",
      fontSize: "11px",
      fontStyle: "700"
    }).setOrigin(0.5).setDepth(9);
    this.add.text(WIDTH - 103, 644, "回收", {
      color: "#d8f7ff",
      fontSize: "11px",
      fontStyle: "700"
    }).setOrigin(0.5).setDepth(9);

    this.matter.add.rectangle(72, 414, 18, 512, { isStatic: true, label: "left-wall" });
    this.matter.add.rectangle(WIDTH - 72, 414, 18, 512, { isStatic: true, label: "right-wall" });

    const aimZone = this.add.zone(WIDTH / 2, 208, 286, 96);
    aimZone.setInteractive({ useHandCursor: true });
    aimZone.on("pointerdown", () => {
      this.dropCoin(this.feederX);
    });
  }

  private createGoldDeflectors(): void {
    [
      { x: 184, y: 270, angle: -20 },
      { x: 246, y: 270, angle: 20 }
    ].forEach((guide) => {
      this.add.rectangle(guide.x, guide.y, 10, 58, 0xf6d24b)
        .setStrokeStyle(2, 0xfff2a8)
        .setAngle(guide.angle)
        .setDepth(10);
      this.matter.add.rectangle(guide.x, guide.y, 10, 58, {
        isStatic: true,
        angle: Phaser.Math.DegToRad(guide.angle),
        label: "deflector",
        friction: 0.02,
        restitution: 0.82
      });
    });

    [
      { x: 150, y: 314 },
      { x: 215, y: 314 },
      { x: 280, y: 314 },
      { x: 132, y: 438 },
      { x: 174, y: 430 },
      { x: 215, y: 438 },
      { x: 256, y: 430 },
      { x: 298, y: 438 }
    ].forEach((peg, index) => {
      this.add.circle(peg.x, peg.y, 7, 0xd8e4f2, 0.96)
        .setStrokeStyle(2, 0xffffff, 0.9)
        .setDepth(10);
      this.add.image(peg.x, peg.y, `coin-${this.save.activeSkin}`)
        .setScale(0.13)
        .setAngle(index * 31)
        .setAlpha(0.62)
        .setDepth(11);
      this.matter.add.circle(peg.x, peg.y, 9, {
        isStatic: true,
        label: "peg",
        friction: 0.01,
        restitution: 0.92
      });
    });
  }

  private createMechanismBoard(): void {
    this.add.rectangle(WIDTH / 2, 244, 246, 25, 0x7f1725, 0.96).setStrokeStyle(2, 0xffd36e).setDepth(5);
    this.add.text(WIDTH / 2, 244, "零件扫描：命中中央槽提升修复效率", {
      color: "#fff1c7",
      fontSize: "11px",
      fontStyle: "700"
    }).setOrigin(0.5).setDepth(6);

    const columns = [
      { x: 150, values: ["20", "80", "200"] },
      { x: 215, values: ["60", "120", "300"] },
      { x: 280, values: ["40", "100", "碎片"] }
    ];

    this.reelTexts = [];
    columns.forEach((column) => {
      this.add.rectangle(column.x, 352, 56, 142, 0xfff8ed, 0.98).setStrokeStyle(3, 0x7f1725).setDepth(5);
      column.values.forEach((value, index) => {
        const y = 306 + index * 46;
        if (index === 1) this.add.rectangle(column.x, y, 52, 38, 0xffdf63, 0.88).setDepth(6);
        const text = this.add.text(column.x, y, value, {
          color: index === 1 ? "#c82131" : "#dc7782",
          fontSize: value.length > 3 ? "15px" : "24px",
          fontStyle: "700"
        }).setOrigin(0.5).setDepth(7);
        if (index === 1) this.reelTexts.push(text);
      });
    });

  }

  private createStaticCoinBed(): void {
    for (let i = 0; i < 24; i += 1) {
      const x = 102 + (i % 12) * 18 + Phaser.Math.Between(-3, 3);
      const y = 586 + Math.floor(i / 12) * 14 + Phaser.Math.Between(-2, 3);
      this.add.image(x, y, `coin-${this.save.activeSkin}`)
        .setScale(0.26 + (i % 3) * 0.018)
        .setAngle(Phaser.Math.Between(-28, 28))
        .setDepth(5);
    }
  }

  private createPusher(): void {
    this.pusherVisual = this.add.rectangle(WIDTH / 2, 524, 292, 28, 0xf8cf63).setStrokeStyle(3, 0xfff2a8).setDepth(12);
    this.pusherShine = this.add.rectangle(WIDTH / 2, 516, 260, 6, 0xffffff, 0.34).setDepth(13);
    this.pusher = this.matter.add.rectangle(WIDTH / 2, 524, 308, 34, {
      isStatic: true,
      label: "pusher",
      friction: 0.15
    });
  }

  private createGlassWalls(): void {
    // 左侧玻璃挡板 + 45° 高光
    const leftGlass = this.add.rectangle(66, 363, 8, 456, 0xd8fbff, 0.12).setDepth(3);
    const leftShine = this.add.rectangle(64, 363, 3, 456, 0xffffff, 0.28).setAngle(45).setDepth(3);
    this.glassWalls.push(leftGlass, leftShine);

    // 右侧玻璃挡板 + 45° 高光
    const rightGlass = this.add.rectangle(WIDTH - 66, 363, 8, 456, 0xd8fbff, 0.12).setDepth(3);
    const rightShine = this.add.rectangle(WIDTH - 64, 363, 3, 456, 0xffffff, 0.28).setAngle(-45).setDepth(3);
    this.glassWalls.push(rightGlass, rightShine);

    // 底部玻璃边缘光
    const bottomGlow = this.add.rectangle(WIDTH / 2, 584, 280, 4, 0x6ed7ff, 0.35).setDepth(3);
    this.glassWalls.push(bottomGlow);
  }

  private startAmbientEffects(): void {
    this.ambientTimer = this.time.addEvent({
      delay: 2000,
      loop: true,
      callback: () => {
        if (Phaser.Math.Between(0, 100) < 35) {
          this.particleSystem.spawnAmbientSparkle();
        }
      }
    });
  }

  private showTutorialIfNeeded(): void {
    if (tutorialSystem.isAllDone()) return;
    tutorialSystem.start();
    this.showNextTutorialStep();
  }

  private showNextTutorialStep(): void {
    const step = tutorialSystem.getNextStep();
    if (!step) {
      this.clearTutorialOverlay();
      return;
    }

    this.clearTutorialOverlay();

    const overlay = this.add.container(0, 0).setDepth(50);
    const dimmer = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.55);
    dimmer.setInteractive({ useHandCursor: false });
    dimmer.on("pointerdown", (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
    });
    overlay.add(dimmer);

    // 高亮区域（镂空效果模拟：在步骤区域上方放一个不遮光的矩形）
    const highlight = this.add.rectangle(step.x, step.y, step.width + 12, step.height + 12, 0x000000, 0).setStrokeStyle(3, 0xffd34f);
    overlay.add(highlight);

    const hasSpaceBelow = step.y + step.height / 2 + 96 < HEIGHT;
    const textY = hasSpaceBelow
      ? step.y + step.height / 2 + 42
      : Math.max(76, step.y - step.height / 2 - 62);
    const nextY = Math.min(HEIGHT - 34, textY + 52);

    // 提示文字框
    const textBg = this.add.rectangle(WIDTH / 2, textY, 340, 60, 0x132b40, 0.96).setStrokeStyle(2, 0xffd34f);
    overlay.add(textBg);
    const text = this.add.text(WIDTH / 2, textY, step.text, {
      color: "#fff5d6",
      fontSize: "14px",
      fontStyle: "700",
      align: "center"
    }).setOrigin(0.5).setWordWrapWidth(320);
    overlay.add(text);

    // 下一步按钮
    const nextBtn = this.add.rectangle(WIDTH / 2, nextY, 120, 36, 0xffd34f).setStrokeStyle(2, 0xffffff);
    const nextLabel = this.add.text(WIDTH / 2, nextY, "知道了", {
      color: "#07315f",
      fontSize: "14px",
      fontStyle: "700"
    }).setOrigin(0.5);
    nextBtn.setInteractive({ useHandCursor: true });
    nextLabel.setInteractive({ useHandCursor: true });
    nextBtn.on("pointerdown", () => {
      tutorialSystem.completeStep(step.id);
      this.showNextTutorialStep();
    });
    nextLabel.on("pointerdown", () => {
      tutorialSystem.completeStep(step.id);
      this.showNextTutorialStep();
    });
    overlay.add([nextBtn, nextLabel]);

    // 跳过全部
    const skip = this.add.text(WIDTH - 20, 20, "跳过引导", {
      color: "#ffffff",
      fontSize: "12px",
      fontStyle: "700"
    }).setOrigin(1, 0).setAlpha(0.7).setInteractive({ useHandCursor: true });
    skip.on("pointerdown", () => {
      tutorialSystem.skipAll();
      this.clearTutorialOverlay();
    });
    overlay.add(skip);

    this.tutorialOverlay = overlay;
  }

  private clearTutorialOverlay(): void {
    this.tutorialOverlay?.destroy();
    this.tutorialOverlay = undefined;
  }

  private createLuckySensor(): void {
    this.add.text(WIDTH / 2, DUCK_Y - 30, "小黄鸭轨道", {
      color: "#fff1c7",
      fontSize: "13px",
      fontStyle: "700"
    }).setOrigin(0.5).setDepth(8);

    this.duckSprite = this.add.image(WIDTH / 2, DUCK_Y, "lucky-sensor")
      .setScale(DUCK_SCALE)
      .setDepth(9);
    this.luckySensorBody = this.matter.add.circle(WIDTH / 2, DUCK_HIT_Y, 34, {
      isSensor: true,
      isStatic: true,
      label: "lucky-sensor"
    });
  }

  private createHud(): void {
    this.add.rectangle(112, 78, 164, 22, 0x06111f, 0.72).setStrokeStyle(1, 0x66d9ff, 0.45).setDepth(14);
    this.hud = this.add.text(34, 78, "", {
      color: "#f4fbff",
      fontSize: "10px",
      fontStyle: "700"
    }).setOrigin(0, 0.5).setDepth(15);

    this.add.rectangle(WIDTH - 112, 78, 164, 22, 0x06111f, 0.62).setStrokeStyle(1, 0xaef27a, 0.38).setDepth(14);
    this.buffText = this.add.text(WIDTH - 34, 78, "", {
      color: "#c8ff8c",
      fontSize: "10px",
      align: "right",
      fontStyle: "700"
    }).setOrigin(1, 0.5).setDepth(15);

    this.add.rectangle(WIDTH / 2, 628, 332, 48, 0x653e29, 0.24).setStrokeStyle(1, 0xffe0a4, 0.32);
    this.tip = this.add.text(WIDTH / 2, 644, "看准顶部摆臂时机，点击推币", {
      color: "#fff5d6",
      fontSize: "12px",
      fontStyle: "700"
    }).setOrigin(0.5);

    this.goalText = this.add.text(WIDTH / 2, 620, "", {
      color: "#fff5d6",
      fontSize: "12px",
      fontStyle: "700"
    }).setOrigin(0.5);
    this.add.rectangle(WIDTH / 2, 664, 306, 12, 0x44291f, 0.9).setStrokeStyle(1, 0xffe0a4, 0.55);
    this.goalBar = this.add.rectangle(62, 664, 0, 8, 0xffd34f).setOrigin(0, 0.5);
  }

  private createControls(): void {
    const supplyButton = this.add.rectangle(68, 702, 92, 56, 0xf7d56b).setStrokeStyle(3, 0xfff3b2);
    const supplyLabel = this.add.text(68, 696, "补给", {
      color: "#5c3216",
      fontSize: "15px",
      fontStyle: "700"
    }).setOrigin(0.5);
    const supplySub = this.add.text(68, 716, "Coin", {
      color: "#7a4b1e",
      fontSize: "11px",
      fontStyle: "700"
    }).setOrigin(0.5);
    supplyButton.setInteractive({ useHandCursor: true });
    supplyLabel.setInteractive({ useHandCursor: true });
    supplySub.setInteractive({ useHandCursor: true });
    supplyButton.on("pointerdown", () => { audioSystem.play("click"); this.showSupplyPanel(); });
    supplyLabel.on("pointerdown", () => { audioSystem.play("click"); this.showSupplyPanel(); });
    supplySub.on("pointerdown", () => { audioSystem.play("click"); this.showSupplyPanel(); });

    const button = this.add.rectangle(WIDTH / 2, 702, 164, 58, 0xff4d57).setStrokeStyle(4, 0xffe0a4);
    const buttonGlow = this.add.rectangle(WIDTH / 2, 694, 134, 12, 0xffa88c, 0.58);
    const label = this.add.text(WIDTH / 2, 694, "点击推币", {
      color: "#fff8ed",
      fontSize: "22px",
      fontStyle: "700"
    }).setOrigin(0.5);
    const cost = this.add.text(WIDTH / 2, 718, "1 Coin / 次", {
      color: "#ffe0a4",
      fontSize: "12px",
      fontStyle: "700"
    }).setOrigin(0.5);
    button.setInteractive({ useHandCursor: true });
    label.setInteractive({ useHandCursor: true });
    cost.setInteractive({ useHandCursor: true });

    const drop = () => {
      this.tweens.add({
        targets: [button, buttonGlow, label, cost],
        scale: 0.96,
        duration: 70,
        yoyo: true
      });
      this.dropCoin(this.spawnX);
    };
    button.on("pointerdown", drop);
    label.on("pointerdown", drop);
    cost.on("pointerdown", drop);

    this.autoDropIndicator = this.add.circle(308, 716, 7, this.save.autoDrop ? 0x7cff8b : 0xffffff, this.save.autoDrop ? 0.95 : 0.24);
    this.createUtilityButton(338, 702, 96, 56, this.save.autoDrop ? "自动开" : "自动关", "跟随摆臂", () => this.toggleAutoDrop(), (text) => {
      this.autoDropText = text;
    });

    this.createSideButton(386, 198, "规则", () => this.showRulesPanel());
    this.createSideButton(386, 250, "升级", () => this.showUpgradePanel());
    this.createSideButton(386, 302, "图鉴", () => this.showGalleryPanel());
    this.createSideButton(386, 354, "任务", () => this.showMissionPanel());
    this.createSideButton(386, 406, "外观", () => this.showSkinPanel());
  }

  private createUtilityButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    subLabel: string,
    callback: () => void,
    capture?: (text: Phaser.GameObjects.Text) => void
  ): void {
    const button = this.add.rectangle(x, y, width, height, 0x2f6f8d, 0.86).setStrokeStyle(2, 0xd8fbff);
    const text = this.add.text(x, y - 9, label, {
      color: "#f3fbff",
      fontSize: "14px",
      fontStyle: "700"
    }).setOrigin(0.5);
    const sub = this.add.text(x, y + 13, subLabel, {
      color: "#c7eaf4",
      fontSize: "10px",
      fontStyle: "700"
    }).setOrigin(0.5);
    button.setInteractive({ useHandCursor: true });
    text.setInteractive({ useHandCursor: true });
    sub.setInteractive({ useHandCursor: true });
    button.on("pointerdown", () => { audioSystem.play("click"); callback(); });
    text.on("pointerdown", () => { audioSystem.play("click"); callback(); });
    sub.on("pointerdown", () => { audioSystem.play("click"); callback(); });
    capture?.(text);
  }

  private createSideButton(x: number, y: number, label: string, callback: () => void): void {
    const button = this.add.rectangle(x, y, 58, 38, 0x06111f, 0.5).setStrokeStyle(1, 0xffe0a4, 0.62);
    const text = this.add.text(x, y, label, {
      color: "#fff5d6",
      fontSize: "13px",
      fontStyle: "700"
    }).setOrigin(0.5);
    button.setInteractive({ useHandCursor: true });
    text.setInteractive({ useHandCursor: true });
    button.on("pointerdown", () => { audioSystem.play("click"); callback(); });
    text.on("pointerdown", () => { audioSystem.play("click"); callback(); });
  }

  private seedCoinPile(): void {
    const count = Math.min(46, 26 + this.save.upgrades.slot * 2);
    for (let i = 0; i < count; i += 1) {
      const x = Phaser.Math.Between(112, 318);
      const y = Phaser.Math.Between(574, 620);
      const coin = this.createPhysicalCoin(x, y);
      coin.setData("seeded", true);
    }
  }

  private createCollisionHandlers(): void {
    this.collisionHandler = (event: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
      event.pairs.forEach((pair) => {
        const bodies = [pair.bodyA, pair.bodyB];
        const coinBody = bodies.find((body) => body.label === "coin");
        if (!coinBody) return;
        const coin = this.coins.find((item) => item.body === coinBody);
        if (!coin) return;

        const otherBody = bodies.find((body) => body !== coinBody);
        const age = this.time.now - ((coin.getData("spawnedAt") as number | undefined) ?? this.time.now);
        if (!coin.getData("seeded") && !coin.getData("dropSounded") && otherBody?.label !== "lucky-sensor" && age > 120) {
          coin.setData("dropSounded", true);
          audioSystem.play("coinDrop");
        }

        const sensorBody = bodies.find((body) => body.label === "lucky-sensor");
        if (!sensorBody) return;
        if (coin.getData("seeded")) return;
        const data = coin.getData("mechanismTriggered") as boolean | undefined;
        if (data || this.mechanismBusy) return;
        coin.setData("mechanismTriggered", true);
        this.triggerMechanism();
      });
    };
    this.matter.world.on("collisionstart", this.collisionHandler);
  }

  private bindSceneLifecycle(): void {
    const cleanup = () => this.cleanupScene();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
  }

  private cleanupScene(): void {
    if (this.sceneCleanedUp) return;
    this.sceneCleanedUp = true;
    if (this.collisionHandler) {
      this.matter.world.off("collisionstart", this.collisionHandler);
      this.collisionHandler = undefined;
    }
    this.tipResetEvent?.remove(false);
    this.ambientTimer?.remove(false);
    this.panel?.destroy();
    this.panel = undefined;
    this.clearTutorialOverlay();
    this.particleSystem.destroy();
  }

  private dropCoin(spawnX = this.feederX): void {
    const now = this.time.now;
    const cooldown = coinCooldown(this.save.upgrades.cooldown);
    if (now - this.lastDrop < cooldown) return;
    if (this.save.coin <= 0) {
      audioSystem.play("error");
      this.flashTip("Coin 不足：等待恢复或使用补给");
      return;
    }
    this.lastDrop = now;
    this.save.coin -= 1;
    increaseMission(this.save, "spawnCoin", 1);

    audioSystem.play("coinSpawn");
    vibratePreset("coinDrop");
    this.particleSystem.spawnCoinSparkle(spawnX, 216);

    const x = Phaser.Math.Clamp(spawnX + Phaser.Math.Between(-6, 6), FEEDER_LEFT, FEEDER_RIGHT);
    const coin = this.createPhysicalCoin(x, 232);
    const lateralFromSwing = ((x - WIDTH / 2) / ((FEEDER_RIGHT - FEEDER_LEFT) / 2)) * 0.34;
    coin.setVelocity(lateralFromSwing + this.feederDirection * 0.24, 0.92);
    coin.setAngularVelocity(Phaser.Math.FloatBetween(-0.16, 0.16));
  }

  private createPhysicalCoin(x: number, y: number): Phaser.Physics.Matter.Image {
    const coin = this.matter.add.image(x, y, `coin-${this.save.activeSkin}`, undefined, {
      shape: { type: "circle", radius: COIN_BODY_RADIUS },
      restitution: 0.05,
      friction: 0.14,
      frictionAir: 0.025,
      density: 0.002,
      slop: 0.02,
      label: "coin"
    });
    coin.setScale(COIN_DISPLAY_SCALE);
    coin.setDepth(5);
    coin.setBounce(0.05);
    coin.setFriction(0.14, 0.025, 0.14);
    coin.setVelocity(0, 0.58);
    coin.setAngularVelocity(Phaser.Math.FloatBetween(-0.08, 0.08));
    coin.setData("spawnedAt", this.time.now);
    this.coins.push(coin);

    if (this.coins.length > MAX_COINS) {
      this.recycleCoin(this.coins.shift());
    }
    return coin;
  }

  private updateFeeder(delta: number): void {
    const next = this.feederX + this.feederDirection * delta * 0.075;
    if (next > FEEDER_RIGHT) this.feederDirection = -1;
    if (next < FEEDER_LEFT) this.feederDirection = 1;
    this.feederX = Phaser.Math.Clamp(next, FEEDER_LEFT, FEEDER_RIGHT);
    this.spawnX = this.feederX;

    const offset = (this.feederX - WIDTH / 2) / ((FEEDER_RIGHT - FEEDER_LEFT) / 2);
    const angle = offset * 17;
    this.dropHead.setPosition(this.feederX, 216);
    this.dropGuide.setPosition(this.feederX, 246);
    this.dropGuide.setAngle(angle);
    this.dropGlow.setPosition(this.feederX, 274);
  }

  private updateDuck(delta: number): void {
    const next = this.duckX + this.duckDirection * delta * 0.06;
    if (next > DUCK_RIGHT) this.duckDirection = -1;
    if (next < DUCK_LEFT) this.duckDirection = 1;
    this.duckX = Phaser.Math.Clamp(next, DUCK_LEFT, DUCK_RIGHT);
    this.duckSprite.setPosition(this.duckX, DUCK_Y);
    this.matter.body.setPosition(this.luckySensorBody, { x: this.duckX, y: DUCK_HIT_Y });
  }

  private updatePusher(delta: number): void {
    const speed = pusherSpeed(this.save.upgrades.pusher) * delta * 0.055;
    const nextY = this.pusher.position.y + speed * this.pusherDirection;
    if (nextY > PUSHER_MAX_Y) this.pusherDirection = -1;
    if (nextY < PUSHER_MIN_Y) this.pusherDirection = 1;
    const y = Phaser.Math.Clamp(nextY, PUSHER_MIN_Y, PUSHER_MAX_Y);
    this.matter.body.setPosition(this.pusher, { x: WIDTH / 2, y });
    this.pusherVisual.setPosition(WIDTH / 2, y);
    this.pusherShine.setPosition(WIDTH / 2, y - 12);
  }

  private checkDrops(): void {
    for (let i = this.coins.length - 1; i >= 0; i -= 1) {
      const coin = this.coins[i];
      const { x, y } = coin;
      const age = this.time.now - ((coin.getData("spawnedAt") as number | undefined) ?? this.time.now);
      if (coin.body && age > 4500 && y < 500 && coin.body.velocity.y < 0.5) {
        coin.setVelocity(coin.body.velocity.x * 0.75, 1.1);
      }
      const autoCollectActive = this.save.buffs.autoCollectUntil > Date.now();
      if (y < DROP_LINE_Y && !(autoCollectActive && y > AUTO_COLLECT_LINE_Y)) continue;
      let reward = Phaser.Math.Between(1, 3);
      const isCenter = x > CENTER_SLOT_LEFT && x < CENTER_SLOT_RIGHT;
      if (isCenter) {
        reward += centerReward(this.save.upgrades.slot);
        increaseMission(this.save, "hitCenter", 1);
        this.flashTip("中央修复槽命中：Gold 增加");
        audioSystem.play("centerHit");
        vibratePreset("centerHit");
        this.particleSystem.spawnCenterHit(x, y);
        this.cameras.main.shake(120, 0.004);
      } else {
        audioSystem.play("coinCollect");
        vibratePreset("coinCollect");
        this.particleSystem.spawnCollect(x, y);
      }
      if (this.save.buffs.goldBoostUntil > Date.now()) {
        reward = Math.ceil(reward * 1.5);
      }
      this.save.gold += reward;
      increaseMission(this.save, "earnGold", reward);
      this.spawnRewardText(x, Math.min(y - 16, 626), `+${reward}`);
      this.particleSystem.spawnGoldFlyToHud(x, y, 33, 104);
      this.recycleCoin(coin);
      this.coins.splice(i, 1);
    }
  }

  private buyUpgrade(id: UpgradeId): void {
    if (tryUpgrade(this.save, id)) {
      audioSystem.play("upgrade");
      vibratePreset("upgrade");
      this.particleSystem.spawnUpgradeBurst(386, 250);
      this.flashTip("升级完成");
      this.persist();
      if (this.panel) this.showUpgradePanel();
      return;
    }
    audioSystem.play("error");
    this.flashTip("Gold 不足或已满级");
  }

  private updateHud(): void {
    const now = Date.now();
    this.hud.setText(`C ${this.save.coin}/${SUPPLY_COIN_CAP}  G ${this.save.gold}  Gem ${this.save.gem}`);
    this.buffText.setText(this.activeBuffLines(now).slice(0, 1).join("  "));
    const goal = currentArcadeGoal(this.save);
    this.goalText.setText(this.save.repairedCount >= arcadeGoals.length ? "街机厅修复完成" : `目标：${goal.costGold} Gold 修复《${goal.label}》`);
    const progress = this.save.repairedCount >= arcadeGoals.length ? 1 : Phaser.Math.Clamp(this.save.gold / goal.costGold, 0, 1);
    this.goalBar.width = 304 * progress;
  }

  private triggerMechanism(): void {
    this.mechanismBusy = true;
    this.save.mechanismTriggers += 1;
    audioSystem.play("mechanismRoll");
    vibratePreset("mechanismTrigger");
    this.particleSystem.spawnDuckFlash(this.duckX, DUCK_Y);
    this.tweens.add({
      targets: this.duckSprite,
      scale: DUCK_HIT_SCALE,
      duration: 80,
      yoyo: true
    });
    this.rollReels(this.pickReelOutcome());
  }

  private pickReelOutcome(random = Math.random()): ReelOutcome {
    const total = REEL_OUTCOMES.reduce((sum, item) => sum + item.weight, 0);
    let cursor = random * total;
    for (const outcome of REEL_OUTCOMES) {
      cursor -= outcome.weight;
      if (cursor <= 0) return outcome;
    }
    return REEL_OUTCOMES[0];
  }

  private rollReels(outcome: ReelOutcome): void {
    const finalSymbol = this.reelSymbolForOutcome(outcome);
    this.flashTip("小黄鸭命中：中屏开始滚动");

    this.reelTexts.forEach((text, column) => {
      this.time.addEvent({
        delay: 70 + column * 15,
        repeat: 14 + column * 4,
        callback: () => {
          text.setText(REEL_SYMBOLS[Phaser.Math.Between(0, REEL_SYMBOLS.length - 1)]);
          text.setColor("#fff1c7");
          this.tweens.add({
            targets: text,
            scale: 1.16,
            duration: 45,
            yoyo: true
          });
        }
      });

      this.time.delayedCall(1220 + column * 280, () => {
        text.setText(finalSymbol);
        text.setColor(outcome.kind === "gold" ? "#c82131" : "#7c2d12");
      });
    });

    this.time.delayedCall(2250, () => {
      this.applyReelOutcome(outcome);
      this.persist();
      this.mechanismBusy = false;
    });
  }

  private reelSymbolForOutcome(outcome: ReelOutcome): string {
    return outcome.kind === "gold" ? `${outcome.gold}` : `${outcome.multiplier}倍`;
  }

  private applyReelOutcome(outcome: ReelOutcome): void {
    audioSystem.play("mechanismStop");
    if (outcome.kind === "gold") {
      this.save.gold += outcome.gold;
      increaseMission(this.save, "earnGold", outcome.gold);
      this.spawnRewardText(WIDTH / 2, 350, `+${outcome.gold}G`);
      this.flashTip(`三列 ${outcome.gold} 对齐：Gold +${outcome.gold}`);
      this.particleSystem.spawnCenterHit(WIDTH / 2, 350);
      audioSystem.play("centerHit");
      vibratePreset("centerHit");
      this.cameras.main.shake(150, 0.005);
      return;
    }

    this.save.giftPacks[outcome.tier] += 1;
    this.spawnGiftPackDrop(outcome.tier);
    this.flashTip(`${GIFT_PACKS[outcome.tier].label} 掉落：到图鉴用 Gold 拼图`);
    audioSystem.play("giftPack");
    vibratePreset("giftPack");
  }

  private spawnGiftPackDrop(tier: GiftTier): void {
    const pack = GIFT_PACKS[tier];
    const box = this.add.rectangle(WIDTH / 2, 258, 46, 38, pack.color).setStrokeStyle(3, 0xfff2a8).setDepth(12);
    const ribbonV = this.add.rectangle(WIDTH / 2, 258, 9, 38, 0xffffff, 0.72).setDepth(13);
    const ribbonH = this.add.rectangle(WIDTH / 2, 258, 46, 8, 0xffffff, 0.72).setDepth(13);
    const label = this.add.text(WIDTH / 2, 258, `${pack.multiplier}x`, {
      color: "#7c2d12",
      fontSize: "13px",
      fontStyle: "700"
    }).setOrigin(0.5).setDepth(14);

    this.tweens.add({
      targets: [box, ribbonV, ribbonH, label],
      y: 546,
      duration: 620,
      ease: "Bounce.easeOut",
      onUpdate: (_tween: Phaser.Tweens.Tween, _target: unknown, _key: string, _value: number, _previous: number, _progress: number, _elapsed: number, _repeat: number, _repeatCount: number, _data: unknown) => {
        this.particleSystem.spawnGiftTrail(WIDTH / 2, (box as Phaser.GameObjects.Rectangle).y, pack.color);
      },
      onComplete: () => {
        this.particleSystem.spawnCollect(WIDTH / 2, 546, pack.color, 8);
        this.time.delayedCall(650, () => {
          box.destroy();
          ribbonV.destroy();
          ribbonH.destroy();
          label.destroy();
        });
      }
    });
  }

  private activeBuffLines(now: number): string[] {
    const lines: string[] = [];
    if (this.save.buffs.goldBoostUntil > now) lines.push(`Gold +50% ${this.formatRemain(this.save.buffs.goldBoostUntil - now)}`);
    if (this.save.buffs.autoCollectUntil > now) lines.push(`自动收集 ${this.formatRemain(this.save.buffs.autoCollectUntil - now)}`);
    if (this.save.buffs.upgradeDiscountUntil > now) lines.push(`升级 9折 ${this.formatRemain(this.save.buffs.upgradeDiscountUntil - now)}`);
    if (this.save.buffs.skinDiscountUntil > now) lines.push(`皮肤券 ${this.formatRemain(this.save.buffs.skinDiscountUntil - now)}`);
    return lines;
  }

  private formatRemain(ms: number): string {
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `${minutes}:${rest.toString().padStart(2, "0")}`;
  }

  private showGalleryPanel(): void {
    const rows = arcadeGoals.map((goal, index) => {
      const unlocked = this.save.repairedCount > index;
      return `${unlocked ? "已修复" : "待修复"}  ${goal.label}  需要 ${goal.costGold} Gold`;
    });
    rows.push(`拼图碎片 ${this.save.fragments}  礼盒 ${this.save.giftPacks.gift5}/${this.save.giftPacks.gift10}/${this.save.giftPacks.gift14}`);
    rows.push(`5倍礼盒 ${GIFT_PACKS.gift5.costGold}G 开启，补 ${GIFT_PACKS.gift5.fragments} 块拼图`);
    rows.push(`10倍礼盒 ${GIFT_PACKS.gift10.costGold}G 开启，补 ${GIFT_PACKS.gift10.fragments} 块拼图`);
    rows.push(`14倍礼盒 ${GIFT_PACKS.gift14.costGold}G 开启，补 ${GIFT_PACKS.gift14.fragments} 块拼图`);

    const actions = [
      ...(this.save.repairedCount < arcadeGoals.length ? [{ label: "修复当前", action: () => this.repairCurrentArcade() }] : []),
      { label: "开5倍", action: () => this.openGiftPack("gift5") },
      { label: "开10倍", action: () => this.openGiftPack("gift10") },
      { label: "开14倍", action: () => this.openGiftPack("gift14") }
    ];
    this.showInfoPanel("修复图鉴", rows, actions);
  }

  private showMissionPanel(): void {
    const rows = missions.map((mission) => {
      const state = this.save.missions[mission.id];
      const ready = state.progress >= mission.target && !state.claimed;
      const suffix = state.claimed ? "已领取" : ready ? "可领取" : `${state.progress}/${mission.target}`;
      return `${mission.label}  ${suffix}  +${mission.rewardGem} Gem`;
    });
    const actions = missions
      .filter((mission) => {
        const state = this.save.missions[mission.id];
        return state.progress >= mission.target && !state.claimed;
      })
      .map((mission) => ({
        label: `领 ${mission.rewardGem}Gm`,
        action: () => this.claimMissionReward(mission.id)
      }));
    this.showInfoPanel("每日任务", rows, actions);
  }

  private showSkinPanel(): void {
    const rows = skins.map((skin) => {
      const active = this.save.activeSkin === skin.id;
      const unlocked = this.save.unlockedSkins.includes(skin.id);
      const cost = this.save.buffs.skinDiscountUntil > Date.now() ? Math.floor(skin.costGem * 0.8) : skin.costGem;
      return `${active ? "装配中" : unlocked ? "已解锁" : `${cost} Gem`}  ${skin.label}`;
    });
    const actions = skins.map((skin) => ({
      label: this.save.unlockedSkins.includes(skin.id) ? skin.label.slice(0, 4) : `${skin.costGem}Gm`,
      action: () => this.buyOrEquipCoinSkin(skin.id)
    }));
    this.showInfoPanel("外观商店", rows, actions);
  }

  private showUpgradePanel(): void {
    const now = Date.now();
    const rows = upgrades.map((upgrade) => {
      const level = this.save.upgrades[upgrade.id];
      const cost = effectiveUpgradeCost(this.save, upgrade, now);
      const price = level >= upgrade.maxLevel ? "已满级" : `${cost} Gold`;
      return `${upgrade.label} Lv.${level}  ${upgrade.description}  ${price}`;
    });
    const actions = upgrades.map((upgrade) => ({
      label: upgrade.label.slice(0, 4),
      action: () => this.buyUpgrade(upgrade.id)
    }));
    this.showInfoPanel("机器升级", rows, actions);
  }

  private showSupplyPanel(): void {
    this.showInfoPanel(
      "补给中心",
      [
        "观看维护短片后发放 Coin 补给",
        "Coin 只用于本局投币，不兑换现金或实物",
        `自然恢复上限 ${NATURAL_COIN_CAP}，补给临时上限 ${SUPPLY_COIN_CAP}`,
        "激励视频模拟 2.5 秒倒计时，完成后自动入账"
      ],
      [
        { label: "看+10C", action: () => this.claimSupplyFromAd(10) },
        { label: "看+30C", action: () => this.claimSupplyFromAd(30) },
        { label: "看+50C", action: () => this.claimSupplyFromAd(50) }
      ]
    );
  }

  private showRulesPanel(): void {
    this.showInfoPanel(
      "规则说明",
      [
        "1. 顶部摆臂持续左右移动，点击推币按当前角度出币",
        "2. 金币碰到中间金色导向柱会改变下落方向",
        "3. 玩家投下的新币砸中鸭子头部触发三列滚动",
        "4. 三列同为 80/120/100 时获得对应 Gold",
        "5. 三列出现礼盒时掉落 5/10/14 倍礼盒包",
        "6. 礼盒在图鉴中用 Gold 开启，补全拼图碎片",
        "7. 无现金、实物、提现、交易或返利奖励"
      ],
      []
    );
  }

  private openGiftPack(tier: GiftTier): void {
    const pack = GIFT_PACKS[tier];
    if (this.save.giftPacks[tier] <= 0) {
      audioSystem.play("error");
      this.flashTip(`${pack.label} 数量不足，先砸中小黄鸭获取`);
      return;
    }
    if (this.save.gold < pack.costGold) {
      audioSystem.play("error");
      this.flashTip(`Gold 不足：开启${pack.label}需要 ${pack.costGold}G`);
      return;
    }

    this.save.giftPacks[tier] -= 1;
    this.save.gold -= pack.costGold;
    this.save.fragments += pack.fragments;
    audioSystem.play("giftPack");
    this.particleSystem.spawnCollect(WIDTH / 2, 350, pack.color, 8);
    this.flashTip(`${pack.label} 已开启：拼图 +${pack.fragments}`);
    this.persist();
    this.showGalleryPanel();
  }

  private claimSupplyFromAd(amount: number): void {
    if (this.adRewardPending) {
      audioSystem.play("error");
      this.flashTip("维护短片播放中，请稍候");
      return;
    }
    this.adRewardPending = true;
    audioSystem.play("click");
    vibratePreset("click");
    this.flashTip("维护短片播放中：2.5 秒", 900);
    adSystem.showRewardedAd(
      {
        onProgress: (remainingMs) => {
          if (remainingMs > 0) this.flashTip(`维护短片播放中：${(remainingMs / 1000).toFixed(1)} 秒`, 900);
        },
        onReward: (reward) => {
          this.applyAdReward(reward);
        },
        onClose: () => {
          this.adRewardPending = false;
          this.panel?.destroy();
          this.panel = undefined;
        },
        onError: (msg) => {
          this.adRewardPending = false;
          audioSystem.play("error");
          vibratePreset("error");
          this.flashTip(msg);
        }
      },
      { type: "coin", value: amount }
    );
  }

  private applyAdReward(reward: AdReward): void {
    const now = Date.now();
    if (reward.type === "coin") {
      const before = this.save.coin;
      this.save.coin = Math.min(SUPPLY_COIN_CAP, this.save.coin + reward.value);
      const gained = this.save.coin - before;
      audioSystem.play("offline");
      vibratePreset("coinCollect");
      this.particleSystem.spawnCollect(68, 702, 0xffd34f, 10);
      this.spawnRewardText(68, 674, `+${gained}C`);
      this.flashTip(gained > 0 ? `补给完成：Coin +${gained}` : "Coin 已达到补给上限");
      this.persist();
      return;
    }

    const durationMs = Math.max(1, reward.duration ?? 60) * 1000;
    const until = now + durationMs;
    if (reward.type === "goldBoost") this.save.buffs.goldBoostUntil = Math.max(this.save.buffs.goldBoostUntil, until);
    if (reward.type === "autoCollect") this.save.buffs.autoCollectUntil = Math.max(this.save.buffs.autoCollectUntil, until);
    if (reward.type === "upgradeDiscount") this.save.buffs.upgradeDiscountUntil = Math.max(this.save.buffs.upgradeDiscountUntil, until);
    if (reward.type === "skinDiscount") this.save.buffs.skinDiscountUntil = Math.max(this.save.buffs.skinDiscountUntil, until);
    audioSystem.play("upgrade");
    vibratePreset("upgrade");
    this.particleSystem.spawnUpgradeBurst(WIDTH / 2, 104);
    this.flashTip("广告奖励 Buff 已生效");
    this.persist();
  }

  private toggleAutoDrop(): void {
    this.save.autoDrop = !this.save.autoDrop;
    audioSystem.play("click");
    this.autoDropText?.setText(this.save.autoDrop ? "自动开" : "自动关");
    this.autoDropIndicator?.setFillStyle(this.save.autoDrop ? 0x7cff8b : 0xffffff, this.save.autoDrop ? 0.95 : 0.24);
    this.flashTip(this.save.autoDrop ? "自动投币已开启" : "自动投币已关闭");
    this.persist();
  }

  private showInfoPanel(title: string, rows: string[], actions: Array<{ label: string; action: () => void }>): void {
    this.panel?.destroy();
    const panel = this.add.container(WIDTH / 2, HEIGHT / 2);
    panel.setDepth(30);
    panel.add(this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x06111f, 0.58));
    panel.add(this.add.rectangle(0, 116, 390, 442, 0xffffff, 0.98).setStrokeStyle(3, 0xff6b6b));
    panel.add(this.add.rectangle(0, -98, 390, 28, 0xff7a66, 0.96));
    panel.add(this.add.text(0, -98, title, {
      color: "#111827",
      fontSize: "22px",
      fontStyle: "700"
    }).setOrigin(0.5));

    rows.slice(0, 9).forEach((row, index) => {
      const y = -54 + index * 34;
      panel.add(this.add.rectangle(0, y, 346, 27, 0xf8fafc, 1).setStrokeStyle(1, 0xe5e7eb));
      panel.add(this.add.text(-160, y, row, {
        color: "#111827",
        fontSize: "11px",
        wordWrap: { width: 318 }
      }).setOrigin(0, 0.5));
    });

    actions.slice(0, 4).forEach((item, index) => {
      const x = -117 + index * 78;
      const button = this.add.rectangle(x, 176, 70, 34, 0xffd34f).setStrokeStyle(2, 0xffffff);
      const label = this.add.text(x, 176, item.label, {
        color: "#07315f",
        fontSize: "11px",
        fontStyle: "700"
      }).setOrigin(0.5);
      button.setInteractive({ useHandCursor: true });
      label.setInteractive({ useHandCursor: true });
      button.on("pointerdown", item.action);
      label.on("pointerdown", item.action);
      panel.add([button, label]);
    });

    const close = this.add.rectangle(0, 220, 128, 36, 0xff4d57).setStrokeStyle(2, 0xffb4b9);
    const closeText = this.add.text(0, 220, "关闭", {
      color: "#ffffff",
      fontSize: "14px",
      fontStyle: "700"
    }).setOrigin(0.5);
    close.setInteractive({ useHandCursor: true });
    closeText.setInteractive({ useHandCursor: true });
    close.on("pointerdown", () => {
      panel.destroy();
      this.panel = undefined;
    });
    closeText.on("pointerdown", () => {
      panel.destroy();
      this.panel = undefined;
    });
    panel.add([close, closeText]);

    this.panel = panel;
  }

  private claimMissionReward(id: MissionId): void {
    if (claimMission(this.save, id)) {
      audioSystem.play("upgrade");
      this.particleSystem.spawnCollect(386, 354, 0x7cff8b, 6);
      this.flashTip("任务奖励已领取：Gem 增加");
      this.persist();
      this.showMissionPanel();
      return;
    }
    audioSystem.play("error");
    this.flashTip("任务尚未达成");
  }

  private buyOrEquipCoinSkin(id: SkinId): void {
    const result = buyOrEquipSkin(this.save, id);
    if (result === "locked") {
      audioSystem.play("error");
      this.flashTip("Gem 不足，先完成每日任务");
      return;
    }
    audioSystem.play(result === "bought" ? "giftPack" : "click");
    const skin = skins.find((item) => item.id === this.save.activeSkin) ?? skins[0];
    this.createCoinTexture(`coin-${skin.id}`, skin);
    this.coins.forEach((coin) => coin.setTexture(`coin-${skin.id}`));
    this.flashTip(result === "bought" ? "外观解锁并装配" : "外观已装配");
    this.persist();
    this.showSkinPanel();
  }

  private repairCurrentArcade(): void {
    const repaired = repairNextArcade(this.save);
    if (!repaired) {
      audioSystem.play("error");
      this.flashTip("Gold 不足，继续修复材料收集");
      return;
    }
    audioSystem.play("upgrade");
    vibratePreset("upgrade");
    this.particleSystem.spawnUpgradeBurst(WIDTH / 2, 600);
    this.flashTip(`已修复：${repaired.label}`);
    this.persist();
    this.showGalleryPanel();
  }

  private applyOfflineProgress(): void {
    const elapsedSec = Math.floor((Date.now() - this.save.lastSaveAt) / 1000);
    if (elapsedSec < 30) return;
    const cappedSec = Math.min(elapsedSec, 28800);
    const gold = Math.floor(cappedSec * (0.04 + this.save.upgrades.slot * 0.015));
    const recoverable = Math.max(0, NATURAL_COIN_CAP - this.save.coin);
    const recoveredCoin = Math.min(recoverable, Math.floor(cappedSec / 60));
    if (gold <= 0 && recoveredCoin <= 0) return;
    this.save.gold += gold;
    this.save.coin += recoveredCoin;
    this.time.delayedCall(400, () => {
      audioSystem.play("offline");
      this.showInfoPanel("离线收益", [`离线 ${Math.floor(elapsedSec / 60)} 分钟`, `Gold +${gold}`, `Coin +${recoveredCoin}`], []);
    });
  }

  private spawnRewardText(x: number, y: number, text: string): void {
    const label = this.add.text(x, y, text, {
      color: "#fff0a6",
      fontSize: "18px",
      fontStyle: "700"
    }).setOrigin(0.5);
    this.tweens.add({
      targets: label,
      y: y - 44,
      alpha: 0,
      duration: 700,
      onComplete: () => label.destroy()
    });
  }

  private flashTip(text: string, duration = 1800): void {
    this.tipResetEvent?.remove(false);
    this.tip.setText(text);
    this.tipResetEvent = this.time.delayedCall(duration, () => {
      this.tip.setText(this.defaultTipText());
      this.tipResetEvent = undefined;
    });
  }

  private defaultTipText(): string {
    if (this.save.repairedCount >= arcadeGoals.length) return "街机厅修复完成，继续收集外观";
    const goal = currentArcadeGoal(this.save);
    return `目标：${goal.costGold} Gold 修复《${goal.label}》`;
  }

  private recycleCoin(coin?: Phaser.Physics.Matter.Image): void {
    if (!coin) return;
    coin.destroy();
  }

  private persist(): void {
    saveGame(this.save);
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "app",
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: "#0b1020",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: "matter",
    matter: {
      gravity: { x: 0, y: 1.0 },
      debug: false,
      enableSleeping: true
    }
  },
  scene: [GameScene]
};

new Phaser.Game(config);
