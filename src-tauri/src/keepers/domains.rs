//! What a keeper keeps: its domain. The domain shapes how the keeper understands its job (its
//! instructions to the engine) and names its graph. New domains are one row here.

use serde::Serialize;

pub struct Domain {
    pub id: &'static str,
    pub title: &'static str,
    pub blurb: &'static str,
    /// Added to the engine's instructions for this keeper.
    pub brief: &'static str,
}

pub const DOMAINS: &[Domain] = &[
    Domain {
        id: "system",
        title: "System administration",
        blurb: "Keeps your computer in order: files, folders, finding and opening things, editing documents.",
        brief: "You are this person's System Administration keeper. Your domain is their computer: finding, opening, organising, \
renaming and tidying files and folders, editing documents, opening apps and websites, and keeping track of where things are. \
When you act, say plainly what you did and where things are now.",
    },
    Domain {
        id: "companion",
        title: "Companion",
        blurb: "A friendly companion: conversation, reminders, how your day is going.",
        brief: "You are this person's companion keeper: warm, playful and encouraging. Your domain is their day: conversation, \
reminders, routines and wellbeing. Keep replies short and kind.",
    },
];

#[derive(Debug, Serialize)]
pub struct DomainInfo {
    pub id: &'static str,
    pub title: &'static str,
    pub blurb: &'static str,
}

pub fn get(id: &str) -> &'static Domain {
    DOMAINS.iter().find(|d| d.id == id).unwrap_or(&DOMAINS[0])
}

pub fn exists(id: &str) -> bool {
    DOMAINS.iter().any(|d| d.id == id)
}

pub fn all() -> Vec<DomainInfo> {
    DOMAINS.iter().map(|d| DomainInfo { id: d.id, title: d.title, blurb: d.blurb }).collect()
}
