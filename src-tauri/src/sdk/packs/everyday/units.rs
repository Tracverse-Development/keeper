//! Converting between units a person uses every day: length, weight, volume (US kitchen and
//! metric), temperature, speed, area, data and time. Pure data: each unit is a linear map to its
//! kind's base unit (`base = value * scale + shift`; only temperatures shift), so any two units
//! of one kind convert through the base. No money: rates change daily and need the internet.
//!
//! `convert(5.0, "km", "miles") == Ok((3.10686, "km", "mi"))` (rounded here for show)

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Kind {
    Length,
    Weight,
    Volume,
    Temperature,
    Speed,
    Area,
    Data,
    Time,
}

struct Unit {
    /// How the answer writes it.
    symbol: &'static str,
    /// Every way a person might say it (lowercase).
    names: &'static [&'static str],
    kind: Kind,
    scale: f64,
    shift: f64,
}

const fn unit(symbol: &'static str, names: &'static [&'static str], kind: Kind, scale: f64) -> Unit {
    Unit { symbol, names, kind, scale, shift: 0.0 }
}

/// Base units: metre, kilogram, litre, kelvin, metre per second, square metre, byte, second.
const UNITS: &[Unit] = &[
    unit("mm", &["mm", "millimetre", "millimetres", "millimeter", "millimeters"], Kind::Length, 0.001),
    unit("cm", &["cm", "centimetre", "centimetres", "centimeter", "centimeters"], Kind::Length, 0.01),
    unit("m", &["m", "metre", "metres", "meter", "meters"], Kind::Length, 1.0),
    unit("km", &["km", "kilometre", "kilometres", "kilometer", "kilometers"], Kind::Length, 1000.0),
    unit("in", &["in", "inch", "inches", "\""], Kind::Length, 0.0254),
    unit("ft", &["ft", "foot", "feet", "'"], Kind::Length, 0.3048),
    unit("yd", &["yd", "yard", "yards"], Kind::Length, 0.9144),
    unit("mi", &["mi", "mile", "miles"], Kind::Length, 1609.344),
    unit("mg", &["mg", "milligram", "milligrams"], Kind::Weight, 1e-6),
    unit("g", &["g", "gram", "grams", "gramme", "grammes"], Kind::Weight, 0.001),
    unit("kg", &["kg", "kilo", "kilos", "kilogram", "kilograms"], Kind::Weight, 1.0),
    unit("oz", &["oz", "ounce", "ounces"], Kind::Weight, 0.028_349_523_125),
    unit("lb", &["lb", "lbs", "pound", "pounds"], Kind::Weight, 0.453_592_37),
    unit("st", &["st", "stone", "stones"], Kind::Weight, 6.350_293_18),
    unit("t", &["t", "tonne", "tonnes", "metric ton", "metric tons"], Kind::Weight, 1000.0),
    unit("ml", &["ml", "millilitre", "millilitres", "milliliter", "milliliters"], Kind::Volume, 0.001),
    unit("l", &["l", "litre", "litres", "liter", "liters"], Kind::Volume, 1.0),
    unit("tsp", &["tsp", "teaspoon", "teaspoons"], Kind::Volume, 0.004_928_921_593_75),
    unit("tbsp", &["tbsp", "tablespoon", "tablespoons"], Kind::Volume, 0.014_786_764_781_25),
    unit("fl oz", &["fl oz", "floz", "fluid ounce", "fluid ounces"], Kind::Volume, 0.029_573_529_562_5),
    unit("cups", &["cup", "cups"], Kind::Volume, 0.236_588_236_5),
    unit("pt", &["pt", "pint", "pints"], Kind::Volume, 0.473_176_473),
    unit("qt", &["qt", "quart", "quarts"], Kind::Volume, 0.946_352_946),
    unit("gal", &["gal", "gallon", "gallons"], Kind::Volume, 3.785_411_784),
    Unit { symbol: "°C", names: &["c", "°c", "celsius", "centigrade", "degrees c", "degrees celsius"], kind: Kind::Temperature, scale: 1.0, shift: 273.15 },
    Unit { symbol: "°F", names: &["f", "°f", "fahrenheit", "degrees f", "degrees fahrenheit"], kind: Kind::Temperature, scale: 5.0 / 9.0, shift: 273.15 - 32.0 * 5.0 / 9.0 },
    unit("K", &["k", "kelvin"], Kind::Temperature, 1.0),
    unit("km/h", &["km/h", "kmh", "kph", "kilometres per hour", "kilometers per hour"], Kind::Speed, 1000.0 / 3600.0),
    unit("mph", &["mph", "miles per hour"], Kind::Speed, 1609.344 / 3600.0),
    unit("m/s", &["m/s", "metres per second", "meters per second"], Kind::Speed, 1.0),
    unit("knots", &["knot", "knots", "kn"], Kind::Speed, 1852.0 / 3600.0),
    unit("sq m", &["sq m", "m2", "m²", "square metre", "square metres", "square meter", "square meters"], Kind::Area, 1.0),
    unit("sq ft", &["sq ft", "ft2", "ft²", "square foot", "square feet"], Kind::Area, 0.092_903_04),
    unit("sq km", &["sq km", "km2", "km²", "square kilometre", "square kilometres", "square kilometer", "square kilometers"], Kind::Area, 1e6),
    unit("sq mi", &["sq mi", "mi2", "mi²", "square mile", "square miles"], Kind::Area, 2_589_988.110_336),
    unit("acres", &["acre", "acres"], Kind::Area, 4046.856_422_4),
    unit("hectares", &["ha", "hectare", "hectares"], Kind::Area, 10_000.0),
    unit("B", &["b", "byte", "bytes"], Kind::Data, 1.0),
    unit("KB", &["kb", "kilobyte", "kilobytes"], Kind::Data, 1e3),
    unit("MB", &["mb", "megabyte", "megabytes"], Kind::Data, 1e6),
    unit("GB", &["gb", "gigabyte", "gigabytes"], Kind::Data, 1e9),
    unit("TB", &["tb", "terabyte", "terabytes"], Kind::Data, 1e12),
    unit("GiB", &["gib", "gibibyte", "gibibytes"], Kind::Data, 1_073_741_824.0),
    unit("s", &["s", "sec", "secs", "second", "seconds"], Kind::Time, 1.0),
    unit("min", &["min", "mins", "minute", "minutes"], Kind::Time, 60.0),
    unit("h", &["h", "hr", "hrs", "hour", "hours"], Kind::Time, 3600.0),
    unit("days", &["day", "days"], Kind::Time, 86_400.0),
    unit("weeks", &["week", "weeks"], Kind::Time, 604_800.0),
];

fn find(said: &str) -> Option<&'static Unit> {
    let key = said.trim().to_lowercase();
    UNITS.iter().find(|u| u.names.contains(&key.as_str()))
}

/// `value` in `from` expressed in `to`, with both units' symbols, or a sentence saying why not.
pub fn convert(value: f64, from: &str, to: &str) -> Result<(f64, &'static str, &'static str), String> {
    let unknown = |said: &str| format!("I don't know the unit \"{}\".", said.trim());
    let (a, b) = (find(from).ok_or_else(|| unknown(from))?, find(to).ok_or_else(|| unknown(to))?);
    if a.kind != b.kind {
        return Err(format!("{} and {} measure different things.", a.symbol, b.symbol));
    }
    let base = value * a.scale + a.shift;
    Ok(((base - b.shift) / b.scale, a.symbol, b.symbol))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: f64, b: f64) -> bool {
        (a - b).abs() < 1e-6 * b.abs().max(1.0)
    }

    #[test]
    fn everyday_conversions_are_right() {
        assert!(close(convert(5.0, "km", "miles").unwrap().0, 3.106_855_96));
        assert!(close(convert(100.0, "Celsius", "F").unwrap().0, 212.0));
        assert!(close(convert(98.6, "°F", "c").unwrap().0, 37.0));
        assert!(close(convert(0.0, "c", "kelvin").unwrap().0, 273.15));
        assert!(close(convert(1.0, "cup", "ml").unwrap().0, 236.588_236_5));
        assert!(close(convert(10.0, "stone", "kg").unwrap().0, 63.502_931_8));
        assert!(close(convert(60.0, "mph", "km/h").unwrap().0, 96.560_64));
        assert!(close(convert(1.0, "acre", "sq ft").unwrap().0, 43_560.0));
        assert!(close(convert(90.0, "minutes", "hours").unwrap().0, 1.5));
        assert_eq!(convert(1.0, "kg", "lb").unwrap().1, "kg");
    }

    #[test]
    fn mismatches_and_unknowns_are_said_plainly() {
        assert_eq!(convert(1.0, "kg", "km").unwrap_err(), "kg and km measure different things.");
        assert_eq!(convert(1.0, "usd", "eur").unwrap_err(), "I don't know the unit \"usd\".");
    }

    #[test]
    fn every_name_means_one_unit() {
        let mut seen = std::collections::HashSet::new();
        for u in UNITS {
            for n in u.names {
                assert!(seen.insert(*n) && *n == n.to_lowercase(), "{n}");
            }
        }
    }
}
