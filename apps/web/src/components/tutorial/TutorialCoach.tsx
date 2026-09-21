import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router";
import { useOptionalAnalyzer } from "@/lib/state/analyzerState";
import { useUserSettings } from "@/lib/settings/useUserSettings";
import {
  coachTargetBox,
  placeCoachCallout,
  TUTORIAL_COACH_STEPS,
  tutorialCoachStepNumber,
  tutorialCoachSteps,
  tutorialTargetSelector,
  type Box,
  type TutorialCoachStep,
  type TutorialCoachTarget,
} from "@/lib/tutorial/coach";
import {
  onTutorialCoachAction,
  tutorialCoachActionFromEvent,
  type TutorialCoachAction,
} from "@/lib/tutorial/coachAction";
import { parseTutorialPath } from "@/lib/tutorial/query";

const CALLOUT_FALLBACK = { width: 280, height: 120 };

function useCoachTarget(target: TutorialCoachTarget): Box | null {
  const [box, setBox] = useState<Box | null>(null);

  useLayoutEffect(() => {
    const read = () => {
      const el = document.querySelector(tutorialTargetSelector(target));
      if (el instanceof HTMLElement && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
      setBox(coachTargetBox(el));
    };
    read();
    const el = document.querySelector(tutorialTargetSelector(target));
    const ro =
      el instanceof HTMLElement && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(read)
        : null;
    if (el instanceof HTMLElement) ro?.observe(el);
    window.addEventListener("resize", read);
    window.addEventListener("scroll", read, true);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", read);
      window.removeEventListener("scroll", read, true);
    };
  }, [target]);

  return box;
}

function CoachSpot({ box }: { box: Box }) {
  const style = {
    top: box.top - 4,
    left: box.left - 4,
    width: box.width + 8,
    height: box.height + 8,
  };
  return (
    <>
      <div className="tutorial-coach-spot" style={style} aria-hidden="true" />
      <div className="tutorial-coach-ring" style={style} aria-hidden="true" />
    </>
  );
}

function CoachCallout({
  step,
  box,
  total,
  onSkip,
}: {
  step: TutorialCoachStep;
  box: Box | null;
  total: number;
  onSkip: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const [size, setSize] = useState(CALLOUT_FALLBACK);
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const layout = box
    ? placeCoachCallout(box, size, viewport)
    : {
        top: viewport.height - size.height - 16,
        left: 16,
        placement: "below" as const,
      };

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next = { width: el.offsetWidth, height: el.offsetHeight };
    setSize((prev) => (prev.width === next.width && prev.height === next.height ? prev : next));
  }, [step.id, box, layout.top, layout.left]);

  return (
    <aside
      ref={ref}
      className="tutorial-coach"
      role="complementary"
      aria-label="Tutorial coach"
      data-placement={layout.placement}
      style={{ top: layout.top, left: layout.left }}
    >
      <p className="tutorial-coach-kicker">
        {tutorialCoachStepNumber(step)} / {total}
      </p>
      <p>{step.body}</p>
      <div className="tutorial-coach-actions">
        <button type="button" className="ghost" onClick={onSkip}>
          Skip
        </button>
      </div>
    </aside>
  );
}

/** Spotlight + callout beside one real control. Advances on `doneWhen`, not Next. */
export function TutorialCoach() {
  const { pathname } = useLocation();
  const { settings, ready, update } = useUserSettings();
  const playing = useOptionalAnalyzer()?.playback.playing ?? false;
  const route = parseTutorialPath(pathname) ?? "replay";
  const steps = tutorialCoachSteps(route);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(true);
  const current = steps[Math.min(index, Math.max(0, steps.length - 1))];
  const box = useCoachTarget(current?.target ?? "play");
  const doneWhenRef = useRef<TutorialCoachAction | null>(null);
  doneWhenRef.current = current && index < steps.length ? current.doneWhen : null;

  const skip = useCallback(() => {
    void update({ tutorialCompleted: true });
    setOpen(false);
  }, [update]);

  const advance = useCallback((action: TutorialCoachAction) => {
    if (doneWhenRef.current == null || action !== doneWhenRef.current) return;
    doneWhenRef.current = null;
    setIndex((i) => i + 1);
  }, []);

  useEffect(() => {
    if (!current) return;
    const onDom = (event: Event) => {
      const action = tutorialCoachActionFromEvent(event);
      if (action) advance(action);
    };
    document.addEventListener("click", onDom, true);
    document.addEventListener("input", onDom, true);
    document.addEventListener("change", onDom, true);
    const stop = onTutorialCoachAction(advance);
    return () => {
      document.removeEventListener("click", onDom, true);
      document.removeEventListener("input", onDom, true);
      document.removeEventListener("change", onDom, true);
      stop();
    };
  }, [advance, current]);

  useEffect(() => {
    if (playing) advance("play-or-scrub");
  }, [advance, playing]);

  if (!ready || settings.tutorialCompleted || !open || !current || index >= steps.length) {
    return null;
  }

  return createPortal(
    <div className="tutorial-coach-layer">
      {box ? <CoachSpot box={box} /> : null}
      <CoachCallout step={current} box={box} total={TUTORIAL_COACH_STEPS.length} onSkip={skip} />
    </div>,
    document.body,
  );
}
