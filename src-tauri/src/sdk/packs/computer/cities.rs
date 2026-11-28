//! Places a person names when they ask the time somewhere ("Tokyo", "Trinidad", "London"),
//! mapped to their IANA time zone. Pure data; a zone name itself ("Europe/Paris") is also taken.

/// (lowercase place, IANA zone). Cities first, then countries and regions with one zone.
const PLACES: &[(&str, &str)] = &[
    ("port of spain", "America/Port_of_Spain"), ("trinidad", "America/Port_of_Spain"), ("tobago", "America/Port_of_Spain"), ("trinidad and tobago", "America/Port_of_Spain"),
    ("kingston", "America/Jamaica"), ("jamaica", "America/Jamaica"), ("barbados", "America/Barbados"), ("bridgetown", "America/Barbados"),
    ("nassau", "America/Nassau"), ("bahamas", "America/Nassau"), ("georgetown", "America/Guyana"), ("guyana", "America/Guyana"),
    ("santo domingo", "America/Santo_Domingo"), ("san juan", "America/Puerto_Rico"), ("puerto rico", "America/Puerto_Rico"), ("havana", "America/Havana"),
    ("new york", "America/New_York"), ("boston", "America/New_York"), ("springfield", "America/New_York"), ("washington", "America/New_York"),
    ("miami", "America/New_York"), ("atlanta", "America/New_York"), ("toronto", "America/Toronto"), ("montreal", "America/Toronto"),
    ("chicago", "America/Chicago"), ("houston", "America/Chicago"), ("dallas", "America/Chicago"), ("mexico city", "America/Mexico_City"),
    ("denver", "America/Denver"), ("phoenix", "America/Phoenix"), ("los angeles", "America/Los_Angeles"), ("san francisco", "America/Los_Angeles"),
    ("seattle", "America/Los_Angeles"), ("vancouver", "America/Vancouver"), ("anchorage", "America/Anchorage"), ("honolulu", "Pacific/Honolulu"), ("hawaii", "Pacific/Honolulu"),
    ("bogota", "America/Bogota"), ("lima", "America/Lima"), ("caracas", "America/Caracas"), ("santiago", "America/Santiago"),
    ("buenos aires", "America/Argentina/Buenos_Aires"), ("sao paulo", "America/Sao_Paulo"), ("rio de janeiro", "America/Sao_Paulo"),
    ("london", "Europe/London"), ("uk", "Europe/London"), ("england", "Europe/London"), ("dublin", "Europe/Dublin"), ("ireland", "Europe/Dublin"),
    ("lisbon", "Europe/Lisbon"), ("madrid", "Europe/Madrid"), ("spain", "Europe/Madrid"), ("paris", "Europe/Paris"), ("france", "Europe/Paris"),
    ("amsterdam", "Europe/Amsterdam"), ("brussels", "Europe/Brussels"), ("berlin", "Europe/Berlin"), ("germany", "Europe/Berlin"),
    ("zurich", "Europe/Zurich"), ("rome", "Europe/Rome"), ("italy", "Europe/Rome"), ("stockholm", "Europe/Stockholm"), ("oslo", "Europe/Oslo"),
    ("warsaw", "Europe/Warsaw"), ("athens", "Europe/Athens"), ("istanbul", "Europe/Istanbul"), ("kyiv", "Europe/Kyiv"), ("moscow", "Europe/Moscow"),
    ("lagos", "Africa/Lagos"), ("nigeria", "Africa/Lagos"), ("accra", "Africa/Accra"), ("ghana", "Africa/Accra"), ("cairo", "Africa/Cairo"), ("egypt", "Africa/Cairo"),
    ("nairobi", "Africa/Nairobi"), ("kenya", "Africa/Nairobi"), ("johannesburg", "Africa/Johannesburg"), ("cape town", "Africa/Johannesburg"), ("south africa", "Africa/Johannesburg"),
    ("addis ababa", "Africa/Addis_Ababa"), ("jerusalem", "Asia/Jerusalem"), ("israel", "Asia/Jerusalem"), ("dubai", "Asia/Dubai"), ("riyadh", "Asia/Riyadh"),
    ("tehran", "Asia/Tehran"), ("karachi", "Asia/Karachi"), ("delhi", "Asia/Kolkata"), ("new delhi", "Asia/Kolkata"), ("mumbai", "Asia/Kolkata"), ("india", "Asia/Kolkata"),
    ("kathmandu", "Asia/Kathmandu"), ("dhaka", "Asia/Dhaka"), ("bangkok", "Asia/Bangkok"), ("jakarta", "Asia/Jakarta"), ("singapore", "Asia/Singapore"),
    ("kuala lumpur", "Asia/Kuala_Lumpur"), ("manila", "Asia/Manila"), ("philippines", "Asia/Manila"), ("hong kong", "Asia/Hong_Kong"), ("beijing", "Asia/Shanghai"),
    ("shanghai", "Asia/Shanghai"), ("china", "Asia/Shanghai"), ("taipei", "Asia/Taipei"), ("seoul", "Asia/Seoul"), ("korea", "Asia/Seoul"),
    ("tokyo", "Asia/Tokyo"), ("japan", "Asia/Tokyo"), ("perth", "Australia/Perth"), ("adelaide", "Australia/Adelaide"), ("brisbane", "Australia/Brisbane"),
    ("sydney", "Australia/Sydney"), ("melbourne", "Australia/Melbourne"), ("auckland", "Pacific/Auckland"), ("new zealand", "Pacific/Auckland"), ("fiji", "Pacific/Fiji"),
    ("utc", "UTC"), ("gmt", "UTC"),
];

/// The zone for what the person said: a place in the list (any case, "the" and punctuation
/// ignored), or an IANA name as given ("Europe/Paris"; the platform checks it exists).
pub fn zone_for(place: &str) -> Option<String> {
    let said = place.trim().trim_end_matches(['?', '.', '!']).trim();
    if said.contains('/') {
        return Some(said.to_string());
    }
    let key = said.to_lowercase();
    let key = key.strip_prefix("the ").unwrap_or(&key).replace(['.', ','], "");
    PLACES.iter().find(|(name, _)| *name == key).map(|(_, zone)| zone.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn places_find_their_zone() {
        assert_eq!(zone_for("Tokyo").as_deref(), Some("Asia/Tokyo"));
        assert_eq!(zone_for("  port of spain? ").as_deref(), Some("America/Port_of_Spain"));
        assert_eq!(zone_for("the UK").as_deref(), Some("Europe/London"));
        assert_eq!(zone_for("Europe/Paris").as_deref(), Some("Europe/Paris"));
        assert_eq!(zone_for("Atlantis"), None);
    }

    #[test]
    fn every_place_is_lowercase_and_named_once() {
        let mut seen = std::collections::HashSet::new();
        for (name, zone) in PLACES {
            assert!(name.chars().all(|c| c.is_lowercase() || c == ' ') && seen.insert(*name), "{name}");
            assert!(zone.contains('/') || *zone == "UTC", "{zone}");
        }
    }

    #[cfg(target_os = "macos")]
    #[tokio::test]
    async fn every_zone_is_one_this_mac_knows() {
        let zones: std::collections::HashSet<&str> = PLACES.iter().map(|(_, z)| *z).collect();
        for zone in zones {
            assert!(crate::platform::time_in_zone(zone).await.is_ok(), "{zone}");
        }
    }
}
