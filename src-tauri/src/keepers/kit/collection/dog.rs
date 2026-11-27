//! Biscuit's sets: for dogs only (not the owl). Plain data over the shape kits (`parts.rs`); see `collection/mod.rs`.

use super::{ItemSet, Official};

pub const SETS: &[ItemSet] = &[
    ItemSet { id: "park-day", name: "Park Day", who: &["puppy"], theme: "Sun, grass and a ball that never stays thrown.", bonus: "Full set: Tennis Ball Burst on every celebration.", reward: "tennis-ball-burst" },
    ItemSet { id: "rescue-ranger", name: "Rescue Ranger", who: &["puppy"], theme: "A working dog on search and rescue duty.", bonus: "Full set: Beacon while thinking.", reward: "beacon" },
    ItemSet { id: "cozy-den", name: "Cozy Den", who: &["puppy"], theme: "Rainy afternoon, blanket, nap.", bonus: "Full set: Dreamy Zzz while thinking.", reward: "dreamy-zzz" },
];

pub const ITEMS: &[Official] = &[
    Official { id: "park-bandana", name: "Park Bandana", part: "neckwear", rarity: "common", blurb: "A classic folded bandana. Starter piece.", effects: r##"{"color":"#2f6fcf","trim":"#f4eee2","sway":1,"style":0}"##, set: "park-day" },
    Official { id: "sun-visor-cap", name: "Sun Visor Cap", part: "brim-hat", rarity: "common", blurb: "A visor cap for sunny walks.", effects: r##"{"color":"#e2662c","trim":"#f4eee2","style":3}"##, set: "park-day" },
    Official { id: "running-booties", name: "Running Booties", part: "shoes", rarity: "uncommon", blurb: "Four bright booties for the long walk.", effects: r##"{"color":"#e2425f","trim":"#2a2a2a","style":6}"##, set: "park-day" },
    Official { id: "tennis-ball-burst", name: "Tennis Ball Burst", part: "cheer-balls", rarity: "rare", blurb: "Tennis balls bounce out in every direction. Set reward.", effects: r##"{"color":"#d8f04a","intensity":1.2}"##, set: "park-day" },
    Official { id: "rescue-vest", name: "Rescue Vest", part: "top", rarity: "uncommon", blurb: "High-visibility vest with a reflective stripe.", effects: r##"{"color":"#ff7a1a","trim":"#e8eef4","glow":0.8,"style":5}"##, set: "rescue-ranger" },
    Official { id: "headlamp", name: "Headlamp", part: "head-gear", rarity: "rare", blurb: "A small lamp that lights where the dog looks.", effects: r##"{"color":"#2a2a2a","trim":"#fff2c0","glow":1.6,"style":1}"##, set: "rescue-ranger" },
    Official { id: "first-aid-saddlebag", name: "First-aid Saddlebag", part: "trail-pack", rarity: "rare", blurb: "Two pouches with a cross badge.", effects: r##"{"color":"#c2373a","trim":"#f4eee2","sway":1,"glow":0,"style":2}"##, set: "rescue-ranger" },
    Official { id: "beacon", name: "Beacon", part: "think-beacon", rarity: "legendary", blurb: "A turning rescue beacon light. Set reward.", effects: r##"{"color":"#ff7a3a","intensity":1.2}"##, set: "rescue-ranger" },
    Official { id: "knit-sweater", name: "Knit Sweater", part: "top", rarity: "common", blurb: "Chunky cable knit with a rolled neck.", effects: r##"{"color":"#c9a66b","trim":"#f4eee2","glow":0,"style":3}"##, set: "cozy-den" },
    Official { id: "pom-beanie", name: "Pom Beanie", part: "soft-hat", rarity: "uncommon", blurb: "A beanie with a pom-pom on top.", effects: r##"{"color":"#3f7d4f","trim":"#f4eee2","style":0}"##, set: "cozy-den" },
    Official { id: "slipper-socks", name: "Slipper Socks", part: "shoes", rarity: "uncommon", blurb: "Soft socks with grippy dots.", effects: r##"{"color":"#bfa8ff","trim":"#f4eee2","style":7}"##, set: "cozy-den" },
    Official { id: "cushion-bed", name: "Cushion Bed", part: "platform", rarity: "rare", blurb: "A round cushion the dog sits in.", effects: r##"{"color":"#7f4a24","trim":"#f0e2c8","glow":0,"style":1}"##, set: "cozy-den" },
    Official { id: "dreamy-zzz", name: "Dreamy Zzz", part: "think-dream", rarity: "legendary", blurb: "Little letters and stars drift up while it thinks. Set reward.", effects: r##"{"color":"#bfa8ff","intensity":1.2}"##, set: "cozy-den" },
];
