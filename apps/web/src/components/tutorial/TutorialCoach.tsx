import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router";
import { useUserSettings } from "@/lib/settings/useUserSettings";
import {
  coachTargetBoxes,
  placeCoachCallout,
  sameBoxes,
  TUTORIAL_COACH_STEPS,
  tutorialCoachStepNumber,
  tutorialCoachStepTargets,
  tutorialCoachSteps,
  tutorialTargetSelector,
  type Box,
  type TutorialCoachStep,
  type TutorialCoachTarget,
} from "@/lib/tutorial/coach";
import { parseTutorialPath } from "@/lib/tutorial/query";

const CALLOUT_FALLBACK = { width: 280, height: 120 };

function useCoachTargets(targets: readonly TutorialCoachTarget[]): Box[] {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const key = targets.join("\0");

  useLayoutEffect(() => {
    const targets = key.split("\0").filter(Boolean) as TutorialCoachTarget[];
    let cancelled = false;
    const observers: ResizeObserver[] = [];
    let raf = 0;

    const observe = () => {
      for (const ro of observers) ro.disconnect();
      observers.length = 0;
      if (typeof ResizeObserver === "undefined" || typeof document === "undefined") return;
      for (const target of targets) {
        const nodes = document.querySelectorAll(tutorialTargetSelector(target));
        for (const node of nodes) {
          if (!(node instanceof HTMLElement)) continue;
          const ro = new ResizeObserver(() => {
            if (cancelled) return;
            const next = coachTargetBoxes(targets);
            setBoxes((prev) => (sameBoxes(prev, next) ? prev : next));
          });
          ro.observe(node);
          observers.push(ro);
        }
      }
    };

    const read = (): boolean => {
      if (cancelled) return false;
      if (typeof document !== "undefined") {
        for (const target of targets) {
          const el = document.querySelector(tutorialTargetSelector(target));
          if (el instanceof HTMLElement && typeof el.scrollIntoView === "function") {
            el.scrollIntoView({ block: "nearest", inline: "nearest" });
            break;
          }
        }
      }
      const next = coachTargetBoxes(targets);
      setBoxes((prev) => (sameBoxes(prev, next) ? prev : next));
      observe();
      return next.length > 0;
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
    if (typeof document !== "undefined") {
      mo?.observe(document.body, { childList: true, subtree: true });
    }
    window.addEventListener("resize", read);
    window.addEventListener("scroll", read, true);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      mo?.disconnect();
      for (const ro of observers) ro.disconnect();
      window.removeEventListener("resize", read);
      window.removeEventListener("scroll", read, true);
    };
  }, [key]);

  return boxes;
}

function CoachRing({ box }: { box: Box }) {
  const style = {
    top: box.top - 4,
    left: box.left - 4,
    width: box.width + 8,
    height: box.height + 8,
  };
  return <div className="tutorial-coach-ring" style={style} aria-hidden="true" />;
}

function CoachCallout({
  step,
  box,
  total,
  onSkip,
  onNext,
}: {
  step: TutorialCoachStep;
  box: Box | null;
  total: number;
  onSkip: () => void;
  onNext: () => void;
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
        <button type="button" className="ghost" onClick={onNext}>
          Next
        </button>
      </div>
    </aside>
  );
}

/** Rings + callout beside real controls. Only Next advances. */
export function TutorialCoach() {
  const { pathname } = useLocation();
  const { update } = useUserSettings();
  const route = parseTutorialPath(pathname);
  const steps = route ? tutorialCoachSteps(route) : [];
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(true);
  const [routeEpoch, setRouteEpoch] = useState(route);
  if (route !== routeEpoch) {
    setRouteEpoch(route);
    setIndex(0);
  }
  const current = steps[index];
  const targets = current ? tutorialCoachStepTargets(current) : (["play"] as const);
  const boxes = useCoachTargets(targets);
  const primary = boxes[0] ?? null;

  const skip = () => {
    void update({ tutorialCompleted: true });
    setOpen(false);
  };

  const next = () => {
    setIndex((i) => i + 1);
  };

  // Playable tutorial routes always show marks. `tutorialCompleted` only skips
  // Home prefetch; IndexedDB `ready` must not hide the first callout. No DOM
  // during prerender — coach hydrates on the client.
  if (typeof document === "undefined" || route == null || !open || !current) {
    return null;
  }

  return createPortal(
    <>
      {boxes.map((box, i) => (
        <CoachRing key={`${box.top}-${box.left}-${i}`} box={box} />
      ))}
      <CoachCallout
        step={current}
        box={primary}
        total={TUTORIAL_COACH_STEPS.length}
        onSkip={skip}
        onNext={next}
      />
    </>,
    document.body,
  );
}
