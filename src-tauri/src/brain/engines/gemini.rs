//! Google's Gemini CLI (`gemini -p`), plain text answers. Its JSON event stream is not read yet,
//! so its tool calls are not recorded step by step (KNOWN_ISSUES DESK-GEMINI-001); `--yolo` lets
//! it act when the person allows that.

use super::cli::{self, ACT_TIMEOUT, CHAT_TIMEOUT};
use crate::brain::context::{Context, Thought};
use crate::brain::prompt;
use crate::kernel::{DeskError, Result};

pub async fn think(ctx: &Context, model: &str) -> Result<Thought> {
    let program = cli::program("gemini").ok_or_else(|| DeskError::Brain("The Gemini CLI is not installed".into()))?;
    let mut args = vec!["-p".to_string(), format!("{}\n\nThe person says: {}", prompt::system(ctx), ctx.said)];
    if !model.is_empty() {
        args.extend(["-m".to_string(), model.to_string()]);
    }
    if ctx.may_act {
        args.push("--yolo".into());
    }
    let timeout = if ctx.may_act { ACT_TIMEOUT } else { CHAT_TIMEOUT };
    let run = cli::run(&program, &args, &cli::workdir(ctx.may_act), timeout, |_| true).await?;
    if !run.success || run.stdout.trim().is_empty() {
        return Err(DeskError::Brain(cli::short(&run.stderr, 200)));
    }
    Ok(prompt::read(&run.stdout))
}
