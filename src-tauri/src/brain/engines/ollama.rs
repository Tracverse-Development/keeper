//! A model on this computer through Ollama (`http://127.0.0.1:11434`). Nothing leaves the machine.

use std::time::Duration;

use serde_json::json;

use crate::brain::context::{Context, Thought};
use crate::brain::prompt;
use crate::kernel::{DeskError, Result};

const BASE: &str = "http://127.0.0.1:11434";
/// A local model on a laptop can be slow on the first answer (it loads into memory).
const THINK_TIMEOUT: Duration = Duration::from_secs(180);

fn http() -> reqwest::Client {
    reqwest::Client::builder().no_proxy().build().unwrap_or_default()
}

/// The models Ollama has, or an empty list when Ollama is not running.
pub async fn models() -> Vec<String> {
    let Ok(res) = http().get(format!("{BASE}/api/tags")).timeout(Duration::from_secs(3)).send().await else { return vec![] };
    let Ok(v) = res.json::<serde_json::Value>().await else { return vec![] };
    v["models"].as_array().map(|m| m.iter().filter_map(|x| x["name"].as_str().map(str::to_string)).collect()).unwrap_or_default()
}

pub async fn think(model: &str, ctx: &Context) -> Result<Thought> {
    let body = json!({
        "model": model,
        "stream": false,
        "format": "json",
        "options": { "temperature": 0.6 },
        "messages": [
            { "role": "system", "content": prompt::system(ctx) },
            { "role": "user", "content": ctx.said },
        ]
    });
    let res = http().post(format!("{BASE}/api/chat")).json(&body).timeout(THINK_TIMEOUT).send().await.map_err(|e| DeskError::Brain(format!("Ollama: {e}")))?;
    if !res.status().is_success() {
        return Err(DeskError::Brain(format!("Ollama answered {}", res.status())));
    }
    let v: serde_json::Value = res.json().await.map_err(|e| DeskError::Brain(e.to_string()))?;
    let content = v["message"]["content"].as_str().unwrap_or_default();
    Ok(prompt::read(content))
}
