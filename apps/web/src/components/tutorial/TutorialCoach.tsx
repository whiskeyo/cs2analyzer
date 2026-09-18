import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { useUserSettings } from "@/lib/settings/useUserSettings";
import { tutorialCoachSteps } from "@/lib/tutorial/coach";
import { parseTutorialQuery } from "@/lib/tutorial/query";

function CoachRing({ target }: { target: string }) {
  const [box, setBox] = useState<DOMRect | null>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      const el = document.querySelector(`[data-tutorial="${target}"]`);
      setBox(el instanceof HTMLElement ? el.getBoundingClientRect() : null);
    };
    frame = window.requestAnimationFrame(update);
    window.addEventListener("resize", update);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
    };
  }, [target]);
  if (!box || box.width <= 0 || box.height <= 0) return null;
  return (
    <div
      className="tutorial-coach-ring"
      style={{
        top: box.top - 4,
        left: box.left - 4,
        width: box.width + 8,
        height: box.height + 8,
      }}
      aria-hidden="true"
    />
  );
}

/** Dismissible callouts. Pointer-events stay off the page so power users are not blocked. */
export function TutorialCoach() {
  const { search } = useLocation();
  const { settings, ready, update } = useUserSettings();
  const step = parseTutorialQuery(search) ?? "replay";
  const steps = tutorialCoachSteps(step);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(true);

  if (!ready || settings.tutorialCompleted || !open || steps.length === 0) return null;
  const current = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;

  const skip = () => {
    void update({ tutorialCompleted: true });
    setOpen(false);
  };

  return (
    <div className="tutorial-coach-layer">
      <CoachRing target={current.id} />
      <aside className="tutorial-coach" role="complementary" aria-label="Tutorial tips">
        <p className="tutorial-coach-kicker">
          {index + 1} / {steps.length}
        </p>
        <h2>{current.title}</h2>
        <p>{current.body}</p>
        <div className="tutorial-coach-actions">
          <button type="button" className="ghost" onClick={skip}>
            Skip
          </button>
          {last ? (
            <button type="button" className="ghost" onClick={() => setOpen(false)}>
              Done
            </button>
          ) : (
            <button type="button" className="ghost" onClick={() => setIndex((i) => i + 1)}>
              Next
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
