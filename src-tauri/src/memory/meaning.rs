//! What a fact or a question is ABOUT, beyond its exact words, worked out on this computer with
//! no model: so "who should I call for family news?" finds "Your sister is Maya", though they
//! share no word.
//!
//! Two things, both pure and tested:
//! - CONCEPTS: everyday areas of a life (family, home, work, food, health, contact…), each a
//!   list of the words people use for it. A text touches a concept when it holds one of its
//!   words; a question and a fact that touch the same concept are related.
//! - SLOTS: the facts of which a person has only ONE at a time (where they live, their job,
//!   their phone number, a favourite). A newer fact in the same slot replaces the older one
//!   (`Memory::replace_stale`). Only a fixed list of single-valued things is a slot: a person
//!   has many friends, so "Your friend is Sam" never replaces "Your friend is Lee".
//!
//! Topic words the mind adds when it learns a fact (`Fact::topics`) widen this further; the
//! concepts are what makes it work for facts learned before that, and with any engine.

/// A concept and the words that mean it (lower case; a word matches as a whole word or as the
/// start of one, so "sister" matches "sisters").
pub const CONCEPTS: &[(&str, &[&str])] = &[
    ("family", &["family", "relative", "sister", "brother", "sibling", "mother", "mom", "mum", "mama", "father", "dad", "papa", "parent", "wife", "husband", "spouse", "partner", "married", "son", "daughter", "child", "kid", "baby", "aunt", "uncle", "cousin", "niece", "nephew", "grandmother", "grandfather", "grandma", "grandpa", "granny", "in-law"]),
    ("friends", &["friend", "buddy", "pal", "neighbour", "neighbor", "colleague", "coworker", "roommate", "classmate"]),
    ("pets", &["pet", "dog", "puppy", "cat", "kitten", "bird", "fish", "rabbit", "hamster", "horse", "vet"]),
    ("home", &["home", "house", "apartment", "flat", "live", "lives", "living", "moved", "moving", "address", "street", "city", "town", "village", "country", "neighbourhood", "neighborhood", "rent", "landlord"]),
    ("work", &["work", "job", "career", "boss", "manager", "office", "company", "business", "employer", "client", "customer", "salary", "profession", "colleague", "coworker", "shift", "meeting", "project"]),
    ("food", &["food", "eat", "eats", "meal", "breakfast", "lunch", "dinner", "snack", "drink", "coffee", "tea", "cook", "cooking", "recipe", "restaurant", "vegetarian", "vegan", "allergic", "allergy", "hungry", "taste", "dish"]),
    ("health", &["health", "doctor", "medicine", "medication", "pill", "allergy", "allergic", "sick", "ill", "hospital", "dentist", "therapy", "therapist", "diagnos", "injur", "sleep", "exercise", "gym", "diet", "weight"]),
    ("contact", &["contact", "call", "phone", "telephone", "mobile", "email", "message", "reach", "whatsapp"]),
    ("dates", &["birthday", "born", "anniversary", "age", "old", "date", "holiday", "christmas", "easter", "wedding", "graduation"]),
    ("schedule", &["schedule", "appointment", "every", "weekly", "daily", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "morning", "evening", "routine", "class", "practice", "plan", "busy", "free"]),
    ("money", &["money", "bank", "account", "budget", "pay", "paid", "bill", "rent", "loan", "debt", "saving", "price", "cost", "afford", "tax"]),
    ("learning", &["school", "college", "university", "study", "studies", "studying", "student", "teacher", "course", "class", "exam", "degree", "learn", "lesson", "homework", "subject"]),
    ("fun", &["hobby", "hobbies", "fun", "play", "plays", "sport", "game", "music", "song", "band", "movie", "film", "show", "book", "read", "reading", "travel", "trip", "holiday", "weekend", "relax", "watch"]),
    ("faith", &["church", "pastor", "pray", "prayer", "bible", "faith", "worship", "sermon", "god"]),
    ("likes", &["favourite", "favorite", "like", "likes", "liked", "love", "loves", "loved", "prefer", "prefers", "enjoy", "enjoys", "hate", "hates", "dislike", "dislikes", "fan"]),
    ("name", &["name", "named", "called", "nickname"]),
    ("travel", &["car", "drive", "drives", "bus", "train", "flight", "fly", "airport", "commute", "bike", "trip", "travel", "passport"]),
];

/// The lower-case words of a text (letters and digits; possessive 's dropped).
pub fn words(text: &str) -> Vec<String> {
    text.to_lowercase().split(|c: char| !c.is_alphanumeric() && c != '\'' && c != '-').map(|w| w.trim_matches('\'').trim_end_matches("'s").to_string()).filter(|w| w.len() >= 2).collect()
}

/// The word itself, or it with an ordinary ending ("sisters", "calling", "injury"): never a
/// longer word that merely starts the same ("planet" is not "plan", "card" is not "car").
fn means(word: &str, concept_word: &str) -> bool {
    let Some(ending) = word.strip_prefix(concept_word) else { return false };
    match ending {
        "" | "s" | "es" | "ing" | "ed" | "er" | "ers" => true,
        // Short endings only on longer words and stems ("injur-y", "diagnos-is", "move-d").
        "d" | "y" | "is" | "ies" => concept_word.len() >= 5,
        _ => false,
    }
}

/// The concepts a text touches, in the order of `CONCEPTS`, each once.
pub fn concepts(text: &str) -> Vec<&'static str> {
    let w = words(text);
    CONCEPTS.iter().filter(|(_, list)| w.iter().any(|word| list.iter().any(|c| means(word, c)))).map(|(name, _)| *name).collect()
}

/// A fact's category as a concept ("person" facts are about family and friends, and so on),
/// so a fact filed by the mind is found by its area even when its words are unusual.
pub fn concepts_of_category(category: &str) -> &'static [&'static str] {
    match category {
        "person" => &["family", "friends", "pets"],
        "place" => &["home"],
        "health" => &["health"],
        "schedule" => &["schedule", "dates"],
        "preference" => &["likes"],
        "identity" => &["name"],
        _ => &[],
    }
}

/// Things a person has exactly one of, and that a newer statement truly replaces: what Keeper
/// replaces BY ITSELF (`slot`). Kept narrow on purpose (review finding: a broad list erased
/// "Your car is a blue Corolla" when told "Your car is in the shop").
const ONLY_ONE: &[&str] = &["name", "full name", "first name", "last name", "surname", "address", "home address", "phone number", "mobile number", "cell number", "email", "email address", "birthday", "date of birth", "time zone", "timezone", "blood type"];

/// Things a person USUALLY has one of: a newer one is only SUGGESTED as replacing an older one
/// ("tidy my memory", `likely_slot`), never erased without the person saying so.
const USUALLY_ONE: &[&str] = &["nickname", "home", "city", "town", "country", "job", "job title", "title", "occupation", "profession", "employer", "company", "workplace", "boss", "manager", "wife", "husband", "spouse", "partner", "age", "phone", "number", "doctor", "dentist", "landlord", "school", "car", "height", "weight", "shoe size", "anniversary"];

/// The rest of a "your X is …" fact: the thing and its value.
fn your_thing(t: &str) -> Option<(&str, &str)> {
    let rest = t.strip_prefix("your ")?;
    let (thing, value) = rest.split_once(" is ")?;
    Some((thing.trim(), value.trim()))
}

/// The slot a fact fills when a newer fact in the same slot certainly REPLACES it, so Keeper
/// may erase the older one by itself: "Your phone number is …", "Your favourite colour is …",
/// or "You live in <Place>" naming a place (a capitalised name, a few words: "You live in fear"
/// or "You live in a small flat" are not addresses). None: the fact stands beside any other.
pub fn slot(text: &str) -> Option<String> {
    let original = text.trim().trim_end_matches('.');
    let t = original.to_lowercase();
    for start in ["you live in ", "you live at "] {
        if let Some(rest) = original.get(start.len()..).filter(|_| t.starts_with(start)) {
            let place = rest.trim();
            let named = place.chars().next().is_some_and(char::is_uppercase) && place.split_whitespace().count() <= 4;
            return named.then(|| "you live in".to_string());
        }
    }
    let (thing, value) = your_thing(&t)?;
    if value.is_empty() {
        return None;
    }
    if let Some(what) = thing.strip_prefix("favourite ").or_else(|| thing.strip_prefix("favorite ")) {
        return (!what.is_empty() && what.split_whitespace().count() <= 3).then(|| format!("your favourite {what}"));
    }
    ONLY_ONE.contains(&thing).then(|| format!("your {thing}"))
}

/// A broader guess at the slot, for SUGGESTING what may be out of date (never for erasing): the
/// certain slots, plus moving, work, and things people usually have one of.
pub fn likely_slot(text: &str) -> Option<String> {
    if let Some(s) = slot(text) {
        return Some(s);
    }
    let t = text.trim().to_lowercase();
    for (start, name) in [("you live in ", "you live in"), ("you live at ", "you live in"), ("you moved to ", "you live in"), ("you work at ", "you work at"), ("you work for ", "you work at"), ("you work as ", "you work as")] {
        if t.starts_with(start) {
            return Some(name.to_string());
        }
    }
    let (thing, _) = your_thing(&t)?;
    USUALLY_ONE.contains(&thing).then(|| format!("your {thing}"))
}

/// The facts a newer fact has made out of date: for each slot holding more than one fact (in
/// the same mode's memory), every one but the newest. `facts` are newest first, as memory
/// returns them. Only SUGGESTED to the person ("tidy my memory"), so it uses the broad guess.
pub fn outdated(facts: &[super::records::Fact]) -> Vec<&super::records::Fact> {
    let mut newest: Vec<(String, &str)> = Vec::new();
    let mut out = Vec::new();
    for f in facts {
        let Some(s) = likely_slot(&f.text) else { continue };
        if newest.iter().any(|(seen, mode)| *seen == s && *mode == f.mode) {
            out.push(f);
        } else {
            newest.push((s, &f.mode));
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_question_and_a_fact_can_share_a_concept_without_sharing_a_word() {
        assert!(concepts("Who should I call for family news?").contains(&"family"));
        assert!(concepts("Your sister is Maya").contains(&"family"));
        assert!(concepts("Who should I call for family news?").contains(&"contact"));
        assert!(concepts("Your sisters live in Arima").contains(&"family"), "plurals count");
        assert!(concepts("What should I cook tonight?").contains(&"food"));
        assert!(concepts("You are allergic to peanuts").contains(&"food") && concepts("You are allergic to peanuts").contains(&"health"));
        assert!(concepts("The capital of France is Paris").is_empty(), "no concept: only its own words count");
        assert!(!concepts("Your callback function failed").contains(&"contact"), "a longer word that merely starts the same is not it");
        assert!(concepts("The planet has a card").is_empty(), "planet is not plan, card is not car");
        assert!(concepts("You injured your knee").contains(&"health") && concepts("You moved last week").contains(&"home"));
    }

    #[test]
    fn older_facts_in_a_slot_are_out_of_date_and_nothing_else_is() {
        let fact = |t: &str| super::super::records::Fact::new(t, "general", "2026-11-25T10:00:00Z");
        // Newest first.
        let facts = vec![fact("You moved to Boston"), fact("Your sister is Maya"), fact("You live in Port of Spain"), fact("Your sister is Ayo"), fact("You live in Arima"), fact("Your favourite colour is green")];
        assert_eq!(outdated(&facts).iter().map(|f| f.text.as_str()).collect::<Vec<_>>(), vec!["You live in Port of Spain", "You live in Arima"]);
        assert!(outdated(&facts[..2]).is_empty());
    }

    #[test]
    fn only_certain_replacements_are_automatic() {
        assert_eq!(slot("You live in Port of Spain").as_deref(), Some("you live in"));
        assert_eq!(slot("Your phone number is 555-0100").as_deref(), Some("your phone number"));
        assert_eq!(slot("Your favourite colour is green").as_deref(), Some("your favourite colour"));
        assert_eq!(slot("Your favorite colour is blue"), slot("Your favourite colour is green"), "either spelling is one slot");
        // Review finding: these erased unrelated facts when the rule was broad.
        assert_eq!(slot("You moved to the night shift"), None);
        assert_eq!(slot("You work at home on Fridays"), None);
        assert_eq!(slot("Your car is in the shop"), None);
        assert_eq!(slot("Your doctor is on holiday"), None);
        assert_eq!(slot("You live in fear of spiders"), None, "not a place");
        assert_eq!(slot("You live in a small flat"), None);
        assert_eq!(slot("Your friend is Sam"), None);
        assert_eq!(slot("Your sister is Maya"), None);
        assert_eq!(slot("You like sorrel"), None);
    }

    #[test]
    fn the_broad_guess_only_suggests() {
        assert_eq!(likely_slot("You moved to Boston").as_deref(), Some("you live in"));
        assert_eq!(likely_slot("You work at Tracverse").as_deref(), Some("you work at"));
        assert_eq!(likely_slot("Your car is a blue Corolla").as_deref(), Some("your car"));
        assert_eq!(likely_slot("Your sister is Maya"), None);
    }
}
