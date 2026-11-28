//! Everyday sums and conversions, the same on every system and with no network: `calculate`
//! (`maths`: arithmetic, percentages, square roots) and `convert` (`units`: length, weight,
//! volume, temperature, speed, area, data, time). Exact answers, so the keeper never guesses.

pub mod maths;
pub mod units;

use super::super::{input, Ability, Access, Done, ALL};
use crate::kernel::{DeskError, Result};

pub const ABILITIES: &[Ability] = &[
    Ability { id: "calculate", how: "{\"sum\": \"15% of 80 + 2^3\"} works out a sum exactly (+ - * / ^, brackets, %, sqrt)", access: Access::Memory, platforms: ALL, run: |input, _| Box::pin(async move { calculate(input) }) },
    Ability { id: "convert", how: "{\"value\": 5, \"from\": \"km\", \"to\": \"miles\"} converts length, weight, cooking volume, temperature, speed, area, data or time (not money)", access: Access::Memory, platforms: ALL, run: |input, _| Box::pin(async move { convert(input) }) },
];

fn calculate(input: &serde_json::Value) -> Result<Done> {
    let sum = input::text(input, "sum")?;
    let value = maths::evaluate(sum).map_err(DeskError::Invalid)?;
    Ok(Done::said(format!("{sum} = {}", maths::shown(value))))
}

fn convert(input: &serde_json::Value) -> Result<Done> {
    let value = input["value"].as_f64().or_else(|| input::optional(input, "value").and_then(|v| maths::evaluate(v).ok())).ok_or_else(|| DeskError::Invalid("That needs a value to convert.".into()))?;
    let (result, from, to) = units::convert(value, input::text(input, "from")?, input::text(input, "to")?).map_err(DeskError::Invalid)?;
    Ok(Done::said(format!("{} {from} is {} {to}.", maths::shown(value), maths::shown(round_for_show(result)))))
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
