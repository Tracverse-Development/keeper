//! Arithmetic the way a person writes it: `+ - * / ^`, `×` and `÷`, brackets, a percent sign
//! (`15% * 80`, or `15% of 80`), and `sqrt(…)`. A recursive-descent parser (one function per
//! precedence level), pure and exact to f64; it never runs anything.
//!
//! `evaluate("2 * (3 + 4)^2") == Ok(98.0)`

/// Longest expression taken (a sum a person would type, not a program).
const MAX_LENGTH: usize = 200;
/// Deepest nesting of brackets.
const MAX_DEPTH: usize = 30;

#[derive(Debug, Clone, Copy, PartialEq)]
enum Token {
    Number(f64),
    Op(char),
    Open,
    Close,
    Sqrt,
}

/// The value of `expression`, or a sentence saying what is wrong with it.
pub fn evaluate(expression: &str) -> Result<f64, String> {
    if expression.chars().count() > MAX_LENGTH {
        return Err("That sum is too long for me.".into());
    }
    let tokens = tokens(expression)?;
    let mut parser = Parser { tokens: &tokens, at: 0, depth: 0 };
    let value = parser.sum()?;
    if parser.at != tokens.len() {
        return Err("I couldn't read all of that sum.".into());
    }
    if value.is_finite() { Ok(value) } else { Err("That has no answer (it divides by zero or grows without end).".into()) }
}

fn tokens(text: &str) -> Result<Vec<Token>, String> {
    let lower = text.to_lowercase().replace("square root of", "sqrt").replace(" of ", " * ");
    let chars: Vec<char> = lower.chars().collect();
    let mut out = Vec::new();
    let mut at = 0;
    while at < chars.len() {
        let c = chars[at];
        at += 1;
        match c {
            ' ' => {}
            '0'..='9' | '.' => {
                // Digits, with thousands commas allowed inside a number ("1,200").
                let mut digits = c.to_string();
                while at < chars.len() && (chars[at].is_ascii_digit() || chars[at] == '.' || chars[at] == ',') {
                    if chars[at] != ',' {
                        digits.push(chars[at]);
                    }
                    at += 1;
                }
                out.push(Token::Number(digits.parse().map_err(|_| format!("{digits} isn't a number."))?));
            }
            '+' | '-' | '*' | '/' | '^' | '%' => out.push(Token::Op(c)),
            'x' | '×' => out.push(Token::Op('*')),
            '÷' => out.push(Token::Op('/')),
            '(' => out.push(Token::Open),
            ')' => out.push(Token::Close),
            's' if chars[at..].starts_with(&['q', 'r', 't']) => {
                at += 3;
                out.push(Token::Sqrt);
            }
            _ => return Err(format!("I can't use \"{c}\" in a sum.")),
        }
    }
    Ok(out)
}

struct Parser<'a> {
    tokens: &'a [Token],
    at: usize,
    depth: usize,
}

impl Parser<'_> {
    fn peek(&self) -> Option<Token> {
        self.tokens.get(self.at).copied()
    }

    fn take_op(&mut self, ops: &[char]) -> Option<char> {
        match self.peek() {
            Some(Token::Op(op)) if ops.contains(&op) => {
                self.at += 1;
                Some(op)
            }
            _ => None,
        }
    }

    /// sum := product (("+" | "-") product)*
    fn sum(&mut self) -> Result<f64, String> {
        let mut value = self.product()?;
        while let Some(op) = self.take_op(&['+', '-']) {
            let right = self.product()?;
            value = if op == '+' { value + right } else { value - right };
        }
        Ok(value)
    }

    /// product := power (("*" | "/") power)*
    fn product(&mut self) -> Result<f64, String> {
        let mut value = self.power()?;
        while let Some(op) = self.take_op(&['*', '/']) {
            let right = self.power()?;
            value = if op == '*' { value * right } else { value / right };
        }
        Ok(value)
    }

    /// power := unary ("^" power)?   (right-associative: 2^3^2 = 2^9)
    fn power(&mut self) -> Result<f64, String> {
        let base = self.unary()?;
        if self.take_op(&['^']).is_some() {
            return Ok(base.powf(self.power()?));
        }
        Ok(base)
    }

    /// unary := "-" unary | "+" unary | atom "%"?
    fn unary(&mut self) -> Result<f64, String> {
        if let Some(op) = self.take_op(&['-', '+']) {
            let value = self.unary()?;
            return Ok(if op == '-' { -value } else { value });
        }
        let value = self.atom()?;
        Ok(if self.take_op(&['%']).is_some() { value / 100.0 } else { value })
    }

    /// atom := number | "(" sum ")" | "sqrt" atom
    fn atom(&mut self) -> Result<f64, String> {
        let token = self.peek().ok_or("That sum ends too soon.")?;
        self.at += 1;
        match token {
            Token::Number(n) => Ok(n),
            Token::Sqrt => {
                let value = self.atom()?;
                if value < 0.0 { Err("A negative number has no square root I can give.".into()) } else { Ok(value.sqrt()) }
            }
            Token::Open => {
                self.depth += 1;
                if self.depth > MAX_DEPTH {
                    return Err("That has too many brackets for me.".into());
                }
                let value = self.sum()?;
                if self.peek() != Some(Token::Close) {
                    return Err("A bracket is never closed.".into());
                }
                self.at += 1;
                self.depth -= 1;
                Ok(value)
            }
            _ => Err("I couldn't read that sum.".into()),
        }
    }
}

/// A result the way a person writes it: up to 10 significant figures, no trailing zeros, and
/// thousands separated ("1,234,567.89").
pub fn shown(value: f64) -> String {
    if value.abs() >= 1e15 || (value != 0.0 && value.abs() < 1e-6) {
        return format!("{value:e}");
    }
    let decimals = (9 - value.abs().log10().floor().max(0.0) as i32).clamp(0, 9) as usize;
    let fixed = format!("{value:.decimals$}");
    let fixed = if fixed.contains('.') { fixed.trim_end_matches('0').trim_end_matches('.').to_string() } else { fixed };
    let (sign, digits) = fixed.strip_prefix('-').map_or(("", fixed.as_str()), |d| ("-", d));
    let (whole, fraction) = digits.split_once('.').map_or((digits, None), |(w, f)| (w, Some(f)));
    let grouped: Vec<String> = whole.as_bytes().rchunks(3).rev().map(|c| String::from_utf8_lossy(c).into_owned()).collect();
    let result = format!("{sign}{}{}", grouped.join(","), fraction.map(|f| format!(".{f}")).unwrap_or_default());
    if result == "-0" { "0".into() } else { result }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sums_follow_the_usual_order() {
        assert_eq!(evaluate("2 * (3 + 4)^2"), Ok(98.0));
        assert_eq!(evaluate("2^3^2"), Ok(512.0));
        assert_eq!(evaluate("-3 + 10 / 4"), Ok(-0.5));
        assert_eq!(evaluate("15% of 80"), Ok(12.0));
        assert_eq!(evaluate("12 x 3 ÷ 4"), Ok(9.0));
        assert_eq!(evaluate("sqrt(16) + square root of 9"), Ok(7.0));
        assert_eq!(evaluate("1,200 * 2"), Ok(2400.0));
    }

    #[test]
    fn broken_sums_say_what_is_wrong() {
        for bad in ["", "2 +", "(1 + 2", "1 / 0", "rm -rf", "2 3", "sqrt(-4)", &"(".repeat(40)] {
            assert!(evaluate(bad).is_err(), "{bad:?}");
        }
        assert!(evaluate(&"1+".repeat(150)).is_err(), "too long");
    }

    #[test]
    fn results_read_cleanly() {
        assert_eq!(shown(98.0), "98");
        assert_eq!(shown(1234567.891), "1,234,567.891");
        assert_eq!(shown(0.1 + 0.2), "0.3");
        assert_eq!(shown(-2.5), "-2.5");
        assert_eq!(shown(1.0 / 3.0), "0.333333333");
    }
}
