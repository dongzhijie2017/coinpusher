import Phaser from "phaser";

export class ParticleSystem {
  private scene: Phaser.Scene;
  private emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  destroy(): void {
    this.emitters.forEach((e) => e.destroy());
    this.emitters = [];
  }

  private destroyEmitterAfter(emitter: Phaser.GameObjects.Particles.ParticleEmitter, delay: number): void {
    this.emitters.push(emitter);
    this.scene.time.delayedCall(delay, () => {
      emitter.destroy();
      this.emitters = this.emitters.filter((item) => item !== emitter);
    });
  }

  /** 金币收集飘散粒子 */
  spawnCollect(x: number, y: number, color = 0xffd34f, count = 6): void {
    const particles = this.scene.add.particles(x, y, "coin-particle", {
      speed: { min: 40, max: 120 },
      scale: { start: 0.25, end: 0 },
      alpha: { start: 0.9, end: 0 },
      lifespan: { min: 400, max: 700 },
      gravityY: 180,
      angle: { min: -140, max: -40 },
      tint: color,
      quantity: count,
      emitting: false
    });
    particles.explode(count);
    this.destroyEmitterAfter(particles, 900);
  }

  /** 中央槽命中爆发 */
  spawnCenterHit(x: number, y: number): void {
    const colors = [0xffd34f, 0xff6b6b, 0x6ed7ff, 0xffffff];
    colors.forEach((color, i) => {
      const particles = this.scene.add.particles(x, y - i * 8, "coin-particle", {
        speed: { min: 60, max: 160 },
        scale: { start: 0.3 + i * 0.05, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: { min: 500, max: 900 },
        gravityY: 120,
        angle: { min: 200, max: 340 },
        tint: color,
        quantity: 4,
        emitting: false
      });
      particles.explode(4);
      this.destroyEmitterAfter(particles, 1000);
    });
    // 环形冲击波
    const ring = this.scene.add.circle(x, y, 8, 0xffd34f, 0.8).setDepth(20);
    this.scene.tweens.add({
      targets: ring,
      scale: 4,
      alpha: 0,
      duration: 500,
      onComplete: () => ring.destroy()
    });
  }

  /** 投币闪光 */
  spawnCoinSparkle(x: number, y: number): void {
    const star = this.scene.add.star(x, y, 4, 2, 6, 0xfff2a8, 0.9).setDepth(15);
    this.scene.tweens.add({
      targets: star,
      scale: 2,
      alpha: 0,
      angle: 90,
      duration: 350,
      onComplete: () => star.destroy()
    });
  }

  /** 升级光环 */
  spawnUpgradeBurst(x: number, y: number): void {
    const ring = this.scene.add.circle(x, y, 10, 0x7cff8b, 0.7).setDepth(20);
    this.scene.tweens.add({
      targets: ring,
      scale: 6,
      alpha: 0,
      duration: 700,
      ease: "Quad.easeOut",
      onComplete: () => ring.destroy()
    });
    const particles = this.scene.add.particles(x, y, "coin-particle", {
      speed: { min: 50, max: 140 },
      scale: { start: 0.3, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 400, max: 800 },
      gravityY: 80,
      angle: { min: 0, max: 360 },
      tint: 0x7cff8b,
      quantity: 10,
      emitting: false
    });
    particles.explode(10);
    this.destroyEmitterAfter(particles, 900);
  }

  /** 礼盒掉落拖尾 */
  spawnGiftTrail(x: number, y: number, color: number): void {
    const dot = this.scene.add.circle(
      x + Phaser.Math.Between(-16, 16),
      y + Phaser.Math.Between(8, 20),
      Phaser.Math.Between(2, 4),
      color,
      0.75
    ).setDepth(11);
    this.scene.tweens.add({
      targets: dot,
      y: dot.y + Phaser.Math.Between(16, 34),
      alpha: 0,
      scale: 0.2,
      duration: Phaser.Math.Between(260, 460),
      onComplete: () => dot.destroy()
    });
  }

  /** 机关检索小黄鸭闪烁 */
  spawnDuckFlash(x: number, y: number): void {
    const flash = this.scene.add.circle(x, y, 28, 0xffd34f, 0.6).setDepth(10);
    this.scene.tweens.add({
      targets: flash,
      scale: 1.6,
      alpha: 0,
      duration: 400,
      onComplete: () => flash.destroy()
    });
  }

  /** 屏幕边缘微光（环境氛围） */
  spawnAmbientSparkle(): void {
    const x = Phaser.Math.Between(60, 370);
    const y = Phaser.Math.Between(200, 550);
    const dot = this.scene.add.circle(x, y, Phaser.Math.Between(1, 3), 0xfff2a8, 0.4).setDepth(1);
    this.scene.tweens.add({
      targets: dot,
      alpha: { from: 0.4, to: 0 },
      y: y - Phaser.Math.Between(20, 60),
      duration: Phaser.Math.Between(800, 1500),
      onComplete: () => dot.destroy()
    });
  }

  /** 金币飞入 HUD 轨迹 */
  spawnGoldFlyToHud(startX: number, startY: number, hudX: number, hudY: number): void {
    const coin = this.scene.add.image(startX, startY, "coin").setScale(0.3).setDepth(25);
    this.scene.tweens.add({
      targets: coin,
      x: hudX,
      y: hudY,
      scale: 0.1,
      alpha: 0.3,
      duration: 600,
      ease: "Cubic.easeIn",
      onComplete: () => coin.destroy()
    });
  }

  /** 创建粒子纹理（应在场景创建时调用） */
  static createTextures(scene: Phaser.Scene): void {
    const g = scene.add.graphics();
    // 通用圆形粒子
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture("coin-particle", 8, 8);
    g.destroy();
  }
}
