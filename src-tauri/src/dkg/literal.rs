//! RDF literals as the node takes and returns them in JSON: `"text"`, `"2026-…"^^<xsd:dateTime>`,
//! IRIs bare. Encoding escapes everything N-Triples needs, so a person's words can never break
//! out of a literal.

use super::ontology::XSD_DATETIME;

/// A plain string literal.
pub fn text(value: &str) -> String {
    let mut out = String::with_capacity(value.len() + 2);
    out.push('"');
    for ch in value.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04X}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

/// An `xsd:dateTime` literal.
pub fn datetime(iso: &str) -> String {
    format!("{}^^<{XSD_DATETIME}>", text(iso))
}

/// A binding value back to its plain value: literals lose quotes, escapes, datatype and
/// language tag; IRIs come back as they are.
pub fn decode(binding: &str) -> String {
    let s = binding.trim();
    if !s.starts_with('"') {
        return s.trim_start_matches('<').trim_end_matches('>').to_string();
    }
    let Some(end) = s.rfind('"').filter(|&i| i > 0) else { return s.to_string() };
    let inner = &s[1..end];
    let mut out = String::with_capacity(inner.len());
    let mut chars = inner.chars();
    while let Some(c) = chars.next() {
        if c != '\\' {
            out.push(c);
            continue;
        }
        match chars.next() {
            Some('n') => out.push('\n'),
            Some('r') => out.push('\r'),
            Some('t') => out.push('\t'),
            Some('"') => out.push('"'),
            Some('\\') => out.push('\\'),
            Some('u') => {
                let code: String = chars.by_ref().take(4).collect();
                if let Some(ch) = u32::from_str_radix(&code, 16).ok().and_then(char::from_u32) {
                    out.push(ch);
                }
            }
            Some(other) => out.push(other),
            None => {}
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_hostile_string_round_trips_inside_its_literal() {
        let nasty = "He said \"hi\" \\ then\n} . <urn:x> \"";
        assert_eq!(decode(&text(nasty)), nasty);
    }

    #[test]
    fn datatypes_and_iris_decode() {
        assert_eq!(decode(&datetime("2026-11-25T10:00:00Z")), "2026-11-25T10:00:00Z");
        assert_eq!(decode("\"bonjour\"@fr"), "bonjour");
        assert_eq!(decode("urn:umoja:desk:fact:1"), "urn:umoja:desk:fact:1");
    }
}
