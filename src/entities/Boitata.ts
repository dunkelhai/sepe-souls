import Phaser from 'phaser';
import { BOSS, WORLD } from '../config/balance';
import { PAL } from '../style/palette';
import { sfx } from '../systems/audio';
import type { Player } from './Player';

export type BossState =
  | 'dormant'
  | 'intro'
  | 'idle'
  | 'chargePrep'
  | 'chargeTele'
  | 'charge'
  | 'spitPrep'
  | 'spitTele'
  | 'spit'
  | 'divePrep'
  | 'diveDown'
  | 'diveWarn'
  | 'erupt'
  | 'recover'
  | 'enrage'
  | 'dying'
  | 'dead';

type Attack = 'charge' | 'spit' | 'dive';

/** Ganchos que a cena fornece ao boss (efeitos e eventos). */
export interface BossHost {
  shake(strong: boolean): void;
  sparks(x: number, y: number, n: number): void;
  flash(color: number, alpha: number): void;
  onBossDefeated(): void;
}

type Fireball = {
  img: Phaser.GameObjects.Image;
  light: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  on: boolean;
};

export type HitCircle = { x: number; y: number; r: number; damage: number };

const MID = (WORLD.arenaLeft + WORLD.arenaRight) / 2;

/** Boitatá: serpente de fogo de 16 segmentos, 2 fases e 3 ataques telegrafados. */
export class Boitata {
  hp: number = BOSS.hp;
  phase = 0;
  state: BossState = 'dormant';
  readonly head: Phaser.GameObjects.Image;
  private segs: Phaser.GameObjects.Image[] = [];
  private radii: number[] = [];
  private light: Phaser.GameObjects.Image;
  private trail: Phaser.GameObjects.Particles.ParticleEmitter;
  private warn: Phaser.GameObjects.Image;
  private chargeLine: Phaser.GameObjects.Image;
  private glow: Phaser.FX.Glow | null = null;
  private fireballs: Fireball[] = [];
  private t = 0;
  private life = 0;
  private hx = 3300;
  private hy = 860;
  private facing = -1;
  private lastAttack: Attack | null = null;
  private chargeDir = 1;
  private spitFired = 0;
  private spitTimer = 0;
  private eruptionsLeft = 0;
  private warnX = 0;
  private warnTick = 0;
  private dyingIndex = 0;
  private idleTx: number | null = null;

  constructor(
    private scene: Phaser.Scene,
    private host: BossHost,
  ) {
    for (let i = 0; i < BOSS.segments; i++) {
      const r = BOSS.headRadius - ((BOSS.headRadius - BOSS.tailRadius) * i) / (BOSS.segments - 1);
      this.radii.push(r);
      const s = scene.add
        .image(this.hx, this.hy, 'bt_seg')
        .setScale(r / 40)
        .setDepth(15 + (BOSS.segments - i) * 0.01);
      this.segs.push(s);
    }
    this.head = scene.add.image(this.hx, this.hy, 'bt_head').setDepth(16);
    if (scene.game.renderer.type === Phaser.WEBGL && this.head.postFX) {
      this.glow = this.head.postFX.addGlow(PAL.brasa, 4, 0);
    }
    this.light = scene.add
      .image(this.hx, this.hy, 'light')
      .setTint(PAL.brasa)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.6)
      .setScale(1.6)
      .setDepth(17);
    this.trail = scene.add.particles(0, 0, 'px', {
      speed: { min: 20, max: 70 },
      lifespan: { min: 450, max: 800 },
      scale: { start: 1.6, end: 0 },
      tint: [PAL.brasa, PAL.chama],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 40,
      maxAliveParticles: 40,
      gravityY: -80,
      emitting: false,
    });
    this.trail.setDepth(18);
    this.trail.startFollow(this.head);
    this.warn = scene.add
      .image(0, WORLD.groundY, 'light')
      .setTint(PAL.perigo)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.9, 0.35)
      .setDepth(45)
      .setVisible(false);
    this.chargeLine = scene.add
      .image(MID, WORLD.groundY - 2, 'px')
      .setTint(PAL.perigo)
      .setDisplaySize(WORLD.arenaRight - WORLD.arenaLeft, 6)
      .setDepth(45)
      .setAlpha(0)
      .setVisible(false);
    for (let i = 0; i < 8; i++) {
      const img = scene.add.image(0, 0, 'fireball').setDepth(40).setVisible(false);
      const light = scene.add
        .image(0, 0, 'light')
        .setTint(PAL.brasa)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.35)
        .setAlpha(0.7)
        .setDepth(39)
        .setVisible(false);
      this.fireballs.push({ img, light, vx: 0, vy: 0, on: false });
    }
    this.reset();
  }

  get active(): boolean {
    return this.state !== 'dormant' && this.state !== 'dead';
  }

  get vulnerable(): boolean {
    const off: BossState[] = ['dormant', 'intro', 'enrage', 'dying', 'dead', 'diveWarn'];
    return !off.includes(this.state) && this.hy < WORLD.groundY + 20;
  }

  get hpRatio(): number {
    return this.hp / BOSS.hp;
  }

  private get m(): number {
    return BOSS.speedMul[this.phase];
  }

  /** Círculos que recebem golpes do jogador. */
  hurtCircles(): HitCircle[] {
    const out: HitCircle[] = [{ x: this.hx, y: this.hy, r: BOSS.headRadius * 0.95, damage: 0 }];
    for (let i = 0; i < BOSS.hitSegments; i++) {
      const s = this.segs[i];
      out.push({ x: s.x, y: s.y, r: this.radii[i], damage: 0 });
    }
    return out;
  }

  /** Círculos que causam dano por contato no estado atual. */
  contactCircles(): HitCircle[] {
    if (this.state === 'charge') {
      const out: HitCircle[] = [
        { x: this.hx, y: this.hy, r: BOSS.headRadius * 0.8, damage: BOSS.chargeDamage },
      ];
      for (let i = 0; i < 3; i++) {
        const s = this.segs[i];
        out.push({ x: s.x, y: s.y, r: this.radii[i] * 0.7, damage: BOSS.chargeDamage });
      }
      return out;
    }
    if (this.state === 'erupt' || this.state === 'diveDown') {
      return [{ x: this.hx, y: this.hy, r: BOSS.headRadius * 0.85, damage: BOSS.eruptDamage }];
    }
    return [];
  }

  /** Bolas de fogo ativas (círculos de dano). Chame `popFireball` ao acertar. */
  fireballCircles(): Array<HitCircle & { index: number }> {
    const out: Array<HitCircle & { index: number }> = [];
    this.fireballs.forEach((f, index) => {
      if (f.on) out.push({ x: f.img.x, y: f.img.y, r: 11, damage: BOSS.fireballDamage, index });
    });
    return out;
  }

  popFireball(index: number): void {
    const f = this.fireballs[index];
    this.host.sparks(f.img.x, f.img.y, 8);
    this.hideFireball(f);
  }

  start(): void {
    this.reset();
    this.setVisible(true);
    this.hx = MID + 140;
    this.hy = 860;
    this.layoutSegments(true);
    this.setState('intro');
    this.trail.start();
    sfx.roar();
    this.host.shake(true);
  }

  reset(): void {
    this.hp = BOSS.hp;
    this.phase = 0;
    this.state = 'dormant';
    this.t = 0;
    this.lastAttack = null;
    this.head.setTexture('bt_head').setAngle(0).clearTint();
    for (const s of this.segs) s.setTexture('bt_seg').clearTint().setVisible(true);
    if (this.glow) {
      this.glow.color = PAL.brasa;
      this.glow.outerStrength = 4;
    }
    this.trail.stop();
    this.trail.frequency = 40;
    this.warn.setVisible(false);
    this.chargeLine.setVisible(false);
    for (const f of this.fireballs) this.hideFireball(f);
    this.hx = MID;
    this.hy = 900;
    this.layoutSegments(true);
    this.setVisible(false);
  }

  private setVisible(v: boolean): void {
    this.head.setVisible(v);
    this.light.setVisible(v);
    for (const s of this.segs) s.setVisible(v);
  }

  private setState(s: BossState): void {
    this.state = s;
    this.t = 0;
    this.idleTx = null;
  }

  /** Retorna o dano efetivo aplicado (0 se invulnerável). */
  takeDamage(dmg: number): number {
    if (!this.vulnerable) return 0;
    this.hp = Math.max(0, this.hp - dmg);
    const restore = (): void => this.applyTint();
    this.head.setTintFill(0xffffff);
    for (const s of this.segs) s.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, restore);
    if (this.hp <= 0) {
      this.startDying();
    } else if (this.phase === 0 && this.hpRatio <= BOSS.phase2At) {
      this.enterPhase2();
    }
    return dmg;
  }

  private applyTint(): void {
    this.head.clearTint();
    for (const s of this.segs) s.clearTint();
  }

  private enterPhase2(): void {
    this.phase = 1;
    this.setState('enrage');
    this.head.setTexture('bt_head2');
    for (const s of this.segs) s.setTexture('bt_seg2');
    if (this.glow) {
      this.glow.color = PAL.chama;
      this.glow.outerStrength = 6;
    }
    this.light.setTint(PAL.chama);
    this.trail.frequency = 22;
    this.chargeLine.setVisible(false);
    this.warn.setVisible(false);
    sfx.roar();
    this.host.shake(true);
    this.host.flash(PAL.brasa, 0.35);
  }

  private startDying(): void {
    this.setState('dying');
    this.dyingIndex = BOSS.segments - 1;
    this.warn.setVisible(false);
    this.chargeLine.setVisible(false);
    for (const f of this.fireballs) this.hideFireball(f);
    sfx.roar();
  }

  /** Mata o boss imediatamente (atalho de debug). */
  forceKill(): void {
    if (!this.active) return;
    this.hp = 0;
    this.startDying();
  }

  private moveTo(tx: number, ty: number, speed: number, dt: number): boolean {
    const dx = tx - this.hx;
    const dy = ty - this.hy;
    const d = Math.hypot(dx, dy);
    const step = (speed * dt) / 1000;
    if (d <= step || d < 1) {
      this.hx = tx;
      this.hy = ty;
      return true;
    }
    this.hx += (dx / d) * step;
    this.hy += (dy / d) * step;
    return false;
  }

  private telegraphFlash(dur: number): void {
    const on = Math.floor(this.t / (dur / 6)) % 2 === 0;
    if (on) this.head.setTint(PAL.perigo);
    else this.head.clearTint();
  }

  private chooseAttack(player: Player): void {
    const all: Attack[] = ['charge', 'spit', 'dive'];
    let options = all.filter((a) => a !== this.lastAttack);
    const dist = Math.abs(player.x - this.hx);
    if (dist > 420 && Math.random() < 0.5) options = options.filter((a) => a !== 'dive');
    const pick = options[Math.floor(Math.random() * options.length)];
    this.lastAttack = pick;
    if (pick === 'charge') this.setState('chargePrep');
    else if (pick === 'spit') this.setState('spitPrep');
    else this.setState('divePrep');
  }

  update(dt: number, player: Player): void {
    this.updateFireballs(dt);
    if (this.state === 'dormant' || this.state === 'dead') return;
    this.t += dt;
    this.life += dt;
    const tele = BOSS.telegraphMs[this.phase];

    switch (this.state) {
      case 'intro': {
        const k = Math.min(1, this.t / BOSS.introMs);
        this.hy = 860 - (860 - 400) * Phaser.Math.Easing.Cubic.Out(k);
        this.head.setAngle(-90 * (1 - k));
        if (k >= 1) this.setState('idle');
        break;
      }
      case 'idle': {
        this.facing = player.x < this.hx ? -1 : 1;
        if (this.idleTx === null) {
          const side = this.hx < player.x ? -1 : 1;
          this.idleTx = Phaser.Math.Clamp(
            player.x + side * BOSS.idleDistance,
            WORLD.arenaLeft + 80,
            WORLD.arenaRight - 80,
          );
        }
        const tx = this.idleTx;
        const ty = BOSS.idleY + Math.sin(this.life / 300) * 8;
        this.moveTo(tx, ty, BOSS.moveSpeed * this.m, dt);
        this.head.setAngle(Math.sin(this.life / 400) * 6);
        if (this.t >= BOSS.idleMs[this.phase]) this.chooseAttack(player);
        break;
      }
      case 'chargePrep': {
        const tx = player.x > MID ? WORLD.arenaLeft + 90 : WORLD.arenaRight - 90;
        const ty = Math.abs(this.hx - tx) > 24 ? 360 : BOSS.chargeY;
        this.facing = tx < MID ? 1 : -1;
        const done = this.moveTo(tx, ty, 560 * this.m, dt);
        this.head.setAngle(0);
        if ((done && ty === BOSS.chargeY) || this.t > BOSS.chargePrepMs * 1.6) {
          this.hx = tx;
          this.hy = BOSS.chargeY;
          this.chargeDir = tx < MID ? 1 : -1;
          this.setState('chargeTele');
          this.chargeLine.setVisible(true);
        }
        break;
      }
      case 'chargeTele':
        this.telegraphFlash(tele);
        this.hx -= (this.chargeDir * 30 * dt) / 1000;
        this.chargeLine.setAlpha(0.25 + 0.35 * Math.abs(Math.sin(this.t / 60)));
        if (this.t >= tele) {
          this.head.clearTint();
          this.chargeLine.setVisible(false);
          this.setState('charge');
          sfx.fire();
          this.host.shake(false);
        }
        break;
      case 'charge': {
        this.hx += (this.chargeDir * BOSS.chargeSpeed * this.m * dt) / 1000;
        this.hy = BOSS.chargeY + Math.sin(this.t / 50) * 4;
        const end = this.chargeDir > 0 ? WORLD.arenaRight - 90 : WORLD.arenaLeft + 90;
        if ((this.chargeDir > 0 && this.hx >= end) || (this.chargeDir < 0 && this.hx <= end)) {
          this.hx = end;
          this.host.shake(true);
          this.setState('recover');
        }
        break;
      }
      case 'spitPrep': {
        const tx = Phaser.Math.Clamp(
          player.x + (player.x > MID ? -320 : 320),
          WORLD.arenaLeft + 100,
          WORLD.arenaRight - 100,
        );
        this.facing = player.x < this.hx ? -1 : 1;
        const done = this.moveTo(tx, BOSS.spitY, 460 * this.m, dt);
        if (done || this.t > 900) this.setState('spitTele');
        break;
      }
      case 'spitTele':
        this.facing = player.x < this.hx ? -1 : 1;
        this.telegraphFlash(tele);
        if (this.t >= tele) {
          this.head.clearTint();
          this.spitFired = 0;
          this.spitTimer = 0;
          this.setState('spit');
        }
        break;
      case 'spit': {
        this.facing = player.x < this.hx ? -1 : 1;
        const n = BOSS.spitCount[this.phase];
        this.spitTimer -= dt;
        if (this.spitFired < n && this.spitTimer <= 0) {
          const off = (this.spitFired - (n - 1) / 2) * BOSS.spitSpread;
          this.fireAt(player.x + off);
          this.spitFired++;
          this.spitTimer = BOSS.spitInterval[this.phase];
        }
        this.hy = BOSS.spitY + Math.sin(this.t / 80) * 6;
        if (this.spitFired >= n && this.spitTimer <= -300) this.setState('recover');
        break;
      }
      case 'divePrep':
        this.moveTo(this.hx, BOSS.diveRiseY, 420 * this.m, dt);
        this.head.setAngle(-30 * this.facing);
        if (this.t >= 520) {
          this.eruptionsLeft = BOSS.eruptions[this.phase];
          this.setState('diveDown');
          sfx.fire();
        }
        break;
      case 'diveDown':
        this.head.setAngle(90).setFlipX(false);
        this.hy += (BOSS.diveSpeed * this.m * dt) / 1000;
        if (this.hy >= 1200) {
          this.warnX = Phaser.Math.Clamp(player.x, WORLD.arenaLeft + 60, WORLD.arenaRight - 60);
          this.hx = this.warnX;
          this.hy = 1200;
          this.warn.setPosition(this.warnX, WORLD.groundY).setVisible(true);
          this.warnTick = 0;
          this.host.shake(false);
          this.setState('diveWarn');
        }
        break;
      case 'diveWarn': {
        const dur = BOSS.diveWarnMs[this.phase];
        this.warn.setAlpha(0.5 + 0.4 * Math.abs(Math.sin(this.t / 70)));
        this.warn.setScale(0.7 + (0.5 * this.t) / dur, 0.35);
        this.warnTick -= dt;
        if (this.warnTick <= 0) {
          this.host.sparks(this.warnX + Phaser.Math.Between(-30, 30), WORLD.groundY - 4, 3);
          this.warnTick = 110;
        }
        if (this.t >= dur) {
          this.warn.setVisible(false);
          this.head.setAngle(-90);
          this.hy = WORLD.groundY + 120;
          sfx.boom();
          this.host.shake(true);
          this.host.sparks(this.warnX, WORLD.groundY - 6, 14);
          this.setState('erupt');
        }
        break;
      }
      case 'erupt':
        this.hy -= (BOSS.eruptSpeed * this.m * dt) / 1000;
        if (this.hy <= BOSS.eruptTopY) {
          this.hy = BOSS.eruptTopY;
          this.eruptionsLeft--;
          if (this.eruptionsLeft > 0) this.setState('diveDown');
          else this.setState('recover');
        }
        break;
      case 'recover': {
        const a = this.head.angle;
        this.head.setAngle(a + (0 - a) * 0.15);
        this.moveTo(this.hx, BOSS.recoverY, 500, dt);
        if (this.t >= BOSS.recoverMs[this.phase]) this.setState('idle');
        break;
      }
      case 'enrage':
        this.moveTo(MID, 380, 400, dt);
        this.head.setAngle(Math.sin(this.t / 40) * 8);
        if (this.t >= BOSS.enrageMs) this.setState('idle');
        break;
      case 'dying': {
        const step = BOSS.deathMs / (BOSS.segments + 1);
        this.head.setAngle(Math.sin(this.t / 30) * 10);
        while (this.dyingIndex >= 0 && this.t >= (BOSS.segments - this.dyingIndex) * step) {
          const s = this.segs[this.dyingIndex];
          this.host.sparks(s.x, s.y, 6);
          s.setVisible(false);
          this.dyingIndex--;
        }
        if (this.t >= BOSS.deathMs) {
          this.host.sparks(this.hx, this.hy, 14);
          sfx.boom();
          this.host.shake(true);
          this.host.flash(PAL.chama, 0.4);
          this.trail.stop();
          this.setVisible(false);
          this.state = 'dead';
          this.host.onBossDefeated();
        }
        break;
      }
    }

    if (this.state !== 'diveDown' && this.state !== 'erupt' && this.state !== 'diveWarn') {
      if (this.state !== 'intro' && this.state !== 'divePrep' && this.state !== 'recover') {
        this.head.setFlipX(this.facing < 0);
      }
    }
    this.head.setPosition(this.hx, this.hy);
    this.light.setPosition(this.hx, this.hy);
    this.light.setAlpha(0.5 + Math.sin(this.life / 90) * 0.08);
    this.layoutSegments(false);
  }

  /** Corpo segue a cabeça como uma corda (espaçamento fixo) com leve ondulação. */
  private layoutSegments(snapAll: boolean): void {
    let px = this.hx;
    let py = this.hy;
    for (let i = 0; i < this.segs.length; i++) {
      const s = this.segs[i];
      const spacing = this.radii[i] * 0.9;
      if (snapAll) {
        s.setPosition(px, py + spacing);
      } else {
        const dx = s.x - px;
        const dy = s.y - py;
        const d = Math.hypot(dx, dy) || 1;
        if (d > spacing) {
          const tx = px + (dx / d) * spacing;
          const ty = py + (dy / d) * spacing;
          s.x += (tx - s.x) * 0.75;
          s.y += (ty - s.y) * 0.75;
        }
        s.y += Math.sin(this.life / 160 + i * 0.7) * 0.25;
      }
      px = s.x;
      py = s.y;
    }
  }

  private fireAt(targetX: number): void {
    const f = this.fireballs.find((b) => !b.on);
    if (!f) return;
    const sx = this.hx + this.facing * 40;
    const sy = this.hy + 10;
    const T = BOSS.spitFlightMs / 1000;
    const g = BOSS.fireballGravity;
    const tx = Phaser.Math.Clamp(targetX, WORLD.arenaLeft + 20, WORLD.arenaRight - 20);
    f.vx = (tx - sx) / T;
    f.vy = (WORLD.groundY - 12 - sy - 0.5 * g * T * T) / T;
    f.on = true;
    f.img.setPosition(sx, sy).setVisible(true);
    f.light.setPosition(sx, sy).setVisible(true);
    sfx.fire();
  }

  private hideFireball(f: Fireball): void {
    f.on = false;
    f.img.setVisible(false);
    f.light.setVisible(false);
  }

  private updateFireballs(dt: number): void {
    const s = dt / 1000;
    for (const f of this.fireballs) {
      if (!f.on) continue;
      f.vy += BOSS.fireballGravity * s;
      f.img.x += f.vx * s;
      f.img.y += f.vy * s;
      f.img.angle += 12;
      f.light.setPosition(f.img.x, f.img.y);
      if (f.img.y >= WORLD.groundY - 8) {
        this.host.sparks(f.img.x, WORLD.groundY - 6, 8);
        this.hideFireball(f);
      } else if (f.img.x < WORLD.bossDoorX || f.img.x > WORLD.width) {
        this.hideFireball(f);
      }
    }
  }
}
