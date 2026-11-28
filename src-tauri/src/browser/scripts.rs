//! The scripts Keeper runs in its browser page (in WebKit's isolated client world,
//! `platform::browser_script`). Each is FIXED text; a value is put in only as a JSON literal made
//! by `serde_json` (`json_literal`), so nothing a page or a person writes can become code.
//!
//!   read()                 the page as the keeper sees it: title, address, the visible text, the
//!                          fields to fill (each tagged `data-keeper-field="fN"`; a password field's
//!                          value is never read) and the links and buttons to press (`data-keeper-
//!                          press="pN"`), as JSON (`Page`)
//!   fill(values)           puts each value in its field (never a password field), the way typing
//!                          would (the site's own input events fire), outlines what it filled
//!   password(field, value) puts a password in ONE password field, and only a password field
//!   press(id)              presses one link or button the page listed

/// The most visible text read from a page (the mind gets this much at most).
pub const MAX_TEXT: usize = 12_000;

/// A value as a JavaScript literal (a JSON string, array or object), safe to put in a script.
pub fn json_literal(value: &serde_json::Value) -> String {
    // serde_json leaves U+2028 and U+2029 as they are; escaped, they can never end a line early.
    serde_json::to_string(value).unwrap_or_else(|_| "null".into()).replace('\u{2028}', "\\u2028").replace('\u{2029}', "\\u2029")
}

/// Reads the page (see the module doc). Returns a JSON string.
pub fn read() -> String {
    format!(
        r#"(() => {{
  const seen = (el) => {{ const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; }};
  const words = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const labelOf = (el) => {{
    if (el.id) {{ const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (l) return words(l.innerText); }}
    const wrap = el.closest('label'); if (wrap) return words(wrap.innerText);
    return words(el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || el.getAttribute('title') || '');
  }};
  const fields = [];
  let f = 0;
  for (const el of document.querySelectorAll('input, textarea, select')) {{
    const type = (el.getAttribute('type') || el.tagName).toLowerCase();
    if (['hidden', 'submit', 'button', 'image', 'reset', 'file'].includes(type) || !seen(el) || el.disabled) continue;
    f += 1; el.setAttribute('data-keeper-field', 'f' + f);
    const field = {{ id: 'f' + f, label: labelOf(el).slice(0, 80), kind: type }};
    if (type === 'password') field.filled = el.value.length > 0;
    else if (type === 'checkbox' || type === 'radio') field.value = el.checked ? 'checked' : '';
    else field.value = String(el.value || '').slice(0, 200);
    if (el.tagName === 'SELECT') field.choices = Array.from(el.options).map((o) => words(o.text)).slice(0, 30);
    fields.push(field);
    if (fields.length >= 60) break;
  }}
  const presses = [];
  let p = 0;
  for (const el of document.querySelectorAll('a[href], button, [role="button"], input[type="submit"], input[type="button"]')) {{
    if (!seen(el)) continue;
    const text = words(el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('title') || '');
    if (!text) continue;
    p += 1; el.setAttribute('data-keeper-press', 'p' + p);
    presses.push({{ id: 'p' + p, text: text.slice(0, 80), link: el.tagName === 'A' }});
    if (presses.length >= 80) break;
  }}
  const text = words(document.body ? document.body.innerText : '').slice(0, {max});
  return JSON.stringify({{ title: words(document.title).slice(0, 160), url: location.href, text, fields, presses }});
}})()"#,
        max = MAX_TEXT
    )
}

/// Fills fields by their read ids (`{"f1": "Amos", "f3": "amos@example.com"}`). Returns the ids filled.
pub fn fill(values: &serde_json::Value) -> String {
    format!(
        r#"(() => {{
  const values = {values};
  const done = [];
  for (const [id, value] of Object.entries(values)) {{
    const el = document.querySelector('[data-keeper-field="' + CSS.escape(id) + '"]');
    if (!el) continue;
    const type = (el.getAttribute('type') || el.tagName).toLowerCase();
    if (type === 'password') continue;
    if (type === 'checkbox' || type === 'radio') {{
      const want = ['yes', 'true', 'checked', 'on', '1'].includes(String(value).toLowerCase());
      if (el.checked !== want) el.click();
    }} else if (el.tagName === 'SELECT') {{
      const option = Array.from(el.options).find((o) => o.text.trim().toLowerCase() === String(value).trim().toLowerCase() || o.value === String(value));
      if (!option) continue;
      el.value = option.value;
    }} else {{
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(value));
    }}
    el.dispatchEvent(new Event('input', {{ bubbles: true }}));
    el.dispatchEvent(new Event('change', {{ bubbles: true }}));
    el.style.outline = '2px solid #d39744'; el.style.outlineOffset = '2px';
    done.push(id);
  }}
  return JSON.stringify(done);
}})()"#,
        values = json_literal(values)
    )
}

/// Puts `value` in the password field `id` (only a `type=password` field). Returns "ok" or "no".
pub fn password(id: &str, value: &str) -> String {
    format!(
        r#"(() => {{
  const el = document.querySelector('[data-keeper-field="' + CSS.escape({id}) + '"]');
  if (!el || (el.getAttribute('type') || '').toLowerCase() !== 'password') return 'no';
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, {value});
  el.dispatchEvent(new Event('input', {{ bubbles: true }}));
  el.dispatchEvent(new Event('change', {{ bubbles: true }}));
  return 'ok';
}})()"#,
        id = json_literal(&serde_json::json!(id)),
        value = json_literal(&serde_json::json!(value))
    )
}

/// Presses one listed link or button. Returns "ok" or "no".
pub fn press(id: &str) -> String {
    format!(
        r#"(() => {{
  const el = document.querySelector('[data-keeper-press="' + CSS.escape({id}) + '"]');
  if (!el) return 'no';
  el.scrollIntoView({{ block: 'center' }});
  el.click();
  return 'ok';
}})()"#,
        id = json_literal(&serde_json::json!(id))
    )
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    #[test]
    fn values_reach_a_script_only_as_literals() {
        let hostile = "x'); alert(1); ('";
        let script = super::fill(&json!({ "f1": hostile }));
        assert!(script.contains(r#"{"f1":"x'); alert(1); ('"}"#), "a value is a JSON string, never code");
        let pw = super::password("f2", "p\"w\\ord\u{2028}");
        assert!(pw.contains(r#""p\"w\\ord\u2028""#), "{pw}");
        assert!(super::press("p1\"]") .contains(r#""p1\"]""#));
    }

    #[test]
    fn reading_never_takes_a_passwords_value() {
        let read = super::read();
        assert!(read.contains("if (type === 'password') field.filled = el.value.length > 0;"));
        assert!(read.contains(".slice(0, 12000)"));
    }

    #[test]
    fn filling_skips_password_fields() {
        assert!(super::fill(&json!({})).contains("if (type === 'password') continue;"));
        assert!(super::password("f1", "x").contains("!== 'password') return 'no'"));
    }
}
