const canvas = document.querySelector('#gameCanvas');
const ctx = canvas.getContext('2d');
const soundButton = document.querySelector('#soundButton');
const resetButton = document.querySelector('#resetButton');
const touchControls = document.querySelector('#touchControls');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const GROUND_Y = 620;
const STORAGE_KEY = 'alex-rese-guardians-save-v1';
const keys = new Set();
const mouse = { x: 0, y: 0, clicked: false };

const palette = {
  ink: '#06101d',
  deep: '#0c1c31',
  panel: 'rgba(7, 20, 35, 0.88)',
  panelBorder: 'rgba(136, 224, 255, 0.38)',
  cyan: '#6be1ff',
  cyanStrong: '#1eb6ff',
  blue: '#5a80ff',
  violet: '#ad82ff',
  gold: '#ffd369',
  green: '#74efa3',
  red: '#ff7c88',
  white: '#f1fbff',
  muted: '#afc4d3',
};

const missions = [
  {
    id: 1,
    title: 'A Vila dos Processos Perdidos',
    subtitle: 'Restaure os fluxos de conhecimento da vila.',
    mentor: 'Mestre Nexus: organize o caos e recupere os primeiros Cristais de Inovação.',
    theme: ['#0c2031', '#174960', '#1d6b74'],
    length: 3600,
    enemyCount: 10,
    crystalCount: 14,
    bossName: 'Bugor, o Corruptor',
    bossHp: 18,
    bossColor: '#ef7d84',
  },
  {
    id: 2,
    title: 'A Floresta dos Dados Esquecidos',
    subtitle: 'Encontre os registros perdidos entre os caminhos duplicados.',
    mentor: 'Mestre Nexus: nem todo dado é conhecimento. Selecione, conecte e avance.',
    theme: ['#0d1f29', '#1d503f', '#2e7552'],
    length: 4300,
    enemyCount: 15,
    crystalCount: 18,
    bossName: 'Duplicata, a Guardiã dos Ecos',
    bossHp: 28,
    bossColor: '#ad82ff',
  },
  {
    id: 3,
    title: 'A Torre da Entropia',
    subtitle: 'Supere a estagnação e reacenda o Núcleo de Inovação.',
    mentor: 'Mestre Nexus: a etapa final exige estratégia, persistência e execução.',
    theme: ['#11152b', '#34254f', '#53325e'],
    length: 5100,
    enemyCount: 20,
    crystalCount: 22,
    bossName: 'Lorde Entropius',
    bossHp: 42,
    bossColor: '#ffb359',
  },
];

const upgradeDefinitions = [
  {
    id: 'programming',
    title: 'Programação Rúnica',
    icon: '</>',
    description: '+1 de dano da energia',
    baseCost: 7,
    max: 8,
  },
  {
    id: 'mobility',
    title: 'Mobilidade Arcana',
    icon: '↗',
    description: '+ velocidade e salto',
    baseCost: 8,
    max: 6,
  },
  {
    id: 'vitality',
    title: 'Resiliência',
    icon: '♥',
    description: '+1 de energia máxima',
    baseCost: 10,
    max: 7,
  },
  {
    id: 'research',
    title: 'Pesquisa Aplicada',
    icon: '✦',
    description: '+20% de cristais por coleta',
    baseCost: 12,
    max: 5,
  },
];

const defaultSave = () => ({
  crystals: 0,
  xp: 0,
  highestMission: 1,
  upgrades: {
    programming: 0,
    mobility: 0,
    vitality: 0,
    research: 0,
  },
  missionsCompleted: 0,
  researchCarry: 0,
  sound: true,
});

let save = loadSave();
let game = createRuntime();
let lastTime = performance.now();

function createRuntime() {
  return {
    scene: 'title',
    paused: false,
    currentMissionId: Math.min(save.highestMission, missions.length),
    level: null,
    player: null,
    particles: [],
    projectiles: [],
    enemyProjectiles: [],
    message: '',
    messageTimer: 0,
    academyButtons: [],
    summary: null,
    shake: 0,
  };
}

function loadSave() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultSave();
    const parsed = JSON.parse(stored);
    return {
      ...defaultSave(),
      ...parsed,
      upgrades: { ...defaultSave().upgrades, ...(parsed.upgrades || {}) },
    };
  } catch (error) {
    console.warn('Não foi possível carregar o progresso salvo:', error);
    return defaultSave();
  }
}

function persistSave() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch (error) {
    console.warn('Não foi possível salvar o progresso:', error);
  }
}

function resetProgress() {
  const accepted = window.confirm('Deseja apagar o progresso salvo e reiniciar a jornada?');
  if (!accepted) return;
  save = defaultSave();
  persistSave();
  game = createRuntime();
  updateSoundLabel();
  canvas.focus();
}

function levelNumber() {
  return 1 + Math.floor(save.xp / 100);
}

function nextLevelXp() {
  return 100 - (save.xp % 100);
}

function upgradeCost(definition) {
  const level = save.upgrades[definition.id];
  return Math.ceil(definition.baseCost * Math.pow(1.55, level));
}

function maxHp() {
  return 4 + save.upgrades.vitality;
}

function playerDamage() {
  return 1 + save.upgrades.programming;
}

function researchMultiplier() {
  return 1 + save.upgrades.research * 0.2;
}

function startMission(missionId) {
  const mission = missions.find((item) => item.id === missionId) || missions[0];
  game.scene = 'level';
  game.paused = false;
  game.currentMissionId = mission.id;
  game.level = generateLevel(mission);
  game.player = createPlayer();
  game.particles = [];
  game.projectiles = [];
  game.enemyProjectiles = [];
  game.message = mission.mentor;
  game.messageTimer = 5;
  game.summary = null;
  canvas.focus();
}

function createPlayer() {
  return {
    x: 110,
    y: GROUND_Y - 70,
    w: 44,
    h: 70,
    vx: 0,
    vy: 0,
    grounded: false,
    facing: 1,
    hp: maxHp(),
    invulnerable: 0,
    shotCooldown: 0,
    animation: 0,
    collected: 0,
    defeated: 0,
  };
}

function generateLevel(mission) {
  const enemies = [];
  const crystals = [];
  const platforms = [];

  for (let index = 0; index < mission.enemyCount; index += 1) {
    const x = 560 + index * ((mission.length - 900) / mission.enemyCount) + seededRange(index + mission.id * 17, -90, 90);
    enemies.push(createBugling(x, index % 3));
  }

  for (let index = 0; index < mission.crystalCount; index += 1) {
    const x = 350 + index * ((mission.length - 650) / mission.crystalCount) + seededRange(index + mission.id * 31, -65, 65);
    const high = index % 4 === 1;
    crystals.push({ x, y: high ? GROUND_Y - 178 : GROUND_Y - 76, r: 14, collected: false, bob: index });
  }

  for (let index = 0; index < 7; index += 1) {
    const x = 620 + index * ((mission.length - 1250) / 7);
    const y = GROUND_Y - 125 - (index % 2) * 54;
    platforms.push({ x, y, w: 155, h: 18 });
  }

  const boss = {
    x: mission.length - 310,
    y: GROUND_Y - 130,
    w: 112,
    h: 130,
    hp: mission.bossHp,
    maxHp: mission.bossHp,
    alive: true,
    vx: 0,
    shotCooldown: 1.2,
    hitFlash: 0,
    name: mission.bossName,
    color: mission.bossColor,
  };

  return {
    mission,
    enemies,
    crystals,
    platforms,
    boss,
    cameraX: 0,
    elapsed: 0,
  };
}

function createBugling(x, variation = 0) {
  return {
    x,
    y: GROUND_Y - 48,
    w: 46,
    h: 48,
    vx: variation % 2 === 0 ? -48 : -66,
    hp: 2 + variation,
    maxHp: 2 + variation,
    alive: true,
    hitFlash: 0,
    variation,
  };
}

function seededRange(seed, min, max) {
  const raw = Math.sin(seed * 999) * 43758.5453;
  const normalized = raw - Math.floor(raw);
  return min + normalized * (max - min);
}

function update(dt) {
  if (game.scene === 'level' && !game.paused) updateLevel(dt);
  if (game.messageTimer > 0) game.messageTimer -= dt;
}

function updateLevel(dt) {
  const level = game.level;
  const player = game.player;
  level.elapsed += dt;
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.shotCooldown = Math.max(0, player.shotCooldown - dt);
  player.animation += dt * Math.abs(player.vx) * 0.04;

  const speed = 250 + save.upgrades.mobility * 16;
  const jumpPower = 570 + save.upgrades.mobility * 16;
  const moveLeft = keys.has('ArrowLeft') || keys.has('KeyA');
  const moveRight = keys.has('ArrowRight') || keys.has('KeyD');
  const jump = keys.has('ArrowUp') || keys.has('KeyK') || keys.has('KeyX');
  const shoot = keys.has('KeyJ') || keys.has('KeyZ');

  player.vx = 0;
  if (moveLeft) {
    player.vx = -speed;
    player.facing = -1;
  }
  if (moveRight) {
    player.vx = speed;
    player.facing = 1;
  }
  if (jump && player.grounded) {
    player.vy = -jumpPower;
    player.grounded = false;
    playTone(360, 0.07);
  }
  if (shoot && player.shotCooldown <= 0) shootRune();

  player.vy += 1420 * dt;
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.x = clamp(player.x, 0, level.mission.length - player.w);
  resolveFloorAndPlatforms(player, level.platforms);

  for (const projectile of game.projectiles) {
    projectile.x += projectile.vx * dt;
    projectile.life -= dt;
  }

  for (const projectile of game.enemyProjectiles) {
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.life -= dt;
    if (rectCircleCollision(player, projectile) && player.invulnerable <= 0) {
      projectile.life = 0;
      hurtPlayer(1);
    }
  }

  for (const enemy of level.enemies) updateEnemy(enemy, dt);
  updateBoss(level.boss, dt);
  updateCollisions();
  collectCrystals();
  updateParticles(dt);

  game.projectiles = game.projectiles.filter((item) => item.life > 0 && item.x > -100 && item.x < level.mission.length + 100);
  game.enemyProjectiles = game.enemyProjectiles.filter((item) => item.life > 0 && item.x > -100 && item.x < level.mission.length + 100);

  const desiredCamera = player.x - WIDTH * 0.3;
  level.cameraX += (clamp(desiredCamera, 0, level.mission.length - WIDTH) - level.cameraX) * Math.min(1, dt * 7);

  if (player.hp <= 0) {
    game.scene = 'gameOver';
    game.summary = { title: 'A missão precisa de uma nova estratégia.', detail: 'Retorne à Academia, invista seus cristais e tente novamente.' };
  }

  if (!level.boss.alive) finishMission();
}

function resolveFloorAndPlatforms(entity, platforms) {
  entity.grounded = false;
  if (entity.y + entity.h >= GROUND_Y) {
    entity.y = GROUND_Y - entity.h;
    entity.vy = 0;
    entity.grounded = true;
  }

  for (const platform of platforms) {
    const falling = entity.vy >= 0;
    const crossedTop = entity.y + entity.h >= platform.y && entity.y + entity.h - entity.vy * 0.016 <= platform.y + 8;
    const horizontallyAligned = entity.x + entity.w > platform.x && entity.x < platform.x + platform.w;
    if (falling && crossedTop && horizontallyAligned) {
      entity.y = platform.y - entity.h;
      entity.vy = 0;
      entity.grounded = true;
    }
  }
}

function updateEnemy(enemy, dt) {
  if (!enemy.alive) return;
  enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
  enemy.x += enemy.vx * dt;

  const player = game.player;
  if (Math.abs(enemy.x - player.x) > 520) return;
  if (enemy.x < player.x - 260) enemy.vx = Math.abs(enemy.vx);
  if (enemy.x > player.x + 340) enemy.vx = -Math.abs(enemy.vx);
  if (rectCollision(player, enemy) && player.invulnerable <= 0) hurtPlayer(1);
}

function updateBoss(boss, dt) {
  if (!boss.alive) return;
  boss.hitFlash = Math.max(0, boss.hitFlash - dt);
  const player = game.player;
  const active = player.x > game.level.mission.length - 920;
  if (!active) return;

  boss.shotCooldown -= dt;
  boss.x += boss.vx * dt;
  const targetX = clamp(player.x + 430, game.level.mission.length - 720, game.level.mission.length - 180);
  boss.vx += Math.sign(targetX - boss.x) * 26 * dt;
  boss.vx *= 0.96;

  if (boss.shotCooldown <= 0) {
    const direction = Math.sign(player.x - boss.x) || -1;
    game.enemyProjectiles.push({
      x: boss.x + boss.w / 2,
      y: boss.y + 50,
      r: 12,
      vx: direction * (190 + game.currentMissionId * 18),
      vy: -40,
      life: 4,
      kind: 'entropy',
    });
    boss.shotCooldown = Math.max(0.58, 1.35 - game.currentMissionId * 0.12);
    playTone(125, 0.12);
  }

  if (rectCollision(player, boss) && player.invulnerable <= 0) hurtPlayer(1);
}

function shootRune() {
  const player = game.player;
  player.shotCooldown = 0.24;
  game.projectiles.push({
    x: player.x + (player.facing > 0 ? player.w : -8),
    y: player.y + 26,
    r: 9,
    vx: player.facing * 620,
    life: 1.8,
    damage: playerDamage(),
  });
  playTone(570, 0.045);
}

function updateCollisions() {
  const level = game.level;
  for (const projectile of game.projectiles) {
    if (projectile.life <= 0) continue;
    for (const enemy of level.enemies) {
      if (!enemy.alive || projectile.life <= 0) continue;
      if (rectCircleCollision(enemy, projectile)) {
        projectile.life = 0;
        enemy.hp -= projectile.damage;
        enemy.hitFlash = 0.12;
        burst(projectile.x, projectile.y, palette.cyan, 8);
        if (enemy.hp <= 0) {
          enemy.alive = false;
          game.player.defeated += 1;
          save.xp += 8;
          persistSave();
          burst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, palette.gold, 15);
          playTone(760, 0.07);
        }
      }
    }

    const boss = level.boss;
    if (boss.alive && projectile.life > 0 && rectCircleCollision(boss, projectile)) {
      projectile.life = 0;
      boss.hp -= projectile.damage;
      boss.hitFlash = 0.15;
      burst(projectile.x, projectile.y, palette.gold, 10);
      game.shake = 0.12;
      if (boss.hp <= 0) {
        boss.alive = false;
        save.xp += 35 * game.currentMissionId;
        burst(boss.x + boss.w / 2, boss.y + boss.h / 2, palette.gold, 50);
        playTone(900, 0.25);
      }
    }
  }
}

function collectCrystals() {
  const player = game.player;
  for (const crystal of game.level.crystals) {
    if (crystal.collected) continue;
    if (rectCircleCollision(player, { x: crystal.x, y: crystal.y, r: crystal.r + 5 })) {
      crystal.collected = true;
      save.researchCarry += researchMultiplier();
      const value = Math.max(1, Math.floor(save.researchCarry));
      save.researchCarry -= value;
      save.crystals += value;
      player.collected += value;
      persistSave();
      burst(crystal.x, crystal.y, palette.gold, 12);
      playTone(820, 0.055);
    }
  }
}

function hurtPlayer(amount) {
  const player = game.player;
  player.hp -= amount;
  player.invulnerable = 1;
  player.vy = -260;
  player.vx = -player.facing * 100;
  game.shake = 0.22;
  burst(player.x + player.w / 2, player.y + player.h / 2, palette.red, 14);
  playTone(170, 0.14);
}

function burst(x, y, color, amount) {
  for (let index = 0; index < amount; index += 1) {
    game.particles.push({
      x,
      y,
      vx: seededRange(index + x, -190, 190),
      vy: seededRange(index + y, -220, 90),
      life: seededRange(index + x + y, 0.25, 0.75),
      maxLife: 0.75,
      color,
      size: seededRange(index + amount, 2, 6),
    });
  }
}

function updateParticles(dt) {
  for (const particle of game.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 450 * dt;
    particle.life -= dt;
  }
  game.particles = game.particles.filter((particle) => particle.life > 0);
}

function finishMission() {
  const missionId = game.currentMissionId;
  save.missionsCompleted += 1;
  if (missionId < missions.length) save.highestMission = Math.max(save.highestMission, missionId + 1);
  persistSave();
  game.scene = missionId === missions.length ? 'victory' : 'missionComplete';
  game.summary = {
    title: missionId === missions.length ? 'O Núcleo de Inovação foi restaurado!' : 'Missão concluída!',
    detail: `Cristais coletados: ${game.player.collected} · Desafios superados: ${game.player.defeated}`,
  };
}

function openAcademy() {
  game.scene = 'academy';
  game.paused = false;
  game.academyButtons = [];
}

function buyUpgrade(id) {
  const definition = upgradeDefinitions.find((item) => item.id === id);
  if (!definition) return;
  const current = save.upgrades[id];
  if (current >= definition.max) {
    game.message = 'Este conhecimento já atingiu o nível máximo.';
    game.messageTimer = 2;
    return;
  }
  const cost = upgradeCost(definition);
  if (save.crystals < cost) {
    game.message = 'Cristais insuficientes para este investimento.';
    game.messageTimer = 2;
    return;
  }
  save.crystals -= cost;
  save.upgrades[id] += 1;
  persistSave();
  game.message = `${definition.title} evoluiu para o nível ${save.upgrades[id]}.`;
  game.messageTimer = 2;
  playTone(720, 0.12);
}

function draw() {
  ctx.save();
  if (game.shake > 0 && game.scene === 'level') {
    game.shake = Math.max(0, game.shake - 0.016);
    ctx.translate(seededRange(performance.now(), -5, 5), seededRange(performance.now() + 4, -4, 4));
  }

  if (game.scene === 'title') drawTitle();
  if (game.scene === 'academy') drawAcademy();
  if (game.scene === 'level') drawLevel();
  if (game.scene === 'missionComplete') drawSummary(false);
  if (game.scene === 'gameOver') drawSummary(true);
  if (game.scene === 'victory') drawVictory();

  ctx.restore();
  mouse.clicked = false;
}

function drawTitle() {
  drawGradientBackground(['#07182a', '#133951', '#17485b']);
  drawStars(38, 17);
  drawMountains(0, 0.18, '#102d45');
  drawMountains(80, 0.28, '#0b253b');
  drawAcademySilhouette();

  drawPanel(80, 78, 715, 482);
  drawText('ALEX RESE', 126, 148, 24, palette.cyan, '800');
  drawText('GUARDIÕES DA INOVAÇÃO', 126, 204, 44, palette.white, '900');
  drawText('Uma jornada original de ação, conhecimento e evolução.', 128, 253, 20, palette.muted, '600');
  drawWrappedText('Mestre Nexus convocou jovens criadores para restaurar os Núcleos de Inovação. Supere desafios, recupere cristais e invista em conhecimento para avançar pelas regiões de Inovaria.', 128, 312, 610, 27, 19, palette.white);

  drawButton(128, 443, 270, 58, 'INICIAR JORNADA', () => openAcademy(), true);
  drawText(`Nível do guardião: ${levelNumber()}  ·  Cristais: ${save.crystals}`, 128, 540, 17, palette.gold, '700');

  drawMentor(1000, 318, 1.15);
  drawText('MESTRE NEXUS', 907, 520, 23, palette.gold, '800');
  drawText('O conhecimento é a magia que permanece.', 844, 552, 17, palette.white, '600');
}

function drawAcademy() {
  drawGradientBackground(['#071727', '#13354a', '#1e5e6a']);
  drawStars(22, 29);
  drawAcademySilhouette();
  drawPanel(50, 42, 1180, 626);

  drawText('ACADEMIA NEXUS', 90, 105, 35, palette.white, '900');
  drawText('Invista Cristais de Inovação em melhorias permanentes.', 92, 142, 18, palette.muted, '600');
  drawText(`✦ ${save.crystals} cristais`, 996, 106, 22, palette.gold, '900');
  drawText(`Guardião nível ${levelNumber()} · faltam ${nextLevelXp()} XP para o próximo nível`, 92, 175, 16, palette.cyan, '700');

  game.academyButtons = [];
  const cardW = 260;
  const gap = 20;
  const startX = 90;

  upgradeDefinitions.forEach((definition, index) => {
    const x = startX + index * (cardW + gap);
    const y = 216;
    const current = save.upgrades[definition.id];
    const isMax = current >= definition.max;
    const cost = isMax ? 0 : upgradeCost(definition);
    drawPanel(x, y, cardW, 268, 'rgba(7, 27, 43, 0.93)');
    drawText(definition.icon, x + 22, y + 56, 34, index % 2 === 0 ? palette.cyan : palette.gold, '900');
    drawText(definition.title, x + 22, y + 98, 19, palette.white, '800');
    drawText(`Nível ${current}/${definition.max}`, x + 22, y + 133, 16, palette.cyan, '800');
    drawWrappedText(definition.description, x + 22, y + 164, cardW - 44, 21, 15, palette.muted);
    const label = isMax ? 'NÍVEL MÁXIMO' : `INVESTIR · ${cost} ✦`;
    const enabled = !isMax && save.crystals >= cost;
    drawButton(x + 18, y + 204, cardW - 36, 45, label, () => buyUpgrade(definition.id), enabled);
    game.academyButtons.push({ x: x + 18, y: y + 204, w: cardW - 36, h: 45, action: () => buyUpgrade(definition.id) });
  });

  drawText('MISSÕES DISPONÍVEIS', 92, 542, 17, palette.gold, '900');
  missions.forEach((mission, index) => {
    const unlocked = mission.id <= save.highestMission;
    const x = 92 + index * 330;
    const label = unlocked ? `${mission.id}. ${mission.title}` : `${mission.id}. MISSÃO BLOQUEADA`;
    drawButton(x, 566, 306, 53, label, () => unlocked && startMission(mission.id), unlocked);
  });

  if (game.messageTimer > 0) drawToast(game.message);
}

function drawLevel() {
  const { mission, cameraX, platforms, enemies, crystals, boss } = game.level;
  drawGradientBackground(mission.theme);
  drawStars(22, mission.id * 13);
  drawMountains(cameraX * 0.12, 0.16, 'rgba(5, 21, 38, 0.34)');
  drawMountains(cameraX * 0.25, 0.25, 'rgba(5, 18, 30, 0.62)');
  drawGround(cameraX);

  ctx.save();
  ctx.translate(-cameraX, 0);

  for (const platform of platforms) drawPlatform(platform);
  for (const crystal of crystals) if (!crystal.collected) drawCrystal(crystal);
  for (const enemy of enemies) if (enemy.alive) drawBugling(enemy);
  if (boss.alive) drawBoss(boss);
  for (const projectile of game.projectiles) drawRuneProjectile(projectile);
  for (const projectile of game.enemyProjectiles) drawEnemyProjectile(projectile);
  drawPlayer(game.player);
  for (const particle of game.particles) drawParticle(particle);

  ctx.restore();
  drawHud();

  if (boss.alive && game.player.x > mission.length - 930) drawBossBar(boss);
  if (game.messageTimer > 0) drawMissionMessage(game.message);
  if (game.paused) drawPause();
}

function drawSummary(isGameOver) {
  drawGradientBackground(isGameOver ? ['#150e1b', '#30203c', '#462a3f'] : ['#071a28', '#1a4b54', '#247461']);
  drawStars(28, isGameOver ? 71 : 49);
  drawPanel(210, 126, 860, 445);
  drawText(isGameOver ? 'MISSÃO INTERROMPIDA' : 'NÚCLEO RESTAURADO', 260, 207, 38, isGameOver ? palette.red : palette.gold, '900');
  drawText(game.summary?.title || '', 260, 269, 25, palette.white, '800');
  drawWrappedText(game.summary?.detail || '', 260, 320, 720, 28, 20, palette.muted);
  drawText(`Cristais disponíveis: ${save.crystals} ✦`, 260, 399, 22, palette.gold, '800');
  drawText(`Experiência acumulada: ${save.xp} XP`, 260, 438, 18, palette.cyan, '700');
  drawButton(260, 484, 315, 56, 'RETORNAR À ACADEMIA', () => openAcademy(), true);
  if (isGameOver) drawButton(602, 484, 212, 56, 'TENTAR NOVAMENTE', () => startMission(game.currentMissionId), true);
}

function drawVictory() {
  drawGradientBackground(['#071a28', '#235671', '#496e8a']);
  drawStars(52, 99);
  drawAcademySilhouette();
  drawPanel(146, 82, 988, 532);
  drawText('JORNADA CONCLUÍDA', 208, 164, 41, palette.gold, '900');
  drawText('A Cidade Nexus volta a conectar ideias a pessoas.', 210, 221, 26, palette.white, '800');
  drawWrappedText('Ao restaurar os Núcleos de Inovação, os jovens guardiões descobriram que a verdadeira magia não estava nos cristais: ela surgia quando conhecimento, criatividade e execução trabalhavam juntos.', 210, 280, 770, 30, 20, palette.muted);
  drawText(`Missões concluídas: ${save.missionsCompleted} · XP total: ${save.xp}`, 210, 414, 19, palette.cyan, '800');
  drawButton(210, 480, 280, 58, 'VOLTAR À ACADEMIA', () => openAcademy(), true);
  drawButton(512, 480, 255, 58, 'REJOGAR MISSÃO 3', () => startMission(3), true);
  drawMentor(1000, 335, 0.94);
}

function drawHud() {
  const player = game.player;
  const mission = game.level.mission;
  drawPanel(20, 20, 434, 96, 'rgba(3, 15, 28, 0.82)');
  drawText(`MISSÃO ${mission.id}`, 42, 52, 15, palette.cyan, '900');
  drawText(mission.title, 42, 82, 20, palette.white, '800');
  drawText(`✦ ${save.crystals}  ·  XP ${save.xp}`, 42, 105, 15, palette.gold, '800');

  drawPanel(980, 20, 280, 96, 'rgba(3, 15, 28, 0.82)');
  drawText('ENERGIA DO GUARDIÃO', 1002, 52, 15, palette.cyan, '900');
  for (let index = 0; index < maxHp(); index += 1) {
    drawHeart(1006 + index * 22, 82, index < player.hp ? palette.red : 'rgba(255,255,255,0.18)');
  }
}

function drawBossBar(boss) {
  drawPanel(318, 128, 644, 62, 'rgba(24, 10, 22, 0.88)');
  drawText(boss.name.toUpperCase(), 345, 154, 16, palette.gold, '900');
  ctx.fillStyle = 'rgba(255,255,255,0.13)';
  ctx.fillRect(345, 166, 590, 12);
  ctx.fillStyle = palette.red;
  ctx.fillRect(345, 166, 590 * clamp(boss.hp / boss.maxHp, 0, 1), 12);
}

function drawMissionMessage(message) {
  drawPanel(170, 546, 940, 118, 'rgba(4, 15, 27, 0.92)');
  drawText('MESTRE NEXUS', 204, 583, 16, palette.gold, '900');
  drawWrappedText(message, 204, 612, 855, 24, 17, palette.white);
}

function drawPause() {
  ctx.fillStyle = 'rgba(2, 10, 18, 0.68)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  drawPanel(430, 260, 420, 180);
  drawText('PAUSA', 572, 332, 38, palette.white, '900');
  drawText('Pressione P para continuar', 518, 384, 18, palette.cyan, '700');
}

function drawGround(cameraX) {
  ctx.fillStyle = '#10273a';
  ctx.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);
  const offset = -(cameraX % 72);
  for (let x = offset - 72; x < WIDTH + 72; x += 72) {
    ctx.fillStyle = '#17384e';
    ctx.fillRect(x, GROUND_Y + 11, 48, 9);
    ctx.fillStyle = '#0a1b2a';
    ctx.fillRect(x + 18, GROUND_Y + 44, 54, 8);
  }
}

function drawPlatform(platform) {
  ctx.fillStyle = '#28536a';
  ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
  ctx.fillStyle = palette.cyan;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(platform.x + 4, platform.y + 3, platform.w - 8, 3);
  ctx.globalAlpha = 1;
}

function drawPlayer(player) {
  const flicker = player.invulnerable > 0 && Math.floor(player.invulnerable * 16) % 2 === 0;
  if (flicker) return;
  ctx.save();
  ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
  ctx.scale(player.facing, 1);
  ctx.translate(-player.w / 2, -player.h / 2);

  ctx.fillStyle = '#15283c';
  ctx.fillRect(9, 22, 29, 38);
  ctx.fillStyle = palette.cyanStrong;
  ctx.fillRect(12, 26, 23, 25);
  ctx.fillStyle = '#e8c7a4';
  ctx.fillRect(13, 4, 22, 22);
  ctx.fillStyle = '#10243a';
  ctx.fillRect(10, 2, 28, 8);
  ctx.fillStyle = palette.gold;
  ctx.fillRect(34, 32, 19, 8);
  ctx.fillStyle = palette.deep;
  ctx.fillRect(8, 59, 12, 11);
  ctx.fillRect(28, 59, 12, 11);
  ctx.fillStyle = palette.white;
  ctx.fillRect(28, 12, 4, 4);
  ctx.restore();
}

function drawBugling(enemy) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.fillStyle = enemy.hitFlash > 0 ? palette.white : enemy.variation % 2 ? '#a272d4' : '#e56e78';
  ctx.fillRect(3, 13, 40, 31);
  ctx.fillStyle = '#152236';
  ctx.fillRect(10, 0, 27, 17);
  ctx.fillStyle = palette.gold;
  ctx.fillRect(12, 20, 8, 8);
  ctx.fillRect(27, 20, 8, 8);
  ctx.fillStyle = '#0c1421';
  ctx.fillRect(8, 43, 11, 5);
  ctx.fillRect(27, 43, 11, 5);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(8, 8, Math.max(0, 32 * (enemy.hp / enemy.maxHp)), 3);
  ctx.restore();
}

function drawBoss(boss) {
  ctx.save();
  ctx.translate(boss.x, boss.y);
  ctx.fillStyle = boss.hitFlash > 0 ? palette.white : boss.color;
  ctx.fillRect(10, 30, 92, 91);
  ctx.fillStyle = '#1a1a30';
  ctx.fillRect(20, 5, 72, 42);
  ctx.fillStyle = palette.gold;
  ctx.fillRect(30, 19, 15, 15);
  ctx.fillRect(67, 19, 15, 15);
  ctx.fillStyle = palette.deep;
  ctx.fillRect(0, 65, 20, 36);
  ctx.fillRect(102, 65, 20, 36);
  ctx.fillRect(18, 119, 26, 11);
  ctx.fillRect(67, 119, 26, 11);
  ctx.fillStyle = palette.white;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(28, 58, 56, 8);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawRuneProjectile(projectile) {
  ctx.save();
  ctx.shadowBlur = 18;
  ctx.shadowColor = palette.cyan;
  ctx.fillStyle = palette.cyan;
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, projectile.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEnemyProjectile(projectile) {
  ctx.save();
  ctx.shadowBlur = 17;
  ctx.shadowColor = palette.red;
  ctx.fillStyle = palette.red;
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, projectile.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCrystal(crystal) {
  const y = crystal.y + Math.sin(performance.now() * 0.004 + crystal.bob) * 7;
  ctx.save();
  ctx.translate(crystal.x, y);
  ctx.shadowBlur = 20;
  ctx.shadowColor = palette.gold;
  ctx.fillStyle = palette.gold;
  ctx.beginPath();
  ctx.moveTo(0, -crystal.r);
  ctx.lineTo(crystal.r * 0.72, 0);
  ctx.lineTo(0, crystal.r);
  ctx.lineTo(-crystal.r * 0.72, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawParticle(particle) {
  ctx.save();
  ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
  ctx.fillStyle = particle.color;
  ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  ctx.restore();
}

function drawAcademySilhouette() {
  ctx.fillStyle = 'rgba(3, 15, 29, 0.64)';
  ctx.fillRect(840, 340, 330, 280);
  ctx.beginPath();
  ctx.moveTo(820, 340);
  ctx.lineTo(1000, 180);
  ctx.lineTo(1190, 340);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(965, 115, 70, 250);
  ctx.beginPath();
  ctx.moveTo(950, 115);
  ctx.lineTo(1000, 55);
  ctx.lineTo(1050, 115);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(107, 225, 255, 0.48)';
  ctx.fillRect(985, 152, 30, 44);
  ctx.fillRect(900, 402, 35, 48);
  ctx.fillRect(1060, 402, 35, 48);
}

function drawMentor(x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#22375a';
  ctx.beginPath();
  ctx.moveTo(-74, 168);
  ctx.lineTo(-43, 32);
  ctx.lineTo(43, 32);
  ctx.lineTo(74, 168);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e6c6a8';
  ctx.beginPath();
  ctx.arc(0, 0, 38, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f1f3f1';
  ctx.beginPath();
  ctx.moveTo(-34, 22);
  ctx.lineTo(0, 96);
  ctx.lineTo(34, 22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#172742';
  ctx.beginPath();
  ctx.moveTo(-62, -22);
  ctx.lineTo(0, -112);
  ctx.lineTo(62, -22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = palette.gold;
  ctx.fillRect(67, 25, 8, 170);
  ctx.beginPath();
  ctx.arc(71, 15, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#182335';
  ctx.fillRect(-20, -3, 8, 6);
  ctx.fillRect(12, -3, 8, 6);
  ctx.restore();
}

function drawMountains(offset, strength, fill) {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(-200 - (offset % 360), GROUND_Y);
  for (let index = -1; index < 7; index += 1) {
    const x = index * 300 - (offset % 300);
    const peak = 410 - (index % 2) * 80 - strength * 200;
    ctx.lineTo(x, GROUND_Y);
    ctx.lineTo(x + 155, peak);
    ctx.lineTo(x + 320, GROUND_Y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawStars(amount, seed) {
  ctx.save();
  for (let index = 0; index < amount; index += 1) {
    const x = seededRange(index + seed, 20, WIDTH - 20);
    const y = seededRange(index + seed * 3, 20, 360);
    const r = seededRange(index + seed * 7, 1, 2.8);
    ctx.globalAlpha = seededRange(index + seed * 11, 0.25, 0.9);
    ctx.fillStyle = palette.white;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawGradientBackground(colors) {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(0.55, colors[1]);
  gradient.addColorStop(1, colors[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawPanel(x, y, w, h, fill = palette.panel) {
  ctx.save();
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = palette.panelBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawButton(x, y, w, h, label, action, enabled) {
  const hovered = pointInRect(mouse.x, mouse.y, { x, y, w, h });
  ctx.save();
  ctx.fillStyle = enabled ? (hovered ? 'rgba(50, 148, 190, 0.94)' : 'rgba(26, 96, 132, 0.88)') : 'rgba(65, 77, 88, 0.72)';
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = enabled ? 'rgba(130, 229, 255, 0.66)' : 'rgba(255,255,255,0.14)';
  ctx.stroke();
  drawText(label, x + w / 2, y + h / 2 + 6, Math.min(16, Math.max(12, 420 / Math.max(label.length, 1))), enabled ? palette.white : 'rgba(255,255,255,0.42)', '900', 'center');
  ctx.restore();

  if (enabled && hovered && mouse.clicked) action();
}

function drawToast(message) {
  drawPanel(370, 630, 540, 58, 'rgba(4, 15, 27, 0.95)');
  drawText(message, 640, 666, 17, palette.white, '700', 'center');
}

function drawText(text, x, y, size, color, weight = '600', align = 'left') {
  ctx.save();
  ctx.font = `${weight} ${size}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawWrappedText(text, x, y, maxWidth, lineHeight, size, color) {
  const words = text.split(' ');
  let line = '';
  let lineY = y;
  ctx.save();
  ctx.font = `600 ${size}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = color;
  for (const word of words) {
    const next = `${line}${word} `;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, lineY);
      line = `${word} `;
      lineY += lineHeight;
    } else {
      line = next;
    }
  }
  if (line) ctx.fillText(line.trim(), x, lineY);
  ctx.restore();
}

function drawHeart(x, y, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + 5);
  ctx.bezierCurveTo(x - 13, y - 8, x - 21, y + 12, x, y + 25);
  ctx.bezierCurveTo(x + 21, y + 12, x + 13, y - 8, x, y + 5);
  ctx.fill();
  ctx.restore();
}

function roundRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function rectCollision(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function rectCircleCollision(rect, circle) {
  const nearestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const nearestY = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  return dx * dx + dy * dy < circle.r * circle.r;
}

function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

let audioContext = null;
function playTone(frequency, duration) {
  if (!save.sound) return;
  try {
    audioContext ||= new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.035, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch (error) {
    console.warn('Áudio indisponível:', error);
  }
}

function updateSoundLabel() {
  soundButton.textContent = save.sound ? 'Som: ligado' : 'Som: desligado';
  soundButton.setAttribute('aria-pressed', String(save.sound));
}

function handleSceneAction() {
  if (game.scene === 'title') openAcademy();
  else if (game.scene === 'missionComplete' || game.scene === 'gameOver' || game.scene === 'victory') openAcademy();
}

window.addEventListener('keydown', (event) => {
  keys.add(event.code);
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space'].includes(event.code)) event.preventDefault();
  if (event.code === 'Enter') handleSceneAction();
  if (event.code === 'KeyP' && game.scene === 'level') game.paused = !game.paused;
  if (game.scene === 'academy' && event.code.startsWith('Digit')) {
    const index = Number(event.code.replace('Digit', '')) - 1;
    const definition = upgradeDefinitions[index];
    if (definition) buyUpgrade(definition.id);
  }
});

window.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('blur', () => keys.clear());

canvas.addEventListener('mousemove', (event) => {
  const bounds = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - bounds.left) / bounds.width) * WIDTH;
  mouse.y = ((event.clientY - bounds.top) / bounds.height) * HEIGHT;
});
canvas.addEventListener('click', () => {
  mouse.clicked = true;
  canvas.focus();
});

touchControls.addEventListener('pointerdown', (event) => {
  const target = event.target.closest('button[data-key]');
  if (!target) return;
  event.preventDefault();
  keys.add(target.dataset.key);
});

touchControls.addEventListener('pointerup', (event) => {
  const target = event.target.closest('button[data-key]');
  if (!target) return;
  event.preventDefault();
  keys.delete(target.dataset.key);
});

touchControls.addEventListener('pointercancel', () => keys.clear());

soundButton.addEventListener('click', () => {
  save.sound = !save.sound;
  persistSave();
  updateSoundLabel();
  canvas.focus();
});
resetButton.addEventListener('click', resetProgress);

function frame(now) {
  const dt = Math.min(0.035, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

window.guardiansDebug = {
  getState: () => ({
    scene: game.scene,
    paused: game.paused,
    missionId: game.currentMissionId,
    crystals: save.crystals,
    xp: save.xp,
    upgrades: { ...save.upgrades },
    player: game.player ? { x: game.player.x, y: game.player.y, hp: game.player.hp } : null,
  }),
  openAcademy,
  startMission,
  buyUpgrade,
};

updateSoundLabel();
canvas.focus();
requestAnimationFrame(frame);
