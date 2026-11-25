//! Tests for `files.rs`: sanitising, the Spotlight queries, exclusions, ranking, and the live
//! check on this Mac (`cargo test live_pim -- --ignored --nocapture`).

use super::*;

fn h(path: &str, modified: &str) -> FileHit {
    FileHit { path: path.into(), name: path.rsplit('/').next().unwrap().into(), kind: "other".into(), modified: modified.into() }
}

#[test]
fn sanitise_keeps_words_and_drops_what_could_escape_the_quotes() {
    assert_eq!(sanitise("  tax   return 2025 ").as_deref(), Some("tax return 2025"));
    assert_eq!(sanitise("--onlyin /etc").as_deref(), Some("onlyin /etc"));
    assert_eq!(sanitise("a\"cd || kMDItemFSName == \"*").as_deref(), Some("acd || kMDItemFSName =="));
    assert_eq!(sanitise("x\\\"y*?\n\tz").as_deref(), Some("xy z"));
    assert_eq!(sanitise(" - * \" "), None);
    assert_eq!(sanitise(""), None);
    let long = "é".repeat(500);
    assert_eq!(sanitise(&long).unwrap().chars().count(), MAX_QUERY);
}

#[test]
fn queries_quote_the_sanitised_words() {
    assert_eq!(name_query("tax"), "kMDItemDisplayName == \"*tax*\"cd");
    assert_eq!(content_query("tax return"), "kMDItemTextContent == \"tax return\"cdw");
    assert_eq!(recent_query(3), "kMDItemFSContentChangeDate >= $time.today(-3)");
}

#[test]
fn library_caches_hidden_node_modules_and_bundle_insides_are_excluded() {
    for p in ["/Users/a/Library/Mail/x.pdf", "/Users/a/.config/x", "/Users/a/code/node_modules/x/readme.md", "/Users/a/Caches/x", "/Applications/Safari.app/Contents/Info.plist", "/Users/a/code/app/target/debug/keeper.d", "/Users/a/x/__pycache__/m.pyc", "/Users/a/x/main.o"] {
        assert!(excluded(Path::new(p)), "{p}");
    }
    for p in ["/Users/a/Documents/Tax.pdf", "/Applications/Safari.app", "/Users/a/Desktop/my.notes.txt"] {
        assert!(!excluded(Path::new(p)), "{p}");
    }
}

#[test]
fn ranking_puts_the_best_name_first_then_content_and_drops_duplicates() {
    let names = vec![h("/a/old taxes.pdf", "2025-01-01T00:00:00Z"), h("/a/tax.pdf", "2024-01-01T00:00:00Z"), h("/a/taxes 2025.pdf", "2026-01-01T00:00:00Z")];
    let contents = vec![h("/a/letter.docx", "2026-02-01T00:00:00Z"), h("/a/tax.pdf", "2024-01-01T00:00:00Z")];
    let ranked: Vec<String> = rank(names, contents, "tax", 10).into_iter().map(|h| h.path).collect();
    assert_eq!(ranked, ["/a/tax.pdf", "/a/taxes 2025.pdf", "/a/old taxes.pdf", "/a/letter.docx"]);
    assert_eq!(rank(vec![h("/a/tax.pdf", "")], vec![h("/b/x", "")], "tax", 1).len(), 1);
}

#[tokio::test]
async fn empty_queries_are_refused_in_plain_words() {
    assert!(matches!(find(" -- ", 5).await, Err(DeskError::Invalid(_))));
}

#[tokio::test]
#[ignore]
async fn live_pim_files() {
    let started = std::time::Instant::now();
    let found = find("keeper", 5).await;
    println!("find_files(\"keeper\", 5) in {:?}:", started.elapsed());
    for f in found.as_deref().unwrap_or_default() {
        println!("  [{}] {} ({}) {}", f.kind, f.name, f.modified, f.path);
    }
    let started = std::time::Instant::now();
    let recent = recent(3, 10).await;
    println!("recent_files(3, 10) in {:?}:", started.elapsed());
    for f in recent.as_deref().unwrap_or_default() {
        println!("  [{}] {} ({}) {}", f.kind, f.name, f.modified, f.path);
    }
    assert!(found.is_ok() && recent.is_ok());
}

#[tokio::test]
#[ignore]
async fn live_pim_recent_day_is_fast() {
    let started = std::time::Instant::now();
    let found = recent(1, 8).await.unwrap_or_default();
    let took = started.elapsed();
    println!("recent(1, 8) in {took:?}: {:?}", found.iter().map(|f| &f.name).collect::<Vec<_>>());
    assert!(took < Duration::from_millis(1000), "the brief's file list is quick");
}
