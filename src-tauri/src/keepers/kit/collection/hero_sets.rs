//! The 0.16.0 sets: one new themed set for each of the six keepers, each with its own bonus and
//! reward, and each built round two new set pieces drawn for close looks (`parts.rs`, the window's
//! `set-parts.ts`): Harbour Watch (the dog), Clockwork (the owl), Test Match (the man), Sky Pilot
//! (the woman), Ark Sentinel (the robot) and Good Shepherd (the God Keeper). Plain data over the
//! shape kits; see `collection/mod.rs`.

use super::{ItemSet, Official};

pub const SETS: &[ItemSet] = &[
    ItemSet { id: "harbour-watch", name: "Harbour Watch", who: &["puppy"], theme: "The ark's ship dog on the evening watch: navy wool, brass buttons and the harbour lights.", bonus: "Full set: Lighthouse Sweep while thinking.", reward: "lighthouse-sweep" },
    ItemSet { id: "clockwork", name: "Clockwork", who: &["owl"], theme: "The clockmaker owl: a silk top hat, a loupe at the eye and gears that keep perfect time.", bonus: "Full set: Gear Orbit while thinking.", reward: "gear-orbit" },
    ItemSet { id: "test-match", name: "Test Match", who: &["man"], theme: "Five days in whites: a willow bat, a baggy cap and the walk out to the middle.", bonus: "Full set: Six! on every celebration.", reward: "six-fireworks" },
    ItemSet { id: "sky-pilot", name: "Sky Pilot", who: &["woman"], theme: "A pioneer of the air: leather helmet, brass goggles and a silk scarf in the slipstream.", bonus: "Full set: Contrail while thinking.", reward: "contrail" },
    ItemSet { id: "ark-sentinel", name: "Ark Sentinel", who: &["robot"], theme: "The steady guardian of your computer: enamelled plate, a kite shield and the ark in light.", bonus: "Full set: Shield Pulse while thinking.", reward: "shield-pulse" },
    ItemSet { id: "good-shepherd", name: "Good Shepherd", who: &["divine"], theme: "Green pastures and still waters: a shepherd's crook, a stole of white and gold, an olive wreath.", bonus: "Full set: Lilies of the Field on every celebration.", reward: "lilies-of-the-field" },
];

pub const ITEMS: &[Official] = &[
    // Harbour Watch (the dog).
    Official { id: "harbour-collar", name: "Harbour Collar", part: "sailor-collar", rarity: "common", blurb: "A navy sailor collar with cream stripes and a gold neckerchief.", effects: r##"{"color":"#151c33","trim":"#f4eee2","knot":"#d39744","sway":1}"##, set: "harbour-watch" },
    Official { id: "skipper-cap", name: "Skipper Cap", part: "crew-cap", rarity: "common", blurb: "A navy cap with a gold brim for the deck.", effects: r##"{"color":"#151c33","trim":"#d39744"}"##, set: "harbour-watch" },
    Official { id: "deck-booties", name: "Deck Booties", part: "shoes", rarity: "uncommon", blurb: "Grippy cream booties for a wet deck.", effects: r##"{"color":"#f4eee2","trim":"#151c33","style":6}"##, set: "harbour-watch" },
    Official { id: "watch-coat", name: "Watch Coat", part: "pea-coat", rarity: "legendary", blurb: "Heavy navy wool, double-breasted, anchor buttons in gold.", effects: r##"{"color":"#1e2848","trim":"#d39744","sway":0.8}"##, set: "harbour-watch" },
    Official { id: "lighthouse-sweep", name: "Lighthouse Sweep", part: "think-beacon", rarity: "legendary", blurb: "A warm lighthouse beam sweeps round while it thinks. Set reward.", effects: r##"{"color":"#ffcf5a","intensity":1.4}"##, set: "harbour-watch" },
    // Clockwork (the owl).
    Official { id: "brass-loupe", name: "Brass Loupe", part: "gear-loupe", rarity: "common", blurb: "A clockmaker's loupe with a flip-up second lens. Starter piece.", effects: r##"{"color":"#d39744","lens":"#bfe6ff","shine":0.7}"##, set: "clockwork" },
    Official { id: "silk-cravat", name: "Silk Cravat", part: "neckwear", rarity: "uncommon", blurb: "A wine-red silk cravat with tiny gold dots.", effects: r##"{"color":"#7a1f3d","trim":"#d39744","sway":0.4,"style":1}"##, set: "clockwork" },
    Official { id: "horologist-waistcoat", name: "Horologist Waistcoat", part: "top", rarity: "rare", blurb: "A navy waistcoat with brass buttons.", effects: r##"{"color":"#1e2848","trim":"#d39744","glow":0,"style":6}"##, set: "clockwork" },
    Official { id: "clockwork-top-hat", name: "Clockwork Top Hat", part: "top-hat", rarity: "legendary", blurb: "Navy silk, a wine band and brass gears that turn as it works.", effects: r##"{"color":"#151c33","trim":"#7a1f3d","metal":"#d39744"}"##, set: "clockwork" },
    Official { id: "gear-orbit", name: "Gear Orbit", part: "think-orbit", rarity: "legendary", blurb: "Brass gears orbit the owl while it thinks. Set reward.", effects: r##"{"color":"#e3b06a","intensity":1.3}"##, set: "clockwork" },
    // Test Match (the man).
    Official { id: "baggy-cap", name: "Baggy Cap", part: "crew-cap", rarity: "common", blurb: "The navy baggy cap, worn in with pride.", effects: r##"{"color":"#151c33","trim":"#d39744"}"##, set: "test-match" },
    Official { id: "cable-knit-jumper", name: "Cable-knit Jumper", part: "top", rarity: "uncommon", blurb: "Cream cable knit with navy and gold at the neck.", effects: r##"{"color":"#ece4d2","trim":"#151c33","glow":0,"style":3}"##, set: "test-match" },
    Official { id: "spiked-whites", name: "Spiked Whites", part: "shoes", rarity: "uncommon", blurb: "White batting shoes with a navy sole.", effects: r##"{"color":"#fbf8f2","trim":"#151c33","style":0}"##, set: "test-match" },
    Official { id: "batting-whites-set", name: "Batting Whites", part: "batting-whites", rarity: "rare", blurb: "Cream whites and ribbed leg guards, buckled on.", effects: r##"{"color":"#ebe3d0","trim":"#151c33","pad":"#f3eee3"}"##, set: "test-match" },
    Official { id: "willow-bat", name: "Willow Bat", part: "cricket-bat", rarity: "legendary", blurb: "English willow, a navy grip and a gold maker's badge.", effects: r##"{"color":"#e8cf9a","trim":"#151c33"}"##, set: "test-match" },
    Official { id: "six-fireworks", name: "Six!", part: "cheer-fireworks", rarity: "legendary", blurb: "Gold fireworks for a ball over the rope. Set reward.", effects: r##"{"color":"#ffcf5a","intensity":1.6}"##, set: "test-match" },
    // Sky Pilot (the woman).
    Official { id: "silk-flying-scarf", name: "Silk Flying Scarf", part: "knit-scarf", rarity: "common", blurb: "A long cream scarf with a gold stripe. Starter piece.", effects: r##"{"color":"#f4eee2","stripe":"#d39744","sway":1.6}"##, set: "sky-pilot" },
    Official { id: "aviator-helmet", name: "Aviator Helmet", part: "flight-cap", rarity: "uncommon", blurb: "Soft brown leather and a fleece edge.", effects: r##"{"color":"#8a5530","trim":"#f4eee2","wear":0.5}"##, set: "sky-pilot" },
    Official { id: "flying-boots", name: "Flying Boots", part: "shoes", rarity: "uncommon", blurb: "Tall laced boots for a cold cockpit.", effects: r##"{"color":"#7a4e28","trim":"#151c33","style":2}"##, set: "sky-pilot" },
    Official { id: "brass-goggles", name: "Brass Goggles", part: "flight-goggles", rarity: "rare", blurb: "Brass rims, padded cups and sky-blue glass.", effects: r##"{"color":"#d39744","trim":"#5a3a1a","lens":"#8fd0e8","shine":0.8}"##, set: "sky-pilot" },
    Official { id: "flight-jacket", name: "Flight Jacket", part: "ranger-jacket", rarity: "legendary", blurb: "A worn leather flight jacket, a gold wing badge glowing on the shoulder.", effects: r##"{"color":"#6a3e22","trim":"#d39744","light":"#ffcf5a","glow":0.8,"wear":0.7}"##, set: "sky-pilot" },
    Official { id: "contrail", name: "Contrail", part: "think-comet", rarity: "legendary", blurb: "A white contrail loops the keeper while she thinks. Set reward.", effects: r##"{"color":"#f4eee2","intensity":1.3}"##, set: "sky-pilot" },
    // Ark Sentinel (the robot).
    Official { id: "ward-ring", name: "Ward Ring", part: "emblem-halo", rarity: "common", blurb: "A ring of small gold wards turning overhead. Starter piece.", effects: r##"{"color":"#d39744","glow":0.7,"speed":0.6,"style":0}"##, set: "ark-sentinel" },
    Official { id: "bastion-ring", name: "Bastion Ring", part: "platform", rarity: "uncommon", blurb: "A navy ring with a gold glow to stand guard on.", effects: r##"{"color":"#151c33","trim":"#ffcf5a","glow":0.5,"style":0}"##, set: "ark-sentinel" },
    Official { id: "sentinel-plate-armour", name: "Sentinel Plate", part: "sentinel-plate", rarity: "legendary", blurb: "Navy enamel, gilt edges and a glowing ark crest.", effects: r##"{"color":"#1e2848","trim":"#d39744","light":"#ffcf5a","glow":1}"##, set: "ark-sentinel" },
    Official { id: "ark-kite-shield", name: "Ark Kite Shield", part: "kite-shield", rarity: "legendary", blurb: "The ark and its waves in gold light on a navy field.", effects: r##"{"color":"#151c33","trim":"#d39744","light":"#ffcf5a","glow":1.2}"##, set: "ark-sentinel" },
    Official { id: "shield-pulse", name: "Shield Pulse", part: "think-pulse", rarity: "legendary", blurb: "A gold shield of light pulses round it while it thinks. Set reward.", effects: r##"{"color":"#ffcf5a","intensity":1.4}"##, set: "ark-sentinel" },
    // Good Shepherd (the God Keeper).
    Official { id: "olive-wreath", name: "Olive Wreath", part: "crown", rarity: "common", blurb: "A wreath of olive leaves in soft gold.", effects: r##"{"color":"#9ab06a","trim":"#d39744","glow":0.3,"style":1}"##, set: "good-shepherd" },
    Official { id: "pilgrim-sandals", name: "Pilgrim Sandals", part: "shoes", rarity: "uncommon", blurb: "Plain leather sandals for a long road.", effects: r##"{"color":"#9a6a3a","trim":"#5a3a1a","style":4}"##, set: "good-shepherd" },
    Official { id: "still-waters", name: "Still Waters", part: "platform", rarity: "rare", blurb: "Quiet water under the keeper, lit gold.", effects: r##"{"color":"#3f8fbf","trim":"#fff2c0","glow":0.5,"style":4}"##, set: "good-shepherd" },
    Official { id: "shepherd-stole", name: "Shepherd's Stole", part: "stole", rarity: "legendary", blurb: "White cloth, gold borders and a fringe that sways.", effects: r##"{"color":"#f4eee2","trim":"#d39744","sway":1}"##, set: "good-shepherd" },
    Official { id: "good-shepherd-crook", name: "Good Shepherd's Crook", part: "shepherd-crook", rarity: "mythical", blurb: "Olive wood and gold, a light resting in the curl.", effects: r##"{"color":"#8a6a48","trim":"#d39744","glow":1}"##, set: "good-shepherd" },
    Official { id: "lilies-of-the-field", name: "Lilies of the Field", part: "cheer-petals", rarity: "mythical", blurb: "White lily petals fall all round the keeper. Set reward.", effects: r##"{"color":"#fff6e0","intensity":1.6}"##, set: "good-shepherd" },
];

#[cfg(test)]
mod tests {
    use super::super::super::parts::{check, check_outfit, WornPart};
    use super::super::super::species::SPECIES;
    use super::{ITEMS, SETS};

    fn worn(o: &super::Official) -> WornPart {
        // Built from JSON (not a struct literal) so it reads the same whatever fields WornPart grows.
        let effects: serde_json::Value = serde_json::from_str(o.effects).unwrap();
        serde_json::from_value(serde_json::json!({ "part": o.part, "effects": effects, "item": format!("official:{}", o.id) })).unwrap()
    }

    /// The keeper each set is made for (the species its `who` names, or the God Keeper's).
    fn keeper_of(set: &str) -> &'static str {
        let who = SETS.iter().find(|s| s.id == set).unwrap().who[0];
        if who == "divine" { "god" } else { who }
    }

    #[test]
    fn every_keeper_has_a_new_set_it_wears_whole() {
        for species in SPECIES {
            let set = SETS.iter().find(|s| keeper_of(s.id) == species.id).unwrap_or_else(|| panic!("{} has a new set", species.id));
            let pieces: Vec<_> = ITEMS.iter().filter(|o| o.set == set.id).collect();
            assert!((4..=7).contains(&pieces.len()), "{}: {} pieces", set.id, pieces.len());
            let outfit: Vec<_> = pieces.iter().map(|o| worn(o)).collect();
            assert_eq!(check_outfit(&outfit, species.id).expect(set.id).len(), pieces.len(), "{}: the {} wears every piece at once", set.id, species.id);
        }
    }

    #[test]
    fn each_set_is_built_round_new_set_pieces() {
        const NEW: &[&str] = &["sailor-collar", "pea-coat", "top-hat", "gear-loupe", "batting-whites", "cricket-bat", "flight-cap", "flight-goggles", "sentinel-plate", "kite-shield", "shepherd-crook", "stole"];
        for set in SETS {
            let new = ITEMS.iter().filter(|o| o.set == set.id && NEW.contains(&o.part)).count();
            assert!(new >= 2, "{} has {} new pieces", set.id, new);
        }
        for part in NEW {
            assert!(ITEMS.iter().any(|o| o.part == *part), "{part} is in a set");
        }
    }

    #[test]
    fn a_new_set_stays_on_its_own_body_and_the_god_keeper_wears_them_all() {
        for set in SETS {
            let owner = keeper_of(set.id);
            for o in ITEMS.iter().filter(|o| o.set == set.id) {
                assert!(check(&worn(o), "god").is_ok(), "the God Keeper wears {}", o.id);
                for other in SPECIES.iter().filter(|s| s.id != owner && s.id != "god") {
                    assert!(check(&worn(o), other.id).is_err(), "{} ({}) is not for the {}", o.id, set.id, other.id);
                }
            }
        }
    }
}
