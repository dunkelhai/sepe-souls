/** Estado global simples (sem save). */
export const settings = {
  reduceFx: false,
  debug: new URLSearchParams(window.location.search).get('debug') === '1',
  showFps: false,
};
