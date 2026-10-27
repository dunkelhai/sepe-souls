import Phaser from 'phaser';
import { makeAllTextures } from '../systems/textures';

/** Gera toda a arte procedural uma vez e segue para o título. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    makeAllTextures(this);
    this.scene.start('Title');
  }
}
