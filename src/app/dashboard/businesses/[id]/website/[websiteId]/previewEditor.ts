// Click-to-edit for the builder's live preview, like the visual editors people
// already know: tap any text to type on it, tap a picture to replace it, and
// hover (or tap) a block to get its own small toolbar.
//
// The preview is the real page (/sitio/<slug>?preview=1&edit=1) in a
// same-origin iframe. In that mode the page marks what can be edited
// (data-edit="<path of the text>", data-img="<section>", data-sec="<section>");
// this module, running in the dashboard, listens to the iframe's document.
// Nothing runs inside the public page itself (it ships with script-src 'none').

export type SectionInfo = { index: number; label: string; canMoveUp: boolean; canMoveDown: boolean; canRemove: boolean; hasBg: boolean };

export type EditorHandlers = {
  /** Saves one edited text. `refresh` asks for a reload of the preview (something appeared or disappeared). */
  saveText(path: string, value: string): Promise<{ ok: boolean; error?: string; refresh?: boolean }>;
  pickImage(index: number, field: "image" | "bgImage"): void;
  move(index: number, direction: -1 | 1): void;
  hide(index: number): void;
  /** The block's own style panel. */
  style(index: number): void;
  /** Opens the block library to add one right below this block. */
  add(index: number): void;
  duplicate(index: number): void;
  remove(index: number): void;
  /** Opens the code editor of a "Código HTML" block. */
  code(index: number): void;
  /** A block taken from the library was dropped on the page: add it so it ends up at `at`. */
  dropBlock(type: string, at: number): void;
  /** A text, button or photo from the library was dropped on a block of the page. */
  dropExtra(kind: string, index: number): void;
  /** A block was touched in the page: the side panel follows it. */
  select(index: number): void;
  undo(): void;
  redo(): void;
  section(index: number): SectionInfo | null;
  notice(message: string): void;
};

const ACCENT = "#5b6cf0";
/** Drag payload of a library block (the same one the block list accepts). */
const NEW_BLOCK_TYPE = "application/x-fl-new-block";
const NEW_EXTRA_TYPE = "application/x-fl-new-extra";

const svgIcon = (d: string) => `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px;margin-right:4px">${d}</svg>`;
// Static icons for the block bar (the bar lives inside the page's own frame, so they are plain strings).
const ICO = {
  palette: svgIcon('<path d="M12 3.500a8.500 8.500 0 1 0 0 17c1.400 0 2-.9 2-1.800 0-1.300-1.100-1.500-1.100-2.700 0-1 .8-1.700 1.900-1.700H17a3.500 3.500 0 0 0 3.500-3.500C20.500 6.800 16.700 3.500 12 3.500Z"/><circle cx="8" cy="11" r="1"/><circle cx="11" cy="7.500" r="1"/><circle cx="15.500" cy="8.500" r="1"/>'),
  image: svgIcon('<rect x="3" y="4" width="18" height="16" rx="2.500"/><circle cx="9" cy="10" r="1.600"/><path d="m3.500 17 5-4.500 4 3.500 3-2.500 5 4"/>'),
  eyeOff: svgIcon('<path d="M3 3l18 18"/><path d="M10.200 6a9.800 9.800 0 0 1 1.800-.5c6 0 9.500 6.500 9.500 6.500a15 15 0 0 1-2.800 3.500M6.700 7.300A15 15 0 0 0 2.500 12S6 18.500 12 18.500c1.500 0 2.800-.4 4-1"/><path d="M9.900 9.900a3 3 0 0 0 4.200 4.200"/>'),
  trash: svgIcon('<path d="M4 7h16M9.500 7V4.500h5V7M6.500 7l.8 12.500h9.400L17.500 7"/><path d="M10 11v5.500M14 11v5.500"/>'),
};

const CSS = `
[data-edit]{cursor:text;border-radius:4px;transition:outline-color .12s,background-color .12s}
[data-edit]:hover{outline:2px dashed ${ACCENT};outline-offset:3px}
[data-edit].fl-editing{outline:2px solid ${ACCENT}!important;outline-offset:3px;background:rgba(91,108,240,.1);-webkit-user-select:text;user-select:text}
[data-note]{cursor:help}
[data-img]{cursor:pointer;transition:filter .12s}
[data-img]:hover{outline:3px solid ${ACCENT};outline-offset:-3px;filter:brightness(.9)}
section[data-sec].fl-active{box-shadow:inset 0 0 0 2px rgba(91,108,240,.55)}
section[data-sec].fl-picked{box-shadow:inset 0 0 0 3px ${ACCENT}}
section[data-sec].fl-hover{box-shadow:inset 0 0 0 2px ${ACCENT};background-image:linear-gradient(rgba(91,108,240,.06),rgba(91,108,240,.06))}
.fl-chip{position:absolute;z-index:2147483100;pointer-events:none;padding:5px 9px;border-radius:8px;background:${ACCENT};color:#fff;font:600 11px/1 system-ui,sans-serif;white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,.3)}
.fl-drop{position:absolute;left:0;right:0;z-index:2147483200;height:0;pointer-events:none}
.fl-drop::before{content:"";position:absolute;left:12px;right:12px;top:-2px;height:4px;border-radius:4px;background:${ACCENT};box-shadow:0 0 0 3px rgba(91,108,240,.25)}
.fl-drop::after{content:"Suelta aquí";position:absolute;left:50%;top:-14px;transform:translateX(-50%);padding:4px 10px;border-radius:99px;background:${ACCENT};color:#fff;font:700 11px/1 system-ui,sans-serif}
@keyframes fl-pulse{0%,100%{outline-color:transparent}50%{outline-color:${ACCENT}}}
[data-edit].fl-pulse{outline:2px dashed transparent;outline-offset:4px;animation:fl-pulse 1.2s ease-in-out 3}
.fl-bar-wrap{position:absolute;right:12px;top:8px;max-width:calc(100% - 24px);z-index:2147483000;font:600 12px/1 system-ui,sans-serif;text-transform:none;letter-spacing:0;text-align:left}
.fl-bar{display:flex;flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:2px;padding:4px;background:#111827;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.4)}
.fl-label{color:#9ca3af;padding:0 8px 0 6px;font-weight:600;white-space:nowrap}
.fl-bar button{all:unset;box-sizing:border-box;cursor:pointer;color:#fff;padding:8px 10px;border-radius:8px;white-space:nowrap;font:600 12px/1 system-ui,sans-serif}
.fl-bar button:hover{background:#374151}
.fl-bar button.fl-danger:hover{background:#b42318}
.fl-bar button.fl-icon{padding:8px 9px;font-size:14px}
.fl-bar button:focus-visible{outline:2px solid #fff}
.fl-bar button[disabled]{opacity:.3;cursor:default}
.fl-bar button[disabled]:hover{background:none}
@media (max-width:700px){.fl-label{display:none}}
@media (pointer:coarse){.fl-bar button{min-height:44px;min-width:44px;padding:0 12px;font-size:14px;display:inline-flex;align-items:center;justify-content:center}.fl-bar button.fl-icon{padding:0 10px;font-size:17px}.fl-bar-wrap{right:6px}.fl-chip{display:none}}
`;

const MULTILINE = /\.(body|answer|description|intro|subheading)$/;

// The page lives in another window (the iframe), whose Element and Node classes are not
// ours: `instanceof Element` is always false for its nodes, so nodes are recognized by type.
const asElement = (t: EventTarget | null): Element | null => (t && (t as Node).nodeType === 1 ? (t as Element) : null);
const isInside = (container: Element, t: EventTarget | null): boolean => !!t && (t as Node).nodeType !== undefined && container.contains(t as Node);

export function attachPreviewEditor(doc: Document, getHandlers: () => EditorHandlers): () => void {
  const win = doc.defaultView;
  if (!win || !doc.head || !doc.body) return () => {};

  const style = doc.createElement("style");
  style.setAttribute("data-fl-editor", "");
  style.textContent = CSS;
  doc.head.appendChild(style);

  doc.querySelectorAll<HTMLElement>("[data-img]").forEach((img) => {
    img.title = "Toca para cambiar la imagen";
  });
  // Every answer of the FAQ open, so each one can be edited.
  doc.querySelectorAll("details").forEach((d) => {
    d.open = true;
  });

  const wrap = doc.createElement("div");
  wrap.className = "fl-bar-wrap";
  wrap.setAttribute("contenteditable", "false");
  const bar = doc.createElement("div");
  bar.className = "fl-bar";
  wrap.appendChild(bar);

  let active: HTMLElement | null = null;
  let editing: HTMLElement | null = null;
  let original = "";

  function placeBar() {
    if (!active) return;
    const r = active.getBoundingClientRect();
    // Stays in view under the page's sticky header while the block is on screen.
    const top = Math.max(8, 76 - r.top);
    wrap.style.top = `${Math.min(top, Math.max(8, r.height - 52))}px`;
  }

  function renderBar(section: HTMLElement) {
    const index = Number(section.dataset.sec);
    const info = getHandlers().section(index);
    if (!info) return false;
    bar.textContent = "";
    const label = doc.createElement("span");
    label.className = "fl-label";
    label.textContent = info.label;
    bar.appendChild(label);
    const add = (act: string, text: string, title: string, disabled = false, icon = false, extra = "") => {
      const b = doc.createElement("button");
      b.type = "button";
      b.className = `${icon ? "fl-icon" : ""} ${extra}`.trim();
      b.dataset.act = act;
      b.innerHTML = text;
      b.title = title;
      b.setAttribute("aria-label", title);
      b.disabled = disabled;
      bar.appendChild(b);
    };
    add("style", `${ICO.palette} Estilo`, "Colores, espacios y tamaños de este bloque");
    add("bg", `${ICO.image} Fondo`, info.hasBg ? "Cambiar la foto de fondo de este bloque" : "Pon una foto detrás de este bloque");
    add("up", "↑", "Subir este bloque", !info.canMoveUp, true);
    add("down", "↓", "Bajar este bloque", !info.canMoveDown, true);
    add("add", "＋", "Agregar un bloque debajo de este", false, true);
    add("dup", "⧉", "Duplicar este bloque", !info.canRemove, true);
    add("hide", `${ICO.eyeOff} Ocultar`, "Ocultar este bloque de la página (no se borra)", index === 0);
    add("del", `${ICO.trash} Quitar`, "Quitar este bloque de la página", !info.canRemove, false, "fl-danger");
    return true;
  }

  function setActive(section: HTMLElement | null) {
    if (section === active) return;
    active?.classList.remove("fl-active");
    active = section;
    if (section && renderBar(section)) {
      section.classList.add("fl-active");
      section.appendChild(wrap);
      placeBar();
    } else {
      active = null;
      wrap.remove();
    }
  }

  const sectionOf = (t: EventTarget | null) => asElement(t)?.closest<HTMLElement>("section[data-sec]") ?? null;

  const readValue = (el: HTMLElement) => {
    const raw = MULTILINE.test(el.dataset.edit ?? "") ? el.innerText : (el.textContent ?? "");
    return raw.replace(/ /g, " ");
  };

  // Puts the caret where the person clicked (or at the end if that spot is outside the text).
  function placeCaret(el: HTMLElement, x: number, y: number) {
    const d = doc as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    };
    let range: Range | null = null;
    if (d.caretRangeFromPoint) range = d.caretRangeFromPoint(x, y);
    else if (d.caretPositionFromPoint) {
      const pos = d.caretPositionFromPoint(x, y);
      if (pos) {
        range = doc.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
      }
    }
    if (!range || !el.contains(range.startContainer)) {
      range = doc.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
    }
    const selection = win!.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  function startEditing(el: HTMLElement) {
    editing = el;
    original = readValue(el);
    el.classList.add("fl-editing");
    el.setAttribute("contenteditable", "plaintext-only");
    // Browsers without plaintext-only fall back to plain contenteditable (paste is cleaned below).
    if (el.contentEditable !== "plaintext-only") el.setAttribute("contenteditable", "true");
    el.focus();
  }

  function stopEditing(el: HTMLElement) {
    el.removeAttribute("contenteditable");
    el.classList.remove("fl-editing");
  }

  async function commit(el: HTMLElement) {
    if (editing !== el) return;
    editing = null;
    stopEditing(el);
    const path = el.dataset.edit ?? "";
    const before = original;
    const value = MULTILINE.test(path) ? readValue(el).trim() : readValue(el).replace(/\s+/g, " ").trim();
    if (value === before.trim() || value === before) {
      el.textContent = before;
      return;
    }
    el.textContent = value;
    const result = await getHandlers().saveText(path, value);
    if (!result.ok) {
      el.textContent = before;
      getHandlers().notice(result.error ?? "No se pudo guardar el cambio");
    }
  }

  function cancel(el: HTMLElement) {
    if (editing !== el) return;
    editing = null;
    stopEditing(el);
    el.textContent = original;
    el.blur();
  }

  const onMouseOver = (e: MouseEvent) => {
    const section = sectionOf(e.target);
    if (section) setActive(section);
  };

  const onMouseDown = (e: MouseEvent) => {
    const t = asElement(e.target);
    if (!t || t.closest(".fl-bar-wrap")) return;
    const el = t.closest<HTMLElement>("[data-edit]");
    if (!el || el === editing) return;
    if (editing) void commit(editing);
    // The browser's own click handling would move the focus away from an element that
    // only just became editable: do the focusing ourselves.
    e.preventDefault();
    startEditing(el);
    placeCaret(el, e.clientX, e.clientY);
  };

  const onClick = (e: MouseEvent) => {
    const t = asElement(e.target);
    if (!t) return;
    const button = t.closest<HTMLElement>(".fl-bar-wrap button");
    if (button) {
      e.preventDefault();
      e.stopPropagation();
      if (!active) return;
      const index = Number(active.dataset.sec);
      const h = getHandlers();
      const act = button.dataset.act;
      if (act === "bg") h.pickImage(index, "bgImage");
      else if (act === "style") h.style(index);
      else if (act === "up") h.move(index, -1);
      else if (act === "down") h.move(index, 1);
      else if (act === "add") h.add(index);
      else if (act === "dup") h.duplicate(index);
      else if (act === "del") h.remove(index);
      else if (act === "hide") h.hide(index);
      return;
    }
    // The page's own links, buttons and form must not do anything while editing.
    if (t.closest("a, summary, button, label, form")) e.preventDefault();
    const plus = t.closest(".faq-plus");
    if (plus) {
      const d = plus.closest("details");
      if (d) d.open = !d.open;
    }
    const noted = t.closest<HTMLElement>("[data-note]");
    if (noted?.dataset.note) {
      e.preventDefault();
      getHandlers().notice(noted.dataset.note);
      return;
    }
    const codeBtn = t.closest<HTMLElement>("[data-code-edit]");
    if (codeBtn) {
      e.preventDefault();
      getHandlers().code(Number(codeBtn.dataset.codeEdit));
      return;
    }
    const img = t.closest<HTMLElement>("[data-img]");
    if (img) {
      e.preventDefault();
      getHandlers().pickImage(Number(img.dataset.img), "image");
      return;
    }
    const section = sectionOf(t);
    if (section) {
      setActive(section);
      getHandlers().select(Number(section.dataset.sec));
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const el = editing;
    // Undo / redo work from the page too, except while typing in a text (the text has its own).
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !(el && isInside(el, e.target))) {
      e.preventDefault();
      if (e.shiftKey) getHandlers().redo();
      else getHandlers().undo();
      return;
    }
    if (!el || !isInside(el, e.target)) return;
    // Keys typed in a title inside a <summary> must not fold the answer.
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      cancel(el);
    } else if (e.key === "Enter") {
      const multiline = MULTILINE.test(el.dataset.edit ?? "");
      if (!multiline || e.ctrlKey || e.metaKey) {
        e.preventDefault();
        el.blur();
      }
    }
  };

  // Space released inside a <summary> toggles it in some browsers.
  const onKeyUp = (e: KeyboardEvent) => {
    if (editing && isInside(editing, e.target)) {
      e.stopPropagation();
      if (e.key === " ") e.preventDefault();
    }
  };

  const onPaste = (e: ClipboardEvent) => {
    const el = editing;
    if (!el || !isInside(el, e.target)) return;
    e.preventDefault();
    const raw = e.clipboardData?.getData("text/plain") ?? "";
    doc.execCommand("insertText", false, MULTILINE.test(el.dataset.edit ?? "") ? raw : raw.replace(/\s+/g, " "));
  };

  const onFocusOut = (e: FocusEvent) => {
    const el = editing;
    if (el && e.target === el) void commit(el);
  };

  const onSubmit = (e: Event) => e.preventDefault();
  const onScroll = () => placeBar();

  // A small label over the text under the pointer, so it is clear that it can be written on.
  const chip = doc.createElement("div");
  chip.className = "fl-chip";
  chip.setAttribute("contenteditable", "false");
  let chipFor: HTMLElement | null = null;
  const hideChip = () => {
    chipFor = null;
    chip.remove();
  };
  const onChipOver = (e: MouseEvent) => {
    const el = asElement(e.target)?.closest<HTMLElement>("[data-edit]") ?? null;
    if (!el || el === editing || el.classList.contains("fl-editing")) return hideChip();
    if (el === chipFor) return;
    chipFor = el;
    const r = el.getBoundingClientRect();
    chip.textContent = "✎ Toca para escribir aquí";
    doc.body.appendChild(chip);
    const top = r.top + win.scrollY - 28;
    chip.style.top = `${Math.max(win.scrollY + 4, top)}px`;
    chip.style.left = `${Math.min(Math.max(4, r.left + win.scrollX), Math.max(4, doc.documentElement.clientWidth - 190))}px`;
  };
  const onChipOut = (e: MouseEvent) => {
    if (!e.relatedTarget || !asElement(e.relatedTarget)?.closest("[data-edit]")) hideChip();
  };

  // Dragging a block from the library over the page: a line shows where it will land.
  const marker = doc.createElement("div");
  marker.className = "fl-drop";
  marker.setAttribute("contenteditable", "false");
  let dropAt: number | null = null;
  const hasNewBlock = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes(NEW_BLOCK_TYPE);
  const sections = () => Array.from(doc.querySelectorAll<HTMLElement>("section[data-sec]"));
  // A text, button or photo dragged over a block of the page: that block lights up and receives it.
  const hasNewExtra = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes(NEW_EXTRA_TYPE);
  const sectionAt = (e: DragEvent) => (doc.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>("section[data-sec]") ?? null;
  const onDragOver = (e: DragEvent) => {
    if (hasNewExtra(e)) {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      const target = sectionAt(e);
      if (target && Number(target.dataset.sec) >= 0) setActive(target);
      return;
    }
    if (!hasNewBlock(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    const list = sections();
    if (list.length === 0) return;
    // Between the two blocks the pointer is closest to; never above the portada.
    let at = Number(list[list.length - 1].dataset.sec) + 1;
    let y = list[list.length - 1].getBoundingClientRect().bottom + win.scrollY;
    for (const s of list) {
      const r = s.getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) {
        at = Number(s.dataset.sec);
        y = r.top + win.scrollY;
        break;
      }
    }
    if (at < 1) {
      at = 1;
      const second = list.find((s) => Number(s.dataset.sec) === 1);
      y = second ? second.getBoundingClientRect().top + win.scrollY : y;
    }
    dropAt = at;
    marker.style.top = `${y}px`;
    doc.body.appendChild(marker);
  };
  const clearDrop = () => {
    dropAt = null;
    marker.remove();
  };
  const onDragLeave = (e: DragEvent) => {
    if (!e.relatedTarget) clearDrop();
  };
  const onDrop = (e: DragEvent) => {
    const extra = e.dataTransfer?.getData(NEW_EXTRA_TYPE);
    if (extra) {
      e.preventDefault();
      const target = sectionAt(e);
      if (target) getHandlers().dropExtra(extra, Number(target.dataset.sec));
      return;
    }
    const type = e.dataTransfer?.getData(NEW_BLOCK_TYPE);
    if (!type) return clearDrop();
    e.preventDefault();
    const at = dropAt;
    clearDrop();
    if (at !== null) getHandlers().dropBlock(type, at);
  };

  // The first time, the first text on the page pulses a few times: "this one you can write on".
  doc.querySelector<HTMLElement>("[data-edit]")?.classList.add("fl-pulse");

  doc.addEventListener("mouseover", onChipOver, true);
  doc.addEventListener("mouseout", onChipOut, true);
  doc.addEventListener("dragover", onDragOver, true);
  doc.addEventListener("dragleave", onDragLeave, true);
  doc.addEventListener("drop", onDrop, true);
  doc.addEventListener("dragend", clearDrop, true);
  doc.addEventListener("mouseover", onMouseOver, true);
  doc.addEventListener("mousedown", onMouseDown, true);
  doc.addEventListener("click", onClick, true);
  doc.addEventListener("keydown", onKeyDown, true);
  doc.addEventListener("keyup", onKeyUp, true);
  doc.addEventListener("paste", onPaste, true);
  doc.addEventListener("focusout", onFocusOut, true);
  doc.addEventListener("submit", onSubmit, true);
  win.addEventListener("scroll", onScroll, { passive: true });
  win.addEventListener("resize", onScroll, { passive: true });

  return () => {
    doc.removeEventListener("mouseover", onChipOver, true);
    doc.removeEventListener("mouseout", onChipOut, true);
    doc.removeEventListener("dragover", onDragOver, true);
    doc.removeEventListener("dragleave", onDragLeave, true);
    doc.removeEventListener("drop", onDrop, true);
    doc.removeEventListener("dragend", clearDrop, true);
    chip.remove();
    marker.remove();
    doc.removeEventListener("mouseover", onMouseOver, true);
    doc.removeEventListener("mousedown", onMouseDown, true);
    doc.removeEventListener("click", onClick, true);
    doc.removeEventListener("keydown", onKeyDown, true);
    doc.removeEventListener("keyup", onKeyUp, true);
    doc.removeEventListener("paste", onPaste, true);
    doc.removeEventListener("focusout", onFocusOut, true);
    doc.removeEventListener("submit", onSubmit, true);
    win.removeEventListener("scroll", onScroll);
    win.removeEventListener("resize", onScroll);
    wrap.remove();
    style.remove();
  };
}

/** Scrolls the preview to a block and outlines it for a moment, so the person sees which one the panel means. */
export function showSection(doc: Document, index: number, opts: { scroll?: boolean } = {}): void {
  const section = doc.querySelector<HTMLElement>(`section[data-sec="${index}"]`);
  if (!section) return;
  doc.querySelectorAll(".fl-picked").forEach((el) => el.classList.remove("fl-picked"));
  if (opts.scroll !== false) section.scrollIntoView({ behavior: "smooth", block: "start" });
  section.classList.add("fl-picked");
  setTimeout(() => section.classList.remove("fl-picked"), 1400);
}

/** Outlines a block of the preview while the pointer is on its row of the block list (null clears it). */
export function hoverSection(doc: Document, index: number | null): void {
  doc.querySelectorAll(".fl-hover").forEach((el) => el.classList.remove("fl-hover"));
  if (index === null) return;
  doc.querySelector<HTMLElement>(`section[data-sec="${index}"]`)?.classList.add("fl-hover");
}
