// Click-to-edit for the builder's live preview, like the visual editors people
// already know: tap any text to type on it, tap a picture to replace it, and
// hover (or tap) a block to get its own small toolbar.
//
// The preview is the real page (/sitio/<slug>?preview=1&edit=1) in a
// same-origin iframe. In that mode the page marks what can be edited
// (data-edit="<path of the text>", data-img="<section>", data-sec="<section>");
// this module, running in the dashboard, listens to the iframe's document.
// Nothing runs inside the public page itself (it ships with script-src 'none').

import { joinMarks, parseMarks } from "@/lib/textMarks";

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
  dropExtra(kind: string, index: number, cell?: number): void;
  /** The "+" of the end of the page: an empty container (with its structure picker) is added there. */
  addContainer(): void;
  /** The list of ready-made blocks. */
  openLibrary(): void;
  /** A structure was picked in an empty Contenedor (or changed): its elements are laid out again. */
  layoutStructure(index: number, structure: string): void;
  /** An element (title, text, button, photo) goes into a column of a Contenedor. */
  addToCell(index: number, cell: number, kind: string): void;
  removeFromCell(index: number, cell: number, item: number): void;
  /** A block was touched in the page: the side panel follows it. */
  select(index: number): void;
  undo(): void;
  redo(): void;
  section(index: number): SectionInfo | null;
  notice(message: string): void;
  /** The page's own colors, offered as quick choices for one text. */
  palette(): string[];
  /** Saves the color of one text ("sections.2.heading"); null brings the automatic color back. */
  setTextColor(path: string, color: string | null): void;
  /** An element of the page was chosen (clicked to edit): its settings open on the left. */
  inspect(path: string, kind: "button" | "text"): void;
  /** The page's logo: opens the photo window / takes it off (the top bar goes back to the name). */
  pickLogo(): void;
  removeLogo(): void;
  /** A color of the page's top bar: its background, its button or its text (null: automatic). */
  setHeaderColor(key: "headerBg" | "headerBtn" | "headerColor", color: string | null): void;
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
.fl-tc{position:absolute;z-index:2147483300;display:flex;align-items:center;gap:6px;padding:6px 8px;background:#111827;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.45);font:600 11px/1 system-ui,sans-serif;color:#9ca3af;white-space:nowrap}
.fl-tc.col{flex-direction:column;align-items:stretch;gap:8px}
.fl-tc .row{display:flex;align-items:center;gap:6px}
.fl-tc .row>span.lab{min-width:46px}
.fl-tc button.sw{all:unset;box-sizing:border-box;width:20px;height:20px;border-radius:50%;border:2px solid rgba(255,255,255,.55);cursor:pointer}
.fl-tc button.sw:hover{border-color:#fff}
.fl-tc button.auto{all:unset;box-sizing:border-box;cursor:pointer;padding:5px 8px;border-radius:8px;color:#fff;font:600 11px/1 system-ui,sans-serif}
.fl-tc button.auto:hover{background:#374151}
.fl-tc input[type=color]{width:24px;height:24px;padding:0;border:0;background:none;cursor:pointer}
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

  // A text may have colored parts (see lib/textMarks.ts): reading it gives the stored form (with the marks),
  // writing it draws the colored parts as spans.
  const toHex = (css: string): string | null => {
    const m = css.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (m) return "#" + [1, 2, 3].map((i) => Math.min(255, Number(m[i])).toString(16).padStart(2, "0")).join("");
    return /^#[0-9a-fA-F]{6}$/.test(css.trim()) ? css.trim().toLowerCase() : null;
  };
  const collect = (node: Node, color: string | null, out: { text: string; color: string | null }[]) => {
    if (node.nodeType === 3) {
      out.push({ text: (node.textContent ?? "").replace(/\u00a0/g, " "), color });
      return;
    }
    if (node.nodeType !== 1) return;
    const e = node as HTMLElement;
    if (e.tagName === "BR") {
      out.push({ text: "\n", color: null });
      return;
    }
    const own = e.style?.color ? (toHex(e.style.color) ?? color) : color;
    if ((e.tagName === "DIV" || e.tagName === "P") && out.length) out.push({ text: "\n", color: null });
    e.childNodes.forEach((child) => collect(child, own, out));
  };
  const readValue = (el: HTMLElement) => {
    const parts: { text: string; color: string | null }[] = [];
    el.childNodes.forEach((child) => collect(child, null, parts));
    return joinMarks(parts);
  };
  const setMarked = (el: HTMLElement, value: string) => {
    el.textContent = "";
    for (const part of parseMarks(value)) {
      if (part.color) {
        const span = doc.createElement("span");
        span.style.color = part.color;
        span.textContent = part.text;
        el.appendChild(span);
      } else el.appendChild(doc.createTextNode(part.text));
    }
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

  // Color of one text: a small bar next to the text being edited (the whole text, not the whole block).
  let tc: HTMLElement | null = null;
  let tcFor: HTMLElement | null = null;
  // The words selected inside the text being edited (the color then goes to those words only).
  let lastRange: Range | null = null;
  const onSelectionChange = () => {
    const target = editing ?? tcFor;
    const sel = win.getSelection();
    if (!target || !sel || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    if (target.contains(r.commonAncestorContainer)) lastRange = r.collapsed ? null : r.cloneRange();
  };
  /** Colors only the selected words (or takes the color off them with null). Returns false when nothing is selected. */
  function colorSelection(el: HTMLElement, path: string, color: string | null): boolean {
    const range = lastRange;
    if (!range || range.collapsed || !el.contains(range.commonAncestorContainer)) return false;
    const sel = win!.getSelection();
    if (!sel) return false;
    el.setAttribute("contenteditable", "true");
    sel.removeAllRanges();
    sel.addRange(range);
    doc.execCommand("styleWithCSS", false, "true");
    if (color) doc.execCommand("foreColor", false, color);
    else doc.execCommand("removeFormat");
    const value = readValue(el);
    original = value;
    if (sel.rangeCount > 0) lastRange = sel.getRangeAt(0).cloneRange();
    if (editing !== el) el.removeAttribute("contenteditable");
    void getHandlers().saveText(path, value);
    return true;
  }
  function hideColors() {
    lastRange = null;
    tc?.remove();
    tc = null;
    tcFor = null;
  }
  function showColors(el: HTMLElement) {
    hideColors();
    const path = el.dataset.edit ?? "";
    // Only the texts of a block (not the top announcement) can carry their own color.
    if (!/^sections\.\d+\./.test(path)) return;
    const h = getHandlers();
    // Pages that cannot store a text color (Showroom / Scroll Story) offer no palette.
    if (h.palette().length === 0) return;
    const box = doc.createElement("div");
    box.className = "fl-tc";
    box.setAttribute("role", "toolbar");
    box.setAttribute("aria-label", "Color de este texto");
    const apply = (color: string | null) => {
      if (colorSelection(el, path, color)) return;
      if (color) {
        el.setAttribute("data-fc", path);
        el.style.setProperty("color", color, "important");
      } else {
        el.removeAttribute("data-fc");
        el.style.removeProperty("color");
      }
      h.setTextColor(path, color);
    };
    const label = doc.createElement("span");
    label.textContent = "Color";
    box.appendChild(label);
    const seen = new Set<string>();
    for (const c of [...h.palette(), "#ffffff", "#111827"]) {
      const hex = c.toLowerCase();
      if (!/^#[0-9a-f]{6}$/.test(hex) || seen.has(hex)) continue;
      seen.add(hex);
      const b = doc.createElement("button");
      b.type = "button";
      b.className = "sw";
      b.style.background = hex;
      b.title = hex;
      b.setAttribute("aria-label", `Color ${hex}`);
      b.addEventListener("click", () => apply(hex));
      box.appendChild(b);
    }
    const pick = doc.createElement("input");
    pick.type = "color";
    pick.title = "Elegir otro color";
    pick.setAttribute("aria-label", "Elegir otro color");
    const current = win!.getComputedStyle(el).color.match(/\d+/g);
    if (current && current.length >= 3) pick.value = "#" + current.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, "0")).join("");
    pick.addEventListener("input", () => {
      if (!lastRange) apply(pick.value);
    });
    pick.addEventListener("change", () => apply(pick.value));
    box.appendChild(pick);
    const auto = doc.createElement("button");
    auto.type = "button";
    auto.className = "auto";
    auto.textContent = "Auto";
    auto.title = "Volver al color automático";
    auto.addEventListener("click", () => apply(null));
    box.appendChild(auto);
    // The buttons must not take the focus away from the text being edited.
    box.addEventListener("mousedown", (e) => {
      if ((e.target as HTMLElement).tagName !== "INPUT") e.preventDefault();
    });
    doc.body.appendChild(box);
    const r = el.getBoundingClientRect();
    const top = r.top + (win!.scrollY || 0);
    box.style.top = `${top > 56 ? top - 46 : r.bottom + (win!.scrollY || 0) + 8}px`;
    box.style.left = `${Math.max(8, Math.min(r.left + (win!.scrollX || 0), doc.documentElement.clientWidth - box.offsetWidth - 8))}px`;
    tc = box;
    tcFor = el;
  }

  // The top bar: the name or the logo (write the name, or put / change / take off the logo) and its colors.
  function showBrandBar(el: HTMLElement) {
    hideColors();
    const h = getHandlers();
    const header = el.closest<HTMLElement>("header.top") ?? el;
    const hasLogo = !!header.querySelector("img[data-logo]");
    const box = doc.createElement("div");
    box.className = "fl-tc col";
    box.setAttribute("role", "toolbar");
    box.setAttribute("aria-label", "Menú de la página");
    const top = doc.createElement("div");
    top.className = "row";
    const add = (text: string, title: string, fn: () => void) => {
      const b = doc.createElement("button");
      b.type = "button";
      b.className = "auto";
      b.textContent = text;
      b.title = title;
      b.addEventListener("click", fn);
      top.appendChild(b);
    };
    add(hasLogo ? "Cambiar logo" : "Poner logo", "Subir o elegir tu logo", () => h.pickLogo());
    if (hasLogo) add("Usar texto", "Quitar el logo y escribir el nombre", () => h.removeLogo());
    else {
      const hint = doc.createElement("span");
      hint.textContent = "o escribe el nombre";
      top.appendChild(hint);
    }
    box.appendChild(top);
    // One row per color: quick colors of the page, any other color, and back to automatic.
    const colorRow = (label: string, key: "headerBg" | "headerBtn" | "headerColor", cssVar: string, property: string) => {
      const row = doc.createElement("div");
      row.className = "row";
      const lab = doc.createElement("span");
      lab.className = "lab";
      lab.textContent = label;
      row.appendChild(lab);
      const live = (color: string | null) => {
        if (color) {
          header.classList.add("hc");
          header.style.setProperty(cssVar, color);
        } else header.style.removeProperty(cssVar);
        h.setHeaderColor(key, color);
      };
      const seen = new Set<string>();
      for (const c of [...h.palette(), "#ffffff", "#111827"]) {
        const hex = c.toLowerCase();
        if (!/^#[0-9a-f]{6}$/.test(hex) || seen.has(hex)) continue;
        seen.add(hex);
        const b = doc.createElement("button");
        b.type = "button";
        b.className = "sw";
        b.style.background = hex;
        b.title = hex;
        b.setAttribute("aria-label", `${label}: ${hex}`);
        b.addEventListener("click", () => live(hex));
        row.appendChild(b);
      }
      const pick = doc.createElement("input");
      pick.type = "color";
      pick.title = "Elegir otro color";
      pick.setAttribute("aria-label", `${label}: otro color`);
      const target = property === "background" ? header : (header.querySelector<HTMLElement>(property === "color" ? ".brand" : ".btn") ?? header);
      const current = win!.getComputedStyle(target)[property === "background" ? "backgroundColor" : "color"].match(/\d+/g);
      if (current && current.length >= 3) pick.value = "#" + current.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, "0")).join("");
      pick.addEventListener("change", () => live(pick.value));
      row.appendChild(pick);
      const auto = doc.createElement("button");
      auto.type = "button";
      auto.className = "auto";
      auto.textContent = "Auto";
      auto.title = "Volver al color automático";
      auto.addEventListener("click", () => live(null));
      row.appendChild(auto);
      box.appendChild(row);
    };
    colorRow("Fondo", "headerBg", "--hbg", "background");
    colorRow("Botón", "headerBtn", "--hbtn", "backgroundColor");
    colorRow("Texto", "headerColor", "--hc", "color");
    box.addEventListener("mousedown", (e) => {
      if ((e.target as HTMLElement).tagName !== "INPUT") e.preventDefault();
    });
    doc.body.appendChild(box);
    const r = header.getBoundingClientRect();
    box.style.top = `${r.bottom + (win!.scrollY || 0) + 8}px`;
    box.style.left = `${Math.max(8, Math.min(r.left + (win!.scrollX || 0) + 8, doc.documentElement.clientWidth - box.offsetWidth - 8))}px`;
    tc = box;
    tcFor = el;
  }

  // The "+" of an empty column: choose what goes in (title, text, button, photo).
  function showCellMenu(anchor: HTMLElement, where: string) {
    hideColors();
    const [si, ci] = where.split(".").map(Number);
    const box = doc.createElement("div");
    box.className = "fl-tc";
    box.setAttribute("role", "toolbar");
    box.setAttribute("aria-label", "Agregar un elemento");
    for (const [kind, label] of [["heading", "Título"], ["text", "Texto"], ["button", "Botón"], ["image", "Foto"]] as const) {
      const b = doc.createElement("button");
      b.type = "button";
      b.className = "auto";
      b.textContent = label;
      b.addEventListener("click", () => {
        hideColors();
        getHandlers().addToCell(si, ci, kind);
      });
      box.appendChild(b);
    }
    box.addEventListener("mousedown", (e) => e.preventDefault());
    doc.body.appendChild(box);
    const r = anchor.getBoundingClientRect();
    box.style.top = `${r.top + (win!.scrollY || 0) - 44}px`;
    box.style.left = `${Math.max(8, Math.min(r.left + (win!.scrollX || 0), doc.documentElement.clientWidth - box.offsetWidth - 8))}px`;
    tc = box;
    tcFor = anchor;
  }

  function startEditing(el: HTMLElement) {
    lastRange = null;
    editing = el;
    original = readValue(el);
    el.classList.add("fl-editing");
    el.setAttribute("contenteditable", "plaintext-only");
    // Browsers without plaintext-only fall back to plain contenteditable (paste is cleaned below).
    if (el.contentEditable !== "plaintext-only") el.setAttribute("contenteditable", "true");
    el.focus();
    if (el.dataset.edit === "chrome.brandName") showBrandBar(el);
    else showColors(el);
    if (el.dataset.edit && !/^chrome\.(brandName|footer)/.test(el.dataset.edit)) getHandlers().inspect(el.dataset.edit, el.closest(".btn") ? "button" : "text");
  }

  function stopEditing(el: HTMLElement) {
    el.removeAttribute("contenteditable");
    el.classList.remove("fl-editing");
    // The color bar stays a moment (the color picker takes the focus) and goes away when nothing in it is in use.
    win!.setTimeout(() => {
      if (tcFor === el && !(tc && tc.contains(doc.activeElement))) hideColors();
    }, 300);
  }

  async function commit(el: HTMLElement) {
    if (editing !== el) return;
    editing = null;
    stopEditing(el);
    const path = el.dataset.edit ?? "";
    const before = original;
    const value = MULTILINE.test(path) ? readValue(el).trim() : readValue(el).replace(/\s+/g, " ").trim();
    if (value === before.trim() || value === before) return;
    setMarked(el, value);
    const result = await getHandlers().saveText(path, value);
    if (!result.ok) {
      setMarked(el, before);
      getHandlers().notice(result.error ?? "No se pudo guardar el cambio");
    }
  }

  function cancel(el: HTMLElement) {
    if (editing !== el) return;
    editing = null;
    stopEditing(el);
    setMarked(el, original);
    el.blur();
  }

  const onMouseOver = (e: MouseEvent) => {
    const section = sectionOf(e.target);
    if (section) setActive(section);
  };

  const onMouseDown = (e: MouseEvent) => {
    const t = asElement(e.target);
    if (!t || t.closest(".fl-bar-wrap") || t.closest(".fl-tc")) return;
    const hdr = t.closest<HTMLElement>("header.top");
    if (hdr && !t.closest("[data-edit]")) {
      e.preventDefault();
      if (editing) void commit(editing);
      showBrandBar(hdr);
      return;
    }
    const el = t.closest<HTMLElement>("[data-edit]");
    if (!el) hideColors();
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
    if (t.closest(".fl-tc")) return;
    if (t.closest("[data-add-container]")) {
      e.preventDefault();
      getHandlers().addContainer();
      return;
    }
    if (t.closest("[data-open-library]")) {
      e.preventDefault();
      getHandlers().openLibrary();
      return;
    }
    const struct = t.closest<HTMLElement>("[data-struct]");
    if (struct) {
      e.preventDefault();
      const sec = sectionOf(t);
      if (sec && struct.dataset.struct) getHandlers().layoutStructure(Number(sec.dataset.sec), struct.dataset.struct);
      return;
    }
    const cellDel = t.closest<HTMLElement>("[data-cell-del]");
    if (cellDel?.dataset.cellDel) {
      e.preventDefault();
      const [si, ci, ki] = cellDel.dataset.cellDel.split(".").map(Number);
      getHandlers().removeFromCell(si, ci, ki);
      return;
    }
    const cellAdd = t.closest<HTMLElement>("[data-cell-add]");
    if (cellAdd?.dataset.cellAdd) {
      e.preventDefault();
      showCellMenu(cellAdd, cellAdd.dataset.cellAdd);
      return;
    }
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
      // The column under the pointer lights up: that is where the element lands.
      const over = (doc.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-cell]") ?? null;
      doc.querySelectorAll(".fl-cell-over").forEach((c) => c !== over && c.classList.remove("fl-cell-over"));
      over?.classList.add("fl-cell-over");
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
    doc.querySelectorAll(".fl-cell-over").forEach((c) => c.classList.remove("fl-cell-over"));
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
      doc.querySelectorAll(".fl-cell-over").forEach((c) => c.classList.remove("fl-cell-over"));
      const target = sectionAt(e);
      const cellEl = asElement(e.target)?.closest<HTMLElement>("[data-cell]");
      if (target) getHandlers().dropExtra(extra, Number(target.dataset.sec), cellEl?.dataset.cell ? Number(cellEl.dataset.cell.split(".")[1]) : undefined);
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
  doc.addEventListener("selectionchange", onSelectionChange);
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
    doc.removeEventListener("selectionchange", onSelectionChange);
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
