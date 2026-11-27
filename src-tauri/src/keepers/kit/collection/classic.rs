//! The first official items (before sets): plain pieces any keeper of the right body can earn,
//! and the Trail Watch at every tier. They belong to no set.

use super::Official;

pub const ITEMS: &[Official] = &[
    Official { id: "sky-scarf", name: "Sky Scarf", part: "knit-scarf", rarity: "common", blurb: "Soft blue knit for a calm day.", effects: r##"{"color":"#7fb4e8","stripe":"#f4eee2"}"##, set: "" },
    Official { id: "forest-cap", name: "Forest Cap", part: "crew-cap", rarity: "common", blurb: "A green cap for walks and work.", effects: r##"{"color":"#3f7d4f","trim":"#f0e2c8"}"##, set: "" },
    Official { id: "ember-jacket", name: "Ember Jacket", part: "ark-jacket", rarity: "uncommon", blurb: "Warm orange with a gold edge.", effects: r##"{"color":"#e2662c","trim":"#e3b06a","sway":1.2}"##, set: "" },
    Official { id: "mint-pack", name: "Mint Pack", part: "trail-pack", rarity: "uncommon", blurb: "A fresh mint backpack.", effects: r##"{"color":"#7fd6b4","trim":"#151c33","sway":1}"##, set: "" },
    Official { id: "midnight-halo", name: "Midnight Halo", part: "memory-halo", rarity: "rare", blurb: "Deep blue memories orbiting slowly.", effects: r##"{"color":"#4a8df0","spinIdle":0.6,"spinWork":3,"nodes":120}"##, set: "" },
    Official { id: "aurora-aura", name: "Aurora Aura", part: "star-aura", rarity: "rare", blurb: "Northern lights that drift around your keeper.", effects: r##"{"color":"#1fd2d6","count":90,"speed":1.6}"##, set: "" },
    Official { id: "solar-halo", name: "Solar Halo", part: "memory-halo", rarity: "legendary", blurb: "A blazing gold orbit of two hundred memories.", effects: r##"{"color":"#ffcf5a","spinIdle":1.8,"spinWork":6,"nodes":200}"##, set: "" },
    Official { id: "royal-jacket", name: "Royal Jacket", part: "ark-jacket", rarity: "legendary", blurb: "Purple velvet, gold trim, worn with pride.", effects: r##"{"color":"#5b2a86","trim":"#ffcf5a","sway":0.8}"##, set: "" },
    Official { id: "nebula-aura", name: "Nebula Aura", part: "star-aura", rarity: "mythical", blurb: "A whole galaxy swirling at full speed.", effects: r##"{"color":"#c25cf0","count":120,"speed":4}"##, set: "" },
    Official { id: "phoenix-jacket", name: "Phoenix Jacket", part: "ark-jacket", rarity: "mythical", blurb: "Fire red and gold, never still.", effects: r##"{"color":"#e2252f","trim":"#ffcf5a","sway":2}"##, set: "" },
    // The Trail Watch at every tier (for humans; the God Keeper wears them too): the same watch,
    // grander from common to mythical.
    Official { id: "field-watch", name: "Field Watch", part: "trail-watch", rarity: "common", blurb: "A plain leather watch for every day.", effects: r##"{"color":"#7f4a24","face":"#f4eee2","glow":0.3}"##, set: "" },
    Official { id: "tide-watch", name: "Tide Watch", part: "trail-watch", rarity: "uncommon", blurb: "Sea green with a soft shimmer.", effects: r##"{"color":"#1f6f5a","face":"#e8f6f0","glow":0.6}"##, set: "" },
    Official { id: "sky-watch", name: "Sky Watch", part: "trail-watch", rarity: "rare", blurb: "Deep blue, ringed with its own light.", effects: r##"{"color":"#1e2848","face":"#bfe0ff","glow":1}"##, set: "" },
    Official { id: "sun-watch", name: "Sun Watch", part: "trail-watch", rarity: "legendary", blurb: "Gold rays turning round a golden dial.", effects: r##"{"color":"#b57b2c","face":"#ffe4a8","glow":1.4}"##, set: "" },
    Official { id: "nebula-watch", name: "Nebula Watch", part: "trail-watch", rarity: "mythical", blurb: "A galaxy on the wrist, in every colour.", effects: r##"{"color":"#2a1840","face":"#e6c8ff","glow":2}"##, set: "" },
    Official { id: "scholar-spectacles", name: "Scholar Spectacles", part: "round-spectacles", rarity: "rare", blurb: "Gold wire for reading late into the night.", effects: r##"{"color":"#d39744","lens":"#d8eeff","shine":0.8}"##, set: "" },
    Official { id: "first-light-lantern", name: "First Light Lantern", part: "star-lantern", rarity: "legendary", blurb: "A lantern carrying the first light of the season.", effects: r##"{"color":"#d39744","light":"#ffcf5a","glow":1.6}"##, set: "" },
    Official { id: "arc-visor", name: "Arc Visor", part: "welder-visor", rarity: "uncommon", blurb: "A brass visor with a cyan arc of glass.", effects: r##"{"color":"#b57b2c","lens":"#1fd2d6"}"##, set: "" },
];
