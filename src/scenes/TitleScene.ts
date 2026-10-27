import Phaser from 'phaser';
import { sfx } from '../systems/audio';
import { settings } from '../systems/settings';
import { CSS, FONT_TITLE, FONT_UI, PAL } from '../style/palette';

export class TitleScene extends Phaser.Scene {
  private layers: Array<{ ts: Phaser.GameObjects.TileSprite; speed: number }> = [];
  private starting = false;

  constructor() {
    super('Title');
  }

  create(): void {
    this.starting = false;
    this.layers = [];
    this.add.image(0, 0, 'sky').setOrigin(0);
    this.add.image(1000, 130, 'moon').setAlpha(0.6);
    const layer = (
      key: string,
      y: number,
      h: number,
      speed: number,
      tint?: number,
      a = 1,
    ): void => {
      const ts = this.add.tileSprite(0, y, 1280, h, key).setOrigin(0).setAlpha(a);
      if (tint !== undefined) ts.setTint(tint);
      this.layers.push({ ts, speed });
    };
    layer('hills', 380, 300, 0.05);
    layer('fog', 330, 200, 0.12, PAL.espectro, 0.25);
    layer('farruins', 300, 380, 0.15);
    layer('fog', 440, 200, 0.3, PAL.ardosia, 0.3);
    this.add.tileSprite(0, 640, 1280, 80, 'ground').setOrigin(0);
    layer('fore', 500, 220, 0.5, undefined, 0.9);

    const glow = this.add
      .image(640, 640, 'light')
      .setTint(PAL.brasa)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(3, 1.2)
      .setAlpha(0.35);
    this.tweens.add({ targets: glow, alpha: 0.5, duration: 1200, yoyo: true, repeat: -1 });
    this.add.particles(0, 0, 'px', {
      x: { min: 0, max: 1280 },
      y: 720,
      speedY: { min: -90, max: -30 },
      speedX: { min: -20, max: 20 },
      lifespan: { min: 3000, max: 6000 },
      scale: { start: 1, end: 0 },
      tint: [PAL.brasa, PAL.chama],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 90,
      maxAliveParticles: 50,
    });

    const style = (
      size: number,
      color: string,
      font = FONT_UI,
    ): Phaser.Types.GameObjects.Text.TextStyle => ({
      fontFamily: font,
      fontSize: `${size}px`,
      color,
      stroke: CSS.noite,
      strokeThickness: 6,
      align: 'center',
    });
    const title = this.add
      .text(640, 220, 'BRASA E RUÍNA', { ...style(96, CSS.chama, FONT_TITLE), fontStyle: '700' })
      .setOrigin(0.5)
      .setLetterSpacing(4)
      .setShadow(0, 3, CSS.preto, 0, true, true)
      .setScale(0.6)
      .setAlpha(0);
    this.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 500, ease: 'Back.easeOut' });
    this.add
      .text(
        640,
        300,
        'um soulslike nas ruínas de uma redução, contra o Boitatá',
        style(24, CSS.osso),
      )
      .setOrigin(0.5);
    const press = this.add.text(640, 430, 'PRESSIONE ESPAÇO', style(32, CSS.osso)).setOrigin(0.5);
    this.tweens.add({ targets: press, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });

    const controls = [
      '←→ / A D  mover     ↑ / W  pular     Z / Espaço  atacar (combo de 3) e interagir',
      'X / Shift  esquivar (invencível)     C  frasco de cura (3 cargas)',
      'Esc  pausa     R  reiniciar a run',
      'Acenda o fogão de chão: ele cura, recarrega os frascos e vira seu ponto de retorno.',
    ];
    controls.forEach((l, i) =>
      this.add
        .text(640, 506 + i * 30, l, style(20, i === 3 ? CSS.chama : CSS.osso))
        .setOrigin(0.5)
        .setAlpha(i === 3 ? 0.9 : 0.85),
    );
    this.add
      .text(
        640,
        690,
        `v0.1 · arte gerada por código · fontes Cinzel e Pixelify Sans${settings.debug ? ' · DEBUG' : ''}`,
        style(16, CSS.osso),
      )
      .setOrigin(0.5)
      .setAlpha(0.5);

    if (this.game.renderer.type === Phaser.WEBGL) {
      this.cameras.main.postFX.addVignette(0.5, 0.5, 0.88, 0.5);
    }
    this.cameras.main.fadeIn(250, 0, 0, 0);

    const kb = this.input.keyboard!;
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE, true).on('down', () => this.begin());
  }

  private begin(): void {
    if (this.starting) return;
    this.starting = true;
    sfx.unlock();
    sfx.select();
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.start('Game'),
    );
  }

  update(): void {
    for (const l of this.layers) l.ts.tilePositionX += l.speed;
  }
}
