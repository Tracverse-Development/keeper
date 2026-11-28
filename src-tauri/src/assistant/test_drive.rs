//! Testing only: with KEEPER_TEST_LINK set (a developer's test copy, never in normal use), a
//! message "/run <ability> <json input>" runs that ability through the whole turn (its sentence,
//! its panels in the window, its record on the DKG) without asking a mind, so every ability can be
//! tried in the real app on a test Mac that has no mind signed in. The test link may also say a
//! turn is at the Mac (`atMac`), so `Access::Change` abilities can be tried there.

use crate::sdk::ActionRequest;

/// The test link is on (set by the developer when starting a test copy).
pub fn enabled() -> bool {
    std::env::var_os("KEEPER_TEST_LINK").is_some()
}

/// The ability a "/run" message names, when the test link is on.
pub fn forced(said: &str) -> Option<ActionRequest> {
    enabled().then(|| parse(said)).flatten()
}

/// "/run open-app {\"name\": \"Notes\"}" → open-app with that input ("{}" when there is none).
fn parse(said: &str) -> Option<ActionRequest> {
    let rest = said.trim().strip_prefix("/run ")?.trim();
    let (skill, input) = rest.split_once(char::is_whitespace).unwrap_or((rest, "{}"));
    let input = serde_json::from_str(input.trim()).ok()?;
    Some(ActionRequest { skill: skill.to_string(), input })
}

#[cfg(test)]
mod tests {
    #[test]
    fn a_run_message_names_an_ability_and_its_input() {
        let r = super::parse("/run set-volume {\"level\": 0}").unwrap();
        assert_eq!((r.skill.as_str(), r.input["level"].as_i64()), ("set-volume", Some(0)));
        assert_eq!(super::parse("/run battery").unwrap().input, serde_json::json!({}));
        assert!(super::parse("run battery").is_none() && super::parse("/run x {not json").is_none());
    }
}
