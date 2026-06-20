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
  private goalText!: Phaser.GameObjects.Text;
  private goalBar!: Phaser.GameObjects.Rectangle;
  private spawnX = WIDTH / 2;
  private dropGuide!: Phaser.GameObjects.Rectangle;
  private panel?: Phaser.GameObjects.Container;

  constructor() {
    super("game");
  }

  create(): void {
    this.save = loadSave();
    this.applyOfflineProgress();
    this.matter.world.setBounds(54, 104, WIDTH - 108, 510, 32, true, true, false, true);
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
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x5fc7ff);
    this.add.rectangle(WIDTH / 2, 120, WIDTH, 240, 0x8fe4ff, 0.45);
    this.add.rectangle(WIDTH / 2, 500, WIDTH, 520, 0x0874d8, 0.32);
  }

  private createMachine(): void {
    this.add.rectangle(WIDTH / 2, 366, 392, 550, 0x0080ff).setStrokeStyle(4, 0x6ed7ff);
    this.add.rectangle(WIDTH / 2, 354, 330, 462, 0xa7ecff, 0.18).setStrokeStyle(2, 0xd8f7ff, 0.7);
    this.add.rectangle(72, 360, 22, 470, 0x0067cb).setStrokeStyle(2, 0x6ed7ff, 0.8);
    this.add.rectangle(WIDTH - 72, 360, 22, 470, 0x0067cb).setStrokeStyle(2, 0x6ed7ff, 0.8);
    this.add.rectangle(112, 340, 12, 390, 0xffffff, 0.12).setAngle(12);
    this.add.rectangle(WIDTH - 112, 340, 12, 390, 0xffffff, 0.12).setAngle(-12);

    this.add.rectangle(WIDTH / 2, 126, 142, 34, 0x0d315f).setStrokeStyle(3, 0xd8e4f2);
    this.add.rectangle(WIDTH / 2, 126, 96, 18, 0x071932);
    this.dropGuide = this.add.rectangle(this.spawnX, 151, 32, 4, 0xfff2a8, 0.9);

    this.add.rectangle(WIDTH / 2, 558, 314, 30, 0x0067cb).setStrokeStyle(2, 0x6ed7ff);
    this.add.rectangle(WIDTH / 2, 606, 152, 58, 0xd8e4f2).setStrokeStyle(3, 0x24354d);
    this.add.rectangle(114, 606, 74, 58, 0x005bb4).setStrokeStyle(3, 0x6ed7ff);
    this.add.rectangle(WIDTH - 114, 606, 74, 58, 0x005bb4).setStrokeStyle(3, 0x6ed7ff);

    this.add.text(WIDTH / 2, 50, "街机修复计划", {
      color: "#07315f",
      fontSize: "26px",
      fontStyle: "700"
    }).setOrigin(0.5);

    this.add.text(WIDTH / 2, 79, "收集零件 · 升级机器 · 解锁图鉴", {
      color: "#0d5fa8",
      fontSize: "14px"
    }).setOrigin(0.5);

    this.matter.add.rectangle(WIDTH / 2, 560, 314, 18, { isStatic: true, label: "front-lip" });
    this.matter.add.rectangle(72, 360, 18, 500, { isStatic: true, label: "left-wall" });
    this.matter.add.rectangle(WIDTH - 72, 360, 18, 500, { isStatic: true, label: "right-wall" });

    const aimZone = this.add.zone(WIDTH / 2, 126, 280, 92);
    aimZone.setInteractive({ useHandCursor: true });
    aimZone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.spawnX = Phaser.Math.Clamp(pointer.x, 135, 295);
      this.dropGuide.setX(this.spawnX);
      this.dropCoin(this.spawnX);
    });
  }

  private createPusher(): void {
    this.pusherVisual = this.add.rectangle(WIDTH / 2, 286, 286, 42, 0xd8e4f2).setStrokeStyle(3, 0x8aa2bd);
    this.add.rectangle(WIDTH / 2, 274, 260, 8, 0xffffff, 0.35);
    this.pusher = this.matter.add.rectangle(WIDTH / 2, 286, 304, 62, {
      isStatic: true,
      label: "pusher",
      friction: 0.18
    });
  }

  private createLuckySensor(): void {
    this.add.text(WIDTH / 2, 190, "机关检索", {
      color: "#07315f",
      fontSize: "13px",
      fontStyle: "700"
    }).setOrigin(0.5);

    this.luckySensor = this.matter.add.image(WIDTH / 2, 220, "lucky-sensor", undefined, {
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
      color: "#07315f",
      fontSize: "15px",
      lineSpacing: 7
    });

    this.tip = this.add.text(WIDTH / 2, 638, "目标：收集 200 Gold，修复第一台街机", {
      color: "#fff7d1",
      fontSize: "14px"
    }).setOrigin(0.5);

    this.buffText = this.add.text(WIDTH - 24, 108, "", {
      color: "#0d5fa8",
      fontSize: "12px",
      align: "right",
      lineSpacing: 5
    }).setOrigin(1, 0);

    this.goalText = this.add.text(WIDTH / 2, 630, "", {
      color: "#fff7d1",
      fontSize: "12px",
      fontStyle: "700"
    }).setOrigin(0.5);
    this.add.rectangle(WIDTH / 2, 650, 304, 12, 0x07315f).setStrokeStyle(1, 0x6ed7ff);
    this.goalBar = this.add.rectangle(64, 650, 0, 8, 0xffd34f).setOrigin(0, 0.5);
  }

  private createControls(): void {
    const button = this.add.circle(76, 704, 38, 0xd8e4f2).setStrokeStyle(5, 0x24354d);
    const buttonGlow = this.add.circle(76, 704, 27, 0xffffff, 0.42);
    const label = this.add.text(76, 704, "投币", {
      color: "#07315f",
      fontSize: "16px",
      fontStyle: "700"
    }).setOrigin(0.5);
    button.setInteractive({ useHandCursor: true });
    label.setInteractive({ useHandCursor: true });

    const drop = () => {
      this.tweens.add({
        targets: [button, buttonGlow, label],
        scale: 0.92,
        duration: 70,
        yoyo: true
      });
      this.dropCoin(this.spawnX);
    };
    button.on("pointerdown", drop);
    label.on("pointerdown", drop);

    const adButton = this.add.rectangle(168, 704, 104, 44, 0x0067cb).setStrokeStyle(2, 0x6ed7ff);
    this.add.text(168, 704, "补给 +30", {
      color: "#d8f7ff",
      fontSize: "14px",
      fontStyle: "700"
    }).setOrigin(0.5);
    adButton.setInteractive({ useHandCursor: true });
    adButton.on("pointerdown", () => {
      this.save.coin = Math.min(80, this.save.coin + 30);
      this.flashTip("模拟激励视频完成：获得 30 Coin");
      this.persist();
    });

    this.createPanelButton(256, 704, "图鉴", () => this.showGalleryPanel());
    this.createPanelButton(318, 704, "任务", () => this.showMissionPanel());
    this.createPanelButton(380, 704, "外观", () => this.showSkinPanel());
  }

  private createPanelButton(x: number, y: number, label: string, callback: () => void): void {
    const button = this.add.rectangle(x, y, 52, 42, 0x005bb4).setStrokeStyle(2, 0x6ed7ff);
    const text = this.add.text(x, y, label, {
      color: "#d8f7ff",
      fontSize: "13px",
      fontStyle: "700"
    }).setOrigin(0.5);
    button.setInteractive({ useHandCursor: true });
    text.setInteractive({ useHandCursor: true });
    button.on("pointerdown", callback);
    text.on("pointerdown", callback);
  }

  private createUpgradePanel(): void {
    upgrades.forEach((upgrade, index) => {
      const y = 674 + index * 28;
      const x = 318;
      const bg = this.add.rectangle(x, y, 196, 23, 0x0067cb).setStrokeStyle(1, 0x6ed7ff);
      const text = this.add.text(x - 90, y, "", {
        color: "#dbe8ff",
        fontSize: "11px"
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

    const x = Phaser.Math.Clamp(spawnX + Phaser.Math.Between(-10, 10), 132, 298);
    const coin = this.matter.add.image(x, 142, `coin-${this.save.activeSkin}`, undefined, {
      shape: { type: "circle", radius: 21 },
      restitution: 0.05,
      friction: 0.14,
      frictionAir: 0.03,
      density: 0.0022,
      slop: 0.02,
      label: "coin"
    });
    coin.setScale(0.68);
    coin.setBounce(0.05);
    coin.setFriction(0.15, 0.03, 0.15);
    coin.setAngularVelocity(Phaser.Math.FloatBetween(-0.08, 0.08));
    this.coins.push(coin);

    if (this.coins.length > MAX_COINS) {
      this.recycleCoin(this.coins.shift());
    }
  }

  private updatePusher(delta: number): void {
    const speed = pusherSpeed(this.save.upgrades.pusher) * delta * 0.055;
    const nextY = this.pusher.position.y + speed * this.pusherDirection;
    if (nextY > 346) this.pusherDirection = -1;
    if (nextY < 266) this.pusherDirection = 1;
    const y = Phaser.Math.Clamp(nextY, 266, 346);
    this.matter.body.setPosition(this.pusher, { x: WIDTH / 2, y });
    this.pusherVisual.setPosition(WIDTH / 2, y);
  }

  private checkDrops(): void {
    for (let i = this.coins.length - 1; i >= 0; i -= 1) {
      const coin = this.coins[i];
      const { x, y } = coin;
      const autoCollectActive = this.save.buffs.autoCollectUntil > Date.now();
      if (y < 596 && !(autoCollectActive && y > 540)) continue;
      let reward = Phaser.Math.Between(1, 3);
      if (x > 138 && x < 292) {
        reward += centerReward(this.save.upgrades.slot);
        increaseMission(this.save, "hitCenter", 1);
        this.flashTip("图鉴槽命中：获得修复材料");
      }
      if (this.save.buffs.goldBoostUntil > Date.now()) {
        reward = Math.ceil(reward * 1.5);
      }
      this.save.gold += reward;
      increaseMission(this.save, "earnGold", reward);
      this.spawnRewardText(x, Math.min(y, 616), `+${reward}`);
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
    this.hud.setText(`Coin ${this.save.coin}/50\nGold ${this.save.gold}\nGem ${this.save.gem}\n碎片 ${this.save.fragments}\n机关 ${this.save.mechanismTriggers}`);
    this.buffText.setText(this.activeBuffLines(now).join("\n"));
    const goal = currentArcadeGoal(this.save);
    this.goalText.setText(this.save.repairedCount >= arcadeGoals.length ? "街机厅修复完成" : `目标：${goal.costGold} Gold 修复《${goal.label}》`);
    const progress = this.save.repairedCount >= arcadeGoals.length ? 1 : Phaser.Math.Clamp(this.save.gold / goal.costGold, 0, 1);
    this.goalBar.width = 304 * progress;
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

  private showGalleryPanel(): void {
    const rows = arcadeGoals.map((goal, index) => {
      const unlocked = this.save.repairedCount > index;
      return `${unlocked ? "已修复" : "待修复"}  ${goal.label}  ${goal.costGold}G`;
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

  private showInfoPanel(title: string, rows: string[], actions: Array<{ label: string; action: () => void }>): void {
    this.panel?.destroy();
    const panel = this.add.container(WIDTH / 2, HEIGHT / 2);
    panel.setDepth(30);
    panel.add(this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x06111f, 0.55));
    panel.add(this.add.rectangle(0, 24, 360, 420, 0x0080ff, 0.98).setStrokeStyle(4, 0xffffff));
    panel.add(this.add.text(0, -154, title, {
      color: "#ffffff",
      fontSize: "24px",
      fontStyle: "700"
    }).setOrigin(0.5));

    rows.slice(0, 8).forEach((row, index) => {
      const y = -104 + index * 34;
      panel.add(this.add.rectangle(0, y, 312, 25, 0x0369a1, 0.8).setStrokeStyle(1, 0x6ed7ff));
      panel.add(this.add.text(-146, y, row, {
        color: "#e0f7ff",
        fontSize: "12px"
      }).setOrigin(0, 0.5));
    });

    actions.slice(0, 4).forEach((item, index) => {
      const x = -117 + index * 78;
      const button = this.add.rectangle(x, 150, 68, 32, 0xffd34f).setStrokeStyle(2, 0xffffff);
      const label = this.add.text(x, 150, item.label, {
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

    const close = this.add.rectangle(0, 198, 120, 32, 0x07315f).setStrokeStyle(2, 0x6ed7ff);
    const closeText = this.add.text(0, 198, "关闭", {
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
    const recoveredCoin = Math.min(50 - this.save.coin, Math.floor(cappedSec / 60));
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
      gravity: { x: 0, y: 1.5 },
      debug: false,
      enableSleeping: true
    }
  },
  scene: [GameScene]
};

new Phaser.Game(config);
