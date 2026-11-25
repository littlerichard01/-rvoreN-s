/* ============================================================
   Montador de Masmorras — lógica do editor (Vanilla JS)
   ============================================================ */
(function () {
  'use strict';

  // #region Configuração
  const CELL = 28;           // tamanho da célula em pixels
  const EDGE_TOL = 9;        // distância (px) para reconhecer a parede sob o cursor
  const HISTORY_LIMIT = 60;  // quantidade de estados guardados para desfazer
  const MIN_CELLS = 4;       // mínimo de colunas e linhas em telas muito pequenas
  const MAX_ROOMS = 60;      // limite de salas na geração aleatória

  // Limites e passo do zoom (mesmos valores da ferramenta de nós)
  const MIN_ZOOM = 0.4;
  const MAX_ZOOM = 2.5;
  const ZOOM_STEP = 1.25;

  // Dimensões do grid: calculadas para preencher a tela disponível
  let cols = 0;
  let rows = 0;
  // #endregion

  // #region Referências de DOM
  const workspace = document.getElementById('workspace');
  const stage = document.getElementById('stage');
  const world = document.getElementById('world');
  const layerRooms = document.getElementById('layer-rooms');
  const layerCorridors = document.getElementById('layer-corridors');
  const layerWalls = document.getElementById('layer-walls');
  const layerDoors = document.getElementById('layer-doors');
  const layerPreview = document.getElementById('layer-preview');
  const clearButton = document.getElementById('btn-clear');
  const exportButton = document.getElementById('btn-export');
  const importButton = document.getElementById('btn-import');
  const fileInput = document.getElementById('file-input');
  const roomCountInput = document.getElementById('room-count');
  const generateButton = document.getElementById('btn-generate');
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnZoomReset = document.getElementById('btn-zoom-reset');
  const toolButtons = Array.prototype.slice.call(document.querySelectorAll('[data-tool]'));
  // #endregion

  // #region Estado do mapa
  const state = {
    tool: 'room',
    rooms: [],               // { id, x, y, w, h }
    doors: new Set(),        // chaves de segmentos que estão no estado porta
    openings: new Set(),     // chaves de segmentos abertos por corredores (sem porta)
    connections: [],         // { id, from, to, cells: [{ c, r }] }
    wallSegments: new Set(), // chaves de todos os segmentos de parede atuais
    wallMap: new Map(),      // chave do segmento -> id da sala
    hoverKey: null,
    drag: null,
    nextId: 1
  };

  // Visualização deslocável (pan) e zoom: k = escala, tx/ty = deslocamento em pixels de tela
  const view = { k: 1, tx: 0, ty: 0 };
  let pan = null; // pan em andamento (botão do meio)
  // #endregion

  // #region Utilitários
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
  // #endregion

  // #region Geometria
  // Converte coordenadas da tela para coordenadas do mundo (descontando o pan e o zoom)
  function pointFromEvent(event) {
    const rect = stage.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - view.tx) / view.k,
      y: (event.clientY - rect.top - view.ty) / view.k
    };
  }

  function cellFromPoint(point) {
    return { c: Math.floor(point.x / CELL), r: Math.floor(point.y / CELL) };
  }

  function insideGrid(cell) {
    return cell.c >= 0 && cell.r >= 0 && cell.c < cols && cell.r < rows;
  }

  function clampCell(cell) {
    return {
      c: Math.min(cols - 1, Math.max(0, cell.c)),
      r: Math.min(rows - 1, Math.max(0, cell.r))
    };
  }

  function rectFromCells(a, b) {
    const x = Math.min(a.c, b.c);
    const y = Math.min(a.r, b.r);
    return { x: x, y: y, w: Math.abs(a.c - b.c) + 1, h: Math.abs(a.r - b.r) + 1 };
  }

  function parseKey(key) {
    const parts = key.split(':');
    return { dir: parts[0], c: Number(parts[1]), r: Number(parts[2]) };
  }

  // Chave do segmento de parede entre duas células vizinhas (ou null se não forem vizinhas)
  function edgeBetween(a, b) {
    if (a.r === b.r) {
      if (b.c === a.c + 1) return 'v:' + b.c + ':' + a.r;
      if (b.c === a.c - 1) return 'v:' + a.c + ':' + a.r;
    }
    if (a.c === b.c) {
      if (b.r === a.r + 1) return 'h:' + a.c + ':' + b.r;
      if (b.r === a.r - 1) return 'h:' + a.c + ':' + a.r;
    }
    return null;
  }
  // #endregion

  // #region Consultas ao modelo
  function roomAt(c, r) {
    for (let i = 0; i < state.rooms.length; i++) {
      const room = state.rooms[i];
      if (c >= room.x && c < room.x + room.w && r >= room.y && r < room.y + room.h) {
        return room;
      }
    }
    return null;
  }

  function overlapsRoom(rect) {
    for (let i = 0; i < state.rooms.length; i++) {
      const room = state.rooms[i];
      const separado = rect.x + rect.w <= room.x ||
        room.x + room.w <= rect.x ||
        rect.y + rect.h <= room.y ||
        room.y + room.h <= rect.y;
      if (!separado) return true;
    }
    return false;
  }

  // Células ocupadas por corredores (fora das salas)
  function corridorCellSet() {
    const cells = new Set();
    for (let i = 0; i < state.connections.length; i++) {
      const path = state.connections[i].cells;
      for (let j = 0; j < path.length; j++) {
        if (!roomAt(path[j].c, path[j].r)) cells.add(path[j].c + ':' + path[j].r);
      }
    }
    return cells;
  }

  // Uma sala não pode ser criada sobre outra sala nem sobre um corredor existente
  function areaBlocked(rect) {
    if (overlapsRoom(rect)) return true;
    const corridors = corridorCellSet();
    for (let c = rect.x; c < rect.x + rect.w; c++) {
      for (let r = rect.y; r < rect.y + rect.h; r++) {
        if (corridors.has(c + ':' + r)) return true;
      }
    }
    return false;
  }

  function roomWallKeys(room) {
    const keys = [];
    for (let c = room.x; c < room.x + room.w; c++) {
      keys.push('h:' + c + ':' + room.y);
      keys.push('h:' + c + ':' + (room.y + room.h));
    }
    for (let r = room.y; r < room.y + room.h; r++) {
      keys.push('v:' + room.x + ':' + r);
      keys.push('v:' + (room.x + room.w) + ':' + r);
    }
    return keys;
  }

  // Parede sob o cursor, considerando a proximidade de cada borda da célula
  function edgeFromPoint(point) {
    const cell = cellFromPoint(point);
    const lx = point.x - cell.c * CELL;
    const ly = point.y - cell.r * CELL;
    const candidates = [
      { key: 'h:' + cell.c + ':' + cell.r, d: ly },
      { key: 'h:' + cell.c + ':' + (cell.r + 1), d: CELL - ly },
      { key: 'v:' + cell.c + ':' + cell.r, d: lx },
      { key: 'v:' + (cell.c + 1) + ':' + cell.r, d: CELL - lx }
    ];
    candidates.sort(function (a, b) { return a.d - b.d; });
    for (let i = 0; i < candidates.length; i++) {
      if (candidates[i].d <= EDGE_TOL && state.wallMap.has(candidates[i].key) &&
        !state.openings.has(candidates[i].key)) {
        return candidates[i].key;
      }
    }
    return null;
  }
  // #endregion

  // #region Trajeto dos corredores
  // Trajeto simples: primeiro na horizontal, depois na vertical
  function pathHorizontalThenVertical(from, to) {
    const cells = [];
    const stepC = to.c >= from.c ? 1 : -1;
    for (let c = from.c; c !== to.c + stepC; c += stepC) {
      cells.push({ c: c, r: from.r });
    }
    const stepR = to.r >= from.r ? 1 : -1;
    for (let r = from.r + stepR; r !== to.r + stepR; r += stepR) {
      cells.push({ c: to.c, r: r });
    }
    return cells;
  }

  // Trajeto alternativo: primeiro na vertical, depois na horizontal
  function pathVerticalThenHorizontal(from, to) {
    const cells = [];
    const stepR = to.r >= from.r ? 1 : -1;
    for (let r = from.r; r !== to.r + stepR; r += stepR) {
      cells.push({ c: from.c, r: r });
    }
    const stepC = to.c >= from.c ? 1 : -1;
    for (let c = from.c + stepC; c !== to.c + stepC; c += stepC) {
      cells.push({ c: c, r: to.r });
    }
    return cells;
  }

  // O trajeto só é válido se não atravessar salas que não sejam a de origem e a de destino
  function pathIsClear(cells, fromRoomId, toRoomId) {
    for (let i = 0; i < cells.length; i++) {
      const owner = roomAt(cells[i].c, cells[i].r);
      if (owner && owner.id !== fromRoomId && owner.id !== toRoomId) return false;
    }
    return true;
  }

  function planPath(from, to) {
    const fromRoom = roomAt(from.c, from.r);
    const toRoom = roomAt(to.c, to.r);
    if (!fromRoom || !toRoom || fromRoom.id === toRoom.id) {
      return { valid: false, cells: [from], toRoom: toRoom };
    }
    const attempts = [
      pathHorizontalThenVertical(from, to),
      pathVerticalThenHorizontal(from, to)
    ];
    for (let i = 0; i < attempts.length; i++) {
      if (pathIsClear(attempts[i], fromRoom.id, toRoom.id)) {
        return { valid: true, cells: attempts[i], toRoom: toRoom };
      }
    }
    return { valid: false, cells: attempts[0], toRoom: toRoom };
  }
  // #endregion

  // #region Layout do grid
  // Quantidade de colunas/linhas já ocupadas pelos elementos do mapa
  function usedCols() {
    let max = 1;
    for (let i = 0; i < state.rooms.length; i++) {
      max = Math.max(max, state.rooms[i].x + state.rooms[i].w);
    }
    for (let i = 0; i < state.connections.length; i++) {
      const cells = state.connections[i].cells;
      for (let j = 0; j < cells.length; j++) max = Math.max(max, cells[j].c + 1);
    }
    return max;
  }

  function usedRows() {
    let max = 1;
    for (let i = 0; i < state.rooms.length; i++) {
      max = Math.max(max, state.rooms[i].y + state.rooms[i].h);
    }
    for (let i = 0; i < state.connections.length; i++) {
      const cells = state.connections[i].cells;
      for (let j = 0; j < cells.length; j++) max = Math.max(max, cells[j].r + 1);
    }
    return max;
  }

  // O palco cobre toda a área visível; a grade "infinita" é desenhada no mundo
  function applyGridSize() {
    const availW = Math.max(CELL, workspace.clientWidth);
    const availH = Math.max(CELL, workspace.clientHeight);

    const fitCols = Math.max(MIN_CELLS, Math.ceil(availW / CELL));
    const fitRows = Math.max(MIN_CELLS, Math.ceil(availH / CELL));

    cols = Math.max(fitCols, usedCols());
    rows = Math.max(fitRows, usedRows());

    document.documentElement.style.setProperty('--cell', CELL + 'px');
  }

  // Aplica o deslocamento (pan) e o zoom ao mundo que contém a grade e o mapa
  function applyView() {
    world.style.transform = 'translate(' + view.tx + 'px, ' + view.ty + 'px) scale(' + view.k + ')';
  }
  // #endregion

  // #region Zoom
  function updateZoomControls() {
    btnZoomReset.textContent = Math.round(view.k * 100) + '%';
    btnZoomIn.disabled = view.k >= MAX_ZOOM;
    btnZoomOut.disabled = view.k <= MIN_ZOOM;
  }

  // Aplica a escala mantendo fixo o ponto informado (em pixels de tela); o centro do palco por padrão
  function setZoom(nextScale, anchor) {
    const scale = clamp(nextScale, MIN_ZOOM, MAX_ZOOM);
    if (scale === view.k) return;

    const rect = stage.getBoundingClientRect();
    const point = anchor || { x: rect.width / 2, y: rect.height / 2 };
    const worldX = (point.x - view.tx) / view.k;
    const worldY = (point.y - view.ty) / view.k;

    view.k = scale;
    view.tx = point.x - worldX * scale;
    view.ty = point.y - worldY * scale;

    applyView();
    updateZoomControls();
  }

  function resetView() {
    view.k = 1;
    view.tx = 0;
    view.ty = 0;
    applyView();
    updateZoomControls();
  }

  // Zoom com a roda do mouse, mantendo o cursor como ponto fixo
  function onWheel(event) {
    let delta = event.deltaY;
    if (event.deltaMode === 1) delta *= 16;
    else if (event.deltaMode === 2) delta *= 100;

    const factor = Math.exp(-delta * 0.0015);
    const rect = stage.getBoundingClientRect();
    setZoom(view.k * factor, { x: event.clientX - rect.left, y: event.clientY - rect.top });

    event.preventDefault();
  }
  // #endregion

  // #region Histórico (desfazer)
  const history = [];

  function snapshot() {
    return JSON.stringify({
      rooms: state.rooms,
      doors: Array.from(state.doors),
      openings: Array.from(state.openings),
      connections: state.connections
    });
  }

  function pushHistory() {
    history.push(snapshot());
    if (history.length > HISTORY_LIMIT) history.shift();
  }

  function applySnapshot(json) {
    const data = JSON.parse(json);
    state.rooms = data.rooms;
    state.doors = new Set(data.doors);
    state.openings = new Set(data.openings || []);
    state.connections = data.connections;
    state.nextId = nextIdFromState();
    state.hoverKey = null;
    state.drag = null;
    applyGridSize();
    renderAll();
  }

  function nextIdFromState() {
    let max = 0;
    for (let i = 0; i < state.rooms.length; i++) max = Math.max(max, state.rooms[i].id);
    for (let i = 0; i < state.connections.length; i++) max = Math.max(max, state.connections[i].id);
    return max + 1;
  }

  function undo() {
    if (history.length === 0) return;
    applySnapshot(history.pop());
  }
  // #endregion

  // #region Alterações no mapa
  function placeRoom(rect) {
    state.rooms.push({ id: state.nextId++, x: rect.x, y: rect.y, w: rect.w, h: rect.h });
  }

  function addRoom(rect) {
    pushHistory();
    placeRoom(rect);
    renderAll();
  }

  function toggleDoor(key) {
    pushHistory();
    if (state.doors.has(key)) {
      state.doors.delete(key);
    } else {
      state.doors.add(key);
    }
    renderAll();
  }

  // Segmentos de parede atravessados pelo corredor são abertos (removidos), sem porta
  function openWallsAlongPath(cells) {
    for (let i = 0; i < cells.length - 1; i++) {
      const key = edgeBetween(cells[i], cells[i + 1]);
      if (key && state.wallMap.has(key)) state.openings.add(key);
    }
  }

  // Aplica uma conexão já validada ao mapa (sem histórico e sem desenhar)
  function placeConnection(fromCell, plan) {
    const fromRoom = roomAt(fromCell.c, fromCell.r);
    state.connections.push({
      id: state.nextId++,
      from: fromRoom ? fromRoom.id : 0,
      to: plan.toRoom ? plan.toRoom.id : 0,
      cells: plan.cells
    });
    openWallsAlongPath(plan.cells);
  }

  function addConnection(fromCell, toCell) {
    const plan = planPath(fromCell, toCell);
    if (!plan.valid || !plan.toRoom) return;

    pushHistory();
    placeConnection(fromCell, plan);
    renderAll();
  }

  function clearMap() {
    pushHistory();
    state.rooms = [];
    state.doors.clear();
    state.openings.clear();
    state.connections = [];
    state.hoverKey = null;
    state.drag = null;
    renderAll();
  }
  // #endregion

  // #region Geração aleatória
  const PLACE_ATTEMPTS = 40;   // tentativas para encaixar cada sala nova
  const DOOR_CHANCE = 0.5;     // proporção de passagens com porta (as demais ficam abertas)

  function randomInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function fitsInGrid(rect, maxC, maxR) {
    return rect.x >= 0 && rect.y >= 0 &&
      rect.x + rect.w <= maxC && rect.y + rect.h <= maxR;
  }

  // Salas podem se encostar (compartilhar a parede), mas não se sobrepor
  function overlapsAny(rect) {
    for (let i = 0; i < state.rooms.length; i++) {
      const room = state.rooms[i];
      const separado = rect.x + rect.w <= room.x ||
        room.x + room.w <= rect.x ||
        rect.y + rect.h <= room.y ||
        room.y + room.h <= rect.y;
      if (!separado) return true;
    }
    return false;
  }

  // Candidata a sala encostada na sala "parent", junto com a aresta compartilhada
  function randomAdjacentRoom(parent, maxW, maxH) {
    const dir = randomInt(0, 3); // 0 leste, 1 oeste, 2 sul, 3 norte
    let w = randomInt(2, maxW);
    let h = randomInt(2, maxH);
    if (Math.random() < 0.25) { // sala fina, no formato de um corredor
      if (Math.random() < 0.5) h = 1; else w = 1;
    }

    const px2 = parent.x + parent.w;
    const py2 = parent.y + parent.h;

    if (dir === 0 || dir === 1) {
      const lo = Math.max(parent.y - h + 1, 0);
      const hi = py2 - 1;
      if (hi < lo) return null;
      const y = randomInt(lo, hi);
      const x = dir === 0 ? px2 : parent.x - w;
      return {
        rect: { x: x, y: y, w: w, h: h },
        edge: {
          axis: 'v',
          fixed: dir === 0 ? px2 : parent.x,
          lo: Math.max(parent.y, y),
          hi: Math.min(py2, y + h) - 1
        }
      };
    }

    const lo = Math.max(parent.x - w + 1, 0);
    const hi = px2 - 1;
    if (hi < lo) return null;
    const x = randomInt(lo, hi);
    const y = dir === 2 ? py2 : parent.y - h;
    return {
      rect: { x: x, y: y, w: w, h: h },
      edge: {
        axis: 'h',
        fixed: dir === 2 ? py2 : parent.y,
        lo: Math.max(parent.x, x),
        hi: Math.min(px2, x + w) - 1
      }
    };
  }

  // Abre a passagem na aresta compartilhada: uma porta ou uma abertura livre
  function applyPassage(edge) {
    const pos = randomInt(edge.lo, edge.hi);
    const key = edge.axis === 'v'
      ? 'v:' + edge.fixed + ':' + pos
      : 'h:' + pos + ':' + edge.fixed;
    if (!state.wallMap.has(key)) return;
    if (Math.random() < DOOR_CHANCE) state.doors.add(key);
    else state.openings.add(key);
  }

  function generateDungeon(total) {
    pushHistory();

    state.rooms = [];
    state.doors.clear();
    state.openings.clear();
    state.connections = [];
    state.nextId = 1;
    state.hoverKey = null;
    state.drag = null;

    // usa apenas colunas/linhas inteiras, para nenhuma sala ficar cortada na borda
    const boundCols = Math.max(2, cols - 1);
    const boundRows = Math.max(2, rows - 1);
    const maxW = Math.max(2, Math.min(8, boundCols - 2));
    const maxH = Math.max(2, Math.min(6, boundRows - 2));

    // primeira sala
    const w0 = randomInt(2, maxW);
    const h0 = randomInt(2, maxH);
    placeRoom({
      x: randomInt(1, Math.max(1, boundCols - 1 - w0)),
      y: randomInt(1, Math.max(1, boundRows - 1 - h0)),
      w: w0,
      h: h0
    });

    // as demais salas encostam em alguma já existente, formando um conjunto único
    const passages = [];
    for (let i = 1; i < total; i++) {
      let chosen = null;
      for (let attempt = 0; attempt < PLACE_ATTEMPTS && !chosen; attempt++) {
        const parent = state.rooms[randomInt(0, state.rooms.length - 1)];
        const candidate = randomAdjacentRoom(parent, maxW, maxH);
        if (candidate && fitsInGrid(candidate.rect, boundCols, boundRows) && !overlapsAny(candidate.rect)) {
          chosen = candidate;
        }
      }
      if (!chosen) break;
      placeRoom(chosen.rect);
      passages.push(chosen.edge);
    }

    rebuildWalls();
    for (let i = 0; i < passages.length; i++) applyPassage(passages[i]);

    applyGridSize();
    renderAll();
  }
  // #endregion

  // #region Exportar e importar
  function exportDungeon() {
    const data = {
      version: 1,
      rooms: state.rooms,
      doors: Array.from(state.doors),
      connections: state.connections
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'masmorra.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function isInteger(value) {
    return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
  }

  function parseRoom(item) {
    if (!item || !isInteger(item.x) || !isInteger(item.y) ||
      !isInteger(item.w) || !isInteger(item.h)) return null;
    if (item.x < 0 || item.y < 0 || item.w < 1 || item.h < 1) return null;
    return { x: item.x, y: item.y, w: item.w, h: item.h };
  }

  function parseCells(item) {
    if (!item || !Array.isArray(item.cells) || item.cells.length === 0) return null;
    const cells = [];
    for (let i = 0; i < item.cells.length; i++) {
      const cell = item.cells[i];
      if (!cell || !isInteger(cell.c) || !isInteger(cell.r)) return null;
      cells.push({ c: cell.c, r: cell.r });
    }
    return cells;
  }

  function loadDungeon(data) {
    if (!data || !Array.isArray(data.rooms) || !Array.isArray(data.connections)) {
      throw new Error('formato não reconhecido');
    }

    const rooms = [];
    for (let i = 0; i < data.rooms.length; i++) {
      const room = parseRoom(data.rooms[i]);
      if (!room) throw new Error('sala inválida no arquivo');
      rooms.push(room);
    }
    if (rooms.length === 0) throw new Error('o arquivo não contém salas');

    const connections = [];
    for (let i = 0; i < data.connections.length; i++) {
      const cells = parseCells(data.connections[i]);
      if (!cells) throw new Error('conexão inválida no arquivo');
      connections.push(cells);
    }

    const doors = [];
    if (Array.isArray(data.doors)) {
      for (let i = 0; i < data.doors.length; i++) {
        if (typeof data.doors[i] === 'string') doors.push(data.doors[i]);
      }
    }

    pushHistory();

    state.rooms = [];
    state.doors.clear();
    state.openings.clear();
    state.connections = [];
    state.nextId = 1;
    state.hoverKey = null;
    state.drag = null;

    for (let i = 0; i < rooms.length; i++) placeRoom(rooms[i]);
    rebuildWalls();

    for (let i = 0; i < connections.length; i++) {
      const cells = connections[i];
      const first = cells[0];
      const last = cells[cells.length - 1];
      state.connections.push({
        id: state.nextId++,
        from: roomIdAt(first.c, first.r),
        to: roomIdAt(last.c, last.r),
        cells: cells
      });
      openWallsAlongPath(cells);
    }

    for (let i = 0; i < doors.length; i++) {
      if (state.wallMap.has(doors[i])) state.doors.add(doors[i]);
    }

    applyGridSize();
    renderAll();
  }

  function roomIdAt(c, r) {
    const room = roomAt(c, r);
    return room ? room.id : 0;
  }

  function onImportFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function () {
      try {
        loadDungeon(JSON.parse(String(reader.result)));
      } catch (error) {
        window.alert('Não foi possível importar o arquivo: ' + error.message + '.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }
  // #endregion

  // #region Desenho
  function rebuildWalls() {
    const segments = new Set();
    const map = new Map();
    for (let i = 0; i < state.rooms.length; i++) {
      const keys = roomWallKeys(state.rooms[i]);
      for (let k = 0; k < keys.length; k++) {
        segments.add(keys[k]);
        if (!map.has(keys[k])) map.set(keys[k], state.rooms[i].id);
      }
    }
    state.wallSegments = segments;
    state.wallMap = map;

    // remove portas que não correspondem mais a um segmento de parede
    state.doors.forEach(function (key) {
      if (!segments.has(key)) state.doors.delete(key);
    });

    // remove aberturas que não correspondem mais a um segmento de parede
    state.openings.forEach(function (key) {
      if (!segments.has(key)) state.openings.delete(key);
    });
  }

  function segmentHtml(key, className) {
    const seg = parseKey(key);
    const pos = 'left:' + (seg.c * CELL) + 'px;top:' + (seg.r * CELL) + 'px;';
    if (seg.dir === 'h') {
      return '<div class="' + className + ' seg-h" style="' + pos + 'width:' + CELL + 'px"></div>';
    }
    return '<div class="' + className + ' seg-v" style="' + pos + 'height:' + CELL + 'px"></div>';
  }

  function renderRooms() {
    let html = '';
    for (let i = 0; i < state.rooms.length; i++) {
      const room = state.rooms[i];
      html += '<div class="room" style="left:' + (room.x * CELL) + 'px;top:' + (room.y * CELL) +
        'px;width:' + (room.w * CELL) + 'px;height:' + (room.h * CELL) + 'px"></div>';
    }
    layerRooms.innerHTML = html;
  }

  function renderCorridors() {
    const cells = corridorCellSet();
    let html = '';
    cells.forEach(function (key) {
      const parts = key.split(':');
      const c = Number(parts[0]);
      const r = Number(parts[1]);
      html += '<div class="corridor-cell" style="left:' + (c * CELL) + 'px;top:' + (r * CELL) +
        'px;width:' + CELL + 'px;height:' + CELL + 'px"></div>';
    });
    layerCorridors.innerHTML = html;
  }

  function renderWalls() {
    let html = '';
    state.wallSegments.forEach(function (key) {
      if (state.doors.has(key) || state.openings.has(key)) return;
      const className = key === state.hoverKey ? 'seg is-hover' : 'seg';
      html += segmentHtml(key, className);
    });
    layerWalls.innerHTML = html;
  }

  function renderDoors() {
    let html = '';
    state.doors.forEach(function (key) {
      html += segmentHtml(key, 'seg is-door');
    });
    layerDoors.innerHTML = html;
  }

  function renderRoomPreview(rect, valid) {
    layerPreview.innerHTML = '<div class="preview-room' + (valid ? '' : ' is-invalid') +
      '" style="left:' + (rect.x * CELL) + 'px;top:' + (rect.y * CELL) +
      'px;width:' + (rect.w * CELL) + 'px;height:' + (rect.h * CELL) + 'px"></div>';
  }

  function renderPathPreview(cells, valid) {
    let html = '';
    for (let i = 0; i < cells.length; i++) {
      html += '<div class="preview-cell' + (valid ? '' : ' is-invalid') +
        '" style="left:' + (cells[i].c * CELL) + 'px;top:' + (cells[i].r * CELL) +
        'px;width:' + CELL + 'px;height:' + CELL + 'px"></div>';
    }
    layerPreview.innerHTML = html;
  }

  function clearPreview() {
    layerPreview.innerHTML = '';
  }

  function renderAll() {
    rebuildWalls();
    renderRooms();
    renderCorridors();
    renderWalls();
    renderDoors();
  }
  // #endregion

  // #region Interação
  let resizePending = false;

  function setTool(tool) {
    state.tool = tool;
    document.body.setAttribute('data-tool', tool);
    state.hoverKey = null;
    state.drag = null;
    clearPreview();

    for (let i = 0; i < toolButtons.length; i++) {
      const ativo = toolButtons[i].dataset.tool === tool;
      toolButtons[i].classList.toggle('is-active', ativo);
      toolButtons[i].setAttribute('aria-pressed', ativo ? 'true' : 'false');
    }
    renderWalls();
  }

  function updateHover(point) {
    if (state.drag || (state.tool !== 'door' && state.tool !== 'room')) {
      if (state.hoverKey !== null) {
        state.hoverKey = null;
        renderWalls();
      }
      return;
    }
    const key = edgeFromPoint(point);
    if (key !== state.hoverKey) {
      state.hoverKey = key;
      renderWalls();
    }
  }

  function onPointerDown(event) {
    // Botão do meio: desloca o quadro (como na ferramenta de nós).
    if (event.button === 1) {
      pan = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        tx: view.tx,
        ty: view.ty
      };
      stage.classList.add('stage--panning');
      event.preventDefault();
      try {
        stage.setPointerCapture(event.pointerId);
      } catch (error) {
        /* ignore */
      }
      return;
    }

    if (event.button !== 0) return;
    const point = pointFromEvent(event);
    const cell = cellFromPoint(point);
    if (!insideGrid(cell)) return;
    event.preventDefault();

    if (state.tool === 'door') {
      const edge = edgeFromPoint(point);
      if (edge) toggleDoor(edge);
      return;
    }

    if (state.tool === 'connect') {
      if (!roomAt(cell.c, cell.r)) return;
      state.drag = { type: 'connect', fromCell: cell, toCell: cell };
      planAndRenderPath(cell, cell);
      stage.setPointerCapture(event.pointerId);
      return;
    }

    state.drag = { type: 'room', start: cell, current: cell, moved: false };
    clearPreview();
    stage.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (pan && event.pointerId === pan.pointerId) {
      view.tx = pan.tx + (event.clientX - pan.startX);
      view.ty = pan.ty + (event.clientY - pan.startY);
      applyView();
      return;
    }

    const point = pointFromEvent(event);
    updateHover(point);

    const drag = state.drag;
    if (!drag) return;

    const cell = clampCell(cellFromPoint(point));

    if (drag.type === 'room') {
      if (cell.c !== drag.current.c || cell.r !== drag.current.r) {
        drag.moved = true;
        drag.current = cell;
        const rect = rectFromCells(drag.start, cell);
        renderRoomPreview(rect, !areaBlocked(rect));
      }
      return;
    }

    if (drag.type === 'connect') {
      if (cell.c === drag.toCell.c && cell.r === drag.toCell.r) return;
      drag.toCell = cell;
      planAndRenderPath(drag.fromCell, cell);
    }
  }

  function planAndRenderPath(fromCell, toCell) {
    const plan = planPath(fromCell, toCell);
    renderPathPreview(plan.cells, plan.valid);
  }

  function onPointerUp(event) {
    if (pan && event.pointerId === pan.pointerId) {
      pan = null;
      stage.classList.remove('stage--panning');
      if (stage.hasPointerCapture && stage.hasPointerCapture(event.pointerId)) {
        stage.releasePointerCapture(event.pointerId);
      }
      return;
    }

    const drag = state.drag;
    state.drag = null;
    if (!drag) return;

    if (stage.hasPointerCapture && stage.hasPointerCapture(event.pointerId)) {
      stage.releasePointerCapture(event.pointerId);
    }

    if (drag.type === 'connect') {
      clearPreview();
      const point = pointFromEvent(event);
      const cell = cellFromPoint(point);
      if (!insideGrid(cell)) return;
      addConnection(drag.fromCell, cell);
      return;
    }

    // ferramenta de sala
    if (drag.moved) {
      const rect = rectFromCells(drag.start, drag.current);
      clearPreview();
      if (!areaBlocked(rect)) addRoom(rect);
      return;
    }

    // clique simples: alterna a porta da parede sob o cursor ou cria uma sala de 1 célula
    const point = pointFromEvent(event);
    const edge = edgeFromPoint(point);
    clearPreview();
    if (edge) {
      toggleDoor(edge);
    } else if (!areaBlocked({ x: drag.start.c, y: drag.start.r, w: 1, h: 1 })) {
      addRoom({ x: drag.start.c, y: drag.start.r, w: 1, h: 1 });
    }
  }

  function onPointerCancel() {
    pan = null;
    stage.classList.remove('stage--panning');
    state.drag = null;
    clearPreview();
  }

  function onKeyDown(event) {
    const desfazer = (event.ctrlKey || event.metaKey) && !event.shiftKey &&
      (event.key === 'z' || event.key === 'Z');
    if (desfazer && event.target !== roomCountInput) {
      event.preventDefault();
      undo();
      return;
    }
    if (event.key !== 'Escape') return;
    state.drag = null;
    clearPreview();
  }

  function onGenerateClick() {
    let total = parseInt(roomCountInput.value, 10);
    if (!isFinite(total) || total < 1) total = 1;
    if (total > MAX_ROOMS) total = MAX_ROOMS;
    roomCountInput.value = String(total);
    generateDungeon(total);
  }

  function onResize() {
    if (resizePending) return;
    resizePending = true;
    window.requestAnimationFrame(function () {
      resizePending = false;
      applyGridSize();
      renderAll();
    });
  }

  function onClearClick() {
    if (state.rooms.length === 0 && state.connections.length === 0) return;
    if (window.confirm('Apagar todas as salas, portas e conexões do mapa?')) {
      clearMap();
    }
  }
  // #endregion

  // #region Inicialização
  function init() {
    applyGridSize();
    applyView();
    updateZoomControls();

    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointercancel', onPointerCancel);
    stage.addEventListener('contextmenu', function (event) { event.preventDefault(); });

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);

    clearButton.addEventListener('click', onClearClick);
    exportButton.addEventListener('click', exportDungeon);
    importButton.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', onImportFile);
    generateButton.addEventListener('click', onGenerateClick);

    btnZoomIn.addEventListener('click', function () { setZoom(view.k * ZOOM_STEP); });
    btnZoomOut.addEventListener('click', function () { setZoom(view.k / ZOOM_STEP); });
    btnZoomReset.addEventListener('click', resetView);
    stage.addEventListener('wheel', onWheel, { passive: false });

    for (let i = 0; i < toolButtons.length; i++) {
      toolButtons[i].addEventListener('click', function () {
        setTool(this.dataset.tool);
      });
    }

    setTool('room');
    renderAll();
  }

  document.addEventListener('DOMContentLoaded', init);
  // #endregion
})();
