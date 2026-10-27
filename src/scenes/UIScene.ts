import Phaser from 'phaser';
import { FX, PLAYER } from '../config/balance';
import { sfx } from '../systems/audio';
import { pop } from '../systems/fx';
import { settings } from '../systems/settings';
import { CSS, FONT_TITLE, FONT_UI, PAL } from '../style/palette';
import type { GameScene } from './GameScene';

type Mode = 'hud' | 'pause' | 'death' | 'victory';

const K = Phaser.Input.Keyboard.KeyCodes;

function txt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  s: string,
  size: number,
  color: string = CSS.osso,
  font: string = FONT_UI,
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, s, {
      fontFamily: font,
      fontSize: `${size}px`,
      color,
      stroke: CSS.noite,
      strokeThickness: 5,
    })
    .setShadow(0, 3, CSS.preto, 0, true, true);
}

function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** HUD, pausa, tela de queda e de vitória. Roda por cima da GameScene. */
export class UIScene extends Phaser.Scene {
  private game_!: GameScene;
  private mode: Mode = 'hud';
  private bars!: Phaser.GameObjects.Graphics;
  private bossBar!: Phaser.GameObjects.Graphics;
  private bossName!: Phaser.GameObjects.Text;
  private flaskIcons: Phaser.GameObjects.Image[] = [];
  private fireText!: Phaser.GameObjects.Text;
  private deathText!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private fpsText!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Container;
  private pauseItems: Phaser.GameObjects.Text[] = [];
  private pauseIndex = 0;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private taps = new Set<string>();
  private deathTimer: Phaser.Time.TimerEvent | null = null;
  private last = { hp: -1, st: -1, flasks: -1, boss: -1, lit: false, deaths: -1, bossOn: false };

  constructor() {
    super('UI');
  }

  create(): void {
    this.game_ = this.scene.get('Game') as GameScene;
    this.mode = 'hud';
    this.flaskIcons = [];
    this.pauseItems = [];
    this.last = { hp: -1, st: -1, flasks: -1, boss: -1, lit: false, deaths: -1, bossOn: false };

    const kb = this.input.keyboard!;
    const add = (c: number): Phaser.Input.Keyboard.Key => kb.addKey(c, true);
    this.keys = {
      esc: add(K.ESC),
      r: add(K.R),
      space: add(K.SPACE),
      z: add(K.Z),
      enter: add(K.ENTER),
      up: add(K.UP),
      down: add(K.DOWN),
      w: add(K.W),
      s: add(K.S),
      f1: add(K.F1),
      f2: add(K.F2),
      f3: add(K.F3),
      f4: add(K.F4),
    };

    this.taps = new Set();
    for (const [name, k] of Object.entries(this.keys)) k.on('down', () => this.taps.add(name));

    // painéis do HUD (estáticos)
    const panels = this.add.graphics();
    panels.fillStyle(PAL.preto, 0.45);
    panels.fillRoundedRect(32, 16, 312, 96, 12);
    panels.fillRoundedRect(1232 - 236, 16, 252, 72, 12);
    txt(this, 48, 22, 'VIDA', 16, CSS.osso).setAlpha(0.8);
    txt(this, 48, 56, 'FÔLEGO', 16, CSS.osso).setAlpha(0.8);
    this.bars = this.add.graphics();
    for (let i = 0; i < PLAYER.flasks; i++) {
      this.flaskIcons.push(this.add.image(60 + i * 26, 92, 'flask'));
    }
    txt(this, 140, 82, 'C · frasco', 16, CSS.chama).setAlpha(0.85);
    this.fireText = txt(this, 1232, 28, '', 20, CSS.osso).setOrigin(1, 0);
    this.deathText = txt(this, 1232, 56, '', 20, CSS.osso).setOrigin(1, 0);
    txt(this, 640, 30, 'RUÍNAS DE SANTA CINZA', 20, CSS.osso).setOrigin(0.5, 0).setAlpha(0.6);

    this.bossBar = this.add.graphics();
    this.bossName = txt(this, 640, 670, 'BOITATÁ · a serpente de fogo', 22, CSS.chama)
      .setOrigin(0.5)
      .setVisible(false);

    this.toastText = txt(this, 640, 150, '', 32, CSS.chama, FONT_TITLE).setOrigin(0.5).setAlpha(0);
    this.fpsText = txt(this, 48, 690, '', 16, CSS.osso).setOrigin(0, 0.5).setVisible(false);

    this.overlay = this.add.container(0, 0).setDepth(100).setVisible(false);

    const ev = this.game_.events;
    const onDeath = (): void => this.showDeath();
    const onVictory = (): void => this.showVictory();
    const onRespawn = (): void => this.closeOverlay();
    const onToast = (s: string): void => this.toast(s);
    ev.on('show-death', onDeath);
    ev.on('show-victory', onVictory);
    ev.on('respawned', onRespawn);
    ev.on('toast', onToast);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      ev.off('show-death', onDeath);
      ev.off('show-victory', onVictory);
      ev.off('respawned', onRespawn);
      ev.off('toast', onToast);
    });
  }

  private jd(...names: string[]): boolean {
    let any = false;
    for (const n of names) {
      if (this.taps.has(n)) any = true;
      this.taps.delete(n);
    }
    return any;
  }

  update(): void {
    const g = this.game_;
    const esc = this.jd('esc');
    const r = this.jd('r');
    const ok = this.jd('space', 'z', 'enter');
    const up = this.jd('up', 'w');
    const down = this.jd('down', 's');

    switch (this.mode) {
      case 'hud':
        if (g.state === 'playing') {
          if (esc) this.openPause();
          else if (r) g.restartRun();
          else if (settings.debug) this.debugKeys();
        }
        break;
      case 'pause':
        if (esc) this.closePause();
        else if (r) this.restartFromPause();
        else if (up || down) {
          this.pauseIndex = (this.pauseIndex + (down ? 1 : -1) + 4) % 4;
          sfx.select();
          this.refreshPause(true);
        } else if (ok) this.selectPause();
        break;
      case 'death':
        if (r) {
          this.deathTimer?.remove();
          g.restartRun();
        } else if (ok) {
          this.deathTimer?.remove();
          g.respawn();
        }
        break;
      case 'victory':
        if (ok || r) g.restartRun();
        else if (esc) this.toTitle();
        break;
    }
    if (settings.debug && this.jd('f4')) settings.showFps = !settings.showFps;
    this.fpsText.setVisible(settings.showFps);
    if (settings.showFps) this.fpsText.setText(`${Math.round(this.game.loop.actualFps)} fps`);
    this.taps.clear();
    this.refreshHud();
  }

  private debugKeys(): void {
    const g = this.game_;
    if (this.jd('f1')) g.debugWin();
    if (this.jd('f2')) g.debugDie();
    if (this.jd('f3')) g.debugTeleport();
  }

  private refreshHud(): void {
    const g = this.game_;
    const p = g.player;
    const hp = Math.round(p.hp);
    const st = Math.round(p.stamina);
    const L = this.last;
    if (hp !== L.hp || st !== L.st) {
      const b = this.bars;
      b.clear();
      b.fillStyle(PAL.noite, 0.9).fillRect(46, 38, 284, 14);
      b.fillStyle(PAL.perigo, 1).fillRect(48, 40, (280 * hp) / PLAYER.maxHp, 10);
      b.fillStyle(PAL.chama, 0.35).fillRect(48, 40, (280 * hp) / PLAYER.maxHp, 2);
      b.fillStyle(PAL.noite, 0.9).fillRect(46, 72, 224, 8);
      b.fillStyle(st < PLAYER.rollCost ? PAL.ocreSombra : PAL.ocre, 1).fillRect(
        48,
        74,
        (220 * st) / PLAYER.maxStamina,
        4,
      );
      L.hp = hp;
      L.st = st;
    }
    if (p.flasks !== L.flasks) {
      this.flaskIcons.forEach((icon, i) => {
        icon.setTexture(i < p.flasks ? 'flask' : 'flask_empty');
        if (L.flasks >= 0) pop(this, icon);
      });
      L.flasks = p.flasks;
    }
    if (g.checkpointLit !== L.lit || L.deaths !== g.deaths) {
      this.fireText.setText(g.checkpointLit ? 'Fogão: aceso' : 'Fogão: apagado');
      this.fireText.setColor(g.checkpointLit ? CSS.chama : CSS.osso);
      if (g.checkpointLit !== L.lit) pop(this, this.fireText);
      this.deathText.setText(`Quedas: ${g.deaths}`);
      L.lit = g.checkpointLit;
      L.deaths = g.deaths;
    }
    const bossOn = g.bossBarVisible;
    const bhp = Math.round(g.boss.hp);
    if (bossOn !== L.bossOn || bhp !== L.boss) {
      this.bossBar.clear();
      this.bossName.setVisible(bossOn);
      if (bossOn) {
        const ratio = g.boss.hpRatio;
        const b = this.bossBar;
        b.fillStyle(PAL.preto, 0.45).fillRoundedRect(224, 652, 832, 64, 12);
        b.fillStyle(PAL.noite, 1).fillRect(238, 690, 804, 16);
        b.fillStyle(g.boss.phase === 1 ? PAL.chama : PAL.brasa, 1).fillRect(
          240,
          692,
          800 * ratio,
          12,
        );
        b.fillStyle(PAL.perigo, 0.6).fillRect(240 + 800 * 0.5 - 1, 688, 2, 20);
        if (!L.bossOn) pop(this, this.bossName);
      }
      L.bossOn = bossOn;
      L.boss = bhp;
    }
  }

  private toast(s: string): void {
    this.tweens.killTweensOf(this.toastText);
    this.toastText.setText(s).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.toastText, scale: 1, duration: 300, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 1400, duration: 500 });
  }

  // ------------------------------------------------------------ overlays

  private buildOverlay(
    title: string,
    color: string,
    lines: string[],
    buttons: string[],
  ): Phaser.GameObjects.Text {
    this.overlay.removeAll(true);
    const bg = this.add.rectangle(640, 360, 1280, 720, PAL.preto, 0.6);
    const t = txt(this, 640, 260, title, 64, color, FONT_TITLE).setOrigin(0.5).setScale(0.6);
    this.overlay.add([bg, t]);
    lines.forEach((l, i) => this.overlay.add(txt(this, 640, 360 + i * 40, l, 22).setOrigin(0.5)));
    const w = 280;
    const gap = 32;
    const total = buttons.length * w + (buttons.length - 1) * gap;
    buttons.forEach((label, i) => {
      const x = 640 - total / 2 + w / 2 + i * (w + gap);
      const g = this.add.graphics();
      g.fillStyle(PAL.noite, 0.9).fillRoundedRect(x - w / 2, 560 - 28, w, 56, 12);
      g.lineStyle(2, i === 0 ? PAL.chama : PAL.ardosia, 1).strokeRoundedRect(
        x - w / 2,
        560 - 28,
        w,
        56,
        12,
      );
      const b = txt(this, x, 560, label, 22, i === 0 ? CSS.chama : CSS.osso).setOrigin(0.5);
      this.overlay.add([g, b]);
    });
    this.overlay.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.overlay, alpha: 1, duration: 250 });
    this.tweens.add({ targets: t, scale: 1, duration: 300, ease: 'Back.easeOut' });
    return t;
  }

  private closeOverlay(): void {
    this.mode = 'hud';
    this.overlay.setVisible(false);
    this.overlay.removeAll(true);
    this.pauseItems = [];
  }

  private showDeath(): void {
    this.mode = 'death';
    const g = this.game_;
    this.buildOverlay(
      'VOCÊ CAIU',
      CSS.perigo,
      [
        `Quedas: ${g.deaths}`,
        g.checkpointLit ? 'Você volta ao fogão de chão aceso.' : 'Você volta ao início das ruínas.',
      ],
      ['Levantar [Espaço]', 'Reiniciar run [R]'],
    );
    this.deathTimer = this.time.delayedCall(FX.deathAutoRespawn, () => {
      if (this.mode === 'death') g.respawn();
    });
  }

  private showVictory(): void {
    this.mode = 'victory';
    const s = this.game_.stats;
    this.buildOverlay(
      'O BOITATÁ SE APAGOU',
      CSS.chama,
      [`Tempo: ${fmtTime(s.timeMs)}`, `Quedas: ${s.deaths}`, `Frascos usados: ${s.flasksUsed}`],
      ['Jogar de novo [Espaço]', 'Menu [Esc]'],
    );
  }

  private openPause(): void {
    this.mode = 'pause';
    this.scene.pause('Game');
    this.pauseIndex = 0;
    this.buildOverlay('PAUSA', CSS.osso, [], []);
    const labels = ['', '', '', ''];
    labels.forEach((_, i) => {
      const t = txt(this, 640, 380 + i * 56, '', 32).setOrigin(0.5);
      this.pauseItems.push(t);
      this.overlay.add(t);
    });
    this.overlay.add(
      txt(this, 640, 640, '↑↓ escolher · Espaço confirmar · Esc voltar', 16)
        .setOrigin(0.5)
        .setAlpha(0.6),
    );
    this.refreshPause(false);
  }

  private refreshPause(animate: boolean): void {
    const labels = [
      'Continuar',
      `Reduzir tremor/flash: ${settings.reduceFx ? 'SIM' : 'NÃO'}`,
      'Reiniciar run',
      'Sair para o título',
    ];
    this.pauseItems.forEach((t, i) => {
      const on = i === this.pauseIndex;
      t.setText(on ? `▸ ${labels[i]}` : labels[i]).setColor(on ? CSS.chama : CSS.osso);
      if (on && animate) pop(this, t);
    });
  }

  private closePause(): void {
    this.closeOverlay();
    this.scene.resume('Game');
  }

  private restartFromPause(): void {
    this.closeOverlay();
    this.scene.resume('Game');
    this.game_.restartRun();
  }

  private selectPause(): void {
    sfx.select();
    switch (this.pauseIndex) {
      case 0:
        this.closePause();
        break;
      case 1:
        settings.reduceFx = !settings.reduceFx;
        this.refreshPause(true);
        break;
      case 2:
        this.restartFromPause();
        break;
      case 3:
        this.toTitle();
        break;
    }
  }

  private toTitle(): void {
    this.scene.stop('Game');
    this.scene.start('Title');
  }
}
