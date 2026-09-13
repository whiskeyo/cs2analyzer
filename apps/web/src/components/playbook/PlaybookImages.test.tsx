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

vi.mock("@/lib/playbook/addPlaybookImages", () => ({
  ingestPlaybookImages,
}));

function still(partial: Partial<PlaybookImage> = {}): PlaybookImage {
  return {
    id: "i1",
    name: "lineup.png",
    mime: "image/png",
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    ...partial,
  };
}

describe("PlaybookImages", () => {
  afterEach(() => {
    ingestPlaybookImages.mockReset();
  });

  it("lists a thumbnail name and removes from the row", async () => {
    const onImages = vi.fn();
    const onSelect = vi.fn();
    render(
      <PlaybookImages
        images={[still()]}
        selectedId="i1"
        error={null}
        onImages={onImages}
        onSelect={onSelect}
        onError={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "lineup.png" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove lineup.png" }));
    expect(onImages).toHaveBeenCalledWith([]);
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("adds a picked file and shows a type error", async () => {
    const onImages = vi.fn();
    const onError = vi.fn();
    const onSelect = vi.fn();
    ingestPlaybookImages.mockResolvedValue({
      images: [still({ id: "i2" })],
      error: PLAYBOOK_IMAGE_TYPE_ERROR,
    });
    render(
      <PlaybookImages
        images={[]}
        selectedId={null}
        error={PLAYBOOK_IMAGE_TYPE_ERROR}
        onImages={onImages}
        onSelect={onSelect}
        onError={onError}
      />,
    );
    expect(screen.getByText(PLAYBOOK_IMAGE_TYPE_ERROR)).toBeInTheDocument();
    const input = screen.getByLabelText("Add playbook image");
    const file = new File([new Uint8Array(8)], "lineup.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(ingestPlaybookImages).toHaveBeenCalled());
    expect(onImages).toHaveBeenCalledWith([expect.objectContaining({ id: "i2" })]);
    expect(onSelect).toHaveBeenCalledWith("i2");
    expect(onError).toHaveBeenCalledWith(PLAYBOOK_IMAGE_TYPE_ERROR);
  });
});
