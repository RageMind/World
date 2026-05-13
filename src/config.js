const T = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, DEEP_STONE: 4,
  WATER: 5, LAVA: 6, SAND: 7, GRAVEL: 8,
  LOG: 9, LEAVES: 10,
  COAL: 11, IRON: 12, GOLD: 13, DIAMOND: 14,
  SNOW: 15, ICE: 16, FIRE: 17, BEDROCK: 18,
  MUSHROOM: 19, TORCH: 20, CHEST: 21, BRICK: 22
};

const TD = {
  0:  { name: 'Воздух',         color: null,      solid: false, liquid: false, flammable: false, light: 0 },
  1:  { name: 'Трава',          color: '#4a8c38', solid: true,  liquid: false, flammable: true,  light: 0, top: '#3a7a28' },
  2:  { name: 'Земля',          color: '#6b4428', solid: true,  liquid: false, flammable: false, light: 0 },
  3:  { name: 'Камень',         color: '#6e6e6e', solid: true,  liquid: false, flammable: false, light: 0 },
  4:  { name: 'Глубокий камень',color: '#2e2e42', solid: true,  liquid: false, flammable: false, light: 0 },
  5:  { name: 'Вода',           color: '#1a5cbf', solid: false, liquid: true,  flammable: false, light: 0, alpha: 0.75 },
  6:  { name: 'Лава',           color: '#c43800', solid: false, liquid: true,  flammable: false, light: 1.0 },
  7:  { name: 'Песок',          color: '#c4a85a', solid: true,  liquid: false, flammable: false, light: 0, gravity: true },
  8:  { name: 'Гравий',         color: '#787470', solid: true,  liquid: false, flammable: false, light: 0, gravity: true },
  9:  { name: 'Бревно',         color: '#3d2610', solid: true,  liquid: false, flammable: true,  light: 0 },
  10: { name: 'Листья',         color: '#2e7016', solid: false, liquid: false, flammable: true,  light: 0, alpha: 0.9 },
  11: { name: 'Угольная руда',  color: '#6e6e6e', solid: true,  liquid: false, flammable: false, light: 0, ore: '#1a1a1a' },
  12: { name: 'Железная руда',  color: '#6e6e6e', solid: true,  liquid: false, flammable: false, light: 0, ore: '#b8986a' },
  13: { name: 'Золотая руда',   color: '#6e6e6e', solid: true,  liquid: false, flammable: false, light: 0, ore: '#e8c000' },
  14: { name: 'Алмазная руда',  color: '#6e6e6e', solid: true,  liquid: false, flammable: false, light: 0.15, ore: '#30d8f0' },
  15: { name: 'Снег',           color: '#dce8e8', solid: true,  liquid: false, flammable: false, light: 0 },
  16: { name: 'Лёд',            color: '#80b8d8', solid: true,  liquid: false, flammable: false, light: 0, alpha: 0.8 },
  17: { name: 'Огонь',          color: '#ff5500', solid: false, liquid: false, flammable: false, light: 0.85 },
  18: { name: 'Бедрок',         color: '#080812', solid: true,  liquid: false, flammable: false, light: 0 },
  19: { name: 'Гриб',           color: '#bb2222', solid: false, liquid: false, flammable: true,  light: 0.05 },
  20: { name: 'Факел',          color: '#cc7700', solid: false, liquid: false, flammable: false, light: 0.8 },
  21: { name: 'Сундук',         color: '#8b5e2e', solid: true,  liquid: false, flammable: true,  light: 0 },
  22: { name: 'Кирпич',         color: '#8b3a2a', solid: true,  liquid: false, flammable: false, light: 0 },
};

const ES = {
  IDLE: 'idle', WALK: 'walk', MINE: 'mine', EAT: 'eat',
  SLEEP: 'sleep', BUILD: 'build', FLEE: 'flee', DIE: 'die',
  TALK: 'talk', FIGHT: 'fight', EXPLORE: 'explore'
};

const TOOLS = {
  BRUSH_GRASS: 'brush_grass',    BRUSH_STONE: 'brush_stone',
  BRUSH_DIRT: 'brush_dirt',      BRUSH_SAND: 'brush_sand',
  BRUSH_WATER: 'brush_water',    BRUSH_LAVA: 'brush_lava',
  BRUSH_FIRE: 'brush_fire',      BRUSH_SNOW: 'brush_snow',
  ERASE: 'erase',
  SPAWN_TROGLYTE: 'spawn_troglyte', SPAWN_ELDER: 'spawn_elder',
  METEOR: 'meteor', LIGHTNING: 'lightning',
  RAIN: 'rain', EARTHQUAKE: 'earthquake',
  FIRE_STORM: 'fire_storm', HEAL: 'heal',
  INSPECT: 'inspect'
};

const TOOL_TILE = {
  [TOOLS.BRUSH_GRASS]: T.GRASS,  [TOOLS.BRUSH_STONE]: T.STONE,
  [TOOLS.BRUSH_DIRT]: T.DIRT,    [TOOLS.BRUSH_SAND]: T.SAND,
  [TOOLS.BRUSH_WATER]: T.WATER,  [TOOLS.BRUSH_LAVA]: T.LAVA,
  [TOOLS.BRUSH_FIRE]: T.FIRE,    [TOOLS.BRUSH_SNOW]: T.SNOW,
};

const TOOL_MANA = {
  [TOOLS.BRUSH_GRASS]: 0,    [TOOLS.BRUSH_STONE]: 0,
  [TOOLS.BRUSH_DIRT]: 0,     [TOOLS.BRUSH_SAND]: 0,
  [TOOLS.BRUSH_WATER]: 1,    [TOOLS.BRUSH_LAVA]: 3,
  [TOOLS.BRUSH_FIRE]: 1,     [TOOLS.BRUSH_SNOW]: 1,
  [TOOLS.ERASE]: 0,
  [TOOLS.SPAWN_TROGLYTE]: 10, [TOOLS.SPAWN_ELDER]: 20,
  [TOOLS.METEOR]: 30,         [TOOLS.LIGHTNING]: 15,
  [TOOLS.RAIN]: 20,           [TOOLS.EARTHQUAKE]: 40,
  [TOOLS.FIRE_STORM]: 25,     [TOOLS.HEAL]: 20,
};

const TROGLYTE_NAMES_M = ['Грак', 'Брул', 'Кракс', 'Норб', 'Дрекс', 'Вулк', 'Торн', 'Глум', 'Фрекс', 'Зорб', 'Корн', 'Мракс', 'Прул', 'Ворм', 'Тибал', 'Кракель', 'Ругол'];
const TROGLYTE_NAMES_F = ['Вела', 'Мира', 'Зара', 'Ксила', 'Осса', 'Пликс', 'Ренна', 'Дума', 'Кала', 'Нера', 'Глива', 'Тора', 'Врекса', 'Сирма', 'Ылла', 'Древа'];

const CFG = {
  TILE_SIZE: 16,
  WORLD_W: 220,
  WORLD_H: 130,
  SURFACE_Y: 42,
  SEA_Y: 46,
  CAVE_START_Y: 52,
  BEDROCK_Y: 126,
  TICK_MS: 80,
  DAY_TICKS: 240,
  MANA_MAX: 100,
  MANA_REGEN: 0.12,
  MAX_ENTITIES: 300,
  MAX_PARTICLES: 800,
};
