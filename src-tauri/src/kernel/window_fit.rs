//! The main window fits the screen it opens on: on a display smaller than the window's designed
//! size (1280 x 820, a 1024 x 768 screen, a VM) it shrinks to the screen's room, never below its
//! minimum, and is centred, so no edge opens off screen (seen in the test VM: the left edge and
//! the What's new sheet were cut off).

/// The size to open at, in logical points: the designed size, shrunk to `room` (the screen less a
/// small margin) but never below `min`.
pub fn fitted(designed: (f64, f64), room: (f64, f64), min: (f64, f64)) -> (f64, f64) {
    let side = |want: f64, have: f64, least: f64| want.min(have).max(least);
    (side(designed.0, room.0, min.0), side(designed.1, room.1, min.1))
}

/// Applies `fitted` to the main window on the monitor it is on, then centres it.
pub fn fit_main_window(window: &tauri::WebviewWindow) {
    let Ok(Some(monitor)) = window.current_monitor() else { return };
    let scale = monitor.scale_factor();
    let screen = monitor.size().to_logical::<f64>(scale);
    // A margin for the menu bar and the Dock.
    let room = (screen.width - 24.0, screen.height - 110.0);
    let Ok(now) = window.outer_size() else { return };
    let now = now.to_logical::<f64>(scale);
    let (w, h) = fitted((now.width, now.height), room, (MIN_WIDTH, MIN_HEIGHT));
    if (w, h) != (now.width, now.height) {
        let _ = window.set_size(tauri::LogicalSize::new(w, h));
        let _ = window.center();
    }
}

/// The window's minimum size (tauri.conf.json `minWidth`, and a height that still shows the dock).
const MIN_WIDTH: f64 = 900.0;
const MIN_HEIGHT: f64 = 620.0;

#[cfg(test)]
mod tests {
    // FIX-0042: on a 1024 x 768 screen the 1280-wide window opened with its left edge off screen.
    #[test]
    fn a_small_screen_gets_a_window_that_fits_and_a_big_one_keeps_the_design() {
        assert_eq!(super::fitted((1280.0, 820.0), (1000.0, 658.0), (900.0, 620.0)), (1000.0, 658.0));
        assert_eq!(super::fitted((1280.0, 820.0), (2536.0, 1330.0), (900.0, 620.0)), (1280.0, 820.0));
        assert_eq!(super::fitted((1280.0, 820.0), (700.0, 400.0), (900.0, 620.0)), (900.0, 620.0), "never below the minimum");
    }
}
