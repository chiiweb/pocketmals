// Pocketmals data: types, moves, mals, maps.
export const TYPES = [
  'normal', 'fire', 'water', 'grass', 'electric', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'steel', 'dark', 'fairy',
];
export const TYPE_COLORS = {
  normal: '#a8a878', fire: '#f08030', water: '#6890f0', grass: '#78c850',
  electric: '#f8d030', ice: '#98d8d8', fighting: '#c03028', poison: '#a040a0',
  ground: '#e0c068', flying: '#a890f0', psychic: '#f85888', bug: '#a8b820',
  rock: '#b8a038', ghost: '#705898', dragon: '#7038f8', steel: '#b8b8d0',
  dark: '#705848', fairy: '#ee99ac',
};

const LEGACY_TYPES = {
  leaf: 'grass', ember: 'fire', tide: 'water', spark: 'electric',
  stone: 'rock', wind: 'flying', mystic: 'psychic',
};

const TYPE_CHART = {
  normal:   { weak: ['fighting'], immune: ['ghost'] },
  fire:     { weak: ['water', 'ground', 'rock'], resist: ['fire', 'grass', 'ice', 'bug', 'steel', 'fairy'] },
  water:    { weak: ['electric', 'grass'], resist: ['fire', 'water'] },
  electric: { weak: ['ground'], resist: ['electric', 'flying', 'steel'] },
  grass:    { weak: ['fire', 'ice', 'poison', 'flying', 'bug'], resist: ['water', 'electric', 'grass', 'ground'] },
  ice:      { weak: ['fire', 'fighting', 'rock', 'steel'], resist: ['ice'] },
  fighting: { weak: ['flying', 'psychic', 'fairy'], resist: ['bug', 'rock', 'dark'] },
  poison:   { weak: ['ground', 'psychic'], resist: ['grass', 'fighting', 'poison', 'bug', 'fairy'] },
  ground:   { weak: ['water', 'grass', 'ice'], resist: ['poison', 'rock'], immune: ['electric'] },
  flying:   { weak: ['electric', 'ice', 'rock'], resist: ['grass', 'fighting', 'bug'], immune: ['ground'] },
  psychic:  { weak: ['bug', 'ghost', 'dark'], resist: ['fighting', 'psychic'] },
  bug:      { weak: ['fire', 'flying', 'rock'], resist: ['grass', 'fighting', 'ground'] },
  rock:     { weak: ['water', 'grass', 'fighting', 'ground', 'steel'], resist: ['normal', 'fire', 'poison', 'flying'] },
  ghost:    { weak: ['ghost', 'dark'], resist: ['poison', 'bug'], immune: ['normal', 'fighting'] },
  dragon:   { weak: ['ice', 'dragon', 'fairy'], resist: ['fire', 'water', 'electric', 'grass'] },
  steel:    { weak: ['fire', 'fighting', 'ground'], resist: ['normal', 'grass', 'ice', 'flying', 'psychic', 'bug', 'rock', 'dragon', 'steel', 'fairy'], immune: ['poison'] },
  dark:     { weak: ['fighting', 'bug', 'fairy'], resist: ['ghost', 'dark'], immune: ['psychic'] },
  fairy:    { weak: ['poison', 'steel'], resist: ['fighting', 'bug', 'dark'], immune: ['dragon'] },
};
export function effectiveness(attackType, defendType) {
  const attack = LEGACY_TYPES[attackType] || attackType;
  const defenders = (Array.isArray(defendType) ? defendType : [defendType])
    .map((type) => LEGACY_TYPES[type] || type);
  return defenders.reduce((multiplier, defendingType) => {
    const chart = TYPE_CHART[defendingType];
    if (!chart) return multiplier;
    if (chart.immune?.includes(attack)) return 0;
    if (chart.weak?.includes(attack)) return multiplier * 2;
    if (chart.resist?.includes(attack)) return multiplier * 0.5;
    return multiplier;
  }, 1);
}

export const MOVES = {
  Tackle: ['normal', 40, 100], Scratch: ['normal', 40, 100], 'Quick Attack': ['normal', 40, 100],
  Bite: ['dark', 60, 100], Headbutt: ['normal', 70, 100], Swift: ['normal', 60, 100],
  Leafage: ['leaf', 40, 100], 'Vine Whip': ['leaf', 45, 100], 'Razor Leaf': ['leaf', 55, 95],
  'Magical Leaf': ['leaf', 60, 100], 'Seed Bomb': ['leaf', 80, 100],
  Ember: ['ember', 40, 100], 'Fire Fang': ['ember', 65, 95], 'Flame Charge': ['ember', 50, 100],
  'Flame Burst': ['ember', 70, 100], Flamethrower: ['ember', 90, 100],
  'Water Gun': ['tide', 40, 100], 'Bubble Beam': ['tide', 65, 100], 'Aqua Jet': ['tide', 40, 100],
  'Water Pulse': ['tide', 60, 100], 'Aqua Tail': ['tide', 90, 90],
  'Thunder Shock': ['spark', 40, 100], Spark: ['spark', 65, 100], 'Thunder Fang': ['spark', 65, 95],
  'Electro Ball': ['spark', 65, 100], Discharge: ['spark', 80, 100],
  'Rock Throw': ['stone', 50, 90], 'Rock Tomb': ['stone', 60, 95], 'Rock Slide': ['stone', 75, 90],
  Bulldoze: ['stone', 60, 100],
  Gust: ['wind', 40, 100], 'Wing Attack': ['wind', 60, 100], 'Air Cutter': ['wind', 60, 95],
  'Air Slash': ['wind', 75, 95], Peck: ['wind', 35, 100],
  Confusion: ['mystic', 50, 100], Psybeam: ['mystic', 65, 100], Psychic: ['mystic', 90, 100],
  Psyshock: ['mystic', 80, 100],
  Return: ['normal', 75, 100], Slam: ['normal', 80, 75], 'Hyper Voice': ['normal', 90, 100],
  'Leaf Blade': ['leaf', 90, 100], 'Giga Drain': ['leaf', 75, 100], 'Energy Ball': ['leaf', 90, 100],
  'Fire Blast': ['ember', 110, 85], Overheat: ['ember', 130, 90],
  Surf: ['tide', 90, 100], 'Hydro Pump': ['tide', 110, 80],   'Ice Beam': ['ice', 90, 100],
  Thunderbolt: ['spark', 90, 100], Thunder: ['spark', 110, 70], 'Wild Charge': ['spark', 90, 100],
  Earthquake: ['stone', 100, 100], 'Stone Edge': ['stone', 100, 80],
  'Brave Bird': ['wind', 120, 100], 'Shadow Ball': ['mystic', 80, 100],
  'Solar Beam': ['leaf', 120, 100], 'Petal Dance': ['leaf', 90, 100],
  'Heat Wave': ['ember', 95, 90], Inferno: ['ember', 100, 50],
  Whirlpool: ['tide', 80, 85], 'Muddy Water': ['tide', 90, 85],
  'Zap Cannon': ['spark', 120, 50], 'Volt Switch': ['spark', 70, 100],
  'Power Gem': ['stone', 80, 100], 'Earth Power': ['stone', 90, 100],
  Hurricane: ['wind', 110, 70], 'Sky Attack': ['wind', 120, 90],
  'Future Sight': ['mystic', 100, 100], 'Moonblast': ['mystic', 95, 100],
  // Compat aliases from older builds
  Nibble: ['normal', 35, 100], 'Pounce Rush': ['normal', 60, 95],
  'Leaf Flick': ['leaf', 45, 100], 'Thorn Lash': ['leaf', 70, 90],
  'Ember Puff': ['ember', 45, 100], 'Cinder Roar': ['ember', 70, 90],
  'Splash Jet': ['tide', 45, 100], 'Tide Crash': ['tide', 70, 90],
  'Zap Tap': ['spark', 45, 100], 'Volt Coil': ['spark', 70, 90],
  'Pebble Toss': ['stone', 45, 95], 'Boulder Bop': ['stone', 70, 85],
  'Gust Slice': ['wind', 45, 100], 'Gale Dive': ['wind', 70, 90],
  'Glimmer Beam': ['mystic', 50, 100], 'Wish Pulse': ['mystic', 75, 90],
  'Low Kick': ['fighting', 50, 100], 'Brick Break': ['fighting', 75, 100],
  'Poison Sting': ['poison', 35, 100], 'Venoshock': ['poison', 65, 100],
  'Mud Shot': ['ground', 55, 95], Dig: ['ground', 80, 100],
  'Ice Shard': ['ice', 40, 100], 'Bug Bite': ['bug', 60, 100], 'Struggle Bug': ['bug', 50, 100],
  Astonish: ['ghost', 30, 100], 'Shadow Claw': ['ghost', 70, 100],
  'Dragon Breath': ['dragon', 60, 100], 'Dragon Claw': ['dragon', 80, 100],
  'Metal Claw': ['steel', 50, 95], 'Iron Head': ['steel', 80, 100],
  'Night Slash': ['dark', 70, 100], 'Dark Pulse': ['dark', 80, 100],
  'Fairy Wind': ['fairy', 40, 100], 'Dazzling Gleam': ['fairy', 80, 100],
};
for (const move of Object.values(MOVES)) move[0] = LEGACY_TYPES[move[0]] || move[0];
MOVES.Bulldoze[0] = 'ground';
MOVES['Earthquake'][0] = 'ground';
MOVES['Earth Power'][0] = 'ground';
MOVES['Ice Beam'][0] = 'ice';
MOVES['Shadow Ball'][0] = 'ghost';
MOVES.Moonblast[0] = 'fairy';
MOVES['Future Sight'][0] = 'psychic';

// name: [type, hp, atk, def, spd, ability, moves, dex]
// Naming: English roots + light Japanese cues (kusa/seed, kitsune fox, usagi rabbit, umi sea)
// Structure mirrors a real gen: three 3-stage starters, a few 2-stage lines, several singles.
const RAW = [
  // --- Starters (3-stage) ---
  ['Seedkit', 'leaf', 50, 49, 52, 45, 'Bloomguard', ['Tackle', 'Leafage', 'Razor Leaf', 'Leaf Blade'],
   'A seedling hound kit. Tiny kusa-sprouts on its back lean toward the warmest sun.'],
  ['Leafox', 'leaf', 62, 62, 60, 58, 'Bloomguard', ['Vine Whip', 'Razor Leaf', 'Magical Leaf', 'Seed Bomb'],
   'Seedkit after the forest claim. Its brushy tail fans leaf-scent to mark safe trails.'],
  ['Florion', 'leaf', 78, 82, 78, 65, 'Bloomguard', ['Leaf Blade', 'Giga Drain', 'Energy Ball', 'Solar Beam'],
   'A shrine-guard presence. Flower manes open only for trainers it trusts.'],

  ['Cinderp', 'ember', 46, 56, 44, 52, 'Hearthfire', ['Scratch', 'Ember', 'Flame Charge', 'Flamethrower'],
   'Born near kiln heat. Its twin-tip tail flares when it feels brave.'],
  ['Flamfox', 'ember', 60, 72, 52, 70, 'Hearthfire', ['Fire Fang', 'Flame Charge', 'Flame Burst', 'Flamethrower'],
   'A kitsune-like runner of cinders. Embers trail its paws without scorching grass.'],
  ['Blazion', 'ember', 78, 90, 68, 80, 'Hearthfire', ['Fire Fang', 'Heat Wave', 'Flamethrower', 'Fire Blast'],
   'Modeled after lion-dog guardians. Its mane is a living furnace kept gentle for friends.'],

  ['Ripplet', 'tide', 52, 48, 54, 44, 'Raincoat', ['Tackle', 'Water Gun', 'Aqua Jet', 'Surf'],
   'A pond pup with fin ears. It skims shallows without a splash — umi-soft and quiet.'],
  ['Wavepup', 'tide', 65, 60, 62, 55, 'Raincoat', ['Water Pulse', 'Aqua Jet', 'Bubble Beam', 'Surf'],
   'Ripplet grown bold. Its crest rises like a small swell before rain.'],
  ['Marinox', 'tide', 85, 78, 80, 62, 'Raincoat', ['Surf', 'Ice Beam', 'Aqua Tail', 'Hydro Pump'],
   'A sea-hound of the coasts. Sailors say following it leads to calm water.'],

  // --- Early route normals & light types ---
  ['Yapup', 'normal', 48, 50, 42, 58, 'Pluck', ['Tackle', 'Quick Attack', 'Bite', 'Headbutt'],
   'A trail mutt that collects shiny junk. First partner of many village kids.'],
  ['Trailhound', 'normal', 70, 72, 58, 70, 'Pluck', ['Bite', 'Headbutt', 'Return', 'Hyper Voice'],
   'Yapup that learned the long road. Its bark carries across whole meadows.'],
  ['Bunnet', 'normal', 45, 52, 40, 70, 'Pluck', ['Quick Attack', 'Headbutt', 'Return', 'Rock Tomb'],
   'Usagi-eared hopper. Thumps warn the whole warren when trainers pass.'],
  ['Pufflet', 'wind', 48, 42, 40, 62, 'Tailwind', ['Tackle', 'Gust', 'Quick Attack', 'Air Cutter'],
   'A soft fledgling. Nest-songs start at dawn over Route 1 fences.'],
  ['Skylit', 'wind', 68, 62, 55, 88, 'Tailwind', ['Air Cutter', 'Wing Attack', 'Air Slash', 'Brave Bird'],
   'Pufflet after the high winds. Clouds thin where its wings pass.'],

  // --- Mid routes ---
  ['Sparkit', 'spark', 40, 52, 38, 78, 'Static Fuzz', ['Quick Attack', 'Thunder Shock', 'Spark', 'Thunderbolt'],
   'Cheek pouches crackle at strange sounds. Common in dry grass north of town.'],
  ['Voltuff', 'spark', 62, 78, 55, 88, 'Static Fuzz', ['Spark', 'Thunder Fang', 'Volt Switch', 'Thunderbolt'],
   'Sparkit with a spiral horn that focuses static into a thin bolt.'],
  ['Rocklit', 'stone', 55, 48, 72, 28, 'Sturdy Shell', ['Tackle', 'Rock Throw', 'Rock Tomb', 'Bulldoze'],
   'Disguises as a river stone until crystal plates catch the light.'],
  ['Cragmite', 'stone', 78, 82, 88, 35, 'Sturdy Shell', ['Rock Tomb', 'Bulldoze', 'Earthquake', 'Stone Edge'],
   'Rocklit that tunnelled under old shrines. Jaws crush crystal cleanly.'],
  ['Mossit', 'leaf', 60, 48, 62, 32, 'Bloomguard', ['Tackle', 'Leafage', 'Giga Drain', 'Energy Ball'],
   'A cap of living moss gathers dew. Patterns shift as it grows.'],
  ['Glimmit', 'mystic', 44, 55, 42, 68, 'Starlit', ['Quick Attack', 'Confusion', 'Psybeam', 'Shadow Ball'],
   'Star-whiskers brighten near ruins and Wishbit stones.'],
  ['Astrin', 'mystic', 68, 78, 60, 85, 'Starlit', ['Psybeam', 'Shadow Ball', 'Moonblast', 'Psychic'],
   'Glimmit that walked a Wishbit path. Tail-runes glow when it is calm.'],

  // --- Ombra Woods / late ---
  ['Mothcinder', 'ember', 45, 58, 40, 72, 'Hearthfire', ['Scratch', 'Ember', 'Gust', 'Flame Burst'],
   'Four wings like warm coals. Dusk signals flash from glowing spots.'],
  ['Pyrewing', 'ember', 62, 85, 52, 90, 'Hearthfire', ['Wing Attack', 'Heat Wave', 'Flamethrower', 'Fire Blast'],
   'Mothcinder fully kindled. Night flights look like a second sunset.'],
  ['Blobble', 'tide', 70, 42, 55, 35, 'Raincoat', ['Tackle', 'Water Gun', 'Bubble Beam', 'Hydro Pump'],
   'Drifts above still ponds. Stores cool water in a clear crown.'],
  ['Floatide', 'tide', 95, 58, 72, 48, 'Raincoat', ['Bubble Beam', 'Surf', 'Muddy Water', 'Hydro Pump'],
   'Blobble with a rain-holding membrane. Villages once used it in droughts.'],
  ['Bramblet', 'leaf', 58, 55, 68, 40, 'Bloomguard', ['Tackle', 'Vine Whip', 'Razor Leaf', 'Seed Bomb'],
   'Rolls into a green ball. Thorns soften after rain, sharpen in sun.'],
  ['Thornox', 'leaf', 80, 82, 90, 48, 'Bloomguard', ['Seed Bomb', 'Leaf Blade', 'Giga Drain', 'Solar Beam'],
   'Bramblet armor fully set. Shields smaller forest partners without a sound.'],
  ['Hushowl', 'mystic', 62, 60, 55, 52, 'Starlit', ['Gust', 'Confusion', 'Air Slash', 'Psychic'],
   'Silent canopy guardian. Wings muffle every glide between trunks.'],
  ['Kilnkit', 'ember', 50, 58, 50, 55, 'Hearthfire', ['Scratch', 'Ember', 'Fire Fang', 'Fire Blast'],
   'A kitten born in a potter\'s kiln. Prefers warm stone floors.'],
  ['Ripfin', 'tide', 50, 58, 45, 68, 'Raincoat', ['Quick Attack', 'Water Gun', 'Ice Beam', 'Surf'],
   'Fan-tailed river fish. Leaps waterfalls toward quiet pools.'],
  ['Breezel', 'wind', 45, 52, 40, 75, 'Tailwind', ['Quick Attack', 'Gust', 'Wing Attack', 'Air Slash'],
   'Long-bodied wind runner. Tail-fins cut turns midair.'],
  ['Wispurr', 'mystic', 55, 65, 50, 72, 'Starlit', ['Confusion', 'Psybeam', 'Shadow Ball', 'Psychic'],
   'Wishbit light given form as a spirit cat. Stardust trails its tail.'],
  ['Starfox', 'mystic', 70, 85, 65, 95, 'Starlit', ['Psybeam', 'Moonblast', 'Shadow Ball', 'Future Sight'],
   'Rare ridge guardian. Eyes reflect constellations not yet risen.'],

  // --- Team Meridian constructs ---
  ['Gearbit', 'spark', 55, 55, 65, 45, 'Static Fuzz', ['Tackle', 'Thunder Shock', 'Spark', 'Discharge'],
   'Beetle with a gear-shell. Meridian probes harvest its steady charge.'],
  ['Latticebot', 'spark', 72, 75, 72, 50, 'Sturdy Shell', ['Thunder Shock', 'Bite', 'Rock Tomb', 'Discharge'],
   'Assembled from lattice scrap. Chest light maps residual Wishbit energy.'],
  ['Tuskvolt', 'spark', 68, 72, 62, 55, 'Static Fuzz', ['Tackle', 'Thunder Shock', 'Thunder Fang', 'Wild Charge'],
   'Boar that stores static in its tusks. They glow just before dusk.'],
  ['Brackibud', 'bug', 48, 52, 48, 58, 'Sporecoat', ['Bug Bite', 'Poison Sting', 'Struggle Bug', 'Astonish'],
   'A tiny marsh beetle that hides beneath curled leaves; its spotted shell gives off a faint herbal scent.', 'poison'],
  ['Puglow', 'fighting', 58, 68, 54, 60, 'Steadfast', ['Tackle', 'Low Kick', 'Brick Break', 'Headbutt'],
   'A broad-pawed trail guardian that practices careful, rhythmic footwork beside mountain paths.'],
  ['Glacub', 'ice', 52, 55, 60, 48, 'Snow Veil', ['Ice Shard', 'Ice Beam', 'Bite', 'Water Gun'],
   'A frost-coated creek cub that gathers tiny snowflakes on the soft fur around its ears.', 'water'],
  ['Hauntide', 'ghost', 56, 58, 65, 72, 'Driftveil', ['Astonish', 'Shadow Ball', 'Water Pulse', 'Bite'],
   'A quiet lantern spirit said to guide lost hikers back toward the sound of running water.', 'water'],
  ['Duskrowl', 'dark', 64, 72, 60, 82, 'Keen Eye', ['Bite', 'Night Slash', 'Gust', 'Air Slash'],
   'An observant dusk bird that watches over its flock from high forest branches.', 'flying'],
  ['Ferrivine', 'steel', 68, 70, 88, 42, 'Sturdy Shell', ['Metal Claw', 'Iron Head', 'Vine Whip', 'Seed Bomb'],
   'A patient ironwood creature whose flexible steel bark bends with the wind instead of breaking.', 'grass'],
  ['Drakindle', 'dragon', 60, 76, 62, 70, 'Hearthfire', ['Dragon Breath', 'Dragon Claw', 'Ember', 'Fire Fang'],
   'A young ridge dragon that warms its crystal horns over sunlit stones.', 'fire'],
  ['Dunemole', 'ground', 72, 66, 88, 38, 'Sand Veil', ['Mud Shot', 'Dig', 'Rock Throw', 'Bulldoze'],
   'A burrowing den-builder that shapes safe underground paths for smaller Pocketmals.', 'rock'],
  ['Faefern', 'fairy', 58, 54, 64, 78, 'Bloomguard', ['Fairy Wind', 'Dazzling Gleam', 'Magical Leaf', 'Moonblast'],
   'A gentle fern sprite whose bright fronds shimmer when its woodland neighbors feel safe.', 'grass'],
  ['Grainper', 'bug', 43, 45, 45, 62, 'Sporecoat', ['Tackle', 'Bug Bite', 'Leafage', 'Struggle Bug'],
   'A tiny forest bug with sprout-tipped feelers and leaflike forelimbs. It gathers dew beneath its wings.', 'grass'],
  ['Wheafield', 'bug', 70, 65, 66, 55, 'Bloomguard', ['Bug Bite', 'Razor Leaf', 'Seed Bomb', 'Struggle Bug'],
   'Its tall leafy mantle shelters the small insects that gather around it in the forest.', 'grass'],
  ['Rascoon', 'normal', 48, 50, 45, 68, 'Pluck', ['Tackle', 'Quick Attack', 'Bite', 'Headbutt'],
   'A curious raccoon that stores berries in its striped tail and checks every dropped trinket with both paws.'],
  ['Racrash', 'normal', 78, 82, 66, 82, 'Keen Eye', ['Bite', 'Night Slash', 'Headbutt', 'Return'],
   'When danger nears, it plants its feet and guards its denmates behind a thick, banded tail.', 'dark'],
  ['Jayble', 'normal', 40, 43, 38, 64, 'Tailwind', ['Peck', 'Gust', 'Quick Attack', 'Wing Attack'],
   'A bold fledgling jay that raises its crest whenever it spots a new path.', 'flying'],
  ['Jayquill', 'water', 60, 61, 57, 79, 'Raincoat', ['Peck', 'Water Gun', 'Wing Attack', 'Water Pulse'],
   'Its bright quills fan wide to show its flock the safest current to follow.', 'flying'],
  ['Jaystream', 'water', 80, 84, 75, 102, 'Raincoat', ['Wing Attack', 'Water Pulse', 'Air Slash', 'Brave Bird'],
   'It rides swift currents with long tailfeathers spread like a rudder.', 'flying'],
  ['Titone', 'rock', 55, 55, 78, 32, 'Sturdy Shell', ['Tackle', 'Rock Throw', 'Rock Tomb', 'Bulldoze'],
   'It tests each ledge with sturdy claws before settling its rough stone crest against the rock.'],
  ['Rockage', 'rock', 82, 85, 110, 40, 'Sturdy Shell', ['Rock Throw', 'Rock Tomb', 'Earthquake', 'Stone Edge'],
   'Layered plates make its broad silhouette look like a moving cliff face. It guards high caves.'],

  ['Kangol', 'fire', 50, 50, 46, 54, 'Hearthfire', ['Scratch', 'Ember', 'Quick Attack', 'Flame Charge'],
   'A bright-eyed joey with long ears and a warm, ember-lit pouch. It bounds after anything that catches its curiosity.'],
  ['Flareroo', 'fire', 66, 70, 58, 76, 'Hearthfire', ['Ember', 'Fire Fang', 'Flame Charge', 'Brick Break'],
   'Its flame-shaped ears rise as it squares up. A strong tail keeps its quick sparring hops balanced.'],
  ['Flaresupial', 'fire', 84, 96, 76, 100, 'Hearthfire', ['Fire Fang', 'Flamethrower', 'Brick Break', 'Heat Wave'],
   'A powerful kangaroo Pocketmal that guards its friends with fiery kicks and a steady, protective stance.', 'fighting'],
  ['Bubbish', 'water', 52, 46, 54, 46, 'Raincoat', ['Tackle', 'Water Gun', 'Bubble Beam', 'Confusion'],
   'A tiny water spirit with a curling crest and soft, cloudlike frills. It gathers bubbles when it feels safe.'],
  ['Foamish', 'water', 68, 60, 72, 61, 'Raincoat', ['Water Gun', 'Water Pulse', 'Psybeam', 'Aqua Jet'],
   'Its foamy mantle ripples as it glides. It likes to drift beside trainers and copy their gestures.'],
  ['Jelluburst', 'water', 86, 76, 86, 86, 'Raincoat', ['Water Pulse', 'Psychic', 'Surf', 'Hydro Pump'],
   'A calm, towering jelly spirit whose flowing tendrils shimmer with a strange, thoughtful light.', 'psychic'],
  ['Lizrout', 'grass', 52, 54, 58, 44, 'Bloomguard', ['Tackle', 'Leafage', 'Vine Whip', 'Bite'],
   'A small, alert reptile with a leafy tail and sturdy claws. It loves basking beneath broad forest leaves.'],
  ['Thornko', 'grass', 68, 72, 77, 52, 'Bloomguard', ['Leafage', 'Vine Whip', 'Razor Leaf', 'Headbutt'],
   'Thorny growths guard its head and tail. It stands its ground when smaller forest Pocketmals need help.'],
  ['Branack', 'grass', 85, 96, 110, 48, 'Bloomguard', ['Seed Bomb', 'Rock Throw', 'Bulldoze', 'Stone Edge'],
   'A broad, rock-armored reptile with a heavy, ridged tail. It rests among stone outcrops and roots.', 'rock'],
  ['Lovlittle', 'fairy', 48, 42, 48, 72, 'Bloomguard', ['Fairy Wind', 'Confusion', 'Dazzling Gleam', 'Magical Leaf'],
   'A gentle fairy with a heart-shaped ruff and bright, affectionate eyes. It often appears near old wishing stones.', 'normal'],
  ['Malittle', 'dark', 48, 52, 48, 72, 'Starlit', ['Astonish', 'Bite', 'Shadow Ball', 'Night Slash'],
   'A mischievous shadow spirit with a jagged silhouette and a shining chest jewel. It is Lovlittle’s counterpart.', 'ghost'],
];

export const MALS = {};
RAW.forEach((r, i) => {
  const type = LEGACY_TYPES[r[1]] || r[1];
  const secondaryType = LEGACY_TYPES[r[9]] || r[9];
  MALS[r[0]] = {
    id: i + 1, name: r[0], type, types: secondaryType ? [type, secondaryType] : [type],
    hp: r[2], atk: r[3], def: r[4], spd: r[5], ability: r[6], moves: r[7], dex: r[8],
  };
});
export const MAL_LIST = RAW.map((r) => r[0]);

// Old save names -> current species (so older parties still load)
export const NAME_ALIASES = {
  Spriglet: 'Seedkit', Brambark: 'Florion', Embercub: 'Cinderp', Flarecub: 'Blazion',
  Puddlepup: 'Ripplet', Tideruff: 'Marinox', Scampup: 'Yapup', Burrabbit: 'Bunnet',
  Puffwing: 'Pufflet', Zappip: 'Sparkit', Pebblit: 'Rocklit', Thistlehog: 'Bramblet',
  Cindermoth: 'Mothcinder', Bubbloat: 'Blobble', Voltusk: 'Tuskvolt', Cragmole: 'Cragmite',
  Glimmouse: 'Glimmit', Mosscap: 'Mossit', Ripplefin: 'Ripfin', Gearbug: 'Gearbit',
  Tinkbot: 'Latticebot', Thornback: 'Thornox', Emberwing: 'Pyrewing', Sparkhorn: 'Voltuff',
  Glintail: 'Astrin', Nimbus: 'Skylit', Stonemaw: 'Cragmite', 'Starlit Fox': 'Starfox',
  Leafox: 'Leafox', Wavepup: 'Wavepup', Flamfox: 'Flamfox', Trailhound: 'Trailhound',
};

// The three offered starter lines are 3-stage; legacy starter families remain for existing saves.
export const EVOLUTIONS = {
  Seedkit: { level: 16, to: 'Leafox' },
  Leafox: { level: 32, to: 'Florion', from: 'Seedkit' },
  Florion: { from: 'Leafox' },
  Cinderp: { level: 16, to: 'Flamfox' },
  Flamfox: { level: 32, to: 'Blazion', from: 'Cinderp' },
  Blazion: { from: 'Flamfox' },
  Ripplet: { level: 16, to: 'Wavepup' },
  Wavepup: { level: 32, to: 'Marinox', from: 'Ripplet' },
  Marinox: { from: 'Wavepup' },
  Yapup: { level: 18, to: 'Trailhound' },
  Trailhound: { from: 'Yapup' },
  Pufflet: { level: 18, to: 'Skylit' },
  Skylit: { from: 'Pufflet' },
  Sparkit: { level: 20, to: 'Voltuff' },
  Voltuff: { from: 'Sparkit' },
  Rocklit: { level: 22, to: 'Cragmite' },
  Cragmite: { from: 'Rocklit' },
  Glimmit: { level: 22, to: 'Astrin' },
  Astrin: { from: 'Glimmit' },
  Mothcinder: { level: 24, to: 'Pyrewing' },
  Pyrewing: { from: 'Mothcinder' },
  Blobble: { level: 22, to: 'Floatide' },
  Floatide: { from: 'Blobble' },
  Bramblet: { level: 22, to: 'Thornox' },
  Thornox: { from: 'Bramblet' },
  Grainper: { level: 18, to: 'Wheafield' },
  Wheafield: { from: 'Grainper' },
  Rascoon: { level: 18, to: 'Racrash' },
  Racrash: { from: 'Rascoon' },
  Jayble: { level: 18, to: 'Jayquill' },
  Jayquill: { level: 32, to: 'Jaystream', from: 'Jayble' },
  Jaystream: { from: 'Jayquill' },
  Titone: { level: 24, to: 'Rockage' },
  Rockage: { from: 'Titone' },
  Kangol: { level: 16, to: 'Flareroo' },
  Flareroo: { level: 32, to: 'Flaresupial', from: 'Kangol' },
  Flaresupial: { from: 'Flareroo' },
  Bubbish: { level: 16, to: 'Foamish' },
  Foamish: { level: 32, to: 'Jelluburst', from: 'Bubbish' },
  Jelluburst: { from: 'Foamish' },
  Lizrout: { level: 16, to: 'Thornko' },
  Thornko: { level: 32, to: 'Branack', from: 'Lizrout' },
  Branack: { from: 'Thornko' },
};

export const ITEMS = {
  Malball: { price: 200, desc: 'Catches wild Pocketmals.' },
  'Great Malball': { price: 600, desc: 'Better catch rate.' },
  Potion: { price: 300, desc: 'Restores 25 HP.' },
  'Super Potion': { price: 700, desc: 'Restores 60 HP.' },
  'Hyper Potion': { price: 1200, desc: 'Restores 120 HP.' },
  Berry: { price: 150, desc: 'A small, sweet 15 HP treat.' },
  Repel: { price: 350, desc: 'Keeps most wild Pocketmals away for 100 steps.' },
  Revive: { price: 900, desc: 'Restores a fainted Pocketmal to half HP.' },
  'Escape Rope': { price: 550, desc: 'Returns you to Covo Town.' },
};

// Technical Machines — teach a move (one use, like early gens)
export const TMS = {
  'TM01 Return': { move: 'Return', price: 1500, desc: 'Teaches Return. Stronger with friendship of the road.' },
  'TM02 Flamethrower': { move: 'Flamethrower', price: 3000, desc: 'Teaches Flamethrower.' },
  'TM03 Surf': { move: 'Surf', price: 3000, desc: 'Teaches Surf.' },
  'TM04 Thunderbolt': { move: 'Thunderbolt', price: 3000, desc: 'Teaches Thunderbolt.' },
  'TM05 Psychic': { move: 'Psychic', price: 3000, desc: 'Teaches Psychic.' },
  'TM06 Earthquake': { move: 'Earthquake', price: 3500, desc: 'Teaches Earthquake.' },
  'TM07 Leaf Blade': { move: 'Leaf Blade', price: 3000, desc: 'Teaches Leaf Blade.' },
  'TM08 Shadow Ball': { move: 'Shadow Ball', price: 2800, desc: 'Teaches Shadow Ball.' },
};

export const MAPS = {
  pocketown: {
    name: 'Covo Town', grass: [],
    rows: [
      'TTTTTTTTT##TTTTTTTTT',
      'T.......F##F.......T',
      'T.HHHH...##..LLLLL.T',
      'T.HHDH..R##..LLDLL.T',
      'T....#..###...#....T',
      'T....#########.....T',
      'T.F.....##........FT',
      'T.CCCC..##...SSSS..T',
      'T.CCDC..##...SSDS..T',
      'T...#...##.....#...T',
      'T...############...T',
      'T..WWW....F..YYYYY.T',
      'T..WWW..F....YYEYY.T',
      'T.F......F.........T',
      'TTTTTTTTTTTTTTTTTTTT',
    ],
    exits: { up: ['route1', 18] },
  },
  // Route 1: mostly Normal, light Wind — classic first-route density
  route1: {
    name: 'Route 1', grass: ['Yapup', 'Yapup', 'Bunnet', 'Bunnet', 'Pufflet', 'Jayble', 'Grainper'], lv: [2, 5],
    rows: [
      'TTTTTTTT##TTTTTTTTTT',
      'TGGGG...##....GGGGGT',
      'TGGGG...##....GGGGGT',
      'T.......##.........T',
      'T...########...WWW.T',
      'T...#......#...WWW.T',
      'TGGG#.GGGG.#...WWW.T',
      'TGGG#.GGGG.#.......T',
      'T...#......####....T',
      'T...####......#..F.T',
      'T......#..GGG.#....T',
      'TFF....#..GGG.#..B.T',
      'T......#####..#....T',
      'T..........#########',
      'TTTTTTTTT##TTTTTTTTT',
    ],
    exits: { up: ['sunmeadow', 18], down: ['pocketown', 1] },
  },
  sunmeadow: {
    name: 'Solara City', grass: ['Yapup', 'Bunnet', 'Pufflet', 'Sparkit', 'Rocklit', 'Breezel', 'Glimmit', 'Rascoon', 'Titone', 'Jayquill'], lv: [5, 9],
    rows: [
      'TTTTTTTT##TTTTTTTTTT',
      'TGGGG...##....GGGGGT',
      'TGGGG...##....GGGGGT',
      'T.......##..F......T',
      'T...#####....#####.T',
      'T...#.......#....#.T',
      'T.GG#..GG...#GG..#.T',
      'T.GG#..GG...#....#.T',
      'T...#.........#....T',
      'T...#####...###....T',
      'T...........###....T',
      'T..........F..YY...T',
      'T.......##..F.YE...T',
      'T.................#T',
      'TTTTTTTTT##TTTTTTTTT',
    ],
    exits: { up: ['whisperwood', 18], down: ['route1', 1] },
  },
  whisperwood: {
    name: 'Ombra Woods', grass: ['Mossit', 'Glimmit', 'Mothcinder', 'Blobble', 'Breezel', 'Cragmite', 'Kilnkit', 'Ripfin', 'Gearbit', 'Tuskvolt', 'Hushowl', 'Bramblet', 'Brackibud', 'Puglow', 'Grainper', 'Grainper', 'Wheafield', 'Rascoon', 'Racrash', 'Jayquill', 'Titone', 'Rockage'], lv: [7, 12],
    rows: [
      'TTTTTTTTTTTTTTTTTTTT',
      'TTGGG..F##F...GGGTTT',
      'TGGGG...##....GGGGTT',
      'TGGTT...##...TTGGGGT',
      'TGGTT...##...TTGGGGT',
      'T.......##.........T',
      'TWWWK...##...GGGG..T',
      'TWWWKGGG##GG.GGGG..T',
      'TWWWKGGG##GG.......T',
      'T.......##....TT...T',
      'TGGGG...##....TTGGGT',
      'TGGGGTT.##.TT..YYGGT',
      'TTGGGTT.##.TT..YYGTT',
      'TT......#..#...E.BTT',
      'TTTTTTTT##TTTTTTTTTT',
    ],
    exits: { down: ['sunmeadow', 1], up: ['starlit', 18] },
  },
  starlit: {
    name: 'Alto Ridge', grass: ['Astrin', 'Skylit', 'Pyrewing', 'Thornox', 'Voltuff', 'Cragmite', 'Floatide', 'Wispurr', 'Starfox', 'Glacub', 'Hauntide', 'Duskrowl', 'Ferrivine', 'Drakindle', 'Dunemole', 'Faefern', 'Wheafield', 'Racrash', 'Jaystream', 'Rockage'], lv: [16, 22],
    rows: [
      'TTTTTTTT##TTTTTTTTTT',
      'TFFFF...##....FFFFFT',
      'T.GGG...##....GGG..T',
      'T.GGG.F.##.F..GGG..T',
      'T...#####....#####.T',
      'T...#..GGG..#....#.T',
      'T.F.#..GGG..#..F.#.T',
      'T...#.......#....#.T',
      'T...#####...#####..T',
      'T......##..........T',
      'TGGGG..##..GGGG....T',
      'TGGGG..##..GGGG..B.T',
      'T......##..........T',
      'T..........#########',
      'TTTTTTTTT##TTTTTTTTT',
    ],
    exits: { down: ['whisperwood', 1] },
  },
};
