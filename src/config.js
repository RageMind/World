// Surface tile types (top-down world)
const ST = {
  VOID: 0, DEEP_WATER: 1, WATER: 2, SAND: 3,
  GRASS: 4, DIRT: 5, STONE: 6, DEEP_STONE: 7,
  SNOW: 8, ICE: 9, LAVA: 10, VOLCANIC: 11,
  GRAVEL: 12, CLAY: 13, MUD: 14,
};

// Feature types (things on top of tiles)
const FT = {
  NONE: 0, OAK_TREE: 1, PINE_TREE: 2, BIRCH: 3,
  ROCK: 4, MUSHROOM: 5, FLOWER: 6, CACTUS: 7,
  HOUSE: 8, TORCH: 9, DEAD_TREE: 10,
};

// Surface tile visual data: top color, left-face color, right-face color
const STD = {
  [ST.VOID]:       { top:'#020208', l:'#010106', r:'#010106', name:'Пустота' },
  [ST.DEEP_WATER]: { top:'#1040a0', l:'#0a2870', r:'#0d3080', name:'Глубина', anim:true },
  [ST.WATER]:      { top:'#2a7adf', l:'#1a5aaa', r:'#2068c8', name:'Вода',    anim:true },
  [ST.SAND]:       { top:'#e8c862', l:'#a87c30', r:'#c09040', name:'Песок' },
  [ST.GRASS]:      { top:'#56b83c', l:'#6b3c1e', r:'#7a4c28', name:'Трава' },
  [ST.DIRT]:       { top:'#8a5230', l:'#5a3018', r:'#6a3c20', name:'Земля' },
  [ST.STONE]:      { top:'#8a8a8a', l:'#505050', r:'#646464', name:'Камень' },
  [ST.DEEP_STONE]: { top:'#464660', l:'#282838', r:'#343448', name:'Глубокий камень' },
  [ST.SNOW]:       { top:'#e8f0f4', l:'#9ab0c0', r:'#b0c8d8', name:'Снег' },
  [ST.ICE]:        { top:'#80c0e0', l:'#4880a8', r:'#5090b8', name:'Лёд', alpha:0.85 },
  [ST.LAVA]:       { top:'#e04800', l:'#6a1c00', r:'#802200', name:'Лава', anim:true },
  [ST.VOLCANIC]:   { top:'#2e2428', l:'#161010', r:'#1e1818', name:'Вулканит' },
  [ST.GRAVEL]:     { top:'#7a7470', l:'#484440', r:'#585450', name:'Гравий' },
  [ST.CLAY]:       { top:'#8898a8', l:'#546070', r:'#647080', name:'Глина' },
  [ST.MUD]:        { top:'#5a4030', l:'#2e1e10', r:'#3c2818', name:'Грязь' },
};

// Entity states
const ES = {
  IDLE: 'idle', WALK: 'walk', MINE: 'mine', EAT: 'eat',
  SLEEP: 'sleep', BUILD: 'build', FLEE: 'flee', DIE: 'die',
  TALK: 'talk', EXPLORE: 'explore',
};

// Tools
const TOOLS = {
  RAISE: 'raise', LOWER: 'lower',
  BRUSH_GRASS: 'brush_grass', BRUSH_STONE: 'brush_stone',
  BRUSH_DIRT: 'brush_dirt',   BRUSH_SAND: 'brush_sand',
  BRUSH_WATER: 'brush_water', BRUSH_LAVA: 'brush_lava',
  BRUSH_SNOW: 'brush_snow',
  ERASE_FEATURE: 'erase_feature',
  SPAWN_TROGLYTE: 'spawn_troglyte', SPAWN_ELDER: 'spawn_elder',
  METEOR: 'meteor', LIGHTNING: 'lightning',
  RAIN: 'rain', EARTHQUAKE: 'earthquake',
  FIRE_STORM: 'fire_storm', HEAL: 'heal',
};

const TOOL_TILE = {
  [TOOLS.BRUSH_GRASS]: ST.GRASS,  [TOOLS.BRUSH_STONE]: ST.STONE,
  [TOOLS.BRUSH_DIRT]:  ST.DIRT,   [TOOLS.BRUSH_SAND]:  ST.SAND,
  [TOOLS.BRUSH_WATER]: ST.WATER,  [TOOLS.BRUSH_LAVA]:  ST.LAVA,
  [TOOLS.BRUSH_SNOW]:  ST.SNOW,
};

const TOOL_MANA = {
  [TOOLS.RAISE]: 0,   [TOOLS.LOWER]: 0,
  [TOOLS.BRUSH_GRASS]: 0, [TOOLS.BRUSH_STONE]: 0,
  [TOOLS.BRUSH_DIRT]:  0, [TOOLS.BRUSH_SAND]:  0,
  [TOOLS.BRUSH_WATER]: 2, [TOOLS.BRUSH_LAVA]:  4,
  [TOOLS.BRUSH_SNOW]:  1, [TOOLS.ERASE_FEATURE]: 0,
  [TOOLS.SPAWN_TROGLYTE]: 10, [TOOLS.SPAWN_ELDER]: 20,
  [TOOLS.METEOR]: 30, [TOOLS.LIGHTNING]: 15,
  [TOOLS.RAIN]:   20, [TOOLS.EARTHQUAKE]: 40,
  [TOOLS.FIRE_STORM]: 25, [TOOLS.HEAL]: 20,
};

const TROGLYTE_NAMES_M = ['Грак', 'Брул', 'Кракс', 'Норб', 'Дрекс', 'Вулк', 'Торн', 'Глум', 'Фрекс', 'Зорб', 'Корн', 'Мракс', 'Прул', 'Ворм', 'Тибал'];
const TROGLYTE_NAMES_F = ['Вела', 'Мира', 'Зара', 'Ксила', 'Осса', 'Пликс', 'Ренна', 'Дума', 'Кала', 'Нера', 'Глива', 'Тора', 'Врекса', 'Сирма', 'Древа'];

// Particle types
const PT = {
  FIRE: 'fire', SPARK: 'spark', SMOKE: 'smoke',
  MAGIC: 'magic', RAIN: 'rain', EXPLOSION: 'explosion',
  DUST: 'dust', HEAL: 'heal', LIGHTNING: 'lightning',
  BLOOD: 'blood', LEAF: 'leaf', SNOWFLAKE: 'snowflake',
};

const CFG = {
  WORLD_W: 80,
  WORLD_D: 80,
  WATER_LEVEL: 3,
  TICK_MS: 100,
  DAY_TICKS: 200,
  MANA_MAX: 100,
  MANA_REGEN: 0.15,
  MAX_ENTITIES: 200,
  MAX_PARTICLES: 600,
  // Isometric tile dimensions (at zoom 1)
  ISO_TW: 48,   // tile diamond width
  ISO_TH: 24,   // tile diamond height (top face)
  ISO_TD: 14,   // depth per elevation unit
};
