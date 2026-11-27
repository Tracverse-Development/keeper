//! The starter keepers (`desk:KeeperTemplate`): six ready-made keepers a person can add in one press
//! from the Studio's Marketplace (Keepers), each a body, a role, a soul and a starter piece from its
//! own first set, so it looks dressed on day one. Names are the founder's to change (plan D1).

use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Starter {
    pub id: &'static str,
    pub name: &'static str,
    pub skin: &'static str,
    pub role: &'static str,
    pub soul: &'static str,
    /// The official item it starts wearing (`collection`).
    pub piece: &'static str,
    pub blurb: &'static str,
}

pub const STARTERS: &[Starter] = &[
    Starter { id: "bolt", name: "Bolt", skin: "robot", role: "system", soul: "steady", piece: "welders-visor", blurb: "The pearl robot, a steady hand with your computer." },
    Starter { id: "biscuit", name: "Biscuit", skin: "puppy", role: "companion", soul: "sunny-pup", piece: "park-bandana", blurb: "A bouncy dog who cheers every small win." },
    Starter { id: "malik", name: "Malik", skin: "man", role: "assistant", soul: "island-vibes", piece: "linen-shirt", blurb: "Island warmth and a quick joke, on your side all day." },
    Starter { id: "amara", name: "Amara", skin: "woman", role: "researcher", soul: "steady", piece: "headwrap", blurb: "A calm researcher who finds the answer and shows her sources." },
    Starter { id: "sage", name: "Sage", skin: "owl", role: "tutor", soul: "wise-owl", piece: "owl-spectacles", blurb: "A patient owl who teaches until it clicks." },
    Starter { id: "seraph", name: "Seraph", skin: "god", role: "assistant", soul: "radiant", piece: "sunstep-sandals", blurb: "The God Keeper: a sovereign of light who wears anything from any race." },
];

pub fn get(id: &str) -> Option<&'static Starter> {
    STARTERS.iter().find(|s| s.id == id)
}

#[cfg(test)]
mod tests {
    #[test]
    fn every_starter_is_a_real_body_role_soul_and_a_piece_it_can_wear() {
        let souls = super::super::souls::builtin();
        for s in super::STARTERS {
            assert!(super::super::species::get(s.skin).is_some(), "{}", s.id);
            assert!(super::super::roles::exists(s.role), "{}", s.id);
            assert!(souls.iter().any(|x| x.id == s.soul), "{}: soul {}", s.id, s.soul);
            let piece = super::super::collection::get(s.piece).unwrap_or_else(|| panic!("{}: piece {}", s.id, s.piece));
            let worn = super::super::parts::WornPart { part: piece.part.into(), effects: Default::default(), item: Some(format!("official:{}", piece.id)), rarity: None, set: None };
            assert!(super::super::parts::check(&worn, s.skin).is_ok(), "{} can wear {}", s.id, s.piece);
        }
    }
}
