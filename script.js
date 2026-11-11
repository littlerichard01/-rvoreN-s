/* ÁrvoreNós — lógica do quadro de nós (HTML/CSS/JS nativos) */
'use strict';

//#region Constantes

const SVG_NS = 'http://www.w3.org/2000/svg';

const FORMAT = 'node-graph';
const VERSION = 1;
const SUPPORTED_VERSIONS = [1];
const STORAGE_KEY = 'arvorenos:board:v1';

const DEFAULT_COLOR = '#3b82f6';
const NODE_FONT = '600 13px system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const FONT_SIZE = 13;
const MIN_RADIUS = 34;
const MAX_RADIUS = 72;
const DRAG_THRESHOLD = 4;

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 1.25;

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
let drag = null;          // arraste em andamento

/** Transformação do quadro: escala (k) e deslocamento (tx, ty) em pixels de tela */
const view = { k: 1, tx: 0, ty: 0 };

const nodeEls = new Map();  // id -> <g>
const connEls = new Map();  // id -> <line>
const visual = new Map();   // id -> { group, radius }

//#endregion

//#region Elementos da interface

const board = document.getElementById('board');
const viewport = document.getElementById('viewport');
const layerConnections = document.getElementById('layer-connections');
const layerNodes = document.getElementById('layer-nodes');
const emptyMsg = document.getElementById('empty');
const modeHint = document.getElementById('mode-hint');
const btnMode = document.getElementById('btn-mode');
const btnAdd = document.getElementById('btn-add');
const btnExport = document.getElementById('btn-export');
const btnImport = document.getElementById('btn-import');
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const btnZoomReset = document.getElementById('btn-zoom-reset');
const fileInput = document.getElementById('file-input');

const nodeDialog = document.getElementById('node-dialog');
const nodeForm = document.getElementById('node-form');
const nodeDialogTitle = document.getElementById('node-dialog-title');
const fieldText = document.getElementById('field-text');
const fieldColor = document.getElementById('field-color');
const formError = document.getElementById('form-error');
const btnDelete = document.getElementById('btn-delete');
const btnCancel = document.getElementById('btn-cancel');
const dialogClose = document.getElementById('dialog-close');

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

//#endregion

//#region Dimensões e texto dos nós

function radiusFor(text) {
  const width = measureText(text);
  return Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, width / 2 + 14));
}

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
      const otherRadius = other ? other.radius : MIN_RADIUS;
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
  const radius = radiusFor(node.text);

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
  const line = connEls.get(conn.id);
  if (!line) return;

  const source = findNode(conn.sourceId);
  const target = findNode(conn.targetId);
  if (!source || !target) return;

  const sourceRadius = (visual.get(source.id) || {}).radius || MIN_RADIUS;
  const targetRadius = (visual.get(target.id) || {}).radius || MIN_RADIUS;

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

  line.setAttribute('x1', (source.position.x + ux * startRadius).toFixed(2));
  line.setAttribute('y1', (source.position.y + uy * startRadius).toFixed(2));
  line.setAttribute('x2', (target.position.x - ux * endRadius).toFixed(2));
  line.setAttribute('y2', (target.position.y - uy * endRadius).toFixed(2));
}

function syncStyles() {
  appEl.classList.toggle('app--connect', mode === 'connect');
  modeHint.hidden = mode !== 'connect';
  btnMode.textContent = mode === 'connect' ? 'Editar' : 'Conectar';
  btnMode.setAttribute('aria-pressed', String(mode === 'connect'));

  nodeEls.forEach((group, id) => {
    group.classList.toggle('node--selected', mode === 'edit' && id === selectedId);
    group.classList.toggle('node--pending', id === pendingId);
  });

  emptyMsg.hidden = state.nodes.length > 0;
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

function addConnectionElement(conn) {
  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('class', 'connection');
  line.setAttribute('data-id', conn.id);
  connEls.set(conn.id, line);
  layerConnections.appendChild(line);
  updateConnectionGeometry(conn);
}

function removeConnectionElement(conn) {
  const line = connEls.get(conn.id);
  if (line) line.remove();
  connEls.delete(conn.id);
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

  const connection = { id: makeId(), sourceId, targetId };
  state.connections.push(connection);
  toast('Conexão criada.');
  return { action: 'created', connection };
}

//#endregion

//#region Arraste (Pointer Events)

function onPointerDown(event) {
  if (event.button !== undefined && event.button !== 0) return;

  const group = event.target.closest ? event.target.closest('.node') : null;
  if (!group) return;

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
  const radius = (visual.get(drag.id) || {}).radius || MIN_RADIUS;
  const minX = area.left + radius + 6;
  const minY = area.top + radius + 6;
  const maxX = Math.max(minX, area.left + area.width - radius - 6);
  const maxY = Math.max(minY, area.top + area.height - radius - 6);

  moveNode(
    drag.id,
    clamp(point.x + drag.offsetX, minX, maxX),
    clamp(point.y + drag.offsetY, minY, maxY),
  );

  event.preventDefault();
}

function onPointerUp(event) {
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

function openCreateDialog() {
  editingId = null;
  nodeDialogTitle.textContent = 'Novo nó';
  fieldText.value = '';
  fieldColor.value = DEFAULT_COLOR;
  btnDelete.hidden = true;
  setFormError('');
  nodeDialog.showModal();
  fieldText.focus();
}

function openEditDialog(id) {
  const node = findNode(id);
  if (!node) return;

  editingId = id;
  selectedId = id;
  nodeDialogTitle.textContent = 'Editar nó';
  fieldText.value = node.text;
  fieldColor.value = node.color;
  btnDelete.hidden = false;
  setFormError('');
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

  if (editingId) {
    const node = findNode(editingId);
    if (node) {
      node.text = text;
      node.color = color;
      toast('Nó atualizado.');
    }
  } else {
    const radius = radiusFor(text);
    state.nodes.push({
      id: makeId(),
      text,
      color,
      position: findFreePosition(radius),
    });
    toast('Nó criado.');
  }

  closeNodeDialog();
  save();
  renderAll();
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
      position: {
        x: Math.round(node.position.x * 100) / 100,
        y: Math.round(node.position.y * 100) / 100,
      },
    })),
    connections: state.connections.map((conn) => ({
      id: conn.id,
      sourceId: conn.sourceId,
      targetId: conn.targetId,
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

    nodes.push({ id, text, color, position: { x: position.x, y: position.y } });
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

    connections.push({ id, sourceId, targetId });
  }

  return { data: { nodes, connections } };
}

function applyBoard(data) {
  state.nodes = data.nodes;
  state.connections = data.connections;
  selectedId = null;
  pendingId = null;
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
  btnAdd.addEventListener('click', openCreateDialog);
  btnMode.addEventListener('click', () => setMode(mode === 'edit' ? 'connect' : 'edit'));
  btnExport.addEventListener('click', exportBoard);
  btnImport.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', onFileSelected);

  btnZoomIn.addEventListener('click', () => setZoom(view.k * ZOOM_STEP));
  btnZoomOut.addEventListener('click', () => setZoom(view.k / ZOOM_STEP));
  btnZoomReset.addEventListener('click', resetView);

  nodeForm.addEventListener('submit', submitNodeForm);
  btnDelete.addEventListener('click', deleteCurrentNode);
  btnCancel.addEventListener('click', closeNodeDialog);
  dialogClose.addEventListener('click', closeNodeDialog);
  nodeDialog.addEventListener('close', () => {
    editingId = null;
    selectedId = null;
    btnDelete.hidden = true;
    syncStyles();
  });

  board.addEventListener('pointerdown', onPointerDown);
  board.addEventListener('pointermove', onPointerMove);
  board.addEventListener('pointerup', onPointerUp);
  board.addEventListener('pointercancel', onPointerCancel);
  board.addEventListener('contextmenu', (event) => event.preventDefault());
  layerNodes.addEventListener('keydown', onNodeKeydown);
}

function init() {
  loadFromStorage();
  bindEvents();
  applyViewport();
  updateZoomControls();
  renderAll();
}

init();

//#endregion
