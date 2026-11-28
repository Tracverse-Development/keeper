//! The Keeper Kit (`docs/design/keeper-kit.md`): what a keeper is made of, besides its memory.
//! - `souls`   WHO it is (personality)          - `roles`   WHAT it can do (its job)
//! - `species` its body and the slots it offers - `parts`   wearables that fill the slots
//! - `slots`   where a wearable goes             - `wardrobe` the items the person owns, worn by keepers
//! - `packs`   shareable `.keeper.json` files   - `inventory` the person's souls and variants on the DKG
//! - `rarity`  common to mythical               - `levels`  experience earned by use, and what it unlocks
//! - `seasons` a small set open for a few weeks, each item earned by a quest of useful things done
//! - `collection` the official items and their sets   - `starters` the starter keepers
//! - `colours` the few colours each item can be worn in (palettes per part kind, per-item overrides)
//! - `look`    paint zones, finishes and habits per keeper (`docs/design/keeper-ecosystem.md`)

pub mod collection;
pub mod colours;
pub mod finishes;
pub mod forge_words;
pub mod inventory;
pub mod levels;
pub mod loadout;
pub mod look;
pub mod pack_sign;
pub mod packs;
pub mod parts;
pub mod personal;
pub mod rarity;
pub mod roles;
pub mod seasons;
pub mod slots;
pub mod souls;
pub mod species;
pub mod starters;
pub mod wardrobe;
