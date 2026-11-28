/**
 * The way back to the Stage once it is closed: "Scenes · 3" reopens this chat's scenes, or, with
 * none, "Pinned · 2" opens the newest pinned one. Nothing when there is neither.
 */
interface Props {
  scenes: number;
  pinned: number;
  onScenes: () => void;
  onPinned: () => void;
}

export function StagePill({ scenes, pinned, onScenes, onPinned }: Props) {
  if (scenes > 0) {
    return (
      <button type="button" className="pill pill-button scenes-pill" onClick={onScenes}>
        Scenes · {scenes}
      </button>
    );
  }
  if (pinned === 0) return null;
  return (
    <button type="button" className="pill pill-button scenes-pill" onClick={onPinned}>
      Pinned · {pinned}
    </button>
  );
}
