//! Sets shared by a race (humans, animals) or by everyone. Plain data over the shape kits (`parts.rs`); see `collection/mod.rs`.

use super::{ItemSet, Official};

pub const SETS: &[ItemSet] = &[
    ItemSet { id: "everyday-basics", name: "Everyday Basics", who: &["human"], theme: "The wardrobe staples every human keeper starts with.", bonus: "Three worn: set glow. Full set: Confetti Pop on every celebration.", reward: "confetti-pop" },
    ItemSet { id: "mas-band", name: "Mas Band", who: &["human"], theme: "Carnival on the road: feathers, sequins and soca.", bonus: "Full set: Carnival Wings shimmer on every celebration.", reward: "carnival-wings" },
    ItemSet { id: "wild-trail", name: "Wild Trail", who: &["animal"], theme: "For keepers with fur or feathers, out in the wild.", bonus: "Full set: Firefly Aura glows brighter at night.", reward: "firefly-aura" },
    ItemSet { id: "ark-pilgrim", name: "Ark Pilgrim", who: &[], theme: "Umoja Ark's own set: the ark, the waves and the promise of the rainbow.", bonus: "Full set: Rainbow Promise on every celebration.", reward: "rainbow-promise" },
];

pub const ITEMS: &[Official] = &[
    Official { id: "crew-tee", name: "Crew Tee", part: "top", rarity: "common", blurb: "A plain cotton tee.", effects: r##"{"color":"#f4eee2","trim":"#151c33","glow":0,"style":0}"##, set: "everyday-basics" },
    Official { id: "denim-jeans", name: "Denim Jeans", part: "trousers", rarity: "common", blurb: "Straight-leg jeans.", effects: r##"{"color":"#3a5a8a","trim":"#d39744","style":0}"##, set: "everyday-basics" },
    Official { id: "canvas-sneakers", name: "Canvas Sneakers", part: "shoes", rarity: "common", blurb: "Low canvas sneakers.", effects: r##"{"color":"#c2373a","trim":"#f4eee2","style":0}"##, set: "everyday-basics" },
    Official { id: "ball-cap", name: "Ball Cap", part: "crew-cap", rarity: "common", blurb: "A curved-brim cap.", effects: r##"{"color":"#2f6fcf","trim":"#f4eee2"}"##, set: "everyday-basics" },
    Official { id: "zip-hoodie", name: "Zip Hoodie", part: "top", rarity: "uncommon", blurb: "A soft zip hoodie, hood down.", effects: r##"{"color":"#6f7686","trim":"#f4eee2","glow":0,"style":2}"##, set: "everyday-basics" },
    Official { id: "round-glasses", name: "Round Glasses", part: "round-spectacles", rarity: "uncommon", blurb: "Everyday round frames.", effects: r##"{"color":"#1a1a1a","lens":"#e8f4ff","shine":0.4,"style":0}"##, set: "everyday-basics" },
    Official { id: "confetti-pop", name: "Confetti Pop", part: "cheer-confetti", rarity: "rare", blurb: "A pop of confetti in every colour. Set reward.", effects: r##"{"color":"#ff6fa8","intensity":1.4}"##, set: "everyday-basics" },
    Official { id: "beaded-arm-bands", name: "Beaded Arm Bands", part: "bangles", rarity: "uncommon", blurb: "Jewelled arm bands that catch the light.", effects: r##"{"color":"#ffcf5a","trim":"#e2425f","glow":1,"style":1}"##, set: "mas-band" },
    Official { id: "sequin-costume", name: "Sequin Costume", part: "top", rarity: "rare", blurb: "A sequinned costume top in band colours.", effects: r##"{"color":"#c25cf0","trim":"#ffcf5a","glow":1.6,"style":7}"##, set: "mas-band" },
    Official { id: "soca-confetti", name: "Soca Confetti", part: "cheer-confetti", rarity: "rare", blurb: "A burst of band-coloured confetti and streamers.", effects: r##"{"color":"#ffcf5a","intensity":1.8}"##, set: "mas-band" },
    Official { id: "feather-headpiece", name: "Feather Headpiece", part: "crown", rarity: "legendary", blurb: "A tall plumed headpiece.", effects: r##"{"color":"#ffcf5a","trim":"#c25cf0","glow":1,"style":2}"##, set: "mas-band" },
    Official { id: "carnival-wings", name: "Carnival Wings", part: "cape", rarity: "mythical", blurb: "Huge feathered wings that sway. Set reward.", effects: r##"{"color":"#c25cf0","trim":"#ffcf5a","glow":1.4,"sway":1.4,"style":1}"##, set: "mas-band" },
    Official { id: "leaf-crown", name: "Leaf Crown", part: "crown", rarity: "common", blurb: "A ring of leaves worn like a crown.", effects: r##"{"color":"#5c8a3a","trim":"#c9a64a","glow":0,"style":1}"##, set: "wild-trail" },
    Official { id: "mossy-stone", name: "Mossy Stone", part: "platform", rarity: "common", blurb: "A flat stone with moss on top.", effects: r##"{"color":"#7a7a72","trim":"#5c8a3a","glow":0,"style":3}"##, set: "wild-trail" },
    Official { id: "charm-collar", name: "Charm Collar", part: "dog-collar", rarity: "uncommon", blurb: "A collar with a little charm. Fits a dog or an owl.", effects: r##"{"color":"#2f8f57","tag":"#ffcf5a"}"##, set: "wild-trail" },
    Official { id: "pathfinder-pack", name: "Pathfinder Pack", part: "trail-pack", rarity: "uncommon", blurb: "A small adventure pack.", effects: r##"{"color":"#3f7d4f","trim":"#c9a66b","sway":1,"glow":0,"style":0}"##, set: "wild-trail" },
    Official { id: "firefly-aura", name: "Firefly Aura", part: "drift-aura", rarity: "rare", blurb: "Fireflies drift around the keeper. Set reward.", effects: r##"{"color":"#d8ff6a","count":40,"speed":0.8,"style":2}"##, set: "wild-trail" },
    Official { id: "pilgrim-scarf", name: "Pilgrim Scarf", part: "knit-scarf", rarity: "common", blurb: "Navy and gold scarf in the ark colours.", effects: r##"{"color":"#151c33","stripe":"#d39744","sway":1}"##, set: "ark-pilgrim" },
    Official { id: "ark-compass-halo", name: "Ark Compass Halo", part: "emblem-halo", rarity: "uncommon", blurb: "A compass rose turning slowly overhead.", effects: r##"{"color":"#d39744","glow":0.8,"speed":0.5,"style":3}"##, set: "ark-pilgrim" },
    Official { id: "voyager-pack", name: "Voyager Pack", part: "trail-pack", rarity: "uncommon", blurb: "A traveller's pack with the ark badge.", effects: r##"{"color":"#151c33","trim":"#d39744","sway":1,"glow":0,"style":0}"##, set: "ark-pilgrim" },
    Official { id: "tideline-base", name: "Tideline Base", part: "platform", rarity: "rare", blurb: "Gentle waves lapping under the keeper.", effects: r##"{"color":"#2f7fbf","trim":"#e8f6f0","glow":0.6,"style":4}"##, set: "ark-pilgrim" },
    Official { id: "ark-lantern", name: "Ark Lantern", part: "drift-aura", rarity: "legendary", blurb: "Warm lantern light around the keeper.", effects: r##"{"color":"#ffb347","count":24,"speed":0.4,"style":3}"##, set: "ark-pilgrim" },
    Official { id: "rainbow-promise", name: "Rainbow Promise", part: "cheer-rainbow", rarity: "mythical", blurb: "A rainbow arcs over the keeper. Set reward.", effects: r##"{"color":"#ffffff","intensity":1.6}"##, set: "ark-pilgrim" },
];
