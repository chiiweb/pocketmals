import { MALS, MAL_LIST, MAPS, MOVES, EVOLUTIONS, ABILITY_INFO, ABILITY_EFFECTS } from '../data.js';
import { music, MAL_CRY_PROFILES } from '../audio-data.js';
import { MAL_SPRITE_MANIFEST } from '../sprite-manifest.js';
import { readFile } from 'node:fs/promises';

const species = Object.keys(MALS);
const fail = (message) => { throw new Error(message); };
if (species.length !== 65 || MAL_LIST.length !== 65) fail('Species count mismatch: expected 65.');
if (new Set(species).size !== species.length) fail('Duplicate species names.');
if (MAL_LIST.some((name) => !MALS[name]) || species.some((name) => !MAL_LIST.includes(name))) fail('MAL_LIST and MALS do not match.');

for (const [name, mal] of Object.entries(MALS)) {
  if (!mal.types?.length || mal.types.length > 2 || !mal.moves?.length || !mal.dex || mal.hp <= 0 || mal.atk <= 0 || mal.def <= 0 || mal.spd <= 0) fail('Invalid species record: ' + name);
  if (!MAL_CRY_PROFILES[name]) fail('Missing cry profile: ' + name);
  if (!ABILITY_INFO[mal.ability] || !ABILITY_EFFECTS[mal.ability]) fail('Missing ability definition: ' + mal.ability);
  for (const move of mal.moves) if (!MOVES[move]) fail(name + ' references unknown move: ' + move);
}
for (const [name, evolution] of Object.entries(EVOLUTIONS)) {
  if (!MALS[name] || (evolution.to && !MALS[evolution.to])) fail('Invalid evolution link: ' + name);
  if (evolution.level !== undefined && (!Number.isFinite(evolution.level) || evolution.level < 1)) fail('Invalid evolution level: ' + name);
}
for (const [mapName, map] of Object.entries(MAPS)) {
  if (!Array.isArray(map.rows) || !map.rows.length) fail('Map has no rows: ' + mapName);
  const width = map.rows[0].length;
  if (map.rows.some((row) => row.length !== width)) fail('Uneven map row widths: ' + mapName);
  for (const row of map.rows) for (const tile of row) if (!'T.GW#FKR BHLCS DYE'.replaceAll(' ', '').includes(tile)) fail('Unknown tile ' + tile + ' in ' + mapName);
  for (const [direction, exit] of Object.entries(map.exits || {})) {
    if (!Array.isArray(exit) || !MAPS[exit[0]] || !Number.isInteger(exit[1]) || exit[1] < 0 || exit[1] >= MAPS[exit[0]].rows[0].length) fail('Invalid exit ' + mapName + ':' + direction);
  }
  for (const encounter of map.grass || []) if (!MALS[encounter]) fail('Unknown grass encounter ' + encounter + ' in ' + mapName);
  if (map.lv && (map.lv.length !== 2 || map.lv.some((lv) => !Number.isFinite(lv) || lv < 1 || lv > 100))) fail('Invalid encounter level range: ' + mapName);
}
for (const [name, views] of Object.entries(MAL_SPRITE_MANIFEST)) {
  if (!MALS[name] || !Array.isArray(views) || views.some((view) => !['front', 'back'].includes(view))) fail('Invalid sprite manifest entry: ' + name);
}
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const font = await readFile(new URL('../pokemon-ds-font.ttf', import.meta.url));
if (!font.length) fail('Local pixel font is empty.');
if (html.includes('fonts.googleapis.com')) fail('The game still requires an external Google font.');
const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
if (main.includes('POCKETMALS_DATABASE_API') || main.includes('loadPocketmalDataFromDatabase')) fail('Removed database integration is still present.');
const atlas = await readFile(new URL('../assets/sprites/humans/sprite-atlas.svg', import.meta.url), 'utf8');
if (!atlas.includes('width="768"') || !atlas.includes('height="288"')) fail('Human sprite atlas dimensions changed unexpectedly.');
for (const [name, views] of Object.entries(MAL_SPRITE_MANIFEST)) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  for (const view of views) await readFile(new URL('../assets/sprites/pocketmals/' + slug + '-' + view + '.png', import.meta.url));
}
const htmlIds = new Set([...html.matchAll(/\\bid="([^"]+)"/g)].map((match) => match[1]));
const jsIds = [...main.matchAll(/getElementById\\(['"]([^'"]+)['"]\\)/g)].map((match) => match[1]);
const missingIds = [...new Set(jsIds)].filter((id) => !htmlIds.has(id));
if (missingIds.length) fail('main.js references missing HTML element ids: ' + missingIds.join(', '));
if (/NPCS\\[S\\.map\\]\\.(find|forEach|map)/.test(main)) fail('Unsafe NPC map lookup without an empty-list fallback.');
if (/for \\(const \\w+ of NPCS\\[S\\.map\\]\\)/.test(main)) fail('NPC iteration can crash on maps without NPC data.');
if (!html.includes('main.js?v=')) fail('main.js cache-busting version missing.');
if (!music.title || !music.covo || !music.route1 || !music.battle || !music.opening) fail('Required music tracks missing.');
console.log('Validated species, moves, abilities, cries, evolutions, maps, exits, sprite manifest, DOM ids, and music.');

const starterNames = ['Lovlittle', 'Malittle'];
for (const name of starterNames) if (!MALS[name]) fail('Missing starter species: ' + name);
if (!main.includes("const STARTER_NAMES = ['Lovlittle', 'Malittle'];")) fail('Starter selection is not the intended two-species choice.');
for (const name of starterNames) {
  if (!main.includes(name + ': {')) fail('Missing starter personality profile: ' + name);
}
if (!main.includes("Lovlittle: 'Malittle', Malittle: 'Lovlittle'")) fail('Rival starter pairing is incomplete.');
