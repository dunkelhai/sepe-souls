import Phaser from 'phaser';

const K = Phaser.Input.Keyboard.KeyCodes;

/** Leitura unificada do teclado, uma vez por frame. */
export class Controls {
  left = false;
  right = false;
  up = false;
  down = false;
  jumpPressed = false;
  jumpHeld = false;
  actionPressed = false;
  dodgePressed = false;
  healPressed = false;

  private keys: Record<string, Phaser.Input.Keyboard.Key[]>;
  /** Toques registrados por evento (não se perdem mesmo com fps baixo). */
  private taps = new Set<string>();

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    const add = (...codes: number[]): Phaser.Input.Keyboard.Key[] =>
      codes.map((c) => kb.addKey(c, true));
    this.keys = {
      left: add(K.LEFT, K.A),
      right: add(K.RIGHT, K.D),
      up: add(K.UP, K.W),
      down: add(K.DOWN, K.S),
      action: add(K.Z, K.SPACE),
      dodge: add(K.X, K.SHIFT),
      heal: add(K.C),
    };
    for (const [name, list] of Object.entries(this.keys)) {
      for (const k of list) k.on('down', () => this.taps.add(name));
    }
  }

  private held(name: string): boolean {
    return this.keys[name].some((k) => k.isDown);
  }

  private pressed(name: string): boolean {
    const hit = this.taps.has(name);
    this.taps.delete(name);
    return hit;
  }

  update(): void {
    this.left = this.held('left');
    this.right = this.held('right');
    this.up = this.held('up');
    this.down = this.held('down');
    this.jumpHeld = this.up;
    this.jumpPressed = this.pressed('up');
    this.actionPressed = this.pressed('action');
    this.dodgePressed = this.pressed('dodge');
    this.healPressed = this.pressed('heal');
  }

  clear(): void {
    this.taps.clear();
    this.jumpPressed = this.actionPressed = this.dodgePressed = this.healPressed = false;
    this.left = this.right = this.up = this.down = this.jumpHeld = false;
  }
}
