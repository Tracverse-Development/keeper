//! Amara's sets: for the woman only. Plain data over the shape kits (`parts.rs`); see `collection/mod.rs`.

use super::{ItemSet, Official};

pub const SETS: &[ItemSet] = &[
    ItemSet { id: "market-morning", name: "Market Morning", who: &["woman"], theme: "Early market: wax print, beads and a full tote.", bonus: "Full set: Marigold Scatter on every celebration.", reward: "marigold-scatter" },
    ItemSet { id: "explorer", name: "Explorer", who: &["woman"], theme: "Field researcher, mountain trail, notebook full.", bonus: "Full set: Compass Glint while thinking.", reward: "compass-glint" },
    ItemSet { id: "gala-night", name: "Gala Night", who: &["woman"], theme: "Evening, chandeliers and a long gown.", bonus: "Full set: Rose Petal Rain on every celebration.", reward: "rose-petal-rain" },
];

pub const ITEMS: &[Official] = &[
    Official { id: "headwrap", name: "Headwrap", part: "soft-hat", rarity: "common", blurb: "A tall, bright wrapped headwrap. Starter piece.", effects: r##"{"color":"#e2662c","trim":"#2f6fcf","style":3}"##, set: "market-morning" },
    Official { id: "bead-bracelets", name: "Bead Bracelets", part: "bangles", rarity: "common", blurb: "Stacked bead bracelets.", effects: r##"{"color":"#e2662c","trim":"#2f8f57","glow":0.2,"style":0}"##, set: "market-morning" },
    Official { id: "wrap-skirt", name: "Wrap Skirt", part: "trousers", rarity: "common", blurb: "A wrap skirt tied at the side.", effects: r##"{"color":"#2f6fcf","trim":"#ffcf5a","style":3}"##, set: "market-morning" },
    Official { id: "wax-print-blouse", name: "Wax-print Blouse", part: "top", rarity: "uncommon", blurb: "Bold wax-print blouse with puff sleeves.", effects: r##"{"color":"#ffcf5a","trim":"#c2373a","glow":0,"style":9}"##, set: "market-morning" },
    Official { id: "woven-tote", name: "Woven Tote", part: "tote", rarity: "uncommon", blurb: "A woven basket tote with leather handles.", effects: r##"{"color":"#d8b47a","trim":"#7f4a24","style":0}"##, set: "market-morning" },
    Official { id: "marigold-scatter", name: "Marigold Scatter", part: "cheer-petals", rarity: "rare", blurb: "Marigold petals scatter and fall. Set reward.", effects: r##"{"color":"#ff9a1a","intensity":1.2}"##, set: "market-morning" },
    Official { id: "wide-brim-hat", name: "Wide-brim Hat", part: "brim-hat", rarity: "common", blurb: "Canvas wide-brim hat with a dark band.", effects: r##"{"color":"#b8a27a","trim":"#5a3a1a","style":1}"##, set: "explorer" },
    Official { id: "field-jacket", name: "Field Jacket", part: "ark-jacket", rarity: "uncommon", blurb: "Four-pocket field jacket.", effects: r##"{"color":"#6a7a4a","trim":"#c9a66b","sway":0.8}"##, set: "explorer" },
    Official { id: "cargo-trousers", name: "Cargo Trousers", part: "trousers", rarity: "uncommon", blurb: "Hard-wearing cargo trousers.", effects: r##"{"color":"#5a5a3a","trim":"#c9a66b","style":2}"##, set: "explorer" },
    Official { id: "trail-boots", name: "Trail Boots", part: "shoes", rarity: "rare", blurb: "Lace-up leather trail boots.", effects: r##"{"color":"#7f4a24","trim":"#2a2a2a","style":2}"##, set: "explorer" },
    Official { id: "compass-glint", name: "Compass Glint", part: "think-compass", rarity: "rare", blurb: "A compass needle swings and settles. Set reward.", effects: r##"{"color":"#e3b06a","intensity":1.2}"##, set: "explorer" },
    Official { id: "starlight-shawl", name: "Starlight Shawl", part: "neckwear", rarity: "rare", blurb: "A sheer shawl with tiny sparkles.", effects: r##"{"color":"#d8c8f0","trim":"#ffffff","sway":1.2,"style":2}"##, set: "gala-night" },
    Official { id: "evening-heels", name: "Evening Heels", part: "shoes", rarity: "rare", blurb: "Slim heels with an ankle strap.", effects: r##"{"color":"#7a1f3d","trim":"#ffcf5a","style":5}"##, set: "gala-night" },
    Official { id: "gold-circlet", name: "Gold Circlet", part: "crown", rarity: "legendary", blurb: "A thin gold circlet worn across the hair.", effects: r##"{"color":"#ffcf5a","trim":"#e2425f","glow":0.8,"style":0}"##, set: "gala-night" },
    Official { id: "evening-gown", name: "Evening Gown", part: "gown", rarity: "legendary", blurb: "Floor-length gown with a soft shimmer. Takes the legs too.", effects: r##"{"color":"#7a1f3d","trim":"#ffcf5a","glow":0.8}"##, set: "gala-night" },
    Official { id: "rose-petal-rain", name: "Rose Petal Rain", part: "cheer-petals", rarity: "mythical", blurb: "Rose petals fall in a slow spiral. Set reward.", effects: r##"{"color":"#e2253f","intensity":1.8}"##, set: "gala-night" },
];
