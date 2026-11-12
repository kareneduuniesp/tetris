(() => {
  const COLS = 10, ROWS = 20, SIZE = 30;
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const nextCanvas = document.getElementById('next');
  const nctx = nextCanvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayHint = document.getElementById('overlayHint');
  const scoreEl = document.getElementById('score');
  const linesEl = document.getElementById('lines');
  const levelEl = document.getElementById('level');

  // Tons neutros, um por peça
  const COLORS = {
    I: '#3d3b38', O: '#6b6862', T: '#8f8c85', S: '#a9a69f',
    Z: '#58554f', J: '#7a776f', L: '#c0bdb6'
  };

  const SHAPES = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    O: [[1,1],[1,1]],
    T: [[0,1,0],[1,1,1],[0,0,0]],
    S: [[0,1,1],[1,1,0],[0,0,0]],
    Z: [[1,1,0],[0,1,1],[0,0,0]],
    J: [[1,0,0],[1,1,1],[0,0,0]],
    L: [[0,0,1],[1,1,1],[0,0,0]]
  };

  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  let grid, piece, next, score, lines, level;
  let dropCounter, lastTime, state, bag = [];

  const newGrid = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null));

  function nextType() {
    if (!bag.length) {
      bag = Object.keys(SHAPES);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop();
  }

  function makePiece(type) {
    const shape = SHAPES[type].map(r => [...r]);
    return { type, shape, x: Math.floor((COLS - shape[0].length) / 2), y: 0 };
  }

  function collides(p, dx = 0, dy = 0, shape = p.shape) {
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (!shape[y][x]) continue;
        const nx = p.x + x + dx, ny = p.y + y + dy;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && grid[ny][nx]) return true;
      }
    }
    return false;
  }

  function rotate(shape) {
    return shape[0].map((_, i) => shape.map(r => r[i]).reverse());
  }

  function tryRotate() {
    const rotated = rotate(piece.shape);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collides(piece, kick, 0, rotated)) {
        piece.shape = rotated;
        piece.x += kick;
        return;
      }
    }
  }

  function lock() {
    piece.shape.forEach((row, y) => row.forEach((v, x) => {
      if (v && piece.y + y >= 0) grid[piece.y + y][piece.x + x] = piece.type;
    }));
    clearLines();
    spawn();
  }

  function clearLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (grid[y].every(Boolean)) {
        grid.splice(y, 1);
        grid.unshift(Array(COLS).fill(null));
        cleared++;
        y++;
      }
    }
    if (cleared) {
      score += [0, 100, 300, 500, 800][cleared] * level;
      lines += cleared;
      level = Math.floor(lines / 10) + 1;
      updateHud();
    }
  }

  function spawn() {
    piece = next || makePiece(nextType());
    next = makePiece(nextType());
    if (collides(piece)) gameOver();
    drawNext();
  }

  function move(dx) {
    if (!collides(piece, dx, 0)) piece.x += dx;
  }

  function softDrop() {
    if (!collides(piece, 0, 1)) { piece.y++; score += 1; updateHud(); }
    else lock();
    dropCounter = 0;
  }

  function hardDrop() {
    let d = 0;
    while (!collides(piece, 0, 1)) { piece.y++; d++; }
    score += d * 2;
    updateHud();
    lock();
    dropCounter = 0;
  }

  function ghostY() {
    let d = 0;
    while (!collides(piece, 0, d + 1)) d++;
    return piece.y + d;
  }

  function drawCell(c, x, y, color, s = SIZE) {
    c.fillStyle = color;
    c.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // grade discreta
    ctx.strokeStyle = css('--line');
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < COLS; x++) { ctx.moveTo(x * SIZE + .5, 0); ctx.lineTo(x * SIZE + .5, canvas.height); }
    for (let y = 1; y < ROWS; y++) { ctx.moveTo(0, y * SIZE + .5); ctx.lineTo(canvas.width, y * SIZE + .5); }
    ctx.stroke();
    ctx.globalAlpha = 1;

    grid.forEach((row, y) => row.forEach((t, x) => { if (t) drawCell(ctx, x, y, COLORS[t]); }));

    if (piece && state !== 'over') {
      const gy = ghostY();
      ctx.globalAlpha = 0.25;
      piece.shape.forEach((row, y) => row.forEach((v, x) => {
        if (v) drawCell(ctx, piece.x + x, gy + y, COLORS[piece.type]);
      }));
      ctx.globalAlpha = 1;
      piece.shape.forEach((row, y) => row.forEach((v, x) => {
        if (v) drawCell(ctx, piece.x + x, piece.y + y, COLORS[piece.type]);
      }));
    }
  }

  function drawNext() {
    nctx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    const s = 24, shape = next.shape;
    const ox = (nextCanvas.width - shape[0].length * s) / 2 / s;
    const oy = (nextCanvas.height - shape.length * s) / 2 / s;
    shape.forEach((row, y) => row.forEach((v, x) => {
      if (v) drawCell(nctx, x + ox, y + oy, COLORS[next.type], s);
    }));
  }

  function updateHud() {
    scoreEl.textContent = score;
    linesEl.textContent = lines;
    levelEl.textContent = level;
  }

  function showOverlay(title, hint) {
    overlayTitle.textContent = title;
    overlayHint.textContent = hint;
    overlay.classList.remove('hidden');
  }

  function start() {
    grid = newGrid();
    score = 0; lines = 0; level = 1;
    bag = []; next = null;
    dropCounter = 0; lastTime = performance.now();
    updateHud();
    spawn();
    state = 'playing';
    overlay.classList.add('hidden');
  }

  function gameOver() {
    state = 'over';
    showOverlay('Fim de jogo', `${score} pontos · Enter para reiniciar`);
  }

  function togglePause() {
    if (state === 'playing') { state = 'paused'; showOverlay('Pausado', 'Pressione P para continuar'); }
    else if (state === 'paused') { state = 'playing'; overlay.classList.add('hidden'); lastTime = performance.now(); }
  }

  function loop(time) {
    const delta = time - lastTime;
    lastTime = time;
    if (state === 'playing') {
      dropCounter += delta;
      const interval = Math.max(80, 800 - (level - 1) * 70);
      if (dropCounter > interval) {
        if (!collides(piece, 0, 1)) piece.y++;
        else lock();
        dropCounter = 0;
      }
    }
    if (grid) draw();
    requestAnimationFrame(loop);
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (state === 'over' || !state)) { start(); return; }
    if (e.key === 'p' || e.key === 'P') { togglePause(); return; }
    if (state !== 'playing') return;
    switch (e.key) {
      case 'ArrowLeft': move(-1); break;
      case 'ArrowRight': move(1); break;
      case 'ArrowDown': softDrop(); break;
      case 'ArrowUp': tryRotate(); break;
      case ' ': hardDrop(); break;
      default: return;
    }
    e.preventDefault();
  });

  // Toque: toque gira, arraste move/desce
  let tx, ty, moved;
  canvas.addEventListener('touchstart', e => {
    tx = e.touches[0].clientX; ty = e.touches[0].clientY; moved = false;
  }, { passive: true });
  canvas.addEventListener('touchmove', e => {
    if (state !== 'playing') return;
    const dx = e.touches[0].clientX - tx, dy = e.touches[0].clientY - ty;
    if (Math.abs(dx) > 24) { move(dx > 0 ? 1 : -1); tx = e.touches[0].clientX; moved = true; }
    if (dy > 24) { softDrop(); ty = e.touches[0].clientY; moved = true; }
  }, { passive: true });
  canvas.addEventListener('touchend', () => {
    if (state === 'playing' && !moved) tryRotate();
  });
  overlay.addEventListener('click', () => {
    if (state === 'over' || !state) start(); else if (state === 'paused') togglePause();
  });

  grid = newGrid();
  next = makePiece(nextType());
  drawNext();
  lastTime = performance.now();
  requestAnimationFrame(loop);
})();
