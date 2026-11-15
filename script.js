/* ÁrvoreNós — lógica do quadro de nós (HTML/CSS/JS nativos) */
'use strict';

//#region Constantes

const SVG_NS = 'http://www.w3.org/2000/svg';

const FORMAT = 'node-graph';
const VERSION = 1;
const SUPPORTED_VERSIONS = [1];
const STORAGE_KEY = 'arvorenos:board:v1';

const DEFAULT_COLOR = '#3b82f6';
/** Laranja de destaque usado na aplicação */
const ACCENT_COLOR = '#e8873c';
/** Cor padrão da borda do nó quando a opção "Borda" é ativada */
const DEFAULT_BORDER_COLOR = ACCENT_COLOR;
/** Cor padrão de uma ligação (mesma de --connection no CSS) */
const DEFAULT_CONNECTION_COLOR = '#7e8a9c';
/** Espessura da borda do nó quando ativada */
const NODE_BORDER_WIDTH = 3;

/** Cores fixas acima do seletor de cor: 5 bases e a intermediária entre cada par */
const PRESET_COLORS = [
  { name: 'Vermelho', value: '#ef4444' },
  { name: 'Magenta', value: '#d946ef' },
  { name: 'Roxo', value: '#8b5cf6' },
  { name: 'Anil', value: '#6366f1' },
  { name: 'Azul', value: '#3b82f6' },
  { name: 'Ciano', value: '#06b6d4' },
  { name: 'Verde', value: '#22c55e' },
  { name: 'Lima', value: '#84cc16' },
  { name: 'Amarelo', value: '#eab308' },
  { name: 'Laranja', value: '#f97316' },
];
const NODE_FONT = '600 13px system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const FONT_SIZE = 13;
const NODE_RADIUS = 46;
const DRAG_THRESHOLD = 4;

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 1.25;

/** Grade em anéis: distância entre anéis concêntricos */
const RING_STEP = 180;
/** Grade em anéis: posições de encaixe no primeiro anel (5, 10, 15… nos seguintes) */
const RING_BASE_DIVISIONS = 5;
/** Grade em anéis: quantidade de anéis desenhados a partir do centro */
const RING_COUNT = 30;

//#endregion

//#region Estado

/** Nós: { id, text, color, position: { x, y } } */
/** Conexões: { id, sourceId, targetId } */
const state = {
  nodes: [],
  connections: [],
};

let mode = 'edit';        // 'edit' | 'connect'
let selectedId = null;    // nó aberto no modal de edição
let pendingId = null;     // primeiro nó escolhido no modo de conexão
let editingId = null;     // nó em edição no modal (null = criação)
let editingConnectionId = null;  // ligação em edição no modal de cor
let drag = null;          // arraste em andamento
let pan = null;           // deslocamento do quadro (botão do meio) em andamento
let marquee = null;       // caixa de seleção em andamento
let gridEnabled = false;  // grade em anéis ativa (com encaixe dos nós)

/** Ids dos nós selecionados pela caixa de seleção */
const selectedIds = new Set();

/** Transformação do quadro: escala (k) e deslocamento (tx, ty) em pixels de tela */
const view = { k: 1, tx: 0, ty: 0 };

const nodeEls = new Map();  // id -> <g>
const connEls = new Map();  // id -> <g> (área de clique + linha visível)
const visual = new Map();   // id -> { group, radius }

//#endregion

//#region Elementos da interface

const board = document.getElementById('board');
const viewport = document.getElementById('viewport');
const layerGrid = document.getElementById('layer-grid');
const layerConnections = document.getElementById('layer-connections');
const layerNodes = document.getElementById('layer-nodes');
const emptyMsg = document.getElementById('empty');
const modeHint = document.getElementById('mode-hint');
const marqueeRect = document.getElementById('marquee');
const btnDeleteSelected = document.getElementById('btn-delete-selected');
const btnMode = document.getElementById('btn-mode');
const btnAdd = document.getElementById('btn-add');
const btnExport = document.getElementById('btn-export');
const btnImport = document.getElementById('btn-import');
const btnPng = document.getElementById('btn-png');
const pngMenu = document.getElementById('png-menu');
const btnGrid = document.getElementById('btn-grid');
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const btnZoomReset = document.getElementById('btn-zoom-reset');
const fileInput = document.getElementById('file-input');

const nodeDialog = document.getElementById('node-dialog');
const nodeForm = document.getElementById('node-form');
const nodeDialogTitle = document.getElementById('node-dialog-title');
const fieldText = document.getElementById('field-text');
const fieldColor = document.getElementById('field-color');
const colorSwatches = document.getElementById('color-swatches');
const fieldBorder = document.getElementById('field-border');
const fieldBorderColor = document.getElementById('field-border-color');
const borderColorField = document.getElementById('border-color-field');
const borderDefault = document.getElementById('border-default');
const formError = document.getElementById('form-error');
const btnDelete = document.getElementById('btn-delete');
const btnCancel = document.getElementById('btn-cancel');
const dialogClose = document.getElementById('dialog-close');

const connectionDialog = document.getElementById('connection-dialog');
const connectionForm = document.getElementById('connection-form');
const fieldConnectionColor = document.getElementById('field-connection-color');
const connectionPreset = document.getElementById('connection-accent');
const connectionCancel = document.getElementById('connection-cancel');
const connectionClose = document.getElementById('connection-close');

const confirmEl = document.getElementById('confirm-dialog');
const confirmMessage = document.getElementById('confirm-message');
const confirmOk = document.getElementById('confirm-ok');
const confirmCancel = document.getElementById('confirm-cancel');

const toastEl = document.getElementById('toast');
const appEl = document.querySelector('.app');

//#endregion

//#region Utilitários

const measureCanvas = document.createElement('canvas');
const measureCtx = measureCanvas.getContext('2d');

function measureText(text) {
  measureCtx.font = NODE_FONT;
  return measureCtx.measureText(text).width;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** Converte "#rrggbb" em canais { r, g, b } (0–255). */
function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

/** Converte canais 0–255 em "#rrggbb". */
function rgbToHex(r, g, b) {
  const channel = (value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** Converte canais 0–255 em { h: 0–360, s: 0–1, v: 0–1 }. */
function rgbToHsv(r, g, b) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  return { h: hue, s: max === 0 ? 0 : delta / max, v: max };
}

/** Converte { h, s, v } em canais 0–255. */
function hsvToRgb(h, s, v) {
  const chroma = v * s;
  const second = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const base = v - chroma;

  let rgb;
  if (h < 60) rgb = [chroma, second, 0];
  else if (h < 120) rgb = [second, chroma, 0];
  else if (h < 180) rgb = [0, chroma, second];
  else if (h < 240) rgb = [0, second, chroma];
  else if (h < 300) rgb = [second, 0, chroma];
  else rgb = [chroma, 0, second];

  return { r: (rgb[0] + base) * 255, g: (rgb[1] + base) * 255, b: (rgb[2] + base) * 255 };
}

/** Aceita "#abc" ou "#aabbcc" (com ou sem "#") e devolve "#aabbcc" — ou null. */
function normalizeHex(text) {
  const value = String(text).trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(value)) {
    return `#${value[0]}${value[0]}${value[1]}${value[1]}${value[2]}${value[2]}`.toLowerCase();
  }
  if (/^[0-9a-f]{6}$/i.test(value)) return `#${value.toLowerCase()}`;
  return null;
}

function hsvFromHex(hex) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsv(r, g, b);
}

function makeId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function findNode(id) {
  return state.nodes.find((node) => node.id === id) || null;
}

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Localiza a conexão entre dois nós, independentemente da ordem.
 */
function findConnection(a, b) {
  const key = pairKey(a, b);
  return state.connections.find((conn) => pairKey(conn.sourceId, conn.targetId) === key) || null;
}

function toBoardPoint(event) {
  const rect = board.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left - view.tx) / view.k,
    y: (event.clientY - rect.top - view.ty) / view.k,
  };
}

function boardSize() {
  const rect = board.getBoundingClientRect();
  return {
    width: rect.width || window.innerWidth,
    height: rect.height || window.innerHeight,
  };
}

/** Região do quadro atualmente visível, em coordenadas do quadro */
function visibleWorldRect() {
  const { width, height } = boardSize();
  return {
    left: -view.tx / view.k,
    top: -view.ty / view.k,
    width: width / view.k,
    height: height / view.k,
  };
}

function formatDate(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

//#endregion

//#region Seletor de cor

/** Ícone do botão de copiar. */
const COPY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
  + '<rect x="9" y="9" width="12" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8" />'
  + '<path d="M15 5V4.5A1.5 1.5 0 0 0 13.5 3h-9A1.5 1.5 0 0 0 3 4.5v9A1.5 1.5 0 0 0 4.5 15H5"'
  + ' fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />'
  + '</svg>';

/** Seletor de cor aberto no momento (apenas um por vez). */
let activePicker = null;

function closeActivePicker() {
  if (activePicker) activePicker.close();
}

/**
 * Troca um <input type="hidden"> por um seletor de cor próprio: amostra da
 * cor, código hexadecimal editável, botão de copiar e painel HSV em um popover.
 *
 * O input original continua guardando o valor — quem lê `input.value` segue
 * funcionando, e as escritas programáticas são interceptadas para que o painel
 * acompanhe a cor atual.
 */
function createColorPicker(input) {
  const nativeValue = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value');

  const root = document.createElement('div');
  root.className = 'picker';

  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'picker__chip';
  chip.setAttribute('aria-haspopup', 'dialog');
  chip.setAttribute('aria-expanded', 'false');
  chip.setAttribute('aria-label', 'Abrir seletor de cor');

  const hexInput = document.createElement('input');
  hexInput.type = 'text';
  hexInput.className = 'picker__hex';
  hexInput.spellcheck = false;
  hexInput.autocomplete = 'off';
  hexInput.maxLength = 7;
  hexInput.setAttribute('aria-label', 'Código hexadecimal');

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'picker__copy';
  copyBtn.title = 'Copiar código';
  copyBtn.setAttribute('aria-label', 'Copiar código hexadecimal');
  copyBtn.innerHTML = COPY_ICON;

  const pop = document.createElement('div');
  pop.className = 'picker__pop';
  pop.hidden = true;

  const area = document.createElement('div');
  area.className = 'picker__area';
  const areaThumb = document.createElement('span');
  areaThumb.className = 'picker__thumb';
  area.append(areaThumb);

  const hue = document.createElement('div');
  hue.className = 'picker__hue';
  const hueThumb = document.createElement('span');
  hueThumb.className = 'picker__thumb';
  hue.append(hueThumb);

  pop.append(area, hue);
  root.append(chip, hexInput, copyBtn, pop);
  input.parentNode.insertBefore(root, input);
  input.hidden = true;

  let hsv = hsvFromHex(input.value || DEFAULT_COLOR);
  let internal = false;

  function render() {
    const hex = input.value;
    root.style.setProperty('--picker-color', hex);
    root.style.setProperty('--picker-hue', `hsl(${Math.round(hsv.h)} 100% 50%)`);
    if (document.activeElement !== hexInput) hexInput.value = hex;
    areaThumb.style.left = `${hsv.s * 100}%`;
    areaThumb.style.top = `${(1 - hsv.v) * 100}%`;
    hueThumb.style.left = `${(hsv.h / 360) * 100}%`;
  }

  /** Grava o valor no input e avisa os ouvintes (bolinhas de cor, etc.). */
  function commit(hex) {
    input.value = hex;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /** Aplica um código hexadecimal: o HSV é recalculado a partir dele. */
  function setFromHex(hex) {
    commit(hex);
  }

  /** Aplica o HSV atual preservando o matiz (evita saltos em cores neutras). */
  function updateFromHsv() {
    const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v);
    internal = true;
    commit(rgbToHex(r, g, b));
    internal = false;
  }

  Object.defineProperty(input, 'value', {
    configurable: true,
    get() {
      return nativeValue.get.call(input);
    },
    set(value) {
      nativeValue.set.call(input, value);
      if (!internal) hsv = hsvFromHex(nativeValue.get.call(input));
      render();
    },
  });

  function trackDrag(element, apply) {
    let pointerId = null;

    element.addEventListener('pointerdown', (event) => {
      pointerId = event.pointerId;
      try {
        element.setPointerCapture(pointerId);
      } catch (error) {
        /* ignore */
      }
      apply(event);
      event.preventDefault();
    });

    element.addEventListener('pointermove', (event) => {
      if (pointerId === null || event.pointerId !== pointerId) return;
      apply(event);
      event.preventDefault();
    });

    const end = (event) => {
      if (pointerId === null || event.pointerId !== pointerId) return;
      try {
        element.releasePointerCapture(pointerId);
      } catch (error) {
        /* ignore */
      }
      pointerId = null;
    };

    element.addEventListener('pointerup', end);
    element.addEventListener('pointercancel', end);
  }

  trackDrag(area, (event) => {
    const rect = area.getBoundingClientRect();
    hsv = {
      h: hsv.h,
      s: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      v: 1 - clamp((event.clientY - rect.top) / rect.height, 0, 1),
    };
    updateFromHsv();
  });

  trackDrag(hue, (event) => {
    const rect = hue.getBoundingClientRect();
    hsv = {
      h: clamp((event.clientX - rect.left) / rect.width, 0, 1) * 360,
      s: hsv.s,
      v: hsv.v,
    };
    updateFromHsv();
  });

  hexInput.addEventListener('input', () => {
    const hex = normalizeHex(hexInput.value);
    if (hex) setFromHex(hex);
  });

  hexInput.addEventListener('blur', () => {
    hexInput.value = input.value;
  });

  hexInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    hexInput.blur();
  });

  copyBtn.addEventListener('click', async () => {
    const hex = input.value;
    try {
      await navigator.clipboard.writeText(hex);
      toast(`${hex} copiado.`);
    } catch (error) {
      hexInput.focus();
      hexInput.select();
      toast('Não foi possível copiar automaticamente.', 'error');
    }
  });

  const instance = {
    root,
    close() {
      setOpen(false);
    },
  };

  function setOpen(open) {
    if (open) {
      if (activePicker && activePicker !== instance) activePicker.close();
      pop.hidden = false;
      chip.setAttribute('aria-expanded', 'true');
      activePicker = instance;

      // Abre para cima quando não há espaço abaixo.
      pop.classList.remove('picker__pop--up');
      if (pop.getBoundingClientRect().bottom > window.innerHeight - 8) {
        pop.classList.add('picker__pop--up');
      }
    } else {
      pop.hidden = true;
      chip.setAttribute('aria-expanded', 'false');
      if (activePicker === instance) activePicker = null;
    }
  }

  chip.addEventListener('click', () => setOpen(pop.hidden));

  render();
  return instance;
}

//#endregion

//#region Zoom

function applyViewport() {
  viewport.setAttribute('transform', `translate(${view.tx} ${view.ty}) scale(${view.k})`);
}

function updateZoomControls() {
  btnZoomReset.textContent = `${Math.round(view.k * 100)}%`;
  btnZoomIn.disabled = view.k >= MAX_ZOOM;
  btnZoomOut.disabled = view.k <= MIN_ZOOM;
}

/**
 * Aplica a escala mantendo fixo o ponto informado (em pixels de tela).
 *
 * @param {number} nextScale Nova escala desejada.
 * @param {{x: number, y: number}} [anchor] Ponto de referência; o centro do quadro por padrão.
 */
function setZoom(nextScale, anchor) {
  const scale = clamp(nextScale, MIN_ZOOM, MAX_ZOOM);
  if (scale === view.k) return;

  const { width, height } = boardSize();
  const point = anchor || { x: width / 2, y: height / 2 };
  const worldX = (point.x - view.tx) / view.k;
  const worldY = (point.y - view.ty) / view.k;

  view.k = scale;
  view.tx = point.x - worldX * scale;
  view.ty = point.y - worldY * scale;

  applyViewport();
  updateZoomControls();
}

function resetView() {
  view.k = 1;
  view.tx = 0;
  view.ty = 0;
  applyViewport();
  updateZoomControls();
}

/**
 * Zoom com a roda do mouse, mantendo o cursor como ponto fixo.
 */
function onWheel(event) {
  let delta = event.deltaY;
  if (event.deltaMode === 1) delta *= 16;
  else if (event.deltaMode === 2) delta *= 100;

  const factor = Math.exp(-delta * 0.0015);
  const rect = board.getBoundingClientRect();
  setZoom(view.k * factor, { x: event.clientX - rect.left, y: event.clientY - rect.top });

  event.preventDefault();
}

//#endregion

//#region Dimensões e texto dos nós

function maxTextWidth(radius) {
  const halfLine = FONT_SIZE / 2 + 3;
  return 2 * Math.sqrt(Math.max(0, radius * radius - halfLine * halfLine)) - 6;
}

function fitText(text, limit) {
  if (measureText(text) <= limit) return text;

  const ellipsis = '…';
  let result = text;
  while (result.length > 1 && measureText(result + ellipsis) > limit) {
    result = result.slice(0, -1);
  }
  return result + ellipsis;
}

function findFreePosition(radius) {
  const area = visibleWorldRect();
  const centerX = area.left + area.width / 2;
  const centerY = area.top + area.height / 2;
  const pad = radius + 16;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < 900; i += 1) {
    const distance = 34 * Math.sqrt(i);
    const angle = i * goldenAngle;
    const x = centerX + Math.cos(angle) * distance;
    const y = centerY + Math.sin(angle) * distance;

    if (x < area.left + pad || y < area.top + pad
      || x > area.left + area.width - pad || y > area.top + area.height - pad) continue;

    const free = state.nodes.every((node) => {
      const other = visual.get(node.id);
      const otherRadius = other ? other.radius : NODE_RADIUS;
      return Math.hypot(node.position.x - x, node.position.y - y) >= radius + otherRadius + 18;
    });

    if (free) return { x, y };
  }

  return {
    x: centerX + (Math.random() - 0.5) * 80,
    y: centerY + (Math.random() - 0.5) * 80,
  };
}

//#endregion

//#region Grade em anéis

/**
 * Quantidade de posições de encaixe no anel informado.
 * Cresce 5 a cada anel: 5 no primeiro, 10 no segundo, 15 no terceiro…
 */
function ringDivisions(ringIndex) {
  return RING_BASE_DIVISIONS * Math.max(1, ringIndex);
}

/**
 * Desenha a grade (anéis concêntricos + raios) em coordenadas do quadro.
 *
 * Cada faixa entre dois anéis tem os raios do anel externo, de modo que todo
 * ponto de encaixe fica visível no cruzamento de um anel com um raio.
 */
function buildRingGrid() {
  layerGrid.textContent = '';

  const rings = [];
  const spokes = [];

  for (let i = 1; i <= RING_COUNT; i += 1) {
    const radius = RING_STEP * i;
    rings.push(
      `M ${-radius} 0 a ${radius} ${radius} 0 1 0 ${radius * 2} 0 a ${radius} ${radius} 0 1 0 ${-radius * 2} 0`,
    );

    const divisions = ringDivisions(i);
    const angularStep = (Math.PI * 2) / divisions;
    const inner = radius - RING_STEP;

    for (let j = 0; j < divisions; j += 1) {
      const angle = angularStep * j;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      spokes.push(
        `M ${(cos * inner).toFixed(2)} ${(sin * inner).toFixed(2)}`
        + ` L ${(cos * radius).toFixed(2)} ${(sin * radius).toFixed(2)}`,
      );
    }
  }

  const ringsPath = document.createElementNS(SVG_NS, 'path');
  ringsPath.setAttribute('class', 'grid-ring');
  ringsPath.setAttribute('d', rings.join(' '));
  layerGrid.appendChild(ringsPath);

  const spokesPath = document.createElementNS(SVG_NS, 'path');
  spokesPath.setAttribute('class', 'grid-spoke');
  spokesPath.setAttribute('d', spokes.join(' '));
  layerGrid.appendChild(spokesPath);
}

/**
 * Converte um ponto do quadro para o cruzamento (anel × raio) mais próximo.
 */
function snapToGrid(x, y) {
  const radius = Math.hypot(x, y);
  const ringIndex = Math.round(radius / RING_STEP);
  const ringRadius = ringIndex * RING_STEP;
  const angularStep = (Math.PI * 2) / ringDivisions(ringIndex);
  const angle = Math.round(Math.atan2(y, x) / angularStep) * angularStep;

  return {
    x: ringRadius * Math.cos(angle),
    y: ringRadius * Math.sin(angle),
  };
}

function setGrid(enabled) {
  gridEnabled = enabled;
  syncStyles();
}

//#endregion

//#region Persistência

function save() {
  try {
    const payload = {
      format: FORMAT,
      version: VERSION,
      nodes: state.nodes,
      connections: state.connections,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Não foi possível salvar os dados localmente.', error);
  }
}

function loadFromStorage() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Não foi possível acessar o armazenamento local.', error);
    return false;
  }
  if (!raw) return false;

  const result = validateBoard(raw);
  if (result.error) {
    console.warn('Dados armazenados inválidos, ignorando.', result.error);
    return false;
  }

  state.nodes = result.data.nodes;
  state.connections = result.data.connections;
  return true;
}

//#endregion

//#region Renderização

function buildNodeVisual(node) {
  const radius = NODE_RADIUS;

  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('class', 'node');
  group.setAttribute('data-id', node.id);
  group.setAttribute('tabindex', '0');
  group.setAttribute('role', 'button');
  group.setAttribute('aria-label', node.text);

  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('class', 'node__circle');
  circle.setAttribute('r', String(radius));
  circle.setAttribute('fill', node.color);

  if (node.border && node.border.enabled) {
    group.classList.add('node--bordered');
    circle.style.setProperty('--node-border', node.border.color);
    circle.style.setProperty('--node-border-width', String(NODE_BORDER_WIDTH));
  }

  const label = document.createElementNS(SVG_NS, 'text');
  label.setAttribute('class', 'node__label');
  label.setAttribute('text-anchor', 'middle');
  label.setAttribute('dominant-baseline', 'central');
  label.setAttribute('y', '1');
  label.textContent = fitText(node.text, maxTextWidth(radius));

  group.append(circle, label);
  return { group, radius };
}

function applyNodeTransform(id) {
  const node = findNode(id);
  const entry = visual.get(id);
  if (!node || !entry) return;
  entry.group.setAttribute('transform', `translate(${node.position.x} ${node.position.y})`);
}

function updateConnectionGeometry(conn) {
  const group = connEls.get(conn.id);
  if (!group) return;

  const source = findNode(conn.sourceId);
  const target = findNode(conn.targetId);
  if (!source || !target) return;

  const sourceRadius = (visual.get(source.id) || {}).radius || NODE_RADIUS;
  const targetRadius = (visual.get(target.id) || {}).radius || NODE_RADIUS;

  let dx = target.position.x - source.position.x;
  let dy = target.position.y - source.position.y;
  let distance = Math.hypot(dx, dy);
  if (distance < 0.001) {
    dx = 1;
    dy = 0;
    distance = 1;
  }

  const ux = dx / distance;
  const uy = dy / distance;
  const span = Math.max(distance, sourceRadius + targetRadius + 2);
  const startRadius = Math.min(sourceRadius, span / 2);
  const endRadius = Math.min(targetRadius, span / 2);

  const x1 = (source.position.x + ux * startRadius).toFixed(2);
  const y1 = (source.position.y + uy * startRadius).toFixed(2);
  const x2 = (target.position.x - ux * endRadius).toFixed(2);
  const y2 = (target.position.y - uy * endRadius).toFixed(2);

  // A área de clique e a linha visível compartilham a mesma geometria.
  for (const line of group.children) {
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
  }
}

function syncStyles() {
  appEl.classList.toggle('app--connect', mode === 'connect');
  appEl.classList.toggle('app--grid', gridEnabled);
  modeHint.hidden = mode !== 'connect';
  btnMode.textContent = mode === 'connect' ? 'Editar' : 'Conectar';
  btnMode.setAttribute('aria-pressed', String(mode === 'connect'));
  btnGrid.setAttribute('aria-pressed', String(gridEnabled));

  nodeEls.forEach((group, id) => {
    const highlighted = (mode === 'edit' && id === selectedId) || selectedIds.has(id);
    group.classList.toggle('node--selected', highlighted);
    group.classList.toggle('node--pending', id === pendingId);
  });

  emptyMsg.hidden = state.nodes.length > 0;
  btnDeleteSelected.hidden = selectedIds.size === 0;
  btnDeleteSelected.textContent = selectedIds.size > 1
    ? `Excluir selecionados (${selectedIds.size})`
    : 'Excluir selecionado';
}

function renderAll() {
  layerConnections.textContent = '';
  layerNodes.textContent = '';
  nodeEls.clear();
  connEls.clear();
  visual.clear();

  state.nodes.forEach((node) => {
    const entry = buildNodeVisual(node);
    visual.set(node.id, entry);
    nodeEls.set(node.id, entry.group);
    entry.group.setAttribute('transform', `translate(${node.position.x} ${node.position.y})`);
    layerNodes.appendChild(entry.group);
  });

  state.connections.forEach(addConnectionElement);

  syncStyles();
}

function connectionColor(conn) {
  return conn.color || DEFAULT_CONNECTION_COLOR;
}

function addConnectionElement(conn) {
  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('class', 'connection-group');
  group.setAttribute('data-id', conn.id);

  const hit = document.createElementNS(SVG_NS, 'line');
  hit.setAttribute('class', 'connection__hit');

  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('class', 'connection');
  line.style.stroke = connectionColor(conn);

  group.append(hit, line);
  connEls.set(conn.id, group);
  layerConnections.appendChild(group);
  updateConnectionGeometry(conn);
}

function removeConnectionElement(conn) {
  const group = connEls.get(conn.id);
  if (group) group.remove();
  connEls.delete(conn.id);
}

function updateConnectionColor(conn) {
  const group = connEls.get(conn.id);
  if (!group) return;
  const line = group.querySelector('.connection');
  if (line) line.style.stroke = connectionColor(conn);
}

function moveNode(id, x, y) {
  const node = findNode(id);
  if (!node) return;

  node.position.x = x;
  node.position.y = y;
  applyNodeTransform(id);

  state.connections.forEach((conn) => {
    if (conn.sourceId === id || conn.targetId === id) updateConnectionGeometry(conn);
  });
}

//#endregion

//#region Modos de operação

function setMode(next) {
  if (next === mode) return;
  mode = next;
  if (mode === 'edit') pendingId = null;
  syncStyles();
}

function handleNodeActivate(id) {
  if (mode === 'connect') {
    if (pendingId === null) {
      pendingId = id;
      syncStyles();
      return;
    }
    if (pendingId === id) {
      pendingId = null;
      syncStyles();
      return;
    }
    const result = toggleConnection(pendingId, id);
    pendingId = null;
    if (result) {
      if (result.action === 'created') addConnectionElement(result.connection);
      else removeConnectionElement(result.connection);
      save();
    }
    syncStyles();
    return;
  }

  openEditDialog(id);
}

/**
 * Conecta ou desconecta dois nós.
 * Se já existir uma conexão entre eles, ela é removida (alternância).
 *
 * @returns {{action: 'created'|'removed', connection: object}|null}
 */
function toggleConnection(sourceId, targetId) {
  if (sourceId === targetId) {
    toast('Não é possível conectar um nó a ele mesmo.', 'error');
    return null;
  }

  const existing = findConnection(sourceId, targetId);
  if (existing) {
    state.connections = state.connections.filter((conn) => conn.id !== existing.id);
    toast('Conexão removida.');
    return { action: 'removed', connection: existing };
  }

  const connection = { id: makeId(), sourceId, targetId, color: DEFAULT_CONNECTION_COLOR };
  state.connections.push(connection);
  toast('Conexão criada.');
  return { action: 'created', connection };
}

//#endregion

//#region Caixa de seleção

function clearSelection() {
  if (selectedIds.size === 0) return;
  selectedIds.clear();
  syncStyles();
}

function nodeIntersectsRect(node, rect) {
  const radius = (visual.get(node.id) || {}).radius || NODE_RADIUS;
  const nx = clamp(node.position.x, rect.x, rect.x + rect.width);
  const ny = clamp(node.position.y, rect.y, rect.y + rect.height);
  return Math.hypot(node.position.x - nx, node.position.y - ny) <= radius;
}

/**
 * Seleciona os nós que tocam a caixa. Com Shift, preserva a seleção anterior.
 */
function applyMarqueeSelection(rect, additive) {
  if (!additive) selectedIds.clear();
  state.nodes.forEach((node) => {
    if (nodeIntersectsRect(node, rect)) selectedIds.add(node.id);
  });
  syncStyles();
}

function marqueeGeometry(start, current) {
  return {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y),
  };
}

function setMarqueeVisible(visible) {
  marqueeRect.classList.toggle('marquee--visible', visible);
}

function startMarquee(event) {
  marquee = {
    pointerId: event.pointerId,
    start: toBoardPoint(event),
    startX: event.clientX,
    startY: event.clientY,
    additive: event.shiftKey,
    moved: false,
  };

  board.classList.add('board--marquee');
  event.preventDefault();
  try {
    board.setPointerCapture(event.pointerId);
  } catch (error) {
    /* ignore */
  }
}

function updateMarquee(event) {
  if (!marquee.moved) {
    const dx = event.clientX - marquee.startX;
    const dy = event.clientY - marquee.startY;
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    marquee.moved = true;
  }

  const rect = marqueeGeometry(marquee.start, toBoardPoint(event));

  setMarqueeVisible(true);
  marqueeRect.setAttribute('x', rect.x.toFixed(2));
  marqueeRect.setAttribute('y', rect.y.toFixed(2));
  marqueeRect.setAttribute('width', rect.width.toFixed(2));
  marqueeRect.setAttribute('height', rect.height.toFixed(2));

  applyMarqueeSelection(rect, marquee.additive);
}

function finishMarquee(event) {
  const { moved, additive } = marquee;
  marquee = null;
  board.classList.remove('board--marquee');
  setMarqueeVisible(false);

  try {
    board.releasePointerCapture(event.pointerId);
  } catch (error) {
    /* ignore */
  }

  // Clique simples fora dos nós limpa a seleção.
  if (!moved && !additive) clearSelection();
}

function cancelMarquee() {
  marquee = null;
  board.classList.remove('board--marquee');
  setMarqueeVisible(false);
}

async function deleteSelectedNodes() {
  if (selectedIds.size === 0) return;

  const total = selectedIds.size;
  const message = total > 1
    ? `Excluir ${total} nós selecionados e todas as conexões ligadas a eles?`
    : 'Excluir o nó selecionado e todas as conexões ligadas a ele?';

  const confirmed = await askConfirm(message);
  if (!confirmed) return;

  state.nodes = state.nodes.filter((node) => !selectedIds.has(node.id));
  state.connections = state.connections.filter(
    (conn) => !selectedIds.has(conn.sourceId) && !selectedIds.has(conn.targetId),
  );
  if (selectedIds.has(pendingId)) pendingId = null;
  if (selectedIds.has(editingId)) editingId = null;
  selectedIds.clear();

  save();
  renderAll();
  toast(total > 1 ? 'Nós excluídos.' : 'Nó excluído.');
}

//#endregion

//#region Arraste (Pointer Events)

function onPointerDown(event) {
  // Botão do meio (rodinha): desloca o quadro.
  if (event.button === 1) {
    pan = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      tx: view.tx,
      ty: view.ty,
    };
    board.classList.add('board--panning');
    event.preventDefault();
    try {
      board.setPointerCapture(event.pointerId);
    } catch (error) {
      /* ignore */
    }
    return;
  }

  if (event.button !== undefined && event.button !== 0) return;

  const group = event.target.closest ? event.target.closest('.node') : null;
  if (!group) {
    // Clique na ligação: abre a escolha de cor da linha.
    const hit = event.target.closest ? event.target.closest('.connection__hit') : null;
    if (hit && mode === 'edit') {
      const connGroup = hit.closest('.connection-group');
      if (connGroup) openConnectionDialog(connGroup.dataset.id);
      event.preventDefault();
      return;
    }

    // Clique/arraste fora dos nós: inicia a caixa de seleção no modo de edição.
    if (mode === 'edit') startMarquee(event);
    return;
  }

  const node = findNode(group.dataset.id);
  if (!node) return;

  const point = toBoardPoint(event);
  drag = {
    id: node.id,
    pointerId: event.pointerId,
    offsetX: node.position.x - point.x,
    offsetY: node.position.y - point.y,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
  };

  event.preventDefault();
  try {
    board.setPointerCapture(event.pointerId);
  } catch (error) {
    /* ignore */
  }
}

function onPointerMove(event) {
  if (pan && event.pointerId === pan.pointerId) {
    view.tx = pan.tx + (event.clientX - pan.startX);
    view.ty = pan.ty + (event.clientY - pan.startY);
    applyViewport();
    event.preventDefault();
    return;
  }

  if (marquee && event.pointerId === marquee.pointerId) {
    updateMarquee(event);
    event.preventDefault();
    return;
  }

  if (!drag || event.pointerId !== drag.pointerId) return;

  if (!drag.moved) {
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

    drag.moved = true;
    const group = nodeEls.get(drag.id);
    if (group) group.classList.add('node--dragging');
  }

  const point = toBoardPoint(event);
  const area = visibleWorldRect();
  const radius = (visual.get(drag.id) || {}).radius || NODE_RADIUS;
  const minX = area.left + radius + 6;
  const minY = area.top + radius + 6;
  const maxX = Math.max(minX, area.left + area.width - radius - 6);
  const maxY = Math.max(minY, area.top + area.height - radius - 6);

  let x = clamp(point.x + drag.offsetX, minX, maxX);
  let y = clamp(point.y + drag.offsetY, minY, maxY);

  if (gridEnabled) {
    const snapped = snapToGrid(x, y);
    x = snapped.x;
    y = snapped.y;
  }

  moveNode(drag.id, x, y);

  event.preventDefault();
}

function onPointerUp(event) {
  if (pan && event.pointerId === pan.pointerId) {
    pan = null;
    board.classList.remove('board--panning');
    try {
      board.releasePointerCapture(event.pointerId);
    } catch (error) {
      /* ignore */
    }
    return;
  }

  if (marquee && event.pointerId === marquee.pointerId) {
    finishMarquee(event);
    return;
  }

  if (!drag || event.pointerId !== drag.pointerId) return;

  const { id, moved } = drag;
  drag = null;

  try {
    board.releasePointerCapture(event.pointerId);
  } catch (error) {
    /* ignore */
  }

  const group = nodeEls.get(id);
  if (group) group.classList.remove('node--dragging');

  if (moved) {
    save();
  } else {
    handleNodeActivate(id);
  }
}

function onPointerCancel(event) {
  if (pan && event.pointerId === pan.pointerId) {
    pan = null;
    board.classList.remove('board--panning');
    return;
  }

  if (marquee && event.pointerId === marquee.pointerId) {
    cancelMarquee();
    return;
  }

  if (!drag || event.pointerId !== drag.pointerId) return;

  const group = nodeEls.get(drag.id);
  if (group) group.classList.remove('node--dragging');
  drag = null;
}

function onNodeKeydown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;

  const group = event.target.closest ? event.target.closest('.node') : null;
  if (!group) return;

  event.preventDefault();
  handleNodeActivate(group.dataset.id);
}

//#endregion

//#region Modal de nó

function setFormError(message) {
  formError.hidden = !message;
  formError.textContent = message || '';
}

/**
 * Cria as bolinhas de cores fixas acima do seletor de cor.
 */
function buildColorSwatches() {
  PRESET_COLORS.forEach(({ name, value }) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'swatch';
    swatch.dataset.color = value;
    swatch.title = name;
    swatch.setAttribute('aria-label', name);
    swatch.style.setProperty('--swatch', value);
    swatch.addEventListener('click', () => {
      fieldColor.value = value;
      syncColorSwatches();
    });
    colorSwatches.appendChild(swatch);
  });

  // Digitar/escolher uma cor no seletor nativo também atualiza as bolinhas.
  fieldColor.addEventListener('input', syncColorSwatches);
}

/** Marca a bolinha correspondente à cor atual do campo. */
function syncColorSwatches() {
  const current = fieldColor.value.toLowerCase();
  colorSwatches.querySelectorAll('.swatch').forEach((swatch) => {
    const active = swatch.dataset.color.toLowerCase() === current;
    swatch.classList.toggle('swatch--active', active);
    swatch.setAttribute('aria-pressed', String(active));
  });
}

/** Mostra o seletor de cor da borda apenas quando a opção está marcada. */
function syncBorderField() {
  borderColorField.hidden = !fieldBorder.checked;
  const active = fieldBorderColor.value.toLowerCase() === DEFAULT_BORDER_COLOR;
  borderDefault.classList.toggle('swatch--active', active);
  borderDefault.setAttribute('aria-pressed', String(active));
}

function openCreateDialog() {
  editingId = null;
  nodeDialogTitle.textContent = 'Novo nó';
  fieldText.value = '';
  fieldColor.value = DEFAULT_COLOR;
  fieldBorder.checked = false;
  fieldBorderColor.value = DEFAULT_BORDER_COLOR;
  btnDelete.hidden = true;
  setFormError('');
  syncColorSwatches();
  syncBorderField();
  nodeDialog.showModal();
  fieldText.focus();
}

function openEditDialog(id) {
  const node = findNode(id);
  if (!node) return;

  clearSelection();
  editingId = id;
  selectedId = id;
  nodeDialogTitle.textContent = 'Editar nó';
  fieldText.value = node.text;
  fieldColor.value = node.color;
  const border = node.border || { enabled: false, color: DEFAULT_BORDER_COLOR };
  fieldBorder.checked = border.enabled === true;
  fieldBorderColor.value = border.color;
  btnDelete.hidden = false;
  setFormError('');
  syncColorSwatches();
  syncBorderField();
  syncStyles();
  nodeDialog.showModal();
  fieldText.focus();
  fieldText.select();
}

function closeNodeDialog() {
  nodeDialog.close();
}

function submitNodeForm(event) {
  event.preventDefault();

  const text = fieldText.value.trim();
  if (!text) {
    setFormError('Informe um texto para o nó.');
    fieldText.focus();
    return;
  }

  const color = fieldColor.value;
  const border = {
    enabled: fieldBorder.checked,
    color: fieldBorderColor.value,
  };

  if (editingId) {
    const node = findNode(editingId);
    if (node) {
      node.text = text;
      node.color = color;
      node.border = border;
      toast('Nó atualizado.');
    }
  } else {
    let position = findFreePosition(NODE_RADIUS);
    if (gridEnabled) position = snapToGrid(position.x, position.y);
    state.nodes.push({
      id: makeId(),
      text,
      color,
      border,
      position,
    });
    toast('Nó criado.');
  }

  closeNodeDialog();
  save();
  renderAll();
}

/** Marca o swatch quando a ligação usa a cor de destaque da aplicação. */
function syncConnectionColor() {
  const active = fieldConnectionColor.value.toLowerCase() === ACCENT_COLOR;
  connectionPreset.classList.toggle('swatch--active', active);
  connectionPreset.setAttribute('aria-pressed', String(active));
}

function openConnectionDialog(id) {
  const conn = state.connections.find((item) => item.id === id);
  if (!conn) return;

  editingConnectionId = id;
  fieldConnectionColor.value = connectionColor(conn);
  syncConnectionColor();
  connectionDialog.showModal();
}

function submitConnectionForm(event) {
  event.preventDefault();

  const conn = state.connections.find((item) => item.id === editingConnectionId);
  if (conn) {
    conn.color = fieldConnectionColor.value;
    updateConnectionColor(conn);
    save();
    toast('Cor da ligação atualizada.');
  }

  connectionDialog.close();
}

async function deleteCurrentNode() {
  if (!editingId) return;

  const node = findNode(editingId);
  if (!node) return;

  const confirmed = await askConfirm(`Excluir o nó "${node.text}" e todas as conexões ligadas a ele?`);
  if (!confirmed) return;

  const id = editingId;
  state.nodes = state.nodes.filter((item) => item.id !== id);
  state.connections = state.connections.filter(
    (conn) => conn.sourceId !== id && conn.targetId !== id,
  );
  if (pendingId === id) pendingId = null;
  selectedIds.delete(id);

  closeNodeDialog();
  save();
  renderAll();
  toast('Nó excluído.');
}

//#endregion

//#region Confirmação e avisos

function askConfirm(message) {
  return new Promise((resolve) => {
    confirmMessage.textContent = message;

    const finish = (value) => {
      confirmOk.removeEventListener('click', onOk);
      confirmCancel.removeEventListener('click', onCancel);
      confirmEl.removeEventListener('cancel', onCancel);
      if (confirmEl.open) confirmEl.close();
      resolve(value);
    };

    const onOk = () => finish(true);
    const onCancel = (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      finish(false);
    };

    confirmOk.addEventListener('click', onOk);
    confirmCancel.addEventListener('click', onCancel);
    confirmEl.addEventListener('cancel', onCancel);

    confirmEl.showModal();
  });
}

let toastTimer = null;

function toast(message, kind) {
  toastEl.textContent = message;
  toastEl.className = kind === 'error' ? 'toast toast--error' : 'toast';
  toastEl.hidden = false;

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastEl.hidden = true;
  }, 3200);
}

//#endregion

//#region Exportação e importação

function exportBoard() {
  const payload = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    nodes: state.nodes.map((node) => ({
      id: node.id,
      text: node.text,
      color: node.color,
      border: {
        enabled: Boolean(node.border && node.border.enabled),
        color: (node.border && node.border.color) || DEFAULT_BORDER_COLOR,
      },
      position: {
        x: Math.round(node.position.x * 100) / 100,
        y: Math.round(node.position.y * 100) / 100,
      },
    })),
    connections: state.connections.map((conn) => ({
      id: conn.id,
      sourceId: conn.sourceId,
      targetId: conn.targetId,
      color: connectionColor(conn),
    })),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `quadro-nos-${formatDate(new Date())}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Quadro exportado.');
}

/** Fator de ampliação do PNG em relação às coordenadas do quadro */
const PNG_SCALE = 3;
/** Maior lado do PNG, em pixels (limite de segurança do canvas) */
const PNG_MAX_SIDE = 8192;
/** Margem livre em volta dos nós, em coordenadas do quadro */
const PNG_PADDING = 60;

/**
 * Estilos aplicados ao SVG exportado: o arquivo gerado não leva o styles.css,
 * então as regras que dependem de classe precisam ir embutidas. Sem
 * `vector-effect`, os traços acompanham a ampliação da imagem.
 */
const PNG_STYLE = [
  '.connection { stroke: #7e8a9c; stroke-width: 2; stroke-linecap: round; }',
  '.connection__hit { stroke: none; }',
  '.node__circle { stroke: var(--node-border, rgba(255, 255, 255, .16)); stroke-width: var(--node-border-width, 1.5); }',
  '.node__label { font: 600 13px system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;'
    + ' fill: #fff; paint-order: stroke fill; stroke: rgba(0, 0, 0, .32); stroke-width: 3; stroke-linejoin: round; }',
].join('\n');

/** Retângulo que envolve todos os nós, em coordenadas do quadro */
function contentBounds() {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

  state.nodes.forEach((node) => {
    const radius = (visual.get(node.id) || {}).radius || NODE_RADIUS;
    bounds.minX = Math.min(bounds.minX, node.position.x - radius);
    bounds.minY = Math.min(bounds.minY, node.position.y - radius);
    bounds.maxX = Math.max(bounds.maxX, node.position.x + radius);
    bounds.maxY = Math.max(bounds.maxY, node.position.y + radius);
  });

  return bounds;
}

/**
 * Exporta em PNG a área ocupada pelos nós. O enquadramento é independente do
 * pan e do zoom da tela.
 *
 * @param {boolean} [transparent] Sem o fundo do quadro (fundo transparente).
 */
function exportPng(transparent) {
  if (state.nodes.length === 0) {
    toast('Não há nós para exportar.', 'error');
    return;
  }

  const bounds = contentBounds();
  const minX = bounds.minX - PNG_PADDING;
  const minY = bounds.minY - PNG_PADDING;
  const width = bounds.maxX - bounds.minX + PNG_PADDING * 2;
  const height = bounds.maxY - bounds.minY + PNG_PADDING * 2;

  const clone = board.cloneNode(true);

  const marqueeClone = clone.querySelector('.marquee');
  if (marqueeClone) marqueeClone.remove();

  const gridClone = clone.querySelector('#layer-grid');
  if (gridClone) gridClone.remove();

  if (transparent) {
    const bgClone = clone.querySelector('.board__bg');
    if (bgClone) bgClone.remove();
  }

  const style = document.createElementNS(SVG_NS, 'style');
  style.textContent = PNG_STYLE;
  clone.insertBefore(style, clone.firstChild);

  // Enquadra os nós: o deslocamento do quadro na tela não entra na imagem.
  clone.querySelector('#viewport').setAttribute('transform', `translate(${-minX} ${-minY})`);

  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const scale = Math.min(PNG_SCALE, PNG_MAX_SIDE / Math.max(width, height));

  const svgUrl = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }),
  );

  const image = new Image();

  image.onerror = () => {
    URL.revokeObjectURL(svgUrl);
    toast('Não foi possível gerar o PNG.', 'error');
  };

  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    const context = canvas.getContext('2d');
    if (!transparent) {
      context.fillStyle = '#0e1116';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.drawImage(image, 0, 0, width, height);

    URL.revokeObjectURL(svgUrl);

    canvas.toBlob((blob) => {
      if (!blob) {
        toast('Não foi possível gerar o PNG.', 'error');
        return;
      }

      const pngUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = pngUrl;
      link.download = `quadro-nos-${formatDate(new Date())}${transparent ? '-transparente' : ''}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
      toast(`PNG salvo (${canvas.width}×${canvas.height}).`);
    }, 'image/png');
  };

  image.src = svgUrl;
}

/** Abre ou fecha o menu de opções da exportação PNG */
function togglePngMenu() {
  setPngMenuOpen(pngMenu.hidden);
}

function setPngMenuOpen(open) {
  pngMenu.hidden = !open;
  btnPng.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function onPngMenuClick(event) {
  const item = event.target.closest('.png-menu__item');
  if (!item) return;
  setPngMenuOpen(false);
  exportPng(item.dataset.background === 'transparent');
}

function onDocumentPointerDown(event) {
  if (!pngMenu.hidden && !event.target.closest('.png-field')) {
    setPngMenuOpen(false);
  }
  if (activePicker && !activePicker.root.contains(event.target)) {
    closeActivePicker();
  }
}

function onDocumentKeydown(event) {
  if (event.key !== 'Escape') return;

  if (!pngMenu.hidden) {
    event.preventDefault();
    setPngMenuOpen(false);
    btnPng.focus();
    return;
  }

  if (activePicker) {
    event.preventDefault();
    closeActivePicker();
  }
}

function validateBoard(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    return { error: 'O arquivo não contém um JSON válido.' };
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { error: 'Estrutura de dados incompatível com o formato esperado.' };
  }
  if (data.format !== FORMAT) {
    return { error: 'Formato de arquivo não reconhecido. Esperado "node-graph".' };
  }
  if (!Number.isInteger(data.version) || !SUPPORTED_VERSIONS.includes(data.version)) {
    return { error: `Versão de arquivo não suportada (${data.version ?? 'ausente'}).` };
  }
  if (!Array.isArray(data.nodes) || !Array.isArray(data.connections)) {
    return { error: 'Estrutura incompatível: "nodes" e "connections" devem ser listas.' };
  }

  const nodes = [];
  const nodeIds = new Set();

  for (const entry of data.nodes) {
    if (!entry || typeof entry !== 'object') {
      return { error: 'Foi encontrado um nó com estrutura inválida.' };
    }

    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    if (!id) return { error: 'Existe um nó sem identificador válido.' };
    if (nodeIds.has(id)) return { error: `Identificador duplicado: "${id}".` };
    nodeIds.add(id);

    const text = typeof entry.text === 'string' ? entry.text.trim() : '';
    if (!text) return { error: 'Existe um nó sem texto identificador válido.' };

    const position = entry.position;
    if (!position || typeof position !== 'object'
      || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      return { error: `Posição inválida para o nó "${text}".` };
    }

    const color = (typeof entry.color === 'string' && /^#[0-9a-f]{6}$/i.test(entry.color))
      ? entry.color
      : DEFAULT_COLOR;

    const rawBorder = entry.border && typeof entry.border === 'object' ? entry.border : {};
    const border = {
      enabled: rawBorder.enabled === true,
      color: (typeof rawBorder.color === 'string' && /^#[0-9a-f]{6}$/i.test(rawBorder.color))
        ? rawBorder.color
        : DEFAULT_BORDER_COLOR,
    };

    nodes.push({ id, text, color, border, position: { x: position.x, y: position.y } });
  }

  const connections = [];
  const connectionIds = new Set();
  const pairs = new Set();

  for (const entry of data.connections) {
    if (!entry || typeof entry !== 'object') {
      return { error: 'Foi encontrada uma conexão com estrutura inválida.' };
    }

    const sourceId = typeof entry.sourceId === 'string' ? entry.sourceId : '';
    const targetId = typeof entry.targetId === 'string' ? entry.targetId : '';

    if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) {
      return { error: 'Existe uma conexão apontando para um nó inexistente.' };
    }
    if (sourceId === targetId) {
      return { error: 'Existe uma conexão de um nó para ele próprio.' };
    }

    const key = pairKey(sourceId, targetId);
    if (pairs.has(key)) {
      return { error: 'Existem conexões duplicadas entre o mesmo par de nós.' };
    }
    pairs.add(key);

    let id = typeof entry.id === 'string' ? entry.id.trim() : '';
    if (!id || connectionIds.has(id)) id = makeId();
    connectionIds.add(id);

    const color = (typeof entry.color === 'string' && /^#[0-9a-f]{6}$/i.test(entry.color))
      ? entry.color
      : DEFAULT_CONNECTION_COLOR;

    connections.push({ id, sourceId, targetId, color });
  }

  return { data: { nodes, connections } };
}

function applyBoard(data) {
  state.nodes = data.nodes;
  state.connections = data.connections;
  selectedId = null;
  pendingId = null;
  selectedIds.clear();
  save();
  renderAll();
}

function onFileSelected(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = '';
  if (!file) return;

  const reader = new FileReader();

  reader.onload = async () => {
    const result = validateBoard(String(reader.result));
    if (result.error) {
      toast(result.error, 'error');
      return;
    }

    const confirmed = await askConfirm(
      'A importação substituirá integralmente o quadro atual. Deseja continuar?',
    );
    if (!confirmed) return;

    applyBoard(result.data);
    toast('Quadro importado com sucesso.');
  };

  reader.onerror = () => toast('Não foi possível ler o arquivo selecionado.', 'error');
  reader.readAsText(file);
}

//#endregion

//#region Inicialização

function bindEvents() {
  createColorPicker(fieldColor);
  createColorPicker(fieldBorderColor);
  createColorPicker(fieldConnectionColor);

  buildColorSwatches();

  btnAdd.addEventListener('click', openCreateDialog);
  btnMode.addEventListener('click', () => setMode(mode === 'edit' ? 'connect' : 'edit'));
  btnExport.addEventListener('click', exportBoard);
  btnImport.addEventListener('click', () => fileInput.click());
  btnPng.addEventListener('click', togglePngMenu);
  pngMenu.addEventListener('click', onPngMenuClick);
  document.addEventListener('pointerdown', onDocumentPointerDown);
  document.addEventListener('keydown', onDocumentKeydown);
  btnGrid.addEventListener('click', () => setGrid(!gridEnabled));
  btnDeleteSelected.addEventListener('click', deleteSelectedNodes);
  fileInput.addEventListener('change', onFileSelected);

  btnZoomIn.addEventListener('click', () => setZoom(view.k * ZOOM_STEP));
  btnZoomOut.addEventListener('click', () => setZoom(view.k / ZOOM_STEP));
  btnZoomReset.addEventListener('click', resetView);
  board.addEventListener('wheel', onWheel, { passive: false });

  nodeForm.addEventListener('submit', submitNodeForm);
  fieldBorder.addEventListener('change', syncBorderField);
  fieldBorderColor.addEventListener('input', syncBorderField);
  borderDefault.style.setProperty('--swatch', DEFAULT_BORDER_COLOR);
  borderDefault.addEventListener('click', () => {
    fieldBorderColor.value = DEFAULT_BORDER_COLOR;
    syncBorderField();
  });
  btnDelete.addEventListener('click', deleteCurrentNode);
  btnCancel.addEventListener('click', closeNodeDialog);
  dialogClose.addEventListener('click', closeNodeDialog);
  nodeDialog.addEventListener('close', () => {
    editingId = null;
    selectedId = null;
    btnDelete.hidden = true;
    closeActivePicker();
    syncStyles();
  });

  connectionForm.addEventListener('submit', submitConnectionForm);
  fieldConnectionColor.addEventListener('input', syncConnectionColor);
  connectionPreset.style.setProperty('--swatch', ACCENT_COLOR);
  connectionPreset.addEventListener('click', () => {
    fieldConnectionColor.value = ACCENT_COLOR;
    syncConnectionColor();
  });
  connectionCancel.addEventListener('click', () => connectionDialog.close());
  connectionClose.addEventListener('click', () => connectionDialog.close());
  connectionDialog.addEventListener('close', () => {
    editingConnectionId = null;
    closeActivePicker();
  });

  board.addEventListener('pointerdown', onPointerDown);
  board.addEventListener('pointermove', onPointerMove);
  board.addEventListener('pointerup', onPointerUp);
  board.addEventListener('pointercancel', onPointerCancel);
  board.addEventListener('contextmenu', (event) => event.preventDefault());
  board.addEventListener('mousedown', (event) => {
    if (event.button === 1) event.preventDefault();
  });
  layerNodes.addEventListener('keydown', onNodeKeydown);
}

function init() {
  loadFromStorage();
  bindEvents();
  buildRingGrid();
  applyViewport();
  updateZoomControls();
  renderAll();
}

init();

//#endregion
