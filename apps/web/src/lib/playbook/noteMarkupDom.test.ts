/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import {
  convertTypedNoteMarkup,
  insertNoteMarkup,
  matchClosedNoteMarkup,
  renderNoteMarkup,
  restyleRawNoteMarkup,
  serializeNoteMarkupFromElement,
  textNodesHaveClosedMarkup,
  toggleNoteMark,
} from "./noteMarkupDom";

function mount(html = ""): HTMLDivElement {
  const el = document.createElement("div");
  el.contentEditable = "true";
  el.innerHTML = html;
  document.body.append(el);
  return el;
}

function selectText(el: HTMLElement, start: number, end: number) {
  const text = el.firstChild;
  expect(text?.nodeType).toBe(Node.TEXT_NODE);
  const range = document.createRange();
  range.setStart(text as Text, start);
  range.setEnd(text as Text, end);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

describe("noteMarkup DOM", () => {
  it("round-trips markdown through the editor DOM", () => {
    const el = mount();
    renderNoteMarkup(el, "**flash** *mid* __hold__\nstairs");
    expect(el.querySelector("strong")?.textContent).toBe("flash");
    expect(el.querySelector("em")?.textContent).toBe("mid");
    expect(el.querySelector("u")?.textContent).toBe("hold");
    expect(serializeNoteMarkupFromElement(el)).toBe("**flash** *mid* __hold__\nstairs");
    renderNoteMarkup(el, "");
    expect(serializeNoteMarkupFromElement(el)).toBe("");
    el.remove();
  });

  it("wraps a selection and serializes it back to markdown", () => {
    const el = mount("flash mid");
    selectText(el, 0, 5);
    toggleNoteMark(el, "bold");
    expect(serializeNoteMarkupFromElement(el)).toBe("**flash** mid");
    expect(el.querySelector("strong")?.textContent).toBe("flash");
    el.remove();
  });

  it("converts a just-typed closer into styled text", () => {
    const el = mount();
    const text = document.createTextNode("go **mid**");
    el.replaceChildren(text);
    const range = document.createRange();
    range.setStart(text, text.data.length);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    expect(convertTypedNoteMarkup(el)).toBe(true);
    expect(el.querySelector("strong")?.textContent).toBe("mid");
    expect(serializeNoteMarkupFromElement(el)).toBe("go **mid**");
    el.remove();
  });

  it("inserts pasted markdown as styled nodes", () => {
    const el = mount();
    insertNoteMarkup(el, "**stairs** and *flash*");
    expect(el.querySelector("strong")?.textContent).toBe("stairs");
    expect(el.querySelector("em")?.textContent).toBe("flash");
    expect(serializeNoteMarkupFromElement(el)).toBe("**stairs** and *flash*");
    el.remove();
  });

  it("restyles a raw **bold** text node left in the DOM", () => {
    const el = mount();
    el.replaceChildren(document.createTextNode("go **mid** now"));
    expect(textNodesHaveClosedMarkup(el)).toBe(true);
    expect(restyleRawNoteMarkup(el)).toBe(true);
    expect(el.querySelector("strong")?.textContent).toBe("mid");
    expect(el.textContent).not.toContain("**");
    expect(serializeNoteMarkupFromElement(el)).toBe("go **mid** now");
    el.remove();
  });
});

describe("matchClosedNoteMarkup", () => {
  it("finds completed markers and ignores unmatched ones", () => {
    expect(matchClosedNoteMarkup("go **mid**")).toEqual({
      start: 3,
      marker: "**",
      inner: "mid",
      mark: "bold",
    });
    expect(matchClosedNoteMarkup("see _late_")).toMatchObject({ marker: "_", inner: "late" });
    expect(matchClosedNoteMarkup("see **later")).toBeNull();
    expect(matchClosedNoteMarkup("cost * 2")).toBeNull();
    expect(matchClosedNoteMarkup("**heaven*")).toBeNull();
  });
});
