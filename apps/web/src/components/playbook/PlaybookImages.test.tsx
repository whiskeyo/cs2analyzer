/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PLAYBOOK_IMAGE_TYPE_ERROR } from "@/lib/playbook/images";
import type { PlaybookImage } from "@/lib/playbook/types";
import { PlaybookImages } from "./PlaybookImages";

const ingestPlaybookImages = vi.hoisted(() => vi.fn());
const ingestPlaybookImageUrl = vi.hoisted(() => vi.fn());

vi.mock("@/lib/playbook/addPlaybookImages", () => ({
  ingestPlaybookImages,
  ingestPlaybookImageUrl,
}));

vi.mock("@/lib/playbook/usePlaybookImageBitmaps", () => ({
  usePlaybookImageBitmaps: () => new Map(),
}));

function still(partial: Partial<PlaybookImage> = {}): PlaybookImage {
  return {
    id: "i1",
    name: "lineup.png",
    mime: "image/png",
    x: 0,
    y: 0,
    ...partial,
  };
}

function renderImages(
  overrides: Partial<Parameters<typeof PlaybookImages>[0]> = {},
): ReturnType<typeof render> {
  return render(
    <PlaybookImages
      images={[]}
      openId={null}
      error={null}
      pendingPin={null}
      onImages={vi.fn()}
      onOpen={vi.fn()}
      onError={vi.fn()}
      onCancelPin={vi.fn()}
      {...overrides}
    />,
  );
}

describe("PlaybookImages", () => {
  afterEach(() => {
    ingestPlaybookImages.mockReset();
    ingestPlaybookImageUrl.mockReset();
  });

  it("lists a thumbnail name and removes from the row without opening", async () => {
    const onImages = vi.fn();
    const onOpen = vi.fn();
    renderImages({ images: [still()], onImages, onOpen });
    expect(screen.getByRole("button", { name: "lineup.png" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove lineup.png" }));
    expect(onImages).toHaveBeenCalledWith([]);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("opens the picture in a modal and deletes from there", async () => {
    const onImages = vi.fn();
    const onOpen = vi.fn();
    const { rerender } = renderImages({ images: [still()], onImages, onOpen });
    await userEvent.click(screen.getByRole("button", { name: "lineup.png" }));
    expect(onOpen).toHaveBeenCalledWith("i1");

    rerender(
      <PlaybookImages
        images={[still()]}
        openId="i1"
        error={null}
        pendingPin={null}
        onImages={onImages}
        onOpen={onOpen}
        onError={vi.fn()}
        onCancelPin={vi.fn()}
      />,
    );
    expect(screen.getByRole("dialog", { name: "lineup.png" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onImages).toHaveBeenCalledWith([]);
    expect(onOpen).toHaveBeenLastCalledWith(null);
  });

  it("keeps a drop error on the list and has no idle add form", () => {
    renderImages({ error: PLAYBOOK_IMAGE_TYPE_ERROR });
    expect(screen.getByText(PLAYBOOK_IMAGE_TYPE_ERROR)).toBeInTheDocument();
    expect(screen.queryByLabelText("Add playbook image")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Image URL" })).not.toBeInTheDocument();
  });

  it("opens a picker on pin drop and ingests at that world XY", async () => {
    const onImages = vi.fn();
    const onOpen = vi.fn();
    const onCancelPin = vi.fn();
    ingestPlaybookImages.mockResolvedValue({
      images: [still({ id: "i2", x: 40, y: 50 })],
      error: null,
    });
    renderImages({
      pendingPin: { x: 40, y: 50 },
      onImages,
      onOpen,
      onCancelPin,
    });
    expect(screen.getByRole("dialog", { name: "Add photo" })).toBeInTheDocument();
    expect(screen.getByText(/Choose a PNG, JPEG, or WebP/)).toBeInTheDocument();
    const input = screen.getByLabelText("Add playbook image");
    const file = new File([new Uint8Array(8)], "lineup.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(ingestPlaybookImages).toHaveBeenCalled());
    expect(ingestPlaybookImages).toHaveBeenCalledWith([file], [], { x: 40, y: 50 });
    expect(onImages).toHaveBeenCalledWith([expect.objectContaining({ id: "i2", x: 40, y: 50 })]);
    expect(onOpen).toHaveBeenCalledWith("i2");
    expect(onCancelPin).toHaveBeenCalled();
  });

  it("pastes an image URL on pin drop and shows a fetch error without closing", async () => {
    const onImages = vi.fn();
    const onOpen = vi.fn();
    const onError = vi.fn();
    const onCancelPin = vi.fn();
    ingestPlaybookImageUrl.mockResolvedValue({
      images: [still({ id: "i2", name: "abc123.jpg", x: 4, y: 5 })],
      error: null,
    });
    const { rerender } = renderImages({
      pendingPin: { x: 4, y: 5 },
      onImages,
      onOpen,
      onError,
      onCancelPin,
    });
    expect(screen.getByText(/or paste an image URL/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Image URL" }), {
      target: { value: "https://imgur.com/abc123" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(ingestPlaybookImageUrl).toHaveBeenCalled());
    expect(ingestPlaybookImageUrl).toHaveBeenCalledWith("https://imgur.com/abc123", [], {
      x: 4,
      y: 5,
    });
    expect(onImages).toHaveBeenCalledWith([expect.objectContaining({ id: "i2" })]);
    expect(onOpen).toHaveBeenCalledWith("i2");
    expect(onCancelPin).toHaveBeenCalled();

    ingestPlaybookImageUrl.mockResolvedValue({
      images: [],
      error: PLAYBOOK_IMAGE_TYPE_ERROR,
    });
    onCancelPin.mockClear();
    rerender(
      <PlaybookImages
        images={[]}
        openId={null}
        error={PLAYBOOK_IMAGE_TYPE_ERROR}
        pendingPin={{ x: 4, y: 5 }}
        onImages={onImages}
        onOpen={onOpen}
        onError={onError}
        onCancelPin={onCancelPin}
      />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Image URL" }), {
      target: { value: "https://example.com/page" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith(PLAYBOOK_IMAGE_TYPE_ERROR));
    expect(onCancelPin).not.toHaveBeenCalled();
  });
});
