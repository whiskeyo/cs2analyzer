import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom's getContext logs "Not implemented" and returns null. Keep the null
// (App-level tests skip the paint loop) without the console noise. Tests that
// need a 2d context spy on the prototype and return createMockCanvas().
HTMLCanvasElement.prototype.getContext = (() =>
  null) as typeof HTMLCanvasElement.prototype.getContext;

afterEach(() => {
  cleanup();
  document.documentElement.lang = "en";
});
