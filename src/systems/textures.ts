import Phaser from 'phaser';
import { PAL } from '../style/palette';

/**
 * Toda a arte do jogo é gerada aqui, uma única vez, em grade de 2 px
 * ("pixel limpo"), e cacheada como textura.
 */

const snap = (v: number): number => Math.round(v / 2) * 2;

type Rect = { x: number; y: number; w: number; h: number; c: number; a: number };

/** Acumula retângulos 2×2-alinhados e desenha com contorno externo opcional. */
class Painter {
  private rects: Rect[] = [];

  rect(x: number, y: number, w: number, h: number, c: number, a = 1): this {
    const r = { x: snap(x), y: snap(y), w: snap(w), h: snap(h), c, a };
    if (r.w > 0 && r.h > 0) this.rects.push(r);
    return this;
  }

  circle(cx: number, cy: number, r: number, c: number, a = 1): this {
    for (let y = -r; y < r; y += 2) {
      const yy = y + 1;
      const hw = snap(Math.sqrt(Math.max(0, r * r - yy * yy)));
      if (hw > 0) this.rect(cx - hw, cy + y, hw * 2, 2, c, a);
    }
    return this;
  }

  /** Preenche células 2×2 onde `fn` é verdadeiro, juntando corridas horizontais. */
  mask(
    x0: number,
    y0: number,
    w: number,
    h: number,
    c: number,
    fn: (x: number, y: number) => boolean,
    a = 1,
  ): this {
    for (let y = 0; y < h; y += 2) {
      let start = -1;
      for (let x = 0; x <= w; x += 2) {
        const on = x < w && fn(x + 1, y + 1);
        if (on && start < 0) start = x;
        if (!on && start >= 0) {
          this.rect(x0 + start, y0 + y, x - start, 2, c, a);
          start = -1;
        }
      }
    }
    return this;
  }

  draw(g: Phaser.GameObjects.Graphics, outline?: number): void {
    if (outline !== undefined) {
      g.fillStyle(outline, 1);
      for (const r of this.rects) {
        if (r.a >= 1) g.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
      }
    }
    for (const r of this.rects) {
      g.fillStyle(r.c, r.a);
      g.fillRect(r.x, r.y, r.w, r.h);
    }
  }
}

/** PRNG determinístico (mulberry32) para a arte sair sempre igual. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gen(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  fn: (g: Phaser.GameObjects.Graphics) => void,
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  fn(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

function paint(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  fn: (p: Painter) => void,
  outline?: number,
): void {
  gen(scene, key, w, h, (g) => {
    const p = new Painter();
    fn(p);
    p.draw(g, outline);
  });
}

// ---------------------------------------------------------------- Jogador

type Arm = 'down' | 'forward' | 'up' | 'slam' | 'flask' | 'back';
type PlayerPose = { dy: number; lean: number; legs: Array<[number, number]>; arm: Arm };

function drawPlayer(p: Painter, o: PlayerPose): void {
  const lx = o.lean;
  const dy = o.dy;
  // pernas + botas
  for (const [x, bottom] of o.legs) {
    p.rect(x, 44, 6, bottom - 48, PAL.calca);
    p.rect(x, bottom - 4, 8, 4, PAL.couro);
  }
  // poncho em trapézio
  for (let y = 26; y < 46; y += 2) {
    const t = (y - 26) / 20;
    const half = snap(8 + t * 6);
    const cx = 24 + lx;
    const stripe = y === 38 || y === 40;
    p.rect(cx - half, y + dy, half * 2, 2, stripe ? PAL.ferrugem : PAL.ocre);
    p.rect(cx - half, y + dy, 4, 2, stripe ? PAL.ferrugem : PAL.ocreSombra);
  }
  for (let x = 12; x < 36; x += 4) p.rect(x + lx, 46 + dy, 2, 2, PAL.ocreSombra);
  // braço / facão
  const ax = lx;
  switch (o.arm) {
    case 'down':
      p.rect(30 + ax, 36 + dy, 4, 4, PAL.osso);
      p.rect(30 + ax, 40 + dy, 4, 2, PAL.ferrugem);
      p.rect(32 + ax, 42 + dy, 2, 14, PAL.osso);
      break;
    case 'forward':
      p.rect(28 + ax, 30 + dy, 8, 4, PAL.ocre);
      p.rect(34 + ax, 30 + dy, 4, 4, PAL.osso);
      p.rect(38 + ax, 28 + dy, 2, 8, PAL.ferrugem);
      p.rect(40 + ax, 30 + dy, 8, 4, PAL.osso);
      break;
    case 'up':
      p.rect(28 + ax, 24 + dy, 6, 4, PAL.ocre);
      p.rect(32 + ax, 20 + dy, 4, 4, PAL.osso);
      for (let i = 0; i < 6; i++) p.rect(36 + ax + i * 2, 16 + dy - i * 2, 2, 4, PAL.osso);
      break;
    case 'slam':
      p.rect(28 + ax, 32 + dy, 8, 4, PAL.ocre);
      p.rect(36 + ax, 32 + dy, 4, 4, PAL.osso);
      for (let i = 0; i < 5; i++) p.rect(38 + ax + i * 2, 36 + dy + i * 2, 4, 2, PAL.osso);
      break;
    case 'flask':
      p.rect(26 + ax, 24 + dy, 6, 6, PAL.ocre);
      p.rect(28 + ax, 18 + dy, 4, 4, PAL.osso);
      p.rect(30 + ax, 12 + dy, 4, 8, PAL.brasa);
      p.rect(30 + ax, 10 + dy, 4, 2, PAL.couro);
      break;
    case 'back':
      p.rect(10 + ax, 28 + dy, 8, 4, PAL.ocre);
      p.rect(8 + ax, 28 + dy, 4, 4, PAL.osso);
      break;
  }
  // lenço, rosto, chapéu
  p.rect(18 + lx, 22 + dy, 12, 4, PAL.ferrugem);
  p.rect(18 + lx, 14 + dy, 12, 8, PAL.osso);
  p.rect(18 + lx, 14 + dy, 2, 8, PAL.ossoSombra);
  p.rect(16 + lx, 14 + dy, 4, 6, PAL.calca);
  p.rect(26 + lx, 16 + dy, 2, 2, PAL.noite);
  p.rect(10 + lx, 12 + dy, 28, 2, PAL.couro);
  p.rect(16 + lx, 4 + dy, 16, 8, PAL.couro);
  p.rect(16 + lx, 10 + dy, 16, 2, PAL.ferrugem);
}

const PLAYER_POSES: Record<string, PlayerPose> = {
  p_idle: {
    dy: 0,
    lean: 0,
    legs: [
      [18, 64],
      [26, 64],
    ],
    arm: 'down',
  },
  p_idle2: {
    dy: 2,
    lean: 0,
    legs: [
      [18, 64],
      [26, 64],
    ],
    arm: 'down',
  },
  p_run1: {
    dy: 0,
    lean: 2,
    legs: [
      [12, 62],
      [30, 64],
    ],
    arm: 'down',
  },
  p_run2: {
    dy: 2,
    lean: 2,
    legs: [
      [20, 64],
      [24, 60],
    ],
    arm: 'down',
  },
  p_jump: {
    dy: 0,
    lean: 0,
    legs: [
      [16, 56],
      [28, 58],
    ],
    arm: 'down',
  },
  p_att1: {
    dy: 0,
    lean: 4,
    legs: [
      [14, 64],
      [28, 64],
    ],
    arm: 'forward',
  },
  p_att2: {
    dy: 0,
    lean: 2,
    legs: [
      [14, 64],
      [28, 64],
    ],
    arm: 'up',
  },
  p_att3: {
    dy: 2,
    lean: 4,
    legs: [
      [12, 64],
      [30, 64],
    ],
    arm: 'slam',
  },
  p_heal: {
    dy: 0,
    lean: 0,
    legs: [
      [18, 64],
      [26, 64],
    ],
    arm: 'flask',
  },
  p_hurt: {
    dy: 0,
    lean: -4,
    legs: [
      [16, 64],
      [26, 62],
    ],
    arm: 'back',
  },
};

function makePlayer(scene: Phaser.Scene): void {
  for (const [key, pose] of Object.entries(PLAYER_POSES)) {
    paint(scene, key, 48, 64, (p) => drawPlayer(p, pose), PAL.noite);
  }
  // rolamento: bola de poncho com chapéu
  paint(
    scene,
    'p_roll',
    48,
    64,
    (p) => {
      p.circle(24, 48, 14, PAL.ocre);
      p.rect(12, 44, 24, 4, PAL.ferrugem);
      p.circle(20, 52, 6, PAL.ocreSombra);
      p.rect(10, 36, 28, 2, PAL.couro);
      p.rect(16, 32, 16, 4, PAL.couro);
      p.rect(32, 56, 8, 4, PAL.couro);
    },
    PAL.noite,
  );
}

// ---------------------------------------------------------------- Alma penada

function drawGhost(p: Painter, frame: 'idle' | 'idle2' | 'wind' | 'att'): void {
  const cx = 18;
  const halfs = [4, 6, 8, 9, 10, 10, 10, 9, 9, 10, 11, 12, 12, 11, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
  const phase = frame === 'idle2' ? Math.PI : 0;
  halfs.forEach((h, i) => {
    const y = 2 + i * 2;
    const sway = i > 13 ? snap(Math.sin(i * 0.8 + phase) * 3) : 0;
    const stretch = frame === 'att' && i > 8 ? -2 : 0;
    p.rect(cx - h + sway + stretch, y, h * 2, 2, PAL.espectro);
    if (h > 5) p.rect(cx - h + 4 + sway + stretch, y, h * 2 - 8, 2, PAL.espectroClaro, 0.55);
  });
  const eye = frame === 'wind' || frame === 'att' ? PAL.perigo : PAL.branco;
  p.rect(cx, 10, 4, 4, eye);
  p.rect(cx + 6, 10, 4, 4, eye);
  p.rect(cx + 2, 18, 6, 2, PAL.nevoa);
  if (frame === 'wind') {
    p.rect(cx - 16, 4, 4, 14, PAL.espectro);
    p.rect(cx - 18, 2, 4, 4, PAL.espectroClaro);
  } else if (frame === 'att') {
    p.rect(cx + 10, 22, 12, 4, PAL.espectro);
    p.rect(cx + 20, 20, 2, 2, PAL.espectroClaro);
    p.rect(cx + 20, 26, 2, 2, PAL.espectroClaro);
  } else {
    p.rect(cx - 14, 22, 4, 10, PAL.espectro);
    p.rect(cx + 10, 22, 4, 10, PAL.espectro);
  }
}

function makeGhost(scene: Phaser.Scene): void {
  (['idle', 'idle2', 'wind', 'att'] as const).forEach((f) => {
    paint(scene, `g_${f}`, 40, 52, (p) => drawGhost(p, f), PAL.noite);
  });
}

// ---------------------------------------------------------------- Boitatá

function makeBoss(scene: Phaser.Scene): void {
  const head = (key: string, outer: number, body: number, core: number, hot: number): void =>
    paint(
      scene,
      key,
      112,
      96,
      (p) => {
        p.circle(44, 50, 38, outer);
        p.rect(56, 34, 46, 30, outer);
        p.rect(60, 62, 40, 8, PAL.ferrugem);
        p.circle(44, 50, 32, body);
        p.rect(56, 38, 42, 22, body);
        p.circle(42, 52, 20, core);
        p.circle(40, 54, 8, hot);
        p.rect(60, 44, 36, 8, core);
        p.rect(94, 40, 4, 4, PAL.noite);
        p.rect(62, 24, 24, 6, PAL.ferrugem);
        p.circle(72, 36, 10, PAL.olho);
        p.rect(72, 28, 4, 14, PAL.noite);
        p.rect(84, 70, 4, 6, PAL.osso);
        p.rect(94, 70, 4, 6, PAL.osso);
      },
      PAL.noite,
    );
  head('bt_head', PAL.ferrugem, PAL.brasa, PAL.chama, PAL.olho);
  head('bt_head2', PAL.brasa, PAL.chama, PAL.olho, PAL.branco);

  const seg = (key: string, a: number, b: number, c: number, d: number): void =>
    paint(scene, key, 96, 96, (p) => {
      p.circle(48, 48, 46, PAL.chama, 0.16);
      p.circle(48, 48, 40, a);
      p.circle(48, 48, 34, b);
      p.circle(46, 50, 22, c);
      p.circle(44, 52, 9, d);
    });
  seg('bt_seg', PAL.ferrugem, PAL.brasa, PAL.chama, PAL.olho);
  seg('bt_seg2', PAL.brasa, PAL.chama, PAL.olho, PAL.branco);

  paint(scene, 'fireball', 32, 32, (p) => {
    p.circle(16, 16, 14, PAL.brasa, 0.5);
    p.circle(16, 16, 11, PAL.brasa);
    p.circle(16, 16, 7, PAL.chama);
    p.circle(15, 17, 3, PAL.olho);
  });
}

// ---------------------------------------------------------------- FX e UI

function makeFx(scene: Phaser.Scene): void {
  gen(scene, 'light', 256, 256, (g) => {
    for (let i = 0; i < 20; i++) {
      g.fillStyle(0xffffff, 0.04);
      g.fillCircle(128, 128, 128 * (1 - i / 20));
    }
  });
  gen(scene, 'px', 4, 4, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 4, 4);
  });
  gen(scene, 'smoke', 24, 24, (g) => {
    for (let i = 0; i < 3; i++) {
      g.fillStyle(0xffffff, 0.35);
      g.fillCircle(12, 12, 12 - i * 3);
    }
  });
  paint(scene, 'slash', 80, 72, (p) => {
    const cx = 14;
    const cy = 36;
    p.mask(0, 0, 80, 72, PAL.chama, (x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      if (dx < 6) return false;
      const ang = Math.abs(Math.atan2(dy, dx));
      const inner = 44 + ang * 10;
      return d > inner && d < 58;
    });
    p.mask(0, 0, 80, 72, PAL.olho, (x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      if (dx < 14) return false;
      const ang = Math.abs(Math.atan2(dy, dx));
      return d > 52 + ang * 3 && d < 58;
    });
  });
  const flask = (key: string, liquid: number): void =>
    paint(
      scene,
      key,
      20,
      24,
      (p) => {
        p.rect(8, 2, 4, 4, PAL.couro);
        p.rect(6, 6, 8, 4, PAL.osso);
        p.rect(4, 10, 12, 12, liquid);
        p.rect(6, 12, 2, 6, PAL.chama);
      },
      PAL.noite,
    );
  flask('flask', PAL.brasa);
  flask('flask_empty', PAL.ardosia);
}

// ---------------------------------------------------------------- Cenário

function makeBlocks(scene: Phaser.Scene): void {
  for (let v = 0; v < 4; v++) {
    const r = rng(100 + v);
    paint(scene, `block${v}`, 64, 64, (p) => {
      p.rect(0, 0, 64, 64, PAL.pedra);
      for (let row = 0; row < 4; row++) {
        const y = row * 16;
        p.rect(0, y + 14, 64, 2, PAL.pedraLinha);
        const off = row % 2 === 0 ? 0 : 16;
        for (let x = off; x < 64; x += 32) p.rect(x, y, 2, 14, PAL.pedraLinha);
      }
      for (let i = 0; i < 3; i++) {
        p.rect(r() * 52, r() * 52, 6 + r() * 12, 4 + r() * 8, PAL.ferrugem, 0.4);
      }
      for (let i = 0; i < 4; i++) p.rect(r() * 60, r() * 60, 4, 2, PAL.osso, 0.15);
      p.rect(0, 56, 64, 8, PAL.noite, 0.2);
    });
  }
  const r = rng(7);
  paint(scene, 'ground', 64, 80, (p) => {
    p.rect(0, 0, 64, 80, PAL.pedra);
    p.rect(0, 0, 64, 6, PAL.couro);
    p.rect(0, 6, 64, 2, PAL.ocreSombra);
    for (let row = 0; row < 5; row++) {
      const y = 8 + row * 16;
      p.rect(0, y + 14, 64, 2, PAL.pedraLinha);
      const off = row % 2 === 0 ? 8 : 40;
      p.rect(off, y, 2, 14, PAL.pedraLinha);
    }
    for (let i = 0; i < 3; i++) p.rect(r() * 56, 10 + r() * 60, 8, 4, PAL.ferrugem, 0.4);
    p.rect(0, 40, 64, 40, PAL.noite, 0.25);
    p.rect(0, 60, 64, 20, PAL.noite, 0.25);
  });
  paint(scene, 'grass', 28, 22, (p) => {
    const gr = rng(3);
    for (let b = 0; b < 8; b++) {
      const x0 = 2 + b * 3;
      const h = 10 + Math.floor(gr() * 9);
      const tilt = gr() < 0.5 ? -1 : 1;
      const col = b % 2 === 0 ? PAL.ocre : PAL.ocreSombra;
      for (let y = 0; y < h; y += 2) {
        p.rect(x0 + Math.floor((y / h) * 4) * tilt, 22 - y - 2, 2, 2, col);
      }
    }
  });
  paint(scene, 'column', 56, 260, (p) => {
    p.mask(8, 0, 40, 244, PAL.pedra, (x, y) => y > 16 + Math.abs(Math.sin(x * 0.3)) * 10);
    p.rect(0, 26, 56, 10, PAL.pedra);
    p.rect(0, 34, 56, 2, PAL.pedraLinha);
    for (let x = 14; x < 48; x += 8) p.rect(x, 40, 2, 200, PAL.pedraLinha);
    p.rect(2, 244, 52, 16, PAL.pedra);
    p.rect(2, 244, 52, 2, PAL.pedraLinha);
    p.rect(30, 120, 10, 14, PAL.ferrugem, 0.4);
  });
  paint(scene, 'arch', 320, 280, (p) => {
    p.rect(0, 110, 48, 170, PAL.pedra);
    p.rect(272, 140, 48, 140, PAL.pedra);
    for (let y = 120; y < 280; y += 18) {
      p.rect(0, y, 48, 2, PAL.pedraLinha);
      p.rect(272, y + 8, 48, 2, PAL.pedraLinha);
    }
    p.mask(0, 0, 320, 140, PAL.pedra, (x, y) => {
      const d = Math.hypot(x - 160, y - 136);
      if (x > 188 && x < 236) return false;
      if (x >= 236 && y < 60 + (x - 236) * 0.6) return false;
      return d > 112 && d < 138 && y < 136;
    });
    p.mask(0, 0, 320, 140, PAL.pedraLinha, (x, y) => {
      const d = Math.hypot(x - 160, y - 136);
      const a = Math.atan2(y - 136, x - 160);
      if (x > 188 && x < 236) return false;
      if (x >= 236 && y < 60 + (x - 236) * 0.6) return false;
      return d > 112 && d < 138 && y < 136 && Math.abs(((a * 180) / Math.PI) % 14) < 1.6;
    });
    p.rect(120, 30, 14, 10, PAL.ferrugem, 0.35);
  });
  // fogão de chão
  paint(
    scene,
    'fogao',
    80,
    28,
    (p) => {
      p.circle(16, 18, 10, PAL.ardosia);
      p.circle(40, 20, 12, PAL.ardosia);
      p.circle(64, 18, 10, PAL.ardosia);
      p.rect(10, 10, 10, 2, PAL.osso, 0.3);
      p.rect(34, 10, 12, 2, PAL.osso, 0.3);
      p.rect(58, 10, 10, 2, PAL.osso, 0.3);
    },
    PAL.noite,
  );
  paint(scene, 'coal', 40, 8, (p) => {
    p.rect(0, 2, 40, 6, PAL.couro);
    for (let x = 2; x < 38; x += 6) p.rect(x, 2, 4, 2, PAL.ferrugem);
  });
  gen(scene, 'flame', 40, 52, (g) => {
    g.fillStyle(PAL.brasa, 1);
    g.fillTriangle(2, 52, 38, 52, 20, 0);
    g.fillTriangle(0, 52, 16, 52, 6, 22);
    g.fillTriangle(24, 52, 40, 52, 34, 18);
    g.fillStyle(PAL.chama, 1);
    g.fillTriangle(8, 52, 32, 52, 20, 14);
    g.fillStyle(PAL.olho, 1);
    g.fillTriangle(14, 52, 26, 52, 20, 30);
  });
  gen(scene, 'firewall', 64, 128, (g) => {
    g.fillStyle(PAL.brasa, 0.35);
    g.fillRect(8, 0, 48, 128);
    for (let k = 0; k < 2; k++) {
      const oy = k * 64;
      g.fillStyle(PAL.brasa, 0.9);
      g.fillTriangle(4, oy + 64, 32, oy + 64, 18, oy + 4);
      g.fillTriangle(30, oy + 64, 60, oy + 64, 46, oy + 10);
      g.fillStyle(PAL.chama, 0.95);
      g.fillTriangle(12, oy + 64, 28, oy + 64, 20, oy + 22);
      g.fillTriangle(36, oy + 64, 54, oy + 64, 46, oy + 28);
      g.fillStyle(PAL.olho, 0.9);
      g.fillTriangle(16, oy + 64, 24, oy + 64, 20, oy + 40);
    }
  });
}

function makeBackdrop(scene: Phaser.Scene): void {
  gen(scene, 'sky', 1280, 720, (g) => {
    g.fillGradientStyle(PAL.noite, PAL.noite, PAL.nevoa, PAL.nevoa, 1);
    g.fillRect(0, 0, 1280, 720);
    const r = rng(11);
    for (let i = 0; i < 70; i++) {
      g.fillStyle(PAL.osso, 0.25 + r() * 0.5);
      g.fillRect(Math.floor(r() * 640) * 2, Math.floor(r() * 200) * 2, 2, 2);
    }
  });
  gen(scene, 'moon', 128, 128, (g) => {
    for (const rr of [62, 52, 42]) {
      g.fillStyle(PAL.osso, 0.05);
      g.fillCircle(64, 64, rr);
    }
    const p = new Painter();
    p.circle(64, 64, 28, PAL.osso);
    p.circle(76, 58, 24, PAL.nevoaFunda);
    p.draw(g);
  });
  gen(scene, 'hills', 1280, 300, (g) => {
    const tau = Math.PI * 2;
    const ridge = (base: number, a1: number, a2: number, ph: number, col: number): void => {
      const pts: Phaser.Types.Math.Vector2Like[] = [{ x: 0, y: 300 }];
      for (let x = 0; x <= 1280; x += 8) {
        const y =
          base + a1 * Math.sin((tau * x * 2) / 1280 + ph) + a2 * Math.sin((tau * x * 5) / 1280);
        pts.push({ x, y: snap(y) });
      }
      pts.push({ x: 1280, y: 300 });
      g.fillStyle(col, 1);
      g.fillPoints(pts, true);
    };
    ridge(120, 34, 16, 0, PAL.nevoa);
    ridge(190, 24, 12, 2, PAL.nevoaFunda);
  });
  paint(scene, 'farruins', 1280, 380, (p) => {
    const c = PAL.ardosia;
    // torre da igreja
    p.rect(180, 80, 90, 300, c);
    p.mask(180, 20, 90, 60, c, (x, y) => Math.abs(x - 45) < y * 0.75);
    p.rect(222, 0, 6, 26, c);
    p.rect(214, 8, 22, 6, c);
    // arcada
    for (let i = 0; i < 6; i++) {
      const x0 = 420 + i * 80;
      const top = i === 3 ? 230 : 180;
      p.rect(x0, top, 18, 380 - top, c);
      if (i < 5 && i !== 2) {
        p.mask(x0, top - 40, 98, 40, c, (x, y) => {
          const d = Math.hypot(x - 49, y - 44);
          return d > 30 && d < 46;
        });
      }
    }
    p.rect(400, 300, 520, 80, c);
    // muro quebrado e torre baixa
    p.mask(980, 200, 200, 180, c, (x, y) => y > 40 + Math.abs(Math.sin(x * 0.05)) * 60);
    p.rect(1080, 140, 50, 240, c);
    p.rect(40, 260, 100, 120, c);
  });
  gen(scene, 'fog', 512, 200, (g) => {
    const r = rng(21);
    for (let i = 0; i < 26; i++) {
      const x = r() * 512;
      const y = 40 + r() * 120;
      const w = 80 + r() * 160;
      const h = 30 + r() * 50;
      g.fillStyle(0xffffff, 0.06);
      for (const ox of [-512, 0, 512]) g.fillEllipse(x + ox, y, w, h);
    }
  });
  gen(scene, 'fore', 1280, 220, (g) => {
    const r = rng(31);
    g.fillStyle(PAL.musgo, 1);
    for (const cx of [90, 470, 860, 1150]) {
      for (let b = 0; b < 16; b++) {
        const x = cx + (r() - 0.5) * 120;
        const h = 40 + r() * 120;
        const lean = (r() - 0.5) * 40;
        g.fillTriangle(x - 5, 220, x + 5, 220, x + lean, 220 - h);
      }
    }
  });
}

export function makeAllTextures(scene: Phaser.Scene): void {
  makePlayer(scene);
  makeGhost(scene);
  makeBoss(scene);
  makeFx(scene);
  makeBlocks(scene);
  makeBackdrop(scene);
}
