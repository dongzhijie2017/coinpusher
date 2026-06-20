import Phaser from "phaser";
import "./style.css";
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
import { mechanismRewards, pickMechanismReward } from "./systems/rewards";
import { loadSave, saveGame } from "./systems/save";
import type { MechanismReward, MissionId, PlayerSave, SkinConfig, SkinId, UpgradeId } from "./types";

const WIDTH = 430;
const HEIGHT = 760;
const MAX_COINS = 140;
const NATURAL_COIN_CAP = 50;
const SUPPLY_COIN_CAP = 80;
const CENTER_SLOT_LEFT = 144;
const CENTER_SLOT_RIGHT = 286;
const PUSHER_MIN_Y = 432;
const PUSHER_MAX_Y = 510;

class GameScene extends Phaser.Scene {
  private save!: PlayerSave;
  private coins: Phaser.Physics.Matter.Image[] = [];
  private pusher!: MatterJS.BodyType;
  private pusherVisual!: Phaser.GameObjects.Rectangle;
  private pusherShine!: Phaser.GameObjects.Rectangle;
  private luckySensor!: Phaser.Physics.Matter.Image;
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
  private panel?: Phaser.GameObjects.Container;
  private autoDropText!: Phaser.GameObjects.Text;
  private autoDropIndicator!: Phaser.GameObjects.Arc;

  constructor() {
    super("game");
  }

  create(): void {
    this.save = loadSave();
    this.applyOfflineProgress();
    this.matter.world.setBounds(54, 104, WIDTH - 108, 535, 32, true, true, false, false);
    this.matter.world.engine.positionIterations = 8;
    this.matter.world.engine.velocityIterations = 6;
    this.matter.world.engine.constraintIterations = 2;

    this.createTextures();
    this.createBackdrop();
    this.createMachine();
    this.createPusher();
    this.createLuckySensor();
    this.createHud();
    this.createControls();
    this.createCollisionHandlers();
    this.seedCoinPile();

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
    this.add.rectangle(WIDTH / 2, 78, 344, 24, 0x103b55, 0.9).setStrokeStyle(1, 0x2ec4b6);
    this.add.text(WIDTH / 2, 78, "Coin 投币 · Gold 修复 · Gem 外观", {
      color: "#d9fff7",
      fontSize: "11px",
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
    this.add.rectangle(WIDTH / 2, 168, 268, 25, 0x9b1c2a, 0.9);
    this.add.text(WIDTH / 2, 168, "机关检索只产出游戏内成长道具", {
      color: "#ffe9b9",
      fontSize: "12px",
      fontStyle: "700"
    }).setOrigin(0.5);

    this.add.rectangle(WIDTH / 2, 386, 314, 352, 0xd8fbff, 0.19).setStrokeStyle(3, 0xf4fdff, 0.82);
    this.add.rectangle(WIDTH / 2, 394, 276, 330, 0x9b1c2a, 0.92);
    this.add.rectangle(WIDTH / 2, 394, 256, 294, 0xb91f2e, 0.62);
    this.createMechanismBoard();
    this.add.rectangle(108, 394, 10, 314, 0xffffff, 0.13).setAngle(12);
    this.add.rectangle(WIDTH - 108, 394, 10, 314, 0xffffff, 0.1).setAngle(-12);

    this.add.rectangle(WIDTH / 2, 198, 150, 34, 0x0d315f).setStrokeStyle(3, 0xd8e4f2);
    this.add.rectangle(WIDTH / 2, 198, 100, 16, 0x071932);
    this.dropGuide = this.add.rectangle(this.spawnX, 220, 34, 5, 0xfff2a8, 0.92);

    this.add.rectangle(WIDTH / 2, 562, 304, 18, 0xffcf3f).setStrokeStyle(2, 0xfff2a8).setDepth(3);
    this.createStaticCoinBed();
    this.add.rectangle(WIDTH / 2, 600, 150, 58, 0xf7f7f2).setStrokeStyle(3, 0x25344a).setDepth(8);
    this.add.text(WIDTH / 2, 600, "中央修复槽", {
      color: "#07315f",
      fontSize: "12px",
      fontStyle: "700"
    }).setOrigin(0.5).setDepth(9);
    this.add.rectangle(114, 600, 74, 58, 0x0067cb).setStrokeStyle(3, 0x6ed7ff).setDepth(8);
    this.add.rectangle(WIDTH - 114, 600, 74, 58, 0x0067cb).setStrokeStyle(3, 0x6ed7ff).setDepth(8);
    this.add.text(114, 600, "回收", {
      color: "#d8f7ff",
      fontSize: "11px",
      fontStyle: "700"
    }).setOrigin(0.5).setDepth(9);
    this.add.text(WIDTH - 114, 600, "回收", {
      color: "#d8f7ff",
      fontSize: "11px",
      fontStyle: "700"
    }).setOrigin(0.5).setDepth(9);

    this.matter.add.rectangle(72, 382, 18, 406, { isStatic: true, label: "left-wall" });
    this.matter.add.rectangle(WIDTH - 72, 382, 18, 406, { isStatic: true, label: "right-wall" });

    const aimZone = this.add.zone(WIDTH / 2, 198, 286, 90);
    aimZone.setInteractive({ useHandCursor: true });
    aimZone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.spawnX = Phaser.Math.Clamp(pointer.x, 122, 308);
      this.dropGuide.setX(this.spawnX);
      this.dropCoin(this.spawnX);
    });
  }

  private createMechanismBoard(): void {
    this.add.rectangle(WIDTH / 2, 244, 246, 25, 0x7f1725, 0.96).setStrokeStyle(2, 0xffd36e);
    this.add.text(WIDTH / 2, 244, "零件扫描：命中中央槽提升修复效率", {
      color: "#fff1c7",
      fontSize: "11px",
      fontStyle: "700"
    }).setOrigin(0.5);

    const columns = [
      { x: 150, values: ["20", "80", "200"] },
      { x: 215, values: ["60", "120", "300"] },
      { x: 280, values: ["40", "100", "碎片"] }
    ];

    columns.forEach((column) => {
      this.add.rectangle(column.x, 352, 56, 142, 0xfff8ed, 0.98).setStrokeStyle(3, 0x7f1725);
      column.values.forEach((value, index) => {
        const y = 306 + index * 46;
        if (index === 1) this.add.rectangle(column.x, y, 52, 38, 0xffdf63, 0.88);
        this.add.text(column.x, y, value, {
          color: index === 1 ? "#c82131" : "#dc7782",
          fontSize: value.length > 3 ? "15px" : "24px",
          fontStyle: "700"
        }).setOrigin(0.5);
      });
    });

    [126, 174, 224, 274, 324].forEach((x, index) => {
      this.add.image(x, 274 + (index % 2) * 8, `coin-${this.save.activeSkin}`).setScale(0.23).setAngle(index * 18 - 24);
      this.add.image(x + 8, 433 - (index % 2) * 7, `coin-${this.save.activeSkin}`).setScale(0.22).setAngle(24 - index * 14);
    });

    this.add.rectangle(WIDTH / 2, 494, 202, 8, 0x271409).setStrokeStyle(2, 0xffe68a);
  }

  private createStaticCoinBed(): void {
    for (let i = 0; i < 34; i += 1) {
      const x = 90 + (i % 17) * 15 + Phaser.Math.Between(-4, 4);
      const y = 548 + Math.floor(i / 17) * 17 + Phaser.Math.Between(-3, 4);
      this.add.image(x, y, `coin-${this.save.activeSkin}`)
        .setScale(0.34 + (i % 3) * 0.025)
        .setAngle(Phaser.Math.Between(-28, 28))
        .setDepth(2);
    }
  }

  private createPusher(): void {
    this.pusherVisual = this.add.rectangle(WIDTH / 2, 462, 286, 42, 0xf6d24b).setStrokeStyle(3, 0xfff2a8).setDepth(6);
    this.pusherShine = this.add.rectangle(WIDTH / 2, 450, 260, 8, 0xffffff, 0.35).setDepth(7);
    this.pusher = this.matter.add.rectangle(WIDTH / 2, 462, 304, 62, {
      isStatic: true,
      label: "pusher",
      friction: 0.18
    });
  }

  private createLuckySensor(): void {
    this.add.text(WIDTH / 2, 468, "小黄鸭轨道", {
      color: "#fff1c7",
      fontSize: "13px",
      fontStyle: "700"
    }).setOrigin(0.5).setDepth(8);

    this.luckySensor = this.matter.add.image(WIDTH / 2, 494, "lucky-sensor", undefined, {
      isSensor: true,
      isStatic: true,
      label: "lucky-sensor"
    });
    this.luckySensor.setScale(0.72);
    this.luckySensor.setDepth(9);

    this.tweens.add({
      targets: this.luckySensor,
      x: { from: 122, to: 308 },
      duration: 2800,
      yoyo: true,
      repeat: -1
    });
  }

  private createHud(): void {
    this.add.rectangle(101, 104, 150, 24, 0x06111f, 0.58).setStrokeStyle(1, 0x66d9ff, 0.45);
    this.hud = this.add.text(33, 104, "", {
      color: "#f4fbff",
      fontSize: "10px",
      fontStyle: "700"
    }).setOrigin(0, 0.5);

    this.add.rectangle(WIDTH - 101, 104, 150, 24, 0x06111f, 0.5).setStrokeStyle(1, 0xaef27a, 0.38);
    this.buffText = this.add.text(WIDTH - 33, 104, "", {
      color: "#c8ff8c",
      fontSize: "10px",
      align: "right",
      fontStyle: "700"
    }).setOrigin(1, 0.5);

    this.add.rectangle(WIDTH / 2, 628, 332, 48, 0x653e29, 0.24).setStrokeStyle(1, 0xffe0a4, 0.32);
    this.tip = this.add.text(WIDTH / 2, 644, "点击上方发币口可选择落点", {
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
    supplyButton.on("pointerdown", () => this.showSupplyPanel());
    supplyLabel.on("pointerdown", () => this.showSupplyPanel());
    supplySub.on("pointerdown", () => this.showSupplyPanel());

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
    this.createUtilityButton(338, 702, 96, 56, this.save.autoDrop ? "自动开" : "自动关", "按当前落点", () => this.toggleAutoDrop(), (text) => {
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
    button.on("pointerdown", callback);
    text.on("pointerdown", callback);
    sub.on("pointerdown", callback);
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
    button.on("pointerdown", callback);
    text.on("pointerdown", callback);
  }

  private seedCoinPile(): void {
    const count = Math.min(64, 34 + this.save.upgrades.slot * 3);
    for (let i = 0; i < count; i += 1) {
      const x = Phaser.Math.Between(112, 318);
      const y = Phaser.Math.Between(506, 575);
      const coin = this.createPhysicalCoin(x, y);
      coin.setData("seeded", true);
    }
  }

  private createCollisionHandlers(): void {
    this.matter.world.on("collisionstart", (event: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
      event.pairs.forEach((pair) => {
        const bodies = [pair.bodyA, pair.bodyB];
        const sensorBody = bodies.find((body) => body.label === "lucky-sensor");
        const coinBody = bodies.find((body) => body.label === "coin");
        if (!sensorBody || !coinBody) return;
        const coin = this.coins.find((item) => item.body === coinBody);
        if (!coin) return;
        if (coin.getData("seeded")) return;
        const data = coin.getData("mechanismTriggered") as boolean | undefined;
        if (data || this.mechanismBusy) return;
        coin.setData("mechanismTriggered", true);
        this.triggerMechanism();
      });
    });
  }

  private dropCoin(spawnX = this.spawnX): void {
    const now = this.time.now;
    const cooldown = coinCooldown(this.save.upgrades.cooldown);
    if (now - this.lastDrop < cooldown) return;
    if (this.save.coin <= 0) {
      this.flashTip("Coin 不足：等待恢复或使用补给");
      return;
    }
    this.lastDrop = now;
    this.save.coin -= 1;
    increaseMission(this.save, "spawnCoin", 1);

    const x = Phaser.Math.Clamp(spawnX + Phaser.Math.Between(-10, 10), 122, 308);
    this.createPhysicalCoin(x, 216);
  }

  private createPhysicalCoin(x: number, y: number): Phaser.Physics.Matter.Image {
    const coin = this.matter.add.image(x, y, `coin-${this.save.activeSkin}`, undefined, {
      shape: { type: "circle", radius: 21 },
      restitution: 0.05,
      friction: 0.14,
      frictionAir: 0.03,
      density: 0.0022,
      slop: 0.02,
      label: "coin"
    });
    coin.setScale(0.68);
    coin.setDepth(5);
    coin.setBounce(0.05);
    coin.setFriction(0.15, 0.03, 0.15);
    coin.setVelocity(0, 0.58);
    coin.setAngularVelocity(Phaser.Math.FloatBetween(-0.08, 0.08));
    this.coins.push(coin);

    if (this.coins.length > MAX_COINS) {
      this.recycleCoin(this.coins.shift());
    }
    return coin;
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
      const autoCollectActive = this.save.buffs.autoCollectUntil > Date.now();
      if (y < 608 && !(autoCollectActive && y > 560)) continue;
      let reward = Phaser.Math.Between(1, 3);
      if (x > CENTER_SLOT_LEFT && x < CENTER_SLOT_RIGHT) {
        reward += centerReward(this.save.upgrades.slot);
        increaseMission(this.save, "hitCenter", 1);
        this.flashTip("中央修复槽命中：Gold 增加");
      }
      if (this.save.buffs.goldBoostUntil > Date.now()) {
        reward = Math.ceil(reward * 1.5);
      }
      this.save.gold += reward;
      increaseMission(this.save, "earnGold", reward);
      this.spawnRewardText(x, Math.min(y - 16, 580), `+${reward}`);
      this.recycleCoin(coin);
      this.coins.splice(i, 1);
    }
  }

  private buyUpgrade(id: UpgradeId): void {
    if (tryUpgrade(this.save, id)) {
      this.flashTip("升级完成");
      this.persist();
      if (this.panel) this.showUpgradePanel();
      return;
    }
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
    const reward = pickMechanismReward();
    this.showMechanismPanel(reward);
  }

  private showMechanismPanel(finalReward: MechanismReward): void {
    const overlay = this.add.container(WIDTH / 2, HEIGHT / 2);
    overlay.setDepth(20);

    const shade = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x05070d, 0.58);
    const panel = this.add.rectangle(0, -8, 354, 330, 0x14213d, 0.96).setStrokeStyle(3, 0x70d6ff);
    const title = this.add.text(0, -145, "机关检索", {
      color: "#fff7d1",
      fontSize: "24px",
      fontStyle: "700"
    }).setOrigin(0.5);
    const subtitle = this.add.text(0, -116, "扫描硬轨迹，发现可用零件", {
      color: "#9fb7ff",
      fontSize: "13px"
    }).setOrigin(0.5);

    overlay.add([shade, panel, title, subtitle]);

    const cells: Phaser.GameObjects.Rectangle[] = [];
    const labels: Phaser.GameObjects.Text[] = [];
    mechanismRewards.slice(0, 9).forEach((reward, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = -108 + col * 108;
      const y = -54 + row * 70;
      const cell = this.add.rectangle(x, y, 92, 54, 0x22365f).setStrokeStyle(2, 0x4a78c2);
      const label = this.add.text(x, y, reward.shortLabel, {
        color: "#ffffff",
        fontSize: "16px",
        fontStyle: "700"
      }).setOrigin(0.5);
      overlay.add([cell, label]);
      cells.push(cell);
      labels.push(label);
    });

    const resultText = this.add.text(0, 132, "", {
      color: "#fff0a6",
      fontSize: "15px",
      align: "center",
      wordWrap: { width: 310 }
    }).setOrigin(0.5);
    overlay.add(resultText);

    let tick = 0;
    const visibleRewards = mechanismRewards.slice(0, 9);
    const finalIndex = Math.max(0, visibleRewards.findIndex((reward) => reward.id === finalReward.id));
    this.time.addEvent({
      delay: 80,
      repeat: 20,
      callback: () => {
        cells.forEach((cell, index) => {
          const selected = index === tick % cells.length;
          cell.setFillStyle(selected ? 0xf2b84b : 0x22365f);
          labels[index].setColor(selected ? "#2b1b04" : "#ffffff");
        });
        tick += 1;
      }
    });

    this.time.delayedCall(1900, () => {
      cells.forEach((cell, index) => {
        const selected = index === finalIndex;
        cell.setFillStyle(selected ? finalReward.color : 0x22365f);
        labels[index].setColor(selected ? "#10131f" : "#ffffff");
      });
      resultText.setText(finalReward.description);
      this.applyMechanismReward(finalReward);
      this.persist();
    });

    this.time.delayedCall(3300, () => {
      overlay.destroy();
      this.mechanismBusy = false;
    });
  }

  private applyMechanismReward(reward: MechanismReward): void {
    const now = Date.now();
    switch (reward.id) {
      case "gold-small":
        this.save.gold += 5;
        this.spawnRewardText(WIDTH / 2, 235, "+5G");
        break;
      case "gold-medium":
        this.save.gold += 10;
        this.spawnRewardText(WIDTH / 2, 235, "+10G");
        break;
      case "gold-large":
        this.save.gold += 30;
        this.spawnRewardText(WIDTH / 2, 235, "+30G");
        break;
      case "coin":
        this.save.coin = Math.min(SUPPLY_COIN_CAP, this.save.coin + 1);
        this.spawnRewardText(WIDTH / 2, 235, "+1C");
        break;
      case "gold-boost":
        this.save.buffs.goldBoostUntil = Math.max(this.save.buffs.goldBoostUntil, now) + 5 * 60 * 1000;
        break;
      case "auto-collect":
        this.save.buffs.autoCollectUntil = Math.max(this.save.buffs.autoCollectUntil, now) + 30 * 1000;
        break;
      case "fragment":
        this.save.fragments += 1;
        this.spawnRewardText(WIDTH / 2, 235, "+碎片");
        break;
      case "upgrade-discount":
        this.save.buffs.upgradeDiscountUntil = Math.max(this.save.buffs.upgradeDiscountUntil, now) + 5 * 60 * 1000;
        break;
      case "skin-discount":
        this.save.buffs.skinDiscountUntil = Math.max(this.save.buffs.skinDiscountUntil, now) + 10 * 60 * 1000;
        break;
      case "blank":
        break;
    }
    this.flashTip(`机关检索：${reward.description}`);
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
    const actions = this.save.repairedCount < arcadeGoals.length ? [{ label: "修复当前", action: () => this.repairCurrentArcade() }] : [];
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
        "观看维护短片可获得 Coin 补给",
        "Coin 只用于本局投币，不兑换现金或实物",
        `自然恢复上限 ${NATURAL_COIN_CAP}，补给临时上限 ${SUPPLY_COIN_CAP}`,
        "建议优先使用标准补给，避免一次性溢出"
      ],
      [
        { label: "+10C", action: () => this.claimSupply(10) },
        { label: "+30C", action: () => this.claimSupply(30) },
        { label: "+50C", action: () => this.claimSupply(50) }
      ]
    );
  }

  private showRulesPanel(): void {
    this.showInfoPanel(
      "规则说明",
      [
        "1. 点击发币口选择落点，再点击底部按钮投币",
        "2. 左右回收槽给基础 Gold，中央修复槽给更高 Gold",
        "3. 小黄鸭只会触发免费机关检索，不售卖次数",
        "4. 机关检索产出游戏内成长道具，不展示概率营销",
        "5. Gold 用于机器升级和街机修复图鉴",
        "6. Gem 来自每日任务，只用于硬币外观",
        "7. 无现金、实物、提现、交易或返利奖励"
      ],
      []
    );
  }

  private claimSupply(amount: number): void {
    this.save.coin = Math.min(SUPPLY_COIN_CAP, this.save.coin + amount);
    this.flashTip(`补给完成：Coin +${amount}`);
    this.persist();
    this.panel?.destroy();
    this.panel = undefined;
  }

  private toggleAutoDrop(): void {
    this.save.autoDrop = !this.save.autoDrop;
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
      this.flashTip("任务奖励已领取：Gem 增加");
      this.persist();
      this.showMissionPanel();
      return;
    }
    this.flashTip("任务尚未达成");
  }

  private buyOrEquipCoinSkin(id: SkinId): void {
    const result = buyOrEquipSkin(this.save, id);
    if (result === "locked") {
      this.flashTip("Gem 不足，先完成每日任务");
      return;
    }
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
      this.flashTip("Gold 不足，继续修复材料收集");
      return;
    }
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

  private flashTip(text: string): void {
    this.tip.setText(text);
    this.time.delayedCall(1800, () => {
      this.tip.setText(this.defaultTipText());
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
      gravity: { x: 0, y: 0.18 },
      debug: false,
      enableSleeping: true
    }
  },
  scene: [GameScene]
};

new Phaser.Game(config);
