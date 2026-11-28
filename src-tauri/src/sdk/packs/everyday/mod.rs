//! Everyday sums and conversions, the same on every system and with no network: `calculate`
//! (`maths`: arithmetic, percentages, square roots) and `convert` (`units`: length, weight,
//! volume, temperature, speed, area, data, time). Exact answers, so the keeper never guesses.

pub mod maths;
pub mod units;

use super::super::{input, Ability, Access, Done, Instant, ALL};
use crate::kernel::{DeskError, Result};

pub const ABILITIES: &[Ability] = &[
    Ability { id: "calculate", how: "{\"sum\": \"15% of 80 + 2^3\"} works out a sum exactly (+ - * / ^, brackets, %, sqrt)", access: Access::Memory, platforms: ALL, modes: &["assistant", "researcher", "companion"], instant: Instant::No, run: |input, _| Box::pin(async move { calculate(input) }) },
    Ability { id: "convert", how: "{\"value\": 5, \"from\": \"km\", \"to\": \"miles\"} converts length, weight, cooking volume, temperature, speed, area, data or time (not money)", access: Access::Memory, platforms: ALL, modes: &["assistant", "researcher", "companion"], instant: Instant::No, run: |input, _| Box::pin(async move { convert(input) }) },
];

fn calculate(input: &serde_json::Value) -> Result<Done> {
    let sum = input::text(input, "sum")?;
    let value = maths::evaluate(sum).map_err(DeskError::Invalid)?;
    Ok(Done::said(format!("{sum} = {}", maths::shown(value))))
}

fn convert(input: &serde_json::Value) -> Result<Done> {
    let value = input["value"].as_f64().or_else(|| input::optional(input, "value").and_then(|v| maths::evaluate(v).ok())).ok_or_else(|| DeskError::Invalid("That needs a value to convert.".into()))?;
    let (result, from, to) = units::convert(value, input::text(input, "from")?, input::text(input, "to")?).map_err(DeskError::Invalid)?;
    let result = round_for_show(result);
    Ok(Done::said(format!("{} {} is {} {}.", maths::shown(value), counted_unit(value, from), maths::shown(result), counted_unit(result, to))))
}

/// A unit as said after its amount: the word units (cups, days, weeks, acres, hectares, knots)
/// lose their "s" for exactly one ("1 cup", "2.113 cups"); symbols (ml, km, °C) never change.
fn counted_unit(amount: f64, unit: &'static str) -> &'static str {
    const WORDS: [(&str, &str); 6] = [("cups", "cup"), ("days", "day"), ("weeks", "week"), ("acres", "acre"), ("hectares", "hectare"), ("knots", "knot")];
    match WORDS.iter().find(|(many, _)| *many == unit) {
        Some((_, one)) if amount == 1.0 => one,
        _ => unit,
    }
}

/// Four significant decimals is what a person wants from a conversion (3.1069 miles, not 3.106855961).
fn round_for_show(value: f64) -> f64 {
    if value == 0.0 || value.abs() >= 1e15 {
        return value;
    }
    let places = (4 - value.abs().log10().floor() as i32 - 1).clamp(0, 12);
    let factor = 10f64.powi(places);
    (value * factor).round() / factor
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    // FIX-0048: "500 ml is 2.113 cup".
    #[test]
    fn word_units_are_counted_and_symbols_never_change() {
        assert_eq!(super::counted_unit(2.113, "cups"), "cups");
        assert_eq!(super::counted_unit(1.0, "cups"), "cup");
        assert_eq!(super::counted_unit(1.0, "days"), "day");
        assert_eq!(super::counted_unit(1.0, "ml"), "ml");
    }

    use super::*;

    #[test]
    fn sums_and_conversions_answer_in_a_sentence() {
        assert_eq!(calculate(&json!({ "sum": "2 * (3 + 4)" })).unwrap().summary, "2 * (3 + 4) = 14");
        assert_eq!(convert(&json!({ "value": 5, "from": "km", "to": "miles" })).unwrap().summary, "5 km is 3.107 mi.");
        assert_eq!(convert(&json!({ "value": "100", "from": "c", "to": "f" })).unwrap().summary, "100 °C is 212 °F.");
        assert_eq!(convert(&json!({ "value": 1500, "from": "m", "to": "km" })).unwrap().summary, "1,500 m is 1.5 km.");
        assert!(convert(&json!({ "from": "km", "to": "mi" })).is_err());
        assert!(calculate(&json!({ "sum": "open the pod bay doors" })).is_err());
    }
}
