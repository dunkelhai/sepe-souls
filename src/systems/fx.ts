import Phaser from 'phaser';
import { FX } from '../config/balance';
import { settings } from './settings';

export function shake(scene: Phaser.Scene, strong = false): void {
  if (settings.reduceFx) return;
  const s = strong ? FX.shakeStrong : FX.shakeLight;
  scene.cameras.main.shake(s.duration, s.intensity);
}

type Tintable = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Tint;

/** Hit-flash branco de 80 ms; `restore` reaplica um tint base se houver. */
export function hitFlash(scene: Phaser.Scene, targets: Tintable[], restore?: () => void): void {
  for (const t of targets) t.setTintFill(0xffffff);
  scene.time.delayedCall(FX.hitFlashMs, () => {
    for (const t of targets) t.clearTint();
    restore?.();
  });
}

/** Pop de UI: escala 1 → 1.1 → 1, 140 ms. */
export function pop(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject): void {
  scene.tweens.add({
    targets: target,
    scale: { from: 1, to: 1.1 },
    duration: 140,
    ease: 'Quad.easeOut',
    yoyo: true,
  });
}

/** Flash de tela (respeita "reduzir flash": alpha máx. 0.3 → usamos 0.15). */
export function screenFlash(scene: Phaser.Scene, color: number, alpha: number): void {
  const cam = scene.cameras.main;
  const a = settings.reduceFx ? Math.min(alpha, 0.15) : alpha;
  const r = scene.add
    .rectangle(cam.width / 2, cam.height / 2, cam.width, cam.height, color, a)
    .setScrollFactor(0)
    .setDepth(900);
  scene.tweens.add({ targets: r, alpha: 0, duration: 220, onComplete: () => r.destroy() });
}

/** Número de dano flutuante. */
export function damageNumber(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: number,
  color: string,
  font: string,
): void {
  const t = scene.add
    .text(x, y, String(value), {
      fontFamily: font,
      fontSize: '20px',
      color,
      stroke: '#0d1220',
      strokeThickness: 4,
    })
    .setOrigin(0.5)
    .setDepth(800);
  scene.tweens.add({
    targets: t,
    y: y - 40,
    alpha: 0,
    duration: 600,
    ease: 'Cubic.easeOut',
    onComplete: () => t.destroy(),
  });
}
