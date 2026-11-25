//! The Hermes agent (guarded by Agent Blackbox), one turn at a time with `hermes -z`.
//! Hermes's model provider may be in the cloud: the window says so before the person picks it.

use super::cli::{self, ACT_TIMEOUT, CHAT_TIMEOUT};
use crate::brain::context::{Context, Thought};
use crate::brain::prompt;
use crate::kernel::{DeskError, Result};

pub async fn think(ctx: &Context) -> Result<Thought> {
    let hermes = cli::program("hermes").ok_or_else(|| DeskError::Brain("Hermes is not installed".into()))?;
    let text = prompt::system(ctx);
    let timeout = if ctx.may_act { ACT_TIMEOUT } else { CHAT_TIMEOUT };
    let run = cli::run(&hermes, &["-z".to_string(), text], &cli::workdir(ctx.may_act), timeout, |_| true).await?;
    let all = format!("{}{}", run.stdout, run.stderr);
    if all.contains("not connected to any AI provider") {
        return Err(DeskError::Brain("Hermes is installed but not connected to a model yet (run `hermes model`)".into()));
    }
    if !run.success {
        return Err(DeskError::Brain(cli::short(all.lines().last().unwrap_or("Hermes failed"), 200)));
    }
    Ok(prompt::read(&run.stdout))
}
