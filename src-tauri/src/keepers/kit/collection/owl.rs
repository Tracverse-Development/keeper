//! Sage's sets: for owls only (not the dog). Plain data over the shape kits (`parts.rs`); see `collection/mod.rs`.

use super::{ItemSet, Official};

pub const SETS: &[ItemSet] = &[
    ItemSet { id: "scholar", name: "Scholar", who: &["owl"], theme: "The library owl: tweed, spectacles and a satchel of books.", bonus: "Full set: Page Flutter while thinking.", reward: "page-flutter" },
    ItemSet { id: "night-watch", name: "Night Watch", who: &["owl"], theme: "The owl at midnight, keeping watch under the stars.", bonus: "Full set: Shooting Star on every celebration.", reward: "shooting-star" },
    ItemSet { id: "forest-keeper", name: "Forest Keeper", who: &["owl"], theme: "The owl of the old wood: acorns, leaves and moss.", bonus: "Full set: Falling Leaves on every celebration.", reward: "falling-leaves" },
];

pub const ITEMS: &[Official] = &[
    Official { id: "owl-spectacles", name: "Round Spectacles", part: "round-spectacles", rarity: "common", blurb: "Small round reading glasses. Starter piece.", effects: r##"{"color":"#b57b2c","lens":"#e8f4ff","shine":0.6,"style":0}"##, set: "scholar" },
    Official { id: "book-satchel", name: "Book Satchel", part: "trail-pack", rarity: "common", blurb: "A leather satchel with a book peeking out.", effects: r##"{"color":"#7f4a24","trim":"#c2373a","sway":0.8,"glow":0,"style":3}"##, set: "scholar" },
    Official { id: "mortarboard", name: "Mortarboard", part: "soft-hat", rarity: "uncommon", blurb: "A graduation cap with a swinging tassel.", effects: r##"{"color":"#151c33","trim":"#ffcf5a","style":2}"##, set: "scholar" },
    Official { id: "tweed-waistcoat", name: "Tweed Waistcoat", part: "top", rarity: "uncommon", blurb: "Herringbone tweed waistcoat.", effects: r##"{"color":"#7a6a4a","trim":"#d39744","glow":0,"style":6}"##, set: "scholar" },
    Official { id: "page-flutter", name: "Page Flutter", part: "think-pages", rarity: "rare", blurb: "Book pages flutter around the owl. Set reward.", effects: r##"{"color":"#f4eee2","intensity":1.2}"##, set: "scholar" },
    Official { id: "star-map-monocle", name: "Star-map Monocle", part: "round-spectacles", rarity: "rare", blurb: "A brass monocle etched with constellations.", effects: r##"{"color":"#b57b2c","lens":"#9ad0ff","shine":1,"style":1}"##, set: "night-watch" },
    Official { id: "moon-cloak", name: "Moon Cloak", part: "cape", rarity: "rare", blurb: "A midnight cloak lined with moonlight.", effects: r##"{"color":"#151c33","trim":"#bfe0ff","glow":1,"sway":1,"style":0}"##, set: "night-watch" },
    Official { id: "crescent-halo", name: "Crescent Halo", part: "emblem-halo", rarity: "legendary", blurb: "A thin crescent moon above the head.", effects: r##"{"color":"#e8f0ff","glow":0.7,"speed":0.4,"style":2}"##, set: "night-watch" },
    Official { id: "night-sky", name: "Night Sky", part: "drift-aura", rarity: "legendary", blurb: "Faint stars twinkle around the owl.", effects: r##"{"color":"#cfe0ff","count":100,"speed":0.5,"style":1}"##, set: "night-watch" },
    Official { id: "shooting-star", name: "Shooting Star", part: "cheer-shooting-star", rarity: "mythical", blurb: "A shooting star crosses and bursts. Set reward.", effects: r##"{"color":"#ffe9a8","intensity":1.6}"##, set: "night-watch" },
    Official { id: "acorn-cap", name: "Acorn Cap", part: "soft-hat", rarity: "common", blurb: "A tiny acorn cap worn at a tilt.", effects: r##"{"color":"#8a5a2a","trim":"#5a3a1a","style":1}"##, set: "forest-keeper" },
    Official { id: "leaf-scarf", name: "Leaf Scarf", part: "knit-scarf", rarity: "common", blurb: "A scarf of stitched leaves.", effects: r##"{"color":"#3f7d4f","stripe":"#c9a64a","sway":1}"##, set: "forest-keeper" },
    Official { id: "branch-perch", name: "Branch Perch", part: "platform", rarity: "uncommon", blurb: "A mossy branch the owl stands on.", effects: r##"{"color":"#6b4a2a","trim":"#5c8a3a","glow":0,"style":2}"##, set: "forest-keeper" },
    Official { id: "falling-leaves", name: "Falling Leaves", part: "cheer-petals", rarity: "rare", blurb: "Autumn leaves spin down around the owl. Set reward.", effects: r##"{"color":"#d9822b","intensity":1.2}"##, set: "forest-keeper" },
];
