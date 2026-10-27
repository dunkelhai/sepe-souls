import Phaser from 'phaser';

class BootScene extends Phaser.Scene {
  create(): void {
    this.add.text(640, 360, 'sepe-souls', { color: '#e6d6b8' }).setOrigin(0.5);
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#0d1220',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene],
});

(window as unknown as { __game: Phaser.Game }).__game = game;
