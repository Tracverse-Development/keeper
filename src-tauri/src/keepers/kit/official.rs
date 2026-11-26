//! The official collection: items Keeper ships, each with a rarity the catalogue gives it (a
//! community pack can never claim one; its items take their part's rarity). Shown in the
//! Studio's Marketplace and in every wardrobe (`official:<id>`), worn once the keeper's level
//! reaches the rarity. No payments: items are earned by level (a founder decision for later).

/// One official item: a part in its own colours and settings, with a rarity and one line.
pub struct Official {
    pub id: &'static str,
    pub name: &'static str,
    pub part: &'static str,
    pub rarity: &'static str,
    pub blurb: &'static str,
    /// Effect values as JSON (validated against the part's schema like any item).
    pub effects: &'static str,
}

pub const OFFICIAL: &[Official] = &[
    Official { id: "sky-scarf", name: "Sky Scarf", part: "knit-scarf", rarity: "common", blurb: "Soft blue knit for a calm day.", effects: r##"{"color":"#7fb4e8","stripe":"#f4eee2"}"## },
    Official { id: "forest-cap", name: "Forest Cap", part: "crew-cap", rarity: "common", blurb: "A green cap for walks and work.", effects: r##"{"color":"#3f7d4f","trim":"#f0e2c8"}"## },
    Official { id: "ember-jacket", name: "Ember Jacket", part: "ark-jacket", rarity: "uncommon", blurb: "Warm orange with a gold edge.", effects: r##"{"color":"#e2662c","trim":"#e3b06a","sway":1.2}"## },
    Official { id: "mint-pack", name: "Mint Pack", part: "trail-pack", rarity: "uncommon", blurb: "A fresh mint backpack.", effects: r##"{"color":"#7fd6b4","trim":"#151c33","sway":1}"## },
    Official { id: "midnight-halo", name: "Midnight Halo", part: "memory-halo", rarity: "rare", blurb: "Deep blue memories orbiting slowly.", effects: r##"{"color":"#4a8df0","spinIdle":0.6,"spinWork":3,"nodes":120}"## },
    Official { id: "aurora-aura", name: "Aurora Aura", part: "star-aura", rarity: "rare", blurb: "Northern lights that drift around your keeper.", effects: r##"{"color":"#1fd2d6","count":90,"speed":1.6}"## },
    Official { id: "solar-halo", name: "Solar Halo", part: "memory-halo", rarity: "legendary", blurb: "A blazing gold orbit of two hundred memories.", effects: r##"{"color":"#ffcf5a","spinIdle":1.8,"spinWork":6,"nodes":200}"## },
    Official { id: "royal-jacket", name: "Royal Jacket", part: "ark-jacket", rarity: "legendary", blurb: "Purple velvet, gold trim, worn with pride.", effects: r##"{"color":"#5b2a86","trim":"#ffcf5a","sway":0.8}"## },
    Official { id: "nebula-aura", name: "Nebula Aura", part: "star-aura", rarity: "mythical", blurb: "A whole galaxy swirling at full speed.", effects: r##"{"color":"#c25cf0","count":120,"speed":4}"## },
    Official { id: "phoenix-jacket", name: "Phoenix Jacket", part: "ark-jacket", rarity: "mythical", blurb: "Fire red and gold, never still.", effects: r##"{"color":"#e2252f","trim":"#ffcf5a","sway":2}"## },
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_official_item_is_valid_and_rated() {
        for o in OFFICIAL {
            let effects: std::collections::BTreeMap<String, serde_json::Value> = serde_json::from_str(o.effects).expect(o.id);
            let worn = super::super::parts::check_effects(&super::super::parts::WornPart { part: o.part.into(), effects: effects.clone(), item: None }).expect(o.id);
            assert_eq!(worn.effects.len(), effects.len(), "{}: every effect is in its part's schema and range", o.id);
            assert!(super::super::rarity::get(o.rarity).is_some(), "{}", o.id);
        }
        for r in super::super::rarity::RARITIES {
            assert!(OFFICIAL.iter().any(|o| o.rarity == r.id), "the collection has a {} item", r.id);
        }
    }
}
