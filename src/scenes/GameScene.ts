import Phaser from 'phaser';
import { FX, GHOST, PLAYER, WORLD } from '../config/balance';
import { Boitata, type BossHost, type HitCircle } from '../entities/Boitata';
import { Ghost } from '../entities/Ghost';
import { Player } from '../entities/Player';
import { sfx } from '../systems/audio';
import { Controls } from '../systems/controls';
import { damageNumber, hitFlash, screenFlash, shake } from '../systems/fx';
import { CSS, FONT_UI, PAL } from '../style/palette';

export type GameState = 'playing' | 'dead' | 'won' | 'transition';

export type RunStats = { timeMs: number; deaths: number; flasksUsed: number };

type Block = { x: number; y: number; w: number; h: number };

/** Plataformas e blocos de ruína (x, y = canto superior esquerdo). */
const BLOCKS: Block[] = [
  { x: 360, y: 576, w: 128, h: 64 },
  { x: 560, y: 488, w: 192, h: 32 },
  { x: 860, y: 404, w: 160, h: 32 },
  { x: 1200, y: 544, w: 96, h: 96 },
  { x: 1400, y: 456, w: 224, h: 32 },
  { x: 1860, y: 528, w: 64, h: 112 },
  { x: 2000, y: 440, w: 192, h: 32 },
  { x: 2290, y: 576, w: 128, h: 64 },
  { x: 2840, y: 500, w: 128, h: 24 },
  { x: 3620, y: 500, w: 128, h: 24 },
];

export class GameScene extends Phaser.Scene implements BossHost {
  state: GameState = 'playing';
  player!: Player;
  boss!: Boitata;
  ghosts: Ghost[] = [];
  checkpointLit = false;
  bossBarVisible = false;
  bossDefeated = false;
  deaths = 0;

  private controls!: Controls;
  private solids: Phaser.GameObjects.Zone[] = [];
  private barrier!: Phaser.GameObjects.Zone;
  private barrierFx!: Phaser.GameObjects.TileSprite;
  private barrierLight!: Phaser.GameObjects.Image;
  private barrierEmbers!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparksFx!: Phaser.GameObjects.Particles.ParticleEmitter;
  private chipsFx!: Phaser.GameObjects.Particles.ParticleEmitter;
  private fireEmbers!: Phaser.GameObjects.Particles.ParticleEmitter;
  private fireSmoke!: Phaser.GameObjects.Particles.ParticleEmitter;
  private flame!: Phaser.GameObjects.Image;
  private fireLight!: Phaser.GameObjects.Image;
  private prompt!: Phaser.GameObjects.Text;
  private parallax: Array<{ ts: Phaser.GameObjects.TileSprite; f: number; drift: number }> = [];
  private hitstop = 0;
  private startTime = 0;
  private endTime = 0;

  constructor() {
    super('Game');
  }

  create(): void {
    this.state = 'playing';
    this.ghosts = [];
    this.solids = [];
    this.parallax = [];
    this.checkpointLit = false;
    this.bossBarVisible = false;
    this.bossDefeated = false;
    this.deaths = 0;
    this.hitstop = 0;
    this.startTime = this.time.now;

    this.physics.world.setBounds(0, 0, WORLD.width, WORLD.height);
    this.physics.world.gravity.y = WORLD.gravity;
    this.controls = new Controls(this);

    this.buildBackdrop();
    this.buildLevel();
    this.buildCheckpoint();
    this.buildBarrier();
    this.buildFx();

    this.player = new Player(this, WORLD.playerStartX, WORLD.groundY - 2);
    this.player.onInteract = () => this.interactCheckpoint();
    this.player.onHealed = () => this.chipsFx.explode(8, this.player.x, this.player.y - 40);
    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(this.player, this.barrier);

    for (const s of GHOST.spawns) this.ghosts.push(new Ghost(this, s));
    this.boss = new Boitata(this, this);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD.width, WORLD.height);
    cam.startFollow(this.player, true, 0.12, 0.12, 0, 60);
    cam.setRoundPixels(true);
    if (this.game.renderer.type === Phaser.WEBGL) {
      cam.postFX.addVignette(0.5, 0.5, 0.88, 0.5);
    }
    cam.fadeIn(250, 0, 0, 0);

    this.scene.launch('UI');
  }

  // ------------------------------------------------------------ construção

  private buildBackdrop(): void {
    this.add.image(0, 0, 'sky').setOrigin(0).setScrollFactor(0).setDepth(0);
    this.add.image(1000, 130, 'moon').setScrollFactor(0.02, 0).setDepth(1).setAlpha(0.6);
    const layer = (
      key: string,
      y: number,
      h: number,
      depth: number,
      f: number,
      drift: number,
      tint?: number,
      alpha = 1,
    ): void => {
      const ts = this.add
        .tileSprite(0, y, 1280, h, key)
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(depth)
        .setAlpha(alpha);
      if (tint !== undefined) ts.setTint(tint);
      this.parallax.push({ ts, f, drift });
    };
    layer('hills', 380, 300, 2, 0.15, 0);
    layer('fog', 330, 200, 3, 0.25, 0.05, PAL.espectro, 0.22);
    layer('farruins', 300, 380, 4, 0.4, 0);
    layer('fog', 430, 200, 5, 0.6, 0.12, PAL.ardosia, 0.3);
    layer('fore', 500, 220, 60, 1.2, 0, undefined, 0.9);
    layer('fog', 520, 200, 61, 1.1, 0.25, PAL.espectro, 0.16);
  }

  private addSolid(x: number, y: number, w: number, h: number): void {
    const z = this.add.zone(x + w / 2, y + h / 2, w, h);
    this.physics.add.existing(z, true);
    this.solids.push(z);
  }

  private buildLevel(): void {
    // decoração de fundo (sem colisão)
    const deco: Array<[string, number, number]> = [
      ['column', 250, 1],
      ['arch', 980, 1],
      ['column', 1700, 0.9],
      ['column', 2120, 1.1],
      ['arch', 2560, 1.15],
      ['column', 2960, 1],
      ['column', 3560, 0.95],
    ];
    for (const [key, x, s] of deco) {
      this.add
        .image(x, WORLD.groundY, key)
        .setOrigin(0.5, 1)
        .setScale(s)
        .setDepth(10)
        .setTint(PAL.ossoSombra);
    }

    this.add.tileSprite(0, WORLD.groundY, WORLD.width, 80, 'ground').setOrigin(0).setDepth(20);
    this.addSolid(0, WORLD.groundY, WORLD.width, 80);

    BLOCKS.forEach((b, i) => {
      this.add
        .tileSprite(b.x, b.y, b.w, b.h, `block${i % 4}`)
        .setOrigin(0)
        .setDepth(20);
      this.addSolid(b.x, b.y, b.w, b.h);
      for (let x = b.x + 10; x < b.x + b.w - 10; x += 36) this.addGrass(x, b.y + 2);
    });

    for (let x = 20; x < WORLD.width; x += 44) {
      this.addGrass(x + ((x * 7) % 17), WORLD.groundY + 2);
    }
  }

  private addGrass(x: number, y: number): void {
    const g = this.add.image(x, y, 'grass').setOrigin(0.5, 1).setDepth(22);
    this.tweens.add({
      targets: g,
      angle: { from: -3, to: 3 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: (x * 13) % 2000,
    });
  }

  private buildCheckpoint(): void {
    const x = WORLD.checkpointX;
    const y = WORLD.groundY;
    this.add
      .image(x, y + 2, 'coal')
      .setOrigin(0.5, 1)
      .setDepth(24);
    this.flame = this.add
      .image(x, y - 4, 'flame')
      .setOrigin(0.5, 1)
      .setDepth(25)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.2, 0)
      .setVisible(false);
    this.add
      .image(x, y + 4, 'fogao')
      .setOrigin(0.5, 1)
      .setDepth(26);
    this.fireLight = this.add
      .image(x, y - 24, 'light')
      .setTint(PAL.chama)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(1.5)
      .setAlpha(0.08)
      .setDepth(27);
    this.fireEmbers = this.add.particles(x, y - 10, 'px', {
      x: { min: -14, max: 14 },
      speedY: { min: -60, max: -20 },
      speedX: { min: -20, max: 20 },
      lifespan: { min: 600, max: 1000 },
      scale: { start: 1, end: 0 },
      tint: [PAL.brasa, PAL.chama],
      blendMode: Phaser.BlendModes.ADD,
      gravityY: -60,
      frequency: 45,
      maxAliveParticles: 24,
      emitting: false,
    });
    this.fireEmbers.setDepth(28);
    this.fireSmoke = this.add.particles(x, y - 30, 'smoke', {
      x: { min: -8, max: 8 },
      speedY: { min: -40, max: -20 },
      lifespan: 2000,
      scale: { start: 0.6, end: 2 },
      alpha: { start: 0.3, end: 0 },
      tint: PAL.ardosia,
      frequency: 500,
      maxAliveParticles: 6,
    });
    this.fireSmoke.setDepth(23);
    this.prompt = this.add
      .text(x, y - 120, '', {
        fontFamily: FONT_UI,
        fontSize: '20px',
        color: CSS.chama,
        stroke: CSS.noite,
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(70)
      .setVisible(false);
    this.tweens.add({
      targets: this.prompt,
      y: y - 126,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private buildBarrier(): void {
    const x = WORLD.bossDoorX;
    this.barrier = this.add.zone(x, WORLD.groundY / 2, 40, WORLD.groundY);
    this.physics.add.existing(this.barrier, true);
    (this.barrier.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    this.barrierFx = this.add
      .tileSprite(x - 32, 0, 64, WORLD.groundY, 'firewall')
      .setOrigin(0)
      .setDepth(50)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    this.barrierLight = this.add
      .image(x, WORLD.groundY - 120, 'light')
      .setTint(PAL.brasa)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(1.2, 2.4)
      .setAlpha(0)
      .setDepth(49);
    this.barrierEmbers = this.add.particles(x, 0, 'px', {
      emitZone: {
        type: 'random',
        source: new Phaser.Geom.Rectangle(-24, 120, 48, WORLD.groundY - 120),
        quantity: 1,
      } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      speedY: { min: -120, max: -50 },
      speedX: { min: -30, max: 30 },
      lifespan: { min: 500, max: 900 },
      scale: { start: 1.2, end: 0 },
      tint: [PAL.brasa, PAL.chama],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 30,
      maxAliveParticles: 50,
      emitting: false,
    });
    this.barrierEmbers.setDepth(51);
  }

  private buildFx(): void {
    this.sparksFx = this.add.particles(0, 0, 'px', {
      speed: { min: 120, max: 260 },
      lifespan: { min: 250, max: 450 },
      scale: { start: 1, end: 0 },
      tint: [PAL.chama, PAL.brasa],
      blendMode: Phaser.BlendModes.ADD,
      maxAliveParticles: 90,
      emitting: false,
    });
    this.sparksFx.setDepth(55);
    this.chipsFx = this.add.particles(0, 0, 'px', {
      speed: { min: 80, max: 200 },
      angle: { min: 200, max: 340 },
      lifespan: { min: 300, max: 450 },
      scale: { start: 0.8, end: 0.2 },
      tint: PAL.osso,
      gravityY: 700,
      maxAliveParticles: 40,
      emitting: false,
    });
    this.chipsFx.setDepth(55);
  }

  // ------------------------------------------------------------ BossHost

  shake(strong: boolean): void {
    shake(this, strong);
  }

  sparks(x: number, y: number, n: number): void {
    this.sparksFx.explode(n, x, y);
  }

  flash(color: number, alpha: number): void {
    screenFlash(this, color, alpha);
  }

  onBossDefeated(): void {
    if (this.bossDefeated) return;
    this.bossDefeated = true;
    this.bossBarVisible = false;
    this.state = 'won';
    this.endTime = this.time.now;
    this.player.freeze(0);
    this.openArena();
    sfx.victory();
    this.time.delayedCall(1200, () => this.events.emit('show-victory'));
  }

  // ------------------------------------------------------------ fluxo

  get stats(): RunStats {
    const end = this.state === 'won' ? this.endTime : this.time.now;
    return {
      timeMs: end - this.startTime,
      deaths: this.deaths,
      flasksUsed: this.player.flasksUsed,
    };
  }

  private interactCheckpoint(): void {
    const first = !this.checkpointLit;
    this.checkpointLit = true;
    this.player.restoreAll();
    this.player.freeze(500);
    // Só descansar (não o primeiro acendimento) faz as almas renascerem.
    if (!first) for (const g of this.ghosts) g.resetAwayFrom(this.player.x);
    if (first) {
      sfx.ignite();
      this.flame.setVisible(true).setScale(0.2, 0);
      this.tweens.add({
        targets: this.flame,
        scaleX: 1,
        scaleY: 1,
        duration: 500,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: this.flame,
            scaleY: { from: 0.9, to: 1.15 },
            duration: 260,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        },
      });
      this.tweens.add({ targets: this.fireLight, alpha: 0.7, duration: 600 });
      this.tweens.add({
        targets: this.fireLight,
        scale: { from: 1.42, to: 1.58 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        delay: 600,
      });
      this.time.addEvent({
        delay: 120,
        loop: true,
        callback: () => this.fireLight.setAlpha(Phaser.Math.FloatBetween(0.5, 0.8)),
        startAt: 0,
      });
      this.fireEmbers.start();
      this.fireSmoke.frequency = 300;
      this.sparksFx.explode(14, WORLD.checkpointX, WORLD.groundY - 20);
      this.shake(false);
      this.events.emit('toast', 'FOGÃO ACESO');
    } else {
      sfx.heal();
      this.events.emit('toast', 'VOCÊ DESCANSA');
    }
  }

  private closeArena(): void {
    (this.barrier.body as Phaser.Physics.Arcade.StaticBody).enable = true;
    this.barrierFx.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.barrierFx, alpha: 0.95, duration: 300 });
    this.tweens.add({ targets: this.barrierLight, alpha: 0.55, duration: 300 });
    this.barrierEmbers.start();
    sfx.fire();
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.pan(WORLD.bossDoorX - 160 + 640, 360, 600, 'Sine.easeInOut', false, (_c, p) => {
      if (p >= 1) {
        cam.setBounds(WORLD.bossDoorX - 160, 0, 1280, WORLD.height);
        cam.startFollow(this.player, true, 0.12, 0.12, 0, 60);
      }
    });
    this.time.delayedCall(450, () => {
      if (this.state !== 'playing') return;
      this.boss.start();
      this.bossBarVisible = true;
    });
  }

  private openArena(): void {
    (this.barrier.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    this.tweens.killTweensOf([this.barrierFx, this.barrierLight]);
    this.tweens.add({
      targets: [this.barrierFx, this.barrierLight],
      alpha: 0,
      duration: 400,
      onComplete: () => this.barrierFx.setVisible(false),
    });
    this.barrierEmbers.stop();
  }

  private resetWorld(): void {
    for (const g of this.ghosts) g.resetAwayFrom(this.player.x);
    this.boss.reset();
    this.bossBarVisible = false;
    this.openArena();
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD.width, WORLD.height);
    cam.startFollow(this.player, true, 0.12, 0.12, 0, 60);
  }

  /** Chamado pela UI (Espaço na tela de queda ou tempo esgotado). */
  respawn(): void {
    if (this.state !== 'dead') return;
    this.state = 'transition';
    const cam = this.cameras.main;
    cam.fadeOut(250, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const x = this.checkpointLit ? WORLD.checkpointX + 40 : WORLD.playerStartX;
      this.player.respawn(x, WORLD.groundY - 2);
      this.resetWorld();
      cam.centerOn(x, 360);
      this.state = 'playing';
      this.events.emit('respawned');
      cam.fadeIn(250, 0, 0, 0);
    });
  }

  /** Reinicia a run inteira (R). */
  restartRun(): void {
    if (this.state === 'transition') return;
    this.state = 'transition';
    const cam = this.cameras.main;
    cam.fadeOut(250, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart());
  }

  private onPlayerDied(): void {
    this.state = 'dead';
    this.deaths++;
    sfx.death();
    this.shake(true);
    this.chipsFx.explode(12, this.player.x, this.player.y - 30);
    this.time.delayedCall(FX.deathOverlayDelay, () => {
      if (this.state === 'dead') this.events.emit('show-death');
    });
  }

  // ------------------------------------------------------------ debug

  debugWin(): void {
    if (this.state !== 'playing') return;
    if (this.boss.active) this.boss.forceKill();
    else this.onBossDefeated();
  }

  debugDie(): void {
    if (this.state !== 'playing') return;
    this.player.kill();
  }

  debugTeleport(): void {
    if (this.state !== 'playing') return;
    if (this.boss.active) this.resetWorld();
    this.player.respawn(WORLD.debugTeleportX, WORLD.groundY - 2);
    this.cameras.main.centerOn(WORLD.debugTeleportX, 360);
  }

  // ------------------------------------------------------------ loop

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50);
    this.updateParallax();
    this.barrierFx.tilePositionY += 2;

    if (this.hitstop > 0) {
      this.hitstop -= delta;
      if (this.hitstop <= 0) this.physics.world.resume();
      return;
    }

    if (this.state === 'playing') this.controls.update();
    else this.controls.clear();

    const p = this.player;
    const near =
      this.state === 'playing' &&
      Math.abs(p.x - WORLD.checkpointX) < PLAYER.interactRange &&
      p.onGround;
    p.nearInteract = near;
    this.prompt
      .setVisible(near && p.state === 'move')
      .setText(this.checkpointLit ? 'Z · descansar' : 'Z · acender o fogão');

    p.update(dt, this.controls);
    for (const g of this.ghosts) g.updateGhost(dt, p);
    this.boss.update(dt, p);

    if (this.state === 'playing') {
      this.resolveCombat();
      if (p.isDead) this.onPlayerDied();
      else if (!this.bossDefeated && this.boss.state === 'dormant' && p.x > WORLD.arenaTriggerX) {
        this.closeArena();
      }
    }
  }

  private updateParallax(): void {
    const sx = this.cameras.main.scrollX;
    for (const l of this.parallax) {
      l.ts.setData('drift', ((l.ts.getData('drift') as number | undefined) ?? 0) + l.drift);
      l.ts.tilePositionX = sx * l.f + (l.ts.getData('drift') as number);
    }
  }

  private doHitstop(ms: number): void {
    this.hitstop = ms;
    this.physics.world.pause();
  }

  private resolveCombat(): void {
    const p = this.player;
    const pr = p.bodyRect();

    // golpes do jogador
    if (p.attackActive) {
      const hb = p.attackHitbox();
      for (const g of this.ghosts) {
        if (!g.alive || p.hasHit(g)) continue;
        if (Phaser.Geom.Intersects.RectangleToRectangle(hb, g.rect())) {
          p.markHit(g);
          const died = g.hurt(p.attackDamage, p.x, p.isHeavyHit);
          hitFlash(this, [g]);
          this.hitFx(g.x, g.y, p.isHeavyHit || died);
        }
      }
      if (this.boss.vulnerable && !p.hasHit(this.boss)) {
        const hit = this.boss
          .hurtCircles()
          .find((c) => Phaser.Geom.Intersects.CircleToRectangle(this.circle(c), hb));
        if (hit) {
          p.markHit(this.boss);
          const dmg = this.boss.takeDamage(p.attackDamage);
          if (dmg > 0) {
            this.hitFx(hit.x, hit.y, p.isHeavyHit);
            damageNumber(this, hit.x, hit.y - hit.r, dmg, CSS.chama, FONT_UI);
          }
        }
      }
    }

    // ataques que acertam o jogador
    for (const g of this.ghosts) {
      if (g.isAttacking && Phaser.Geom.Intersects.RectangleToRectangle(g.rect(), pr)) {
        this.hurtPlayer(GHOST.damage, g.x);
      }
    }
    for (const c of this.boss.contactCircles()) {
      if (Phaser.Geom.Intersects.CircleToRectangle(this.circle(c), pr)) {
        this.hurtPlayer(c.damage, c.x);
        break;
      }
    }
    for (const f of this.boss.fireballCircles()) {
      if (Phaser.Geom.Intersects.CircleToRectangle(this.circle(f), pr)) {
        if (this.hurtPlayer(f.damage, f.x)) this.boss.popFireball(f.index);
      }
    }
  }

  private circle(c: HitCircle): Phaser.Geom.Circle {
    return new Phaser.Geom.Circle(c.x, c.y, c.r);
  }

  private hitFx(x: number, y: number, heavy: boolean): void {
    sfx.hit();
    this.sparksFx.explode(10, x, y);
    this.chipsFx.explode(4, x, y);
    shake(this, false);
    this.doHitstop(heavy ? FX.hitstopHeavyMs : FX.hitstopMs);
  }

  private hurtPlayer(dmg: number, fromX: number): boolean {
    const p = this.player;
    if (!p.takeDamage(dmg, fromX)) return false;
    sfx.hurt();
    hitFlash(this, [p]);
    shake(this, true);
    screenFlash(this, PAL.perigo, 0.3);
    this.chipsFx.explode(6, p.x, p.y - 30);
    return true;
  }
}
