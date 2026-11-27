//! Bolt's sets: for robots only. Plain data over the shape kits (`parts.rs`); see `collection/mod.rs`.

use super::{ItemSet, Official};

pub const SETS: &[ItemSet] = &[
    ItemSet { id: "workshop", name: "Workshop", who: &["robot"], theme: "A tinkerer's kit: sparks, grease and good tools.", bonus: "Full set: Spark Shower on every celebration.", reward: "spark-shower" },
    ItemSet { id: "deep-space", name: "Deep Space", who: &["robot"], theme: "Built for orbit: navigation plating and engine glow.", bonus: "Full set: Comet Trail while thinking.", reward: "comet-trail" },
    ItemSet { id: "circuit-garden", name: "Circuit Garden", who: &["robot"], theme: "A solar-powered robot that grows things.", bonus: "Full set: Bloom on every celebration.", reward: "bloom" },
];

pub const ITEMS: &[Official] = &[
    Official { id: "welders-visor", name: "Welder's Visor", part: "welder-visor", rarity: "common", blurb: "A flip-down brass visor with smoked glass. Starter piece.", effects: r##"{"color":"#8a6a3a","lens":"#3a5a4a"}"##, set: "workshop" },
    Official { id: "grease-rag-bandana", name: "Grease Rag Bandana", part: "neckwear", rarity: "common", blurb: "A working bandana with oil smudges.", effects: r##"{"color":"#c2373a","trim":"#2a2a2a","sway":0.8,"style":0}"##, set: "workshop" },
    Official { id: "toolbox-pack", name: "Toolbox Pack", part: "trail-pack", rarity: "uncommon", blurb: "A steel toolbox worn as a backpack, latches that rattle.", effects: r##"{"color":"#c2373a","trim":"#c9ccd4","sway":1.2,"glow":0,"style":1}"##, set: "workshop" },
    Official { id: "spark-shower", name: "Spark Shower", part: "cheer-sparks", rarity: "rare", blurb: "A burst of welding sparks. Set reward.", effects: r##"{"color":"#ffb347","intensity":1.2}"##, set: "workshop" },
    Official { id: "orbit-antenna-halo", name: "Orbit Antenna Halo", part: "emblem-halo", rarity: "uncommon", blurb: "A ring of tiny satellites circling the head.", effects: r##"{"color":"#bfe0ff","glow":0.8,"speed":1.2,"style":0}"##, set: "deep-space" },
    Official { id: "navigator-plating", name: "Navigator Plating", part: "top", rarity: "rare", blurb: "Star-chart engraved chest plates.", effects: r##"{"color":"#1e2848","trim":"#6aa3f5","glow":1.2,"style":8}"##, set: "deep-space" },
    Official { id: "hover-ring", name: "Hover Ring", part: "platform", rarity: "rare", blurb: "A humming ring the keeper floats above.", effects: r##"{"color":"#2a3352","trim":"#4fd6ff","glow":1.2,"style":0}"##, set: "deep-space" },
    Official { id: "thruster-pack", name: "Thruster Pack", part: "trail-pack", rarity: "legendary", blurb: "Twin thrusters with a soft blue flame.", effects: r##"{"color":"#c9ccd4","trim":"#1e2848","sway":0.6,"glow":1.6,"style":4}"##, set: "deep-space" },
    Official { id: "comet-trail", name: "Comet Trail", part: "think-comet", rarity: "legendary", blurb: "A comet loops the keeper while it thinks. Set reward.", effects: r##"{"color":"#bfe0ff","intensity":1.2}"##, set: "deep-space" },
    Official { id: "sprout-antenna", name: "Sprout Antenna", part: "head-gear", rarity: "common", blurb: "A seedling growing from the antenna.", effects: r##"{"color":"#6b4a2a","trim":"#5cc887","glow":0.3,"style":2}"##, set: "circuit-garden" },
    Official { id: "moss-plating", name: "Moss Plating", part: "top", rarity: "uncommon", blurb: "Chest plates with moss in the seams.", effects: r##"{"color":"#7a8a6a","trim":"#3f7d4f","glow":0.2,"style":8}"##, set: "circuit-garden" },
    Official { id: "solar-petal-halo", name: "Solar Petal Halo", part: "emblem-halo", rarity: "rare", blurb: "Petals that turn to face the light.", effects: r##"{"color":"#ffcf5a","glow":1,"speed":0.6,"style":1}"##, set: "circuit-garden" },
    Official { id: "pollen-drift", name: "Pollen Drift", part: "drift-aura", rarity: "legendary", blurb: "Slow golden pollen in the air around it.", effects: r##"{"color":"#ffd76a","count":90,"speed":0.6,"style":0}"##, set: "circuit-garden" },
    Official { id: "bloom", name: "Bloom", part: "cheer-petals", rarity: "legendary", blurb: "Flowers burst open all round the keeper. Set reward.", effects: r##"{"color":"#ff8ac2","intensity":1.4}"##, set: "circuit-garden" },
];
