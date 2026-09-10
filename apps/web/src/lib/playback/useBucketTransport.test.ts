import { describe, expect, it } from "vitest";
import { bucketPlayheadStep } from "./useBucketTransport";

describe("bucketPlayheadStep", () => {
  it("advances by dt * speed and flags the window end", () => {
    expect(bucketPlayheadStep(1, 0.1, 1, 5)).toEqual({ next: 1.1, ended: false });
    expect(bucketPlayheadStep(4.9, 0.2, 1, 5)).toEqual({ next: 5, ended: true });
    expect(bucketPlayheadStep(0, 1, 2, 10)).toEqual({ next: 2, ended: false });
  });
});
