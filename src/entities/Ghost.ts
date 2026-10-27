import Phaser from 'phaser';
import { GHOST, WORLD } from '../config/balance';
import { PAL } from '../style/palette';
import type { Player } from './Player';

type GhostMode = 'patrol' | 'chase' | 'windup' | 'lunge' | 'recover' | 'stun' | 'dead';

type Spawn = { x: number; minX: number; maxX: number };

/** Alma penada: patrulha, persegue, telegrafa (olhos vermelhos + pisca) e investe. */
export class Ghost extends Phaser.GameObjects.Sprite {
  hp: number = GHOST.hp;
  mode: GhostMode = 'patrol';
  private t = 0;
  private life = Math.random() * 1000;
  private dir = 1;
  private vx = 0;
  private baseY: number;
  private light: Phaser.GameObjects.Image;
  private pendingRespawn = false;

  constructor(
    scene: Phaser.Scene,
    private spawn: Spawn,
  ) {
    const baseY = WORLD.groundY - GHOST.hoverAboveGround - 26;
    super(scene, spawn.x, baseY, 'g_idle');
    this.baseY = baseY;
    scene.add.existing(this);
    this.setDepth(30).setAlpha(0.85);
    this.light = scene.add
      .image(this.x, this.y, 'light')
      .setTint(PAL.espectro)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.35)
      .setScale(0.5)
      .setDepth(29);
  }

  get alive(): boolean {
    return this.mode !== 'dead';
  }

  get isAttacking(): boolean {
    return this.mode === 'lunge';
  }

  rect(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.x - 13, this.y - 22, 26, 46);
  }

  updateGhost(dt: number, player: Player): void {
    if (this.mode === 'dead') {
      if (this.pendingRespawn) this.resetAwayFrom(player.x);
      return;
    }
    this.t += dt;
    this.life += dt;
    const dx = player.x - this.x;
    const adx = Math.abs(dx);
    const ady = Math.abs(player.y - 30 - this.y);
    const sees = !player.isDead && adx < GHOST.detectX && ady < GHOST.detectY;
    let frame = Math.floor(this.life / 300) % 2 === 0 ? 'g_idle' : 'g_idle2';

    switch (this.mode) {
      case 'patrol':
        this.vx = this.dir * GHOST.patrolSpeed;
        if (this.x <= this.spawn.minX) this.dir = 1;
        if (this.x >= this.spawn.maxX) this.dir = -1;
        if (sees) this.setMode('chase');
        break;
      case 'chase':
        this.dir = Math.sign(dx) || this.dir;
        this.vx = this.dir * GHOST.chaseSpeed;
        if (adx < GHOST.attackRangeX && ady < 60) this.setMode('windup');
        else if (!sees && adx > GHOST.detectX * 1.3) this.setMode('patrol');
        if (player.isDead) this.setMode('patrol');
        break;
      case 'windup': {
        this.vx = -this.dir * 20;
        frame = 'g_wind';
        const blink = Math.floor(this.t / 90) % 2 === 0;
        if (blink) this.setTint(PAL.perigo);
        else this.clearTint();
        if (this.t >= GHOST.windup) {
          this.clearTint();
          this.dir = Math.sign(dx) || this.dir;
          this.setMode('lunge');
        }
        break;
      }
      case 'lunge':
        frame = 'g_att';
        this.vx = this.dir * GHOST.lungeSpeed;
        if (this.t >= GHOST.lungeDuration) this.setMode('recover');
        break;
      case 'recover':
        this.vx *= 0.85;
        if (this.t >= GHOST.recover) this.setMode('chase');
        break;
      case 'stun':
        this.vx *= 0.86;
        if (this.t >= GHOST.hitStun) this.setMode('chase');
        break;
    }

    this.x += (this.vx * dt) / 1000;
    this.x = Phaser.Math.Clamp(this.x, this.spawn.minX - 80, this.spawn.maxX + 80);
    this.y = this.baseY + Math.sin(this.life / 320) * 6;
    if (this.texture.key !== frame) this.setTexture(frame);
    this.setFlipX(this.dir < 0);
    this.light.setPosition(this.x + this.dir * 4, this.y - 10);
  }

  private setMode(m: GhostMode): void {
    this.mode = m;
    this.t = 0;
  }

  /** Retorna true se morreu com o golpe. */
  hurt(dmg: number, fromX: number, heavy: boolean): boolean {
    if (this.mode === 'dead') return false;
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    if (this.mode !== 'lunge' || heavy) {
      this.clearTint();
      this.setMode('stun');
      this.vx = Math.sign(this.x - fromX) * GHOST.knockback * (heavy ? 1.6 : 1);
    }
    return false;
  }

  private die(): void {
    this.mode = 'dead';
    this.clearTint();
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 1.6,
      scaleY: 0.4,
      duration: 380,
      ease: 'Quad.easeIn',
      onComplete: () => this.setVisible(false),
    });
    this.scene.tweens.add({ targets: this.light, alpha: 0, duration: 380 });
  }

  /**
   * Renasce no ponto de patrulha mais distante de `avoidX`. Se nenhum ponto
   * estiver a pelo menos `GHOST.safeRespawnDist`, fica invisível e tenta de novo
   * a cada frame até o jogador se afastar.
   */
  resetAwayFrom(avoidX: number): void {
    const points = [this.spawn.x, this.spawn.minX, this.spawn.maxX];
    const best = points.reduce((a, b) => (Math.abs(b - avoidX) > Math.abs(a - avoidX) ? b : a));
    if (Math.abs(best - avoidX) >= GHOST.safeRespawnDist) {
      this.reset();
      this.x = best;
      this.light.setPosition(this.x, this.y - 10);
      return;
    }
    this.scene.tweens.killTweensOf([this, this.light]);
    this.mode = 'dead';
    this.pendingRespawn = true;
    this.clearTint();
    this.setVisible(false);
    this.light.setAlpha(0);
  }

  reset(): void {
    this.pendingRespawn = false;
    this.scene.tweens.killTweensOf([this, this.light]);
    this.hp = GHOST.hp;
    this.mode = 'patrol';
    this.t = 0;
    this.vx = 0;
    this.dir = 1;
    this.setPosition(this.spawn.x, this.baseY).setScale(1).setAlpha(0.85).setVisible(true);
    this.clearTint();
    this.light.setAlpha(0.35);
  }
}
