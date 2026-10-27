/** Paleta do sepe-souls (STYLE_GUIDE §2). Nunca use hex solto nas cenas. */
export const PAL = {
  noite: 0x0d1220,
  nevoa: 0x24324a,
  nevoaFunda: 0x1a2436,
  ardosia: 0x3b4658,
  pedra: 0x7a4f3a,
  pedraLinha: 0x5e3b2b,
  ferrugem: 0xa4482a,
  ocre: 0xc88a3c,
  ocreSombra: 0x8f6a2e,
  osso: 0xe6d6b8,
  ossoSombra: 0xb5a184,
  musgo: 0x2f3a2a,
  brasa: 0xff7a1a,
  chama: 0xffd27a,
  espectro: 0x7fb8c9,
  espectroClaro: 0xbfe0e8,
  perigo: 0xe23b2e,
  olho: 0xfff6d0,
  couro: 0x4a3226,
  calca: 0x2a2c3a,
  branco: 0xffffff,
  preto: 0x000000,
} as const;

/** Versões string para `Text`. */
export const CSS = {
  noite: '#0d1220',
  osso: '#e6d6b8',
  ocre: '#c88a3c',
  brasa: '#ff7a1a',
  chama: '#ffd27a',
  espectro: '#7fb8c9',
  perigo: '#e23b2e',
  preto: '#000000',
} as const;

export const FONT_TITLE = 'Cinzel';
export const FONT_UI = 'Pixelify Sans';
