import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BucketControls } from "./BucketControls";

function baseProps(overrides: Partial<Parameters<typeof BucketControls>[0]> = {}) {
  return {
    playSec: 5,
    maxSec: 30,
    playing: false,
    speed: 1,
    onPlaySec: vi.fn(),
    onPlaying: vi.fn(),
    onTogglePlay: vi.fn(),
    onSpeed: vi.fn(),
    ...overrides,
  };
}

describe("BucketControls", () => {
  it("renders the bucket timeline and clock", () => {
    render(<BucketControls {...baseProps()} />);
    expect(screen.getByLabelText("Bucket overlay timeline")).toBeInTheDocument();
    expect(screen.getByText("+0:05")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export clip" })).not.toBeInTheDocument();
  });

  it("toggles play and steps by one second", async () => {
    const onTogglePlay = vi.fn();
    const onPlaying = vi.fn();
    const onPlaySec = vi.fn();
    render(<BucketControls {...baseProps({ onTogglePlay, onPlaying, onPlaySec })} />);

    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(onTogglePlay).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByTitle("Step forward 1s"));
    expect(onPlaySec).toHaveBeenCalledWith(6);
    expect(onPlaying).toHaveBeenCalledWith(false);
  });

  it("changes playback speed", async () => {
    const onSpeed = vi.fn();
    render(<BucketControls {...baseProps({ onSpeed })} />);
    await userEvent.selectOptions(screen.getByLabelText("Speed"), "4");
    expect(onSpeed).toHaveBeenCalledWith(4);
  });

  it("scrubs the bucket timeline", async () => {
    const onPlaySec = vi.fn();
    render(<BucketControls {...baseProps({ onPlaySec, maxSec: 20 })} />);
    const slider = screen.getByLabelText("Bucket overlay timeline");
    fireEvent.change(slider, { target: { value: "12" } });
    expect(onPlaySec).toHaveBeenCalledWith(12);
  });
});
