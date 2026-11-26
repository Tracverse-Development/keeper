//! The Keeper Kit (`docs/design/keeper-kit.md`): what a keeper is made of, besides its memory.
//! - `souls`   WHO it is (personality)          - `roles`   WHAT it can do (its job)
//! - `species` its body and the slots it offers - `parts`   wearables that fill the slots
//! - `slots`   where a wearable goes             - `wardrobe` the items the person owns, worn by keepers
//! - `packs`   shareable `.keeper.json` files   - `inventory` the person's souls and variants on the DKG
//! - `rarity`  common to mythical               - `levels`  experience earned by use, and what it unlocks
//! - `look`    paint zones and habits per keeper (`docs/design/keeper-ecosystem.md`)

pub mod inventory;
pub mod levels;
pub mod look;
pub mod official;
pub mod packs;
pub mod parts;
pub mod rarity;
pub mod roles;
pub mod slots;
pub mod souls;
pub mod species;
pub mod wardrobe;
