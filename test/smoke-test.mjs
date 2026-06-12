import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }
  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }
  dispatchEvent(event) {
    event.target ||= this;
    event.preventDefault ||= () => {};
    for (const handler of this.listeners.get(event.type) || []) handler(event);
    return true;
  }
}

function createContext2d() {
  const noOp = () => {};
  return new Proxy({
    save: noOp,
    restore: noOp,
    translate: noOp,
    scale: noOp,
    fillRect: noOp,
    strokeRect: noOp,
    beginPath: noOp,
    closePath: noOp,
    moveTo: noOp,
    lineTo: noOp,
    arc: noOp,
    arcTo: noOp,
    bezierCurveTo: noOp,
    fill: noOp,
    stroke: noOp,
    createLinearGradient: () => ({ addColorStop: noOp }),
    measureText: (text) => ({ width: String(text).length * 8 }),
    fillText: noOp,
    set fillStyle(value) {},
    set strokeStyle(value) {},
    set lineWidth(value) {},
    set globalAlpha(value) {},
    set shadowBlur(value) {},
    set shadowColor(value) {},
    set font(value) {},
    set textAlign(value) {},
  }, {
    get(target, property) {
      if (property in target) return target[property];
      return noOp;
    },
  });
}

class FakeCanvas extends FakeEventTarget {
  constructor() {
    super();
    this.width = 1280;
    this.height = 720;
  }
  getContext() { return createContext2d(); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; }
  focus() {}
}

class FakeButton extends FakeEventTarget {
  constructor() {
    super();
    this.textContent = '';
    this.attributes = {};
  }
  setAttribute(name, value) { this.attributes[name] = value; }
}

class FakeTouchControls extends FakeEventTarget {}

const canvas = new FakeCanvas();
const soundButton = new FakeButton();
const resetButton = new FakeButton();
const touchControls = new FakeTouchControls();
const storage = new Map();
const scheduledFrames = [];
let clock = 0;

const windowTarget = new FakeEventTarget();
windowTarget.confirm = () => true;
windowTarget.guardiansDebug = undefined;
windowTarget.addEventListener = windowTarget.addEventListener.bind(windowTarget);
windowTarget.dispatchEvent = windowTarget.dispatchEvent.bind(windowTarget);

const localStorage = {
  getItem: (key) => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};

const document = {
  querySelector(selector) {
    if (selector === '#gameCanvas') return canvas;
    if (selector === '#soundButton') return soundButton;
    if (selector === '#resetButton') return resetButton;
    if (selector === '#touchControls') return touchControls;
    return null;
  },
};

function KeyboardEvent(type, init = {}) {
  return { type, code: init.code || '', preventDefault() {} };
}

const sandbox = {
  console,
  window: windowTarget,
  document,
  localStorage,
  performance: { now: () => clock },
  requestAnimationFrame(callback) { scheduledFrames.push(callback); return scheduledFrames.length; },
  AudioContext: class {
    constructor() { this.currentTime = 0; this.destination = {}; }
    createOscillator() { return { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  },
  KeyboardEvent,
  setTimeout,
  clearTimeout,
  Math,
  JSON,
};
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
const gameSource = fs.readFileSync(new URL('../src/game.js', import.meta.url), 'utf8');
vm.runInContext(gameSource, sandbox, { filename: 'src/game.js' });

assert.ok(windowTarget.guardiansDebug, 'A ponte de depuração deve existir após o carregamento.');
assert.equal(windowTarget.guardiansDebug.getState().scene, 'title', 'O jogo deve iniciar na tela de título.');
assert.ok(scheduledFrames.length > 0, 'O loop de animação deve ter sido agendado.');

function runFrame(ms = 16.67) {
  const callback = scheduledFrames.shift();
  assert.ok(callback, 'Um frame deve estar agendado.');
  clock += ms;
  callback(clock);
}

// Clique real no botão inicial: valida o ciclo mousemove -> click -> drawButton.
canvas.dispatchEvent({ type: 'mousemove', clientX: 180, clientY: 470 });
canvas.dispatchEvent({ type: 'click' });
runFrame();
assert.equal(windowTarget.guardiansDebug.getState().scene, 'academy', 'O clique no botão inicial deve abrir a Academia.');

// Carrega cristais de teste e valida compra de melhoria.
storage.set('alex-rese-guardians-save-v1', JSON.stringify({
  crystals: 100,
  xp: 0,
  highestMission: 1,
  upgrades: { programming: 0, mobility: 0, vitality: 0, research: 0 },
  missionsCompleted: 0,
  researchCarry: 0,
  sound: false,
}));
// Reexecuta o jogo em um segundo sandbox limpo para validar persistência carregada.
const secondFrames = [];
const secondWindow = new FakeEventTarget();
secondWindow.confirm = () => true;
secondWindow.addEventListener = secondWindow.addEventListener.bind(secondWindow);
secondWindow.dispatchEvent = secondWindow.dispatchEvent.bind(secondWindow);
const secondCanvas = new FakeCanvas();
const secondDocument = {
  querySelector(selector) {
    if (selector === '#gameCanvas') return secondCanvas;
    if (selector === '#soundButton') return new FakeButton();
    if (selector === '#resetButton') return new FakeButton();
    if (selector === '#touchControls') return new FakeTouchControls();
    return null;
  },
};
let secondClock = 0;
const secondSandbox = {
  ...sandbox,
  window: secondWindow,
  document: secondDocument,
  performance: { now: () => secondClock },
  requestAnimationFrame(callback) { secondFrames.push(callback); return secondFrames.length; },
};
secondSandbox.globalThis = secondSandbox;
vm.createContext(secondSandbox);
vm.runInContext(gameSource, secondSandbox, { filename: 'src/game.js' });

const debug = secondWindow.guardiansDebug;
assert.equal(debug.getState().crystals, 100, 'O progresso salvo deve ser carregado do localStorage.');
debug.openAcademy();
debug.buyUpgrade('programming');
assert.equal(debug.getState().upgrades.programming, 1, 'O investimento deve elevar Programação Rúnica ao nível 1.');
assert.equal(debug.getState().crystals, 93, 'A compra inicial de Programação Rúnica deve custar 7 cristais.');

debug.startMission(1);
assert.equal(debug.getState().scene, 'level', 'A missão 1 deve iniciar.');
const startX = debug.getState().player.x;
secondWindow.dispatchEvent(KeyboardEvent('keydown', { code: 'ArrowRight' }));
secondWindow.dispatchEvent(KeyboardEvent('keydown', { code: 'KeyJ' }));
for (let index = 0; index < 12; index += 1) {
  const callback = secondFrames.shift();
  assert.ok(callback, 'O loop da missão deve manter frames agendados.');
  secondClock += 16.67;
  callback(secondClock);
}
secondWindow.dispatchEvent(KeyboardEvent('keyup', { code: 'ArrowRight' }));
secondWindow.dispatchEvent(KeyboardEvent('keyup', { code: 'KeyJ' }));
assert.ok(debug.getState().player.x > startX, 'O personagem deve avançar ao pressionar a direção direita.');

secondWindow.dispatchEvent(KeyboardEvent('keydown', { code: 'KeyP' }));
assert.equal(debug.getState().paused, true, 'A tecla P deve pausar a missão.');
secondWindow.dispatchEvent(KeyboardEvent('keydown', { code: 'KeyP' }));
assert.equal(debug.getState().paused, false, 'A tecla P deve retomar a missão.');

console.log(JSON.stringify({
  status: 'ok',
  checks: [
    'carregamento',
    'loop de animação',
    'clique no botão inicial',
    'persistência local',
    'investimento permanente',
    'início da missão',
    'movimento',
    'energia rúnica',
    'pausa',
  ],
  finalState: debug.getState(),
}, null, 2));
