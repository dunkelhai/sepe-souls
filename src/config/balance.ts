/** TODAS as constantes de balanceamento do jogo. Tempos em ms, velocidades em px/s. */
export const WORLD = {
  width: 3840,
  height: 720,
  groundY: 640,
  gravity: 1500,
  playerStartX: 140,
  checkpointX: 2480,
  bossDoorX: 2720,
  arenaLeft: 2760,
  arenaRight: 3800,
  arenaTriggerX: 2810,
  debugTeleportX: 2620,
} as const;

export const PLAYER = {
  maxHp: 100,
  maxStamina: 100,
  staminaRegen: 55, // por segundo
  staminaRegenDelay: 550,
  speed: 230,
  airControl: 0.9,
  jumpVelocity: 640,
  jumpCutFactor: 0.45,
  coyoteMs: 90,
  jumpBufferMs: 120,
  // Ataque leve em combo de 3 golpes
  attackCost: 14,
  attackDamage: [12, 12, 22],
  attackDuration: [300, 300, 420],
  attackActive: [
    [70, 170],
    [70, 170],
    [120, 240],
  ],
  attackLunge: [90, 90, 160],
  comboInputFrom: 110,
  attackRange: 74,
  attackHeight: 76,
  attackBufferMs: 180,
  rollCancelFrom: 190,
  // Esquiva
  rollCost: 24,
  rollDuration: 320,
  rollIFrames: 270,
  rollSpeed: 430,
  // Frasco de cura
  flasks: 3,
  flaskHeal: 45,
  healDuration: 800,
  healApplyAt: 430,
  // Dano recebido
  hurtDuration: 280,
  hurtKnockback: 260,
  hurtIFrames: 750,
  interactRange: 70,
} as const;

export const GHOST = {
  hp: 36,
  patrolSpeed: 55,
  chaseSpeed: 120,
  detectX: 300,
  detectY: 140,
  attackRangeX: 86,
  windup: 560,
  lungeSpeed: 400,
  lungeDuration: 230,
  recover: 720,
  damage: 18,
  hitStun: 260,
  knockback: 160,
  hoverAboveGround: 30,
  safeRespawnDist: 300, // nenhuma alma renasce mais perto que isso do jogador
  spawns: [
    { x: 900, minX: 700, maxX: 1150 },
    { x: 1560, minX: 1320, maxX: 1800 },
    { x: 2180, minX: 1950, maxX: 2380 },
  ],
} as const;

export const BOSS = {
  hp: 420,
  phase2At: 0.5,
  segments: 16,
  headRadius: 40,
  tailRadius: 10,
  hitSegments: 5, // segmentos (além da cabeça) que recebem golpe
  contactDamage: 15,
  chargeDamage: 24,
  eruptDamage: 26,
  fireballDamage: 16,
  idleY: 536,
  idleDistance: 230,
  idleMs: [1150, 720],
  telegraphMs: [450, 340],
  speedMul: [1, 1.35],
  moveSpeed: 320,
  introMs: 1500,
  // Investida rasteira
  chargeY: 598,
  chargeSpeed: 720,
  chargePrepMs: 900,
  // Cuspe em arco
  spitY: 300,
  spitCount: [3, 5],
  spitInterval: [200, 150],
  spitFlightMs: 900,
  spitSpread: 90,
  fireballGravity: 900,
  // Mergulho / erupção
  diveRiseY: 260,
  diveSpeed: 1000,
  diveWarnMs: [820, 600],
  eruptSpeed: 1400,
  eruptTopY: 250,
  eruptions: [1, 2],
  // Janela de punição após cada ataque
  recoverMs: [950, 650],
  recoverY: 566,
  enrageMs: 1100,
  deathMs: 1800,
} as const;

export const FX = {
  shakeLight: { duration: 90, intensity: 0.003 },
  shakeStrong: { duration: 180, intensity: 0.007 },
  hitFlashMs: 80,
  hitstopMs: 40,
  hitstopHeavyMs: 60,
  deathOverlayDelay: 900,
  deathAutoRespawn: 3200,
} as const;
