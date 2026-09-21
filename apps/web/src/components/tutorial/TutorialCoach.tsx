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

function sameBox(a: Box | null, b: Box | null): boolean {
  if (a == null || b == null) return a === b;
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

function useCoachTarget(target: TutorialCoachTarget): Box | null {
  const [box, setBox] = useState<Box | null>(null);

  useLayoutEffect(() => {
    let cancelled = false;
    let ro: ResizeObserver | null = null;
    let raf = 0;

    const observe = (el: Element | null) => {
      ro?.disconnect();
      ro = null;
      if (!(el instanceof HTMLElement) || typeof ResizeObserver === "undefined") return;
      ro = new ResizeObserver(() => {
        if (cancelled) return;
        const next = coachTargetBox(el);
        setBox((prev) => (sameBox(prev, next) ? prev : next));
      });
      ro.observe(el);
    };

    const read = (): boolean => {
      if (cancelled) return false;
      const el = document.querySelector(tutorialTargetSelector(target));
      if (el instanceof HTMLElement && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
      const next = coachTargetBox(el);
      setBox((prev) => (sameBox(prev, next) ? prev : next));
      observe(el);
      return el instanceof HTMLElement;
    };

    const poll = () => {
      if (cancelled) return;
      if (!read()) raf = requestAnimationFrame(poll);
    };

    poll();
    const mo =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver(() => {
            read();
          })
        : null;
    mo?.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", read);
    window.addEventListener("scroll", read, true);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      mo?.disconnect();
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
  const { update } = useUserSettings();
  const playing = useOptionalAnalyzer()?.playback.playing ?? false;
  const wasPlayingRef = useRef(playing);
  const route = parseTutorialPath(pathname);
  const steps = route ? tutorialCoachSteps(route) : [];
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
    const started = playing && !wasPlayingRef.current;
    wasPlayingRef.current = playing;
    if (started) advance("play-or-scrub");
  }, [advance, playing]);

  // Playable tutorial routes always show marks. `tutorialCompleted` only skips
  // Home prefetch; IndexedDB `ready` must not hide the first callout. No DOM
  // during prerender — coach hydrates on the client.
  if (
    typeof document === "undefined" ||
    route == null ||
    !open ||
    !current ||
    index >= steps.length
  ) {
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
