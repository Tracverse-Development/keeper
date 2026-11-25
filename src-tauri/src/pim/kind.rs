//! What kind of file a path is, for the person's eyes ("a PDF", "a spreadsheet"): read from the
//! extension first (bundles such as `.app` and `.pages` are folders on disk but not to a person),
//! then "folder" for a plain directory, else "other".

use std::path::Path;

const DOCUMENTS: &[&str] = &["doc", "docx", "pages", "txt", "md", "markdown", "rtf", "rtfd", "odt", "tex", "epub"];
const IMAGES: &[&str] = &["png", "jpg", "jpeg", "gif", "heic", "heif", "webp", "tif", "tiff", "bmp", "svg", "psd", "raw", "cr2", "nef", "dng"];
const PRESENTATIONS: &[&str] = &["key", "ppt", "pptx", "odp"];
const SPREADSHEETS: &[&str] = &["numbers", "xls", "xlsx", "csv", "tsv", "ods"];

/// One of "folder", "pdf", "document", "image", "presentation", "spreadsheet", "app", "other".
pub fn kind_of(path: &Path, is_dir: bool) -> &'static str {
    let ext = path.extension().and_then(|e| e.to_str()).map(str::to_ascii_lowercase).unwrap_or_default();
    let ext = ext.as_str();
    match ext {
        "app" => "app",
        "pdf" => "pdf",
        _ if DOCUMENTS.contains(&ext) => "document",
        _ if IMAGES.contains(&ext) => "image",
        _ if PRESENTATIONS.contains(&ext) => "presentation",
        _ if SPREADSHEETS.contains(&ext) => "spreadsheet",
        _ if is_dir => "folder",
        _ => "other",
    }
}

#[cfg(test)]
mod tests {
    use super::kind_of;
    use std::path::Path;

    #[test]
    fn kinds_come_from_the_extension_in_any_case() {
        let cases = [
            ("/a/Tax 2025.PDF", false, "pdf"),
            ("/a/letter.docx", false, "document"),
            ("/a/Notes.pages", true, "document"),
            ("/a/photo.HEIC", false, "image"),
            ("/a/talk.key", true, "presentation"),
            ("/a/budget.numbers", true, "spreadsheet"),
            ("/a/data.csv", false, "spreadsheet"),
            ("/Applications/Safari.app", true, "app"),
            ("/a/Projects", true, "folder"),
            ("/a/archive.zip", false, "other"),
            ("/a/Makefile", false, "other"),
        ];
        for (path, is_dir, kind) in cases {
            assert_eq!(kind_of(Path::new(path), is_dir), kind, "{path}");
        }
    }
}
