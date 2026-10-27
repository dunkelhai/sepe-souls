import Phaser from 'phaser';
import { PLAYER } from '../config/balance';
import type { Controls } from '../systems/controls';
import { sfx } from '../systems/audio';

export type PlayerState = 'move' | 'attack' | 'roll' | 'heal' | 'hurt' | 'dead' | 'frozen';

/** O Andarilho: poncho ocre, chapéu de aba larga e facão. */
export class Player extends Phaser.Physics.Arcade.Sprite {
  hp: number = PLAYER.maxHp;
  stamina: number = PLAYER.maxStamina;
  flasks: number = PLAYER.flasks;
  facing = 1;
  state: PlayerState = 'move';
  combo = 0;
  flasksUsed = 0;
  /** Definido pela cena quando há algo interagível por perto. */
  nearInteract = false;
  onInteract: (() => void) | null = null;
  onHealed: (() => void) | null = null;

  private t = 0;
  private animT = 0;
  private comboQueued = false;
  private hitThisSwing = new Set<object>();
  private iframes = 0;
  private staminaDelay = 0;
  private coyote = 0;
  private jumpBuffer = 0;
  private attackBuffer = 0;
  private healed = false;
  private rollDir = 1;
  private frozenFor = 0;
  private slash: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'p_idle');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1).setDepth(35);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(20, 50).setOffset(14, 14);
    body.setMaxVelocity(900, 1200);
    this.setCollideWorldBounds(true);
    this.slash = scene.add
      .image(x, y, 'slash')
      .setDepth(36)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
  }

  get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  get onGround(): boolean {
    return this.arcadeBody.blocked.down || this.arcadeBody.touching.down;
  }

  get isDead(): boolean {
    return this.state === 'dead';
  }

  get attackActive(): boolean {
    if (this.state !== 'attack') return false;
    const [a, b] = PLAYER.attackActive[this.combo];
    return this.t >= a && this.t <= b;
  }

  get attackDamage(): number {
    return PLAYER.attackDamage[this.combo];
  }

  get isHeavyHit(): boolean {
    return this.combo === 2;
  }

  attackHitbox(): Phaser.Geom.Rectangle {
    const range = PLAYER.attackRange * (this.combo === 2 ? 1.15 : 1);
    const h = PLAYER.attackHeight;
    const cy = this.y - 34;
    const x = this.facing > 0 ? this.x - 6 : this.x - range + 6;
    return new Phaser.Geom.Rectangle(x, cy - h / 2, range, h);
  }

  bodyRect(): Phaser.Geom.Rectangle {
    const b = this.arcadeBody;
    return new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height);
  }

  hasHit(target: object): boolean {
    return this.hitThisSwing.has(target);
  }

  markHit(target: object): void {
    this.hitThisSwing.add(target);
  }

  freeze(ms: number): void {
    this.state = 'frozen';
    this.frozenFor = ms;
    this.t = 0;
    this.setVelocityX(0);
  }

  update(dt: number, c: Controls): void {
    const body = this.arcadeBody;
    const ground = this.onGround;
    this.t += dt;
    this.animT += dt;
    if (this.iframes > 0) this.iframes -= dt;

    // stamina regenera após uma breve pausa
    if (this.staminaDelay > 0) this.staminaDelay -= dt;
    else if (this.state !== 'roll' && this.state !== 'attack') {
      this.stamina = Math.min(PLAYER.maxStamina, this.stamina + (PLAYER.staminaRegen * dt) / 1000);
    }

    this.coyote = ground ? PLAYER.coyoteMs : this.coyote - dt;
    this.jumpBuffer = c.jumpPressed ? PLAYER.jumpBufferMs : this.jumpBuffer - dt;
    this.attackBuffer = c.actionPressed ? PLAYER.attackBufferMs : this.attackBuffer - dt;

    switch (this.state) {
      case 'move': {
        const dir = (c.right ? 1 : 0) - (c.left ? 1 : 0);
        this.setVelocityX(dir * PLAYER.speed * (ground ? 1 : PLAYER.airControl));
        if (dir !== 0) this.facing = dir;
        if (this.jumpBuffer > 0 && this.coyote > 0) {
          this.setVelocityY(-PLAYER.jumpVelocity);
          this.jumpBuffer = 0;
          this.coyote = 0;
        }
        if (!c.jumpHeld && body.velocity.y < -220) {
          this.setVelocityY(body.velocity.y * PLAYER.jumpCutFactor);
        }
        if (this.attackBuffer > 0 && this.nearInteract && ground && this.onInteract) {
          this.attackBuffer = 0;
          this.onInteract();
        } else if (this.attackBuffer > 0 && this.stamina > 0) {
          this.startAttack(0);
        } else if (c.dodgePressed && this.stamina > 0) {
          this.startRoll(dir !== 0 ? dir : this.facing);
        } else if (c.healPressed && this.flasks > 0 && ground) {
          this.startHeal();
        }
        if (this.state === 'move') {
          if (!ground) this.setTexture('p_jump');
          else if (dir !== 0)
            this.setTexture(Math.floor(this.animT / 120) % 2 === 0 ? 'p_run1' : 'p_run2');
          else this.setTexture(Math.floor(this.animT / 450) % 2 === 0 ? 'p_idle' : 'p_idle2');
        }
        break;
      }
      case 'attack': {
        const i = this.combo;
        if (ground) this.setVelocityX(this.t < 120 ? this.facing * PLAYER.attackLunge[i] : 0);
        if (this.attackBuffer > 0 && this.t > PLAYER.comboInputFrom) {
          this.comboQueued = true;
          this.attackBuffer = 0;
        }
        this.updateSlash();
        if (this.t > PLAYER.rollCancelFrom && c.dodgePressed && this.stamina > 0) {
          const dir = (c.right ? 1 : 0) - (c.left ? 1 : 0);
          this.startRoll(dir !== 0 ? dir : this.facing);
          break;
        }
        if (this.t >= PLAYER.attackDuration[i]) {
          if (this.comboQueued && i < 2 && this.stamina > 0) this.startAttack(i + 1);
          else this.toMove();
        }
        break;
      }
      case 'roll': {
        const k = 1 - (this.t / PLAYER.rollDuration) * 0.45;
        this.setVelocityX(this.rollDir * PLAYER.rollSpeed * k);
        if (this.t >= PLAYER.rollDuration) this.toMove();
        break;
      }
      case 'heal': {
        this.setVelocityX(0);
        if (!this.healed && this.t >= PLAYER.healApplyAt) {
          this.healed = true;
          this.hp = Math.min(PLAYER.maxHp, this.hp + PLAYER.flaskHeal);
          sfx.heal();
          this.onHealed?.();
        }
        if (this.t >= PLAYER.healDuration) this.toMove();
        break;
      }
      case 'hurt':
        this.setVelocityX(body.velocity.x * 0.9);
        if (this.t >= PLAYER.hurtDuration) this.toMove();
        break;
      case 'frozen':
        this.setVelocityX(0);
        this.setTexture('p_idle');
        if (this.frozenFor > 0 && this.t >= this.frozenFor) this.toMove();
        break;
      case 'dead':
        this.setVelocityX(0);
        break;
    }

    if (this.state !== 'attack') this.slash.setVisible(false);
    this.setFlipX(this.facing < 0);
    const blink = this.iframes > 0 && this.state !== 'dead' && this.state !== 'roll';
    this.setAlpha(blink && Math.floor(this.iframes / 70) % 2 === 0 ? 0.35 : 1);
  }

  private toMove(): void {
    this.state = 'move';
    this.t = 0;
  }

  private startAttack(i: number): void {
    this.state = 'attack';
    this.combo = i;
    this.t = 0;
    this.comboQueued = false;
    this.attackBuffer = 0;
    this.hitThisSwing.clear();
    this.stamina = Math.max(0, this.stamina - PLAYER.attackCost);
    this.staminaDelay = PLAYER.staminaRegenDelay;
    this.setTexture(`p_att${i + 1}`);
    sfx.swing();
  }

  private updateSlash(): void {
    const [a, b] = PLAYER.attackActive[this.combo];
    if (this.t < a || this.t > b + 60) {
      this.slash.setVisible(false);
      return;
    }
    const k = (this.t - a) / (b - a + 60);
    const angles = [0, -28, 24];
    const scales = [1, 1, 1.25];
    this.slash
      .setVisible(true)
      .setPosition(this.x + this.facing * 26, this.y - 34)
      .setFlipX(this.facing < 0)
      .setAngle(angles[this.combo] * this.facing)
      .setScale(scales[this.combo])
      .setAlpha(1 - k);
  }

  private startRoll(dir: number): void {
    this.state = 'roll';
    this.t = 0;
    this.rollDir = dir;
    this.facing = dir;
    this.stamina = Math.max(0, this.stamina - PLAYER.rollCost);
    this.staminaDelay = PLAYER.staminaRegenDelay;
    this.setTexture('p_roll');
    sfx.dodge();
  }

  private startHeal(): void {
    this.state = 'heal';
    this.t = 0;
    this.healed = false;
    this.flasks -= 1;
    this.flasksUsed += 1;
    this.setTexture('p_heal');
  }

  /** Retorna true se o golpe acertou (não estava invencível). */
  takeDamage(amount: number, fromX: number): boolean {
    if (this.state === 'dead' || this.iframes > 0) return false;
    if (this.state === 'roll' && this.t < PLAYER.rollIFrames) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.iframes = PLAYER.hurtIFrames;
    if (this.hp <= 0) {
      this.kill();
      return true;
    }
    this.state = 'hurt';
    this.t = 0;
    const away = Math.sign(this.x - fromX) || -this.facing;
    this.setVelocity(away * PLAYER.hurtKnockback, -220);
    this.setTexture('p_hurt');
    return true;
  }

  kill(): void {
    this.hp = 0;
    this.state = 'dead';
    this.t = 0;
    this.setVelocityX(0);
    this.setTexture('p_hurt');
    this.slash.setVisible(false);
    this.scene.tweens.add({ targets: this, angle: -90 * this.facing, duration: 420 });
  }

  restoreAll(): void {
    this.hp = PLAYER.maxHp;
    this.stamina = PLAYER.maxStamina;
    this.flasks = PLAYER.flasks;
  }

  respawn(x: number, y: number): void {
    this.scene.tweens.killTweensOf(this);
    this.restoreAll();
    this.setAngle(0).setAlpha(1).setPosition(x, y).setVelocity(0, 0);
    this.iframes = 0;
    this.state = 'move';
    this.t = 0;
    this.facing = 1;
    this.setTexture('p_idle');
  }
}
