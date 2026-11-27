//! Malik's sets: for the man only. Plain data over the shape kits (`parts.rs`); see `collection/mod.rs`.

use super::{ItemSet, Official};

pub const SETS: &[ItemSet] = &[
    ItemSet { id: "island-linen", name: "Island Linen", who: &["man"], theme: "Caribbean summer: light cloth, sea air, steelpan in the distance.", bonus: "Full set: Steelpan Ripple on every celebration.", reward: "steelpan-ripple" },
    ItemSet { id: "studio-producer", name: "Studio Producer", who: &["man"], theme: "Late session in the studio, levels in the green.", bonus: "Full set: Waveform while thinking.", reward: "waveform" },
    ItemSet { id: "sharp-suit", name: "Sharp Suit", who: &["man"], theme: "Dressed for the big day.", bonus: "Full set: Spotlight base.", reward: "spotlight" },
];

pub const ITEMS: &[Official] = &[
    Official { id: "linen-shirt", name: "Linen Shirt", part: "top", rarity: "common", blurb: "Loose linen shirt, sleeves rolled. Starter piece.", effects: r##"{"color":"#f0e8d6","trim":"#c9a66b","glow":0,"style":1}"##, set: "island-linen" },
    Official { id: "straw-fedora", name: "Straw Fedora", part: "brim-hat", rarity: "common", blurb: "Woven straw hat with a dark band.", effects: r##"{"color":"#e0c48a","trim":"#2a2a2a","style":0}"##, set: "island-linen" },
    Official { id: "rolled-chinos", name: "Rolled Chinos", part: "trousers", rarity: "uncommon", blurb: "Light chinos cuffed at the ankle.", effects: r##"{"color":"#c8b48a","trim":"#7f4a24","style":1}"##, set: "island-linen" },
    Official { id: "leather-sandals", name: "Leather Sandals", part: "shoes", rarity: "uncommon", blurb: "Hand-stitched leather sandals.", effects: r##"{"color":"#9a6a3a","trim":"#5a3a1a","style":4}"##, set: "island-linen" },
    Official { id: "steelpan-ripple", name: "Steelpan Ripple", part: "cheer-ripple", rarity: "rare", blurb: "Rings of light ripple out like notes from a pan. Set reward.", effects: r##"{"color":"#4fd6d6","intensity":1.2}"##, set: "island-linen" },
    Official { id: "over-ear-headphones", name: "Over-ear Headphones", part: "head-gear", rarity: "uncommon", blurb: "Studio headphones resting on the head.", effects: r##"{"color":"#151c33","trim":"#5cc887","glow":0.6,"style":0}"##, set: "studio-producer" },
    Official { id: "smart-watch", name: "Smart Watch", part: "trail-watch", rarity: "uncommon", blurb: "A watch face that glows softly.", effects: r##"{"color":"#151c33","face":"#5cc887","glow":1.2}"##, set: "studio-producer" },
    Official { id: "bomber-jacket", name: "Bomber Jacket", part: "ark-jacket", rarity: "rare", blurb: "Satin bomber with ribbed cuffs.", effects: r##"{"color":"#2a3a2a","trim":"#e2662c","sway":0.6}"##, set: "studio-producer" },
    Official { id: "high-top-sneakers", name: "High-top Sneakers", part: "shoes", rarity: "rare", blurb: "Clean high-tops, laces loose.", effects: r##"{"color":"#f4eee2","trim":"#c2373a","style":1}"##, set: "studio-producer" },
    Official { id: "waveform", name: "Waveform", part: "think-wave", rarity: "legendary", blurb: "An audio waveform pulses round the keeper. Set reward.", effects: r##"{"color":"#5cc887","intensity":1.2}"##, set: "studio-producer" },
    Official { id: "silk-tie", name: "Silk Tie", part: "neckwear", rarity: "uncommon", blurb: "Narrow silk tie, half-Windsor.", effects: r##"{"color":"#7a1f3d","trim":"#d39744","sway":0.4,"style":1}"##, set: "sharp-suit" },
    Official { id: "oxford-shoes", name: "Oxford Shoes", part: "shoes", rarity: "uncommon", blurb: "Polished leather oxfords.", effects: r##"{"color":"#3a2414","trim":"#1a120c","style":3}"##, set: "sharp-suit" },
    Official { id: "tailored-blazer", name: "Tailored Blazer", part: "top", rarity: "rare", blurb: "Two-button blazer with a pocket square.", effects: r##"{"color":"#1e2848","trim":"#f4eee2","glow":0.2,"style":4}"##, set: "sharp-suit" },
    Official { id: "classic-watch", name: "Classic Watch", part: "trail-watch", rarity: "rare", blurb: "A gold-cased watch with a leather strap.", effects: r##"{"color":"#3a2414","face":"#fff6e0","glow":0.4}"##, set: "sharp-suit" },
    Official { id: "spotlight", name: "Spotlight", part: "platform", rarity: "legendary", blurb: "A pool of stage light under the keeper. Set reward.", effects: r##"{"color":"#fff2c0","trim":"#ffcf5a","glow":0.9,"style":5}"##, set: "sharp-suit" },
];
