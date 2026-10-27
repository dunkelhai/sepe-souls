import Phaser from 'phaser';
import { WORLD } from './config/balance';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { TitleScene } from './scenes/TitleScene';
import { UIScene } from './scenes/UIScene';
import { CSS } from './style/palette';

async function waitFonts(): Promise<void> {
  const loads = Promise.all([
    document.fonts.load('700 48px "Cinzel"'),
    document.fonts.load('400 20px "Pixelify Sans"'),
    document.fonts.load('600 20px "Pixelify Sans"'),
  ]).then(() => document.fonts.ready);
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 3000));
  await Promise.race([loads.catch(() => undefined), timeout]);
}

void waitFonts().then(() => {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 1280,
    height: 720,
    backgroundColor: CSS.noite,
    pixelArt: true,
    fps: { target: 60 },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: WORLD.gravity }, debug: false },
    },
    scene: [BootScene, TitleScene, GameScene, UIScene],
  });
  (window as unknown as { __game: Phaser.Game }).__game = game;
});
