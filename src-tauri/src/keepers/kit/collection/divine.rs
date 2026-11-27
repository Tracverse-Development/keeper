//! The God Keeper's own set (the God Keeper also wears every set above). Plain data over the shape kits (`parts.rs`); see `collection/mod.rs`.

use super::{ItemSet, Official};

pub const SETS: &[ItemSet] = &[
    ItemSet { id: "celestial-regalia", name: "Celestial Regalia", who: &["divine"], theme: "The God Keeper's own regalia: a crown of rays, wings of light and the halo of ages.", bonus: "Full set: Genesis on every celebration.", reward: "genesis" },
];

pub const ITEMS: &[Official] = &[
    Official { id: "sunstep-sandals", name: "Sunstep Sandals", part: "shoes", rarity: "rare", blurb: "Gold sandals that leave light where they step.", effects: r##"{"color":"#ffcf5a","trim":"#fff2c0","style":4}"##, set: "celestial-regalia" },
    Official { id: "starfire-robe", name: "Starfire Robe", part: "top", rarity: "legendary", blurb: "A robe woven from starlight, falling to the feet.", effects: r##"{"color":"#f4eee2","trim":"#ffcf5a","glow":0.8,"style":10}"##, set: "celestial-regalia" },
    Official { id: "seraph-crown", name: "Seraph Crown", part: "crown", rarity: "legendary", blurb: "A crown of rays that burns brighter as it works.", effects: r##"{"color":"#ffcf5a","trim":"#bfe0ff","glow":1,"style":3}"##, set: "celestial-regalia" },
    Official { id: "cloud-throne", name: "Cloud Throne", part: "platform", rarity: "legendary", blurb: "A bank of gold-lit cloud to stand upon.", effects: r##"{"color":"#f4eee2","trim":"#ffcf5a","glow":0.6,"style":6}"##, set: "celestial-regalia" },
    Official { id: "wings-of-light", name: "Wings of Light", part: "cape", rarity: "mythical", blurb: "Six wings of pure light, slowly beating.", effects: r##"{"color":"#fff6e0","trim":"#ffcf5a","glow":0.9,"sway":1,"style":2}"##, set: "celestial-regalia" },
    Official { id: "halo-of-ages", name: "Halo of Ages", part: "emblem-halo", rarity: "mythical", blurb: "Three rings of old gold script, turning against each other.", effects: r##"{"color":"#ffcf5a","glow":0.9,"speed":0.8,"style":4}"##, set: "celestial-regalia" },
    Official { id: "genesis", name: "Genesis", part: "cheer-starburst", rarity: "mythical", blurb: "Light before everything: a blinding flare and a storm of gold. Set reward.", effects: r##"{"color":"#ffcf5a","intensity":2}"##, set: "celestial-regalia" },
];
