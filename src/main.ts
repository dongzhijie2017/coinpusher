import Phaser from "phaser";
import "./style.css";
import { centerReward, coinCooldown, effectiveUpgradeCost, pusherSpeed, tryUpgrade, upgrades } from "./systems/economy";
import { mechanismRewards, pickMechanismReward } from "./systems/rewards";
import { loadSave, saveGame } from "./systems/save";
import type { MechanismReward, PlayerSave, UpgradeId } from "./types";

const WIDTH = 430;
const HEIGHT = 760;
const MAX_COINS = 140;

class GameScene extends Phaser.Scene {
  private save!: PlayerSave;
  private coins: Phaser.Physics.Matter.Image[] = [];
  private pusher!: MatterJS.BodyType;
  private pusherVisual!: Phaser.GameObjects.Rectangle;
  private luckySensor!: Phaser.Physics.Matter.Image;
  private lastDrop = 0;
  private pusherDirection = 1;
  private mechanismBusy = false;
  private hud!: Phaser.GameObjects.Text;
  private tip!: Phaser.GameObjects.Text;
  private upgradeTexts: Partial<Record<UpgradeId, Phaser.GameObjects.Text>> = {};
  private buffText!: Phaser.GameObjects.Text;

  constructor() {
    super("game");
  }

  preload(): void {
    this.load.image("hero", "/assets/coin-pusher-hero.png");
  }

  create(): void {
    this.save = loadSave();
    this.matter.world.setBounds(34, 104, WIDTH - 68, 520, 32, true, true, false, true);
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
    this.createUpgradePanel();
    this.createCollisionHandlers();

    this.time.addEvent({
      delay: 60000,
      loop: true,
      callback: () => {
        this.save.coin = Math.min(50, this.save.coin + 1);
        this.persist();
      }
    });

    this.time.addEvent({
      delay: 2500,
      loop: true,
      callback: () => this.persist()
    });
  }

  update(_time: number, delta: number): void {
    this.updatePusher(delta);
    this.checkDrops();
    this.updateHud();
  }

  private createTextures(): void {
    const coin = this.add.graphics();
    coin.fillStyle(0xffd45a, 1);
    coin.fillCircle(32, 32, 30);
    coin.lineStyle(5, 0xf6a821, 1);
    coin.strokeCircle(32, 32, 26);
    coin.lineStyle(2, 0xfff2a8, 0.85);
    coin.strokeCircle(32, 32, 18);
    coin.fillStyle(0xfff2a8, 0.7);
    coin.fillCircle(23, 22, 7);
    coin.generateTexture("coin", 64, 64);
    coin.destroy();

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

  private createBackdrop(): void {
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x0b1020);
    const hero = this.add.image(WIDTH / 2, 178, "hero");
    hero.setDisplaySize(500, 281);
    hero.setAlpha(0.28);

    this.add.rectangle(WIDTH / 2, 90, WIDTH, 180, 0x101936, 0.78);
    this.add.rectangle(WIDTH / 2, 385, WIDTH, 520, 0x121a2d);
    this.add.rectangle(WIDTH / 2, 650, WIDTH, 220, 0x090d19);
  }

  private createMachine(): void {
    this.add.rectangle(WIDTH / 2, 360, 370, 520, 0x2f3f75).setStrokeStyle(3, 0xf1c35b);
    this.add.rectangle(WIDTH / 2, 360, 318, 460, 0x14213d).setStrokeStyle(2, 0x70d6ff, 0.8);
    this.add.rectangle(WIDTH / 2, 540, 300, 34, 0x563a74).setStrokeStyle(2, 0xf1c35b);
    this.add.rectangle(WIDTH / 2, 590, 290, 46, 0x28314f).setStrokeStyle(2, 0x70d6ff);

    this.add.text(WIDTH / 2, 50, "街机修复计划", {
      color: "#fff7d1",
      fontSize: "26px",
      fontStyle: "700"
    }).setOrigin(0.5);

    this.add.text(WIDTH / 2, 79, "收集零件 · 升级机器 · 解锁图鉴", {
      color: "#9fb7ff",
      fontSize: "14px"
    }).setOrigin(0.5);

    this.matter.add.rectangle(WIDTH / 2, 612, 300, 18, { isStatic: true, label: "front-lip" });
    this.matter.add.rectangle(58, 360, 18, 500, { isStatic: true, label: "left-wall" });
    this.matter.add.rectangle(WIDTH - 58, 360, 18, 500, { isStatic: true, label: "right-wall" });
  }

  private createPusher(): void {
    this.pusherVisual = this.add.rectangle(WIDTH / 2, 274, 268, 36, 0x8b6ef3).setStrokeStyle(3, 0xf1c35b);
    this.pusher = this.matter.add.rectangle(WIDTH / 2, 274, 286, 58, {
      isStatic: true,
      label: "pusher",
      friction: 0.18
    });
  }

  private createLuckySensor(): void {
    this.add.text(WIDTH / 2, 187, "机关检索", {
      color: "#d8f7ff",
      fontSize: "13px",
      fontStyle: "700"
    }).setOrigin(0.5);

    this.luckySensor = this.matter.add.image(WIDTH / 2, 218, "lucky-sensor", undefined, {
      isSensor: true,
      isStatic: true,
      label: "lucky-sensor"
    });
    this.luckySensor.setScale(0.72);

    this.tweens.add({
      targets: this.luckySensor,
      x: { from: 102, to: 328 },
      duration: 2800,
      yoyo: true,
      repeat: -1
    });
  }

  private createHud(): void {
    this.hud = this.add.text(24, 108, "", {
      color: "#ffffff",
      fontSize: "15px",
      lineSpacing: 7
    });

    this.tip = this.add.text(WIDTH / 2, 626, "目标：收集 200 Gold，修复第一台街机", {
      color: "#fff0a6",
      fontSize: "14px"
    }).setOrigin(0.5);

    this.buffText = this.add.text(WIDTH - 24, 108, "", {
      color: "#aef27a",
      fontSize: "12px",
      align: "right",
      lineSpacing: 5
    }).setOrigin(1, 0);
  }

  private createControls(): void {
    const button = this.add.rectangle(WIDTH / 2, 696, 168, 56, 0xf2b84b).setStrokeStyle(3, 0xfff0a6);
    const label = this.add.text(WIDTH / 2, 696, "投币", {
      color: "#2b1b04",
      fontSize: "24px",
      fontStyle: "700"
    }).setOrigin(0.5);
    button.setInteractive({ useHandCursor: true });
    label.setInteractive({ useHandCursor: true });

    const drop = () => this.dropCoin();
    button.on("pointerdown", drop);
    label.on("pointerdown", drop);

    const adButton = this.add.rectangle(92, 696, 118, 46, 0x27496d).setStrokeStyle(2, 0x70d6ff);
    this.add.text(92, 696, "补给 +30", {
      color: "#d8f7ff",
      fontSize: "16px",
      fontStyle: "700"
    }).setOrigin(0.5);
    adButton.setInteractive({ useHandCursor: true });
    adButton.on("pointerdown", () => {
      this.save.coin = Math.min(80, this.save.coin + 30);
      this.flashTip("模拟激励视频完成：获得 30 Coin");
      this.persist();
    });
  }

  private createUpgradePanel(): void {
    upgrades.forEach((upgrade, index) => {
      const y = 654 + index * 31;
      const x = 286;
      const bg = this.add.rectangle(x, y, 240, 25, 0x1b2b4a).setStrokeStyle(1, 0x4a78c2);
      const text = this.add.text(x - 112, y, "", {
        color: "#dbe8ff",
        fontSize: "12px"
      }).setOrigin(0, 0.5);
      bg.setInteractive({ useHandCursor: true });
      bg.on("pointerdown", () => this.buyUpgrade(upgrade.id));
      text.setInteractive({ useHandCursor: true });
      text.on("pointerdown", () => this.buyUpgrade(upgrade.id));
      this.upgradeTexts[upgrade.id] = text;
    });
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
        const data = coin.getData("mechanismTriggered") as boolean | undefined;
        if (data || this.mechanismBusy) return;
        coin.setData("mechanismTriggered", true);
        this.triggerMechanism();
      });
    });
  }

  private dropCoin(): void {
    const now = this.time.now;
    const cooldown = coinCooldown(this.save.upgrades.cooldown);
    if (now - this.lastDrop < cooldown) return;
    if (this.save.coin <= 0) {
      this.flashTip("Coin 不足：等待恢复或使用补给");
      return;
    }
    this.lastDrop = now;
    this.save.coin -= 1;

    const x = Phaser.Math.Between(145, 285);
    const coin = this.matter.add.image(x, 142, "coin", undefined, {
      shape: { type: "circle", radius: 21 },
      restitution: 0.05,
      friction: 0.14,
      frictionAir: 0.025,
      density: 0.002,
      slop: 0.02,
      label: "coin"
    });
    coin.setScale(0.68);
    coin.setBounce(0.05);
    coin.setFriction(0.14, 0.025, 0.14);
    coin.setAngularVelocity(Phaser.Math.FloatBetween(-0.08, 0.08));
    this.coins.push(coin);

    if (this.coins.length > MAX_COINS) {
      this.recycleCoin(this.coins.shift());
    }
  }

  private updatePusher(delta: number): void {
    const speed = pusherSpeed(this.save.upgrades.pusher) * delta * 0.055;
    const nextY = this.pusher.position.y + speed * this.pusherDirection;
    if (nextY > 334) this.pusherDirection = -1;
    if (nextY < 252) this.pusherDirection = 1;
    const y = Phaser.Math.Clamp(nextY, 252, 334);
    this.matter.body.setPosition(this.pusher, { x: WIDTH / 2, y });
    this.pusherVisual.setPosition(WIDTH / 2, y);
  }

  private checkDrops(): void {
    for (let i = this.coins.length - 1; i >= 0; i -= 1) {
      const coin = this.coins[i];
      const { x, y } = coin;
      const autoCollectActive = this.save.buffs.autoCollectUntil > Date.now();
      if (y < 632 && !(autoCollectActive && y > 560)) continue;
      let reward = Phaser.Math.Between(1, 3);
      if (x > 158 && x < 272) {
        reward += centerReward(this.save.upgrades.slot);
        this.flashTip("图鉴槽命中：获得修复材料");
      }
      if (this.save.buffs.goldBoostUntil > Date.now()) {
        reward = Math.ceil(reward * 1.5);
      }
      this.save.gold += reward;
      this.spawnRewardText(x, Math.min(y, 610), `+${reward}`);
      this.recycleCoin(coin);
      this.coins.splice(i, 1);
    }
  }

  private buyUpgrade(id: UpgradeId): void {
    if (tryUpgrade(this.save, id)) {
      this.flashTip("升级完成");
      this.persist();
      return;
    }
    this.flashTip("Gold 不足或已满级");
  }

  private updateHud(): void {
    const now = Date.now();
    this.hud.setText(`Coin ${this.save.coin}/50\nGold ${this.save.gold}\n碎片 ${this.save.fragments}\n机关 ${this.save.mechanismTriggers}`);
    this.buffText.setText(this.activeBuffLines(now).join("\n"));
    upgrades.forEach((upgrade) => {
      const level = this.save.upgrades[upgrade.id];
      const cost = effectiveUpgradeCost(this.save, upgrade, now);
      this.upgradeTexts[upgrade.id]?.setText(`${upgrade.label} Lv.${level}  ${level >= upgrade.maxLevel ? "MAX" : `${cost}G`}`);
    });
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
        this.save.coin = Math.min(80, this.save.coin + 1);
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
      this.tip.setText("目标：收集 200 Gold，修复第一台街机");
    });
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
      gravity: { x: 0, y: 1.1 },
      debug: false,
      enableSleeping: true
    }
  },
  scene: [GameScene]
};

new Phaser.Game(config);
