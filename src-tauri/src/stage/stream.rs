//! Panels while the engine is still writing: the answer is JSON (`{"reply": …, "panels": [ … ]}`)
//! arriving a few characters at a time. `PanelStream` watches for the `"panels"` array and hands
//! back each panel the moment its closing brace arrives, so the first panel can be on screen in
//! seconds instead of after the whole answer. It tracks strings and escapes, so braces inside text
//! never confuse it; every panel still goes through `stage::read` (validated and capped).

use super::Panel;

#[derive(Default)]
pub struct PanelStream {
    buf: String,
    /// Bytes of `buf` already scanned.
    scanned: usize,
    /// Byte index just after the `[` of the panels array, once found.
    array: Option<usize>,
    depth: i32,
    in_string: bool,
    escaped: bool,
    object_start: Option<usize>,
    done: bool,
    emitted: usize,
}

impl PanelStream {
    /// Find `"panels"` `:` `[` (whitespace allowed) at or after `from`; returns the index after `[`.
    fn find_array(buf: &str, from: usize) -> Option<usize> {
        let mut search = from;
        while let Some(pos) = buf[search..].find("\"panels\"") {
            let after = search + pos + "\"panels\"".len();
            let rest = buf[after..].trim_start();
            if let Some(r) = rest.strip_prefix(':') {
                let r2 = r.trim_start();
                if let Some(stripped) = r2.strip_prefix('[') {
                    return Some(buf.len() - stripped.len());
                }
                if r2.is_empty() {
                    return None; // not arrived yet
                }
            } else if rest.is_empty() {
                return None;
            }
            search = after;
        }
        None
    }

    /// Feed the next piece of the answer; returns panels completed by it.
    pub fn push(&mut self, chunk: &str) -> Vec<Panel> {
        let mut out = Vec::new();
        if self.done {
            return out;
        }
        self.buf.push_str(chunk);
        if self.array.is_none() {
            match Self::find_array(&self.buf, 0) {
                Some(i) => {
                    self.array = Some(i);
                    self.scanned = i;
                }
                None => return out,
            }
        }
        let start = self.scanned;
        for (offset, ch) in self.buf[start..].char_indices() {
            let i = start + offset;
            if self.in_string {
                if self.escaped {
                    self.escaped = false;
                } else if ch == '\\' {
                    self.escaped = true;
                } else if ch == '"' {
                    self.in_string = false;
                }
                continue;
            }
            match ch {
                '"' => self.in_string = true,
                '{' => {
                    if self.depth == 0 {
                        self.object_start = Some(i);
                    }
                    self.depth += 1;
                }
                '}' => {
                    self.depth -= 1;
                    if self.depth == 0 {
                        if let Some(s) = self.object_start.take() {
                            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&self.buf[s..=i]) {
                                // `read` caps and ids it; keep the index so ids match the final answer.
                                if let Some(mut p) = super::read(&serde_json::Value::Array(vec![v])).into_iter().next() {
                                    p.set_id(&format!("panel-{}", self.emitted));
                                    self.emitted += 1;
                                    out.push(p);
                                }
                            }
                        }
                    }
                }
                ']' if self.depth == 0 => {
                    self.done = true;
                    self.scanned = i + 1;
                    return out;
                }
                _ => {}
            }
        }
        self.scanned = self.buf.len();
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const ANSWER: &str = r#"{"reply": "Here {you} go: } tricky \" text", "panels": [{"kind": "text", "title": "A {brace}", "body": "x } y"}, {"kind": "steps", "title": "Solve", "steps": [{"label": "one", "math": "2x = 6"}]}], "remember": []}"#;

    #[test]
    fn panels_arrive_one_by_one_whatever_the_chunking() {
        for size in [1, 3, 7, 40, 1000] {
            let mut s = PanelStream::default();
            let mut got = Vec::new();
            let chars: Vec<char> = ANSWER.chars().collect();
            for chunk in chars.chunks(size) {
                got.extend(s.push(&chunk.iter().collect::<String>()));
            }
            assert_eq!(got.len(), 2, "chunk size {size}");
            assert!(matches!(&got[0], Panel::Text { title, .. } if title == "A {brace}"));
            assert!(matches!(&got[1], Panel::Steps { id, .. } if id == "panel-1"));
        }
    }

    #[test]
    fn no_panels_means_nothing() {
        let mut s = PanelStream::default();
        assert!(s.push(r#"{"reply": "just words about panels", "remember": []}"#).is_empty());
    }
}
