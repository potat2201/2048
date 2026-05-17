const SIZE = 4;
const BEST_KEY = "2048-best-score";
const WIN_VALUE = 2048;
const MILESTONES = [128, 256, 512, 1024, 2048];

const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("best-score");
const milestoneTimeEls = Object.fromEntries(
  MILESTONES.map((value) => [
    value,
    document.querySelector(`[data-milestone="${value}"]`),
  ])
);
const gridBackground = document.getElementById("grid-background");
const tileContainer = document.getElementById("tile-container");
const overlay = document.getElementById("overlay");
const overlayMessage = document.getElementById("overlay-message");
const newGameBtn = document.getElementById("new-game");
const tryAgainBtn = document.getElementById("try-again");

let grid = [];
let score = 0;
let bestScore = Number(localStorage.getItem(BEST_KEY)) || 0;
let hasWon = false;
let keepPlaying = false;
let cellSize = 0;
let gap = 12;
let gameStartTime = 0;
let milestoneTimes = {};

function createEmptyGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function initBackground() {
  gridBackground.innerHTML = "";
  for (let i = 0; i < SIZE * SIZE; i++) {
    const cell = document.createElement("div");
    cell.className = "grid-cell";
    gridBackground.appendChild(cell);
  }
}

function measureBoard() {
  const rect = gridBackground.getBoundingClientRect();
  const style = getComputedStyle(document.documentElement);
  gap = parseFloat(style.getPropertyValue("--gap")) || 12;
  cellSize = (rect.width - gap * 3) / 4;
}

function tilePosition(row, col) {
  return {
    x: col * (cellSize + gap),
    y: row * (cellSize + gap),
  };
}

function renderTiles(animations = {}) {
  tileContainer.innerHTML = "";
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const value = grid[r][c];
      if (!value) continue;

      const tile = document.createElement("div");
      const key = `${r}-${c}`;
      const anim = animations[key];
      const pos = anim?.to ?? tilePosition(r, c);

      tile.className =
        value > 2048 ? "tile tile-super" : `tile tile-${value}`;
      tile.textContent = String(value);

      tile.style.width = `${cellSize}px`;
      tile.style.height = `${cellSize}px`;
      tile.style.transform = `translate(${pos.x}px, ${pos.y}px)`;

      if (anim?.isNew) tile.classList.add("tile-new");
      if (anim?.merged) tile.classList.add("tile-merged");

      tileContainer.appendChild(tile);
    }
  }
}

function updateScoreDisplay() {
  scoreEl.textContent = score;
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem(BEST_KEY, String(bestScore));
  }
  bestScoreEl.textContent = bestScore;
}

function formatElapsed(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) {
    return `${min}:${String(sec).padStart(2, "0")}`;
  }
  return `${totalSec}s`;
}

function resetMilestones() {
  milestoneTimes = {};
  for (const value of MILESTONES) {
    if (milestoneTimeEls[value]) {
      milestoneTimeEls[value].textContent = "—";
      milestoneTimeEls[value].classList.remove("milestone-hit");
    }
  }
}

function checkMilestones() {
  const elapsed = Date.now() - gameStartTime;
  for (const value of MILESTONES) {
    if (milestoneTimes[value] != null) continue;
    const found = grid.some((row) => row.some((cell) => cell === value));
    if (!found) continue;

    milestoneTimes[value] = elapsed;
    const el = milestoneTimeEls[value];
    if (el) {
      el.textContent = formatElapsed(elapsed);
      el.classList.add("milestone-hit");
    }
  }
}

function emptyCells() {
  const cells = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) cells.push([r, c]);
    }
  }
  return cells;
}

function addRandomTile() {
  const cells = emptyCells();
  if (!cells.length) return null;
  const [r, c] = cells[Math.floor(Math.random() * cells.length)];
  grid[r][c] = Math.random() < 0.9 ? 2 : 4;
  return { r, c, isNew: true };
}

function slideLine(line) {
  const filtered = line.filter((n) => n !== 0);
  const result = [];
  let gained = 0;
  let i = 0;
  while (i < filtered.length) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const merged = filtered[i] * 2;
      result.push(merged);
      gained += merged;
      i += 2;
    } else {
      result.push(filtered[i]);
      i++;
    }
  }
  while (result.length < SIZE) result.push(0);
  return { line: result, gained, changed: result.some((v, idx) => v !== line[idx]) };
}

function move(direction) {
  const vectors = {
    left: { dr: 0, dc: -1, traverse: () => [...Array(SIZE).keys()].map((r) => ({ r, reverse: false })) },
    right: { dr: 0, dc: 1, traverse: () => [...Array(SIZE).keys()].map((r) => ({ r, reverse: true })) },
    up: { dr: -1, dc: 0, traverse: () => [...Array(SIZE).keys()].map((c) => ({ c, reverse: false })) },
    down: { dr: 1, dc: 0, traverse: () => [...Array(SIZE).keys()].map((c) => ({ c, reverse: true })) },
  };

  const vec = vectors[direction];
  if (!vec) return false;

  const next = createEmptyGrid();
  let moved = false;
  let gained = 0;

  const lines = vec.traverse();
  for (const spec of lines) {
    let line;
    if ("r" in spec) {
      line = grid[spec.r].slice();
      if (spec.reverse) line.reverse();
    } else {
      line = [];
      for (let r = 0; r < SIZE; r++) line.push(grid[r][spec.c]);
      if (spec.reverse) line.reverse();
    }

    const { line: slid, gained: g, changed } = slideLine(line);
    gained += g;
    if (changed) moved = true;

    let output = slid;
    if (spec.reverse) output = [...output].reverse();

    if ("r" in spec) {
      next[spec.r] = output;
    } else {
      for (let r = 0; r < SIZE; r++) next[r][spec.c] = output[r];
    }
  }

  if (!moved) return false;

  grid = next;
  score += gained;
  updateScoreDisplay();

  checkMilestones();

  const spawned = addRandomTile();
  measureBoard();
  const anims = {};
  if (spawned) anims[`${spawned.r}-${spawned.c}`] = { isNew: true };
  renderTiles(anims);

  checkMilestones();
  checkGameState();
  return true;
}

function canMove() {
  if (emptyCells().length) return true;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c];
      if (c < SIZE - 1 && grid[r][c + 1] === v) return true;
      if (r < SIZE - 1 && grid[r + 1][c] === v) return true;
    }
  }
  return false;
}

function hasWinningTile() {
  return grid.some((row) => row.some((v) => v >= WIN_VALUE));
}

function showOverlay(message) {
  overlayMessage.textContent = message;
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
}

function hideOverlay() {
  overlay.classList.add("hidden");
  overlay.setAttribute("aria-hidden", "true");
}

function checkGameState() {
  if (!hasWon && !keepPlaying && hasWinningTile()) {
    hasWon = true;
    showOverlay("You win!");
    return;
  }
  if (!canMove()) {
    showOverlay("Game over!");
  }
}

function startGame() {
  grid = createEmptyGrid();
  score = 0;
  hasWon = false;
  keepPlaying = false;
  hideOverlay();
  resetMilestones();
  gameStartTime = Date.now();
  updateScoreDisplay();
  addRandomTile();
  addRandomTile();
  measureBoard();
  renderTiles();
}

function handleKey(event) {
  const map = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
    a: "left",
    d: "right",
    w: "up",
    s: "down",
  };
  const key = map[event.key];
  if (!key) return;
  event.preventDefault();
  move(key);
}

let touchStart = null;

function handleTouchStart(event) {
  const t = event.changedTouches[0];
  touchStart = { x: t.clientX, y: t.clientY };
}

function handleTouchEnd(event) {
  if (!touchStart) return;
  const t = event.changedTouches[0];
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  touchStart = null;

  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (Math.max(absX, absY) < 24) return;

  if (absX > absY) move(dx > 0 ? "right" : "left");
  else move(dy > 0 ? "down" : "up");
}

tryAgainBtn.addEventListener("click", startGame);
newGameBtn.addEventListener("click", startGame);
document.addEventListener("keydown", handleKey);
document.addEventListener("touchstart", handleTouchStart, { passive: true });
document.addEventListener("touchend", handleTouchEnd, { passive: true });
window.addEventListener("resize", () => {
  measureBoard();
  renderTiles();
});

overlay.addEventListener("click", (event) => {
  if (event.target === overlay && overlayMessage.textContent === "You win!") {
    keepPlaying = true;
    hideOverlay();
  }
});

initBackground();
bestScoreEl.textContent = bestScore;
startGame();
