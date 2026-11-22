// The Scroll Story page's browser code, written as a normal function and shipped to the page as its
// text (see story.ts). It must stay SELF-CONTAINED: no imports and no reference to anything
// outside its own body, because only its source text reaches the browser.

export type StoryClientData = {
  items: {
    id: string;
    name: string;
    img: string;
    price: number | null;
    cur: string;
    zone: string;
    tag: string;
    what: string;
    res: string;
    dur: string;
    ses: string;
    after: string;
    pack: string;
  }[];
  collectionTitle: string;
  months: string[];
};

export function storyClient(D: StoryClientData): void {
  const doc = document;
  const $ = (id: string) => doc.getElementById(id) as HTMLElement & HTMLInputElement & HTMLSelectElement & HTMLDialogElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const T = D.items;
  const N = T.length;
  const esc = (t: string) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const fmt = (v: number, cur: string) => {
    const r = Math.round(v);
    return cur === "USD" ? "US$" + r.toLocaleString("en-US") : cur === "EUR" ? "€" + r.toLocaleString("de-DE") : "$" + r.toLocaleString("es-CO");
  };
  const priceOf = (t: (typeof T)[number]) => (t.price !== null ? fmt(t.price, t.cur) : "");

  /* Header turns solid as you scroll */
  const top = $("top");
  const onHead = () => top.classList.toggle("solid", scrollY > 40);
  addEventListener("scroll", onHead, { passive: true });
  onHead();

  /* The traveling product: one fixed image that glides between the anchors */
  const flyer = $("flyer");
  const anchors = Array.from(doc.querySelectorAll<HTMLElement>("[data-anchor]"));
  if (flyer && anchors.length >= 2) {
    const flyOK = () => !reduce && matchMedia("(min-width:901px)").matches;
    let ticking = false;
    const fly = () => {
      ticking = false;
      if (!flyOK()) {
        doc.documentElement.classList.remove("fly");
        return;
      }
      doc.documentElement.classList.add("fly");
      const vc = innerHeight / 2;
      const P = anchors.map((a) => {
        const r = a.getBoundingClientRect();
        return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height, rot: +(a.dataset.rot || 0) };
      });
      let a = P[0];
      let b = P[0];
      let t = 0;
      if (vc <= P[0].cy) {
        a = b = P[0];
      } else if (vc >= P[P.length - 1].cy) {
        a = b = P[P.length - 1];
      } else {
        for (let i = 0; i < P.length - 1; i++) {
          if (vc >= P[i].cy && vc <= P[i + 1].cy) {
            a = P[i];
            b = P[i + 1];
            t = (vc - P[i].cy) / (P[i + 1].cy - P[i].cy);
            break;
          }
        }
      }
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const L = (x: number, y: number) => x + (y - x) * e;
      const w = L(a.w, b.w);
      const h = L(a.h, b.h);
      const cx = L(a.cx, b.cx);
      const cy = L(a.cy, b.cy);
      const rot = L(a.rot, b.rot);
      const last = P[P.length - 1];
      const fade = vc > last.cy ? Math.max(0, 1 - (vc - last.cy) / (innerHeight * 0.35)) : 1;
      flyer.style.width = w + "px";
      flyer.style.height = h + "px";
      flyer.style.transform = "translate(" + (cx - w / 2) + "px," + (cy - h / 2) + "px) rotate(" + rot + "deg)";
      flyer.style.opacity = String(fade);
      const lastImg = anchors[anchors.length - 1].querySelector("img") as HTMLElement;
      lastImg.style.visibility = fade < 1 ? "visible" : "";
      lastImg.style.opacity = fade < 1 ? String(1 - fade) : "";
    };
    const req = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(fly);
      }
    };
    addEventListener("scroll", req, { passive: true });
    addEventListener("resize", req);
    fly();
    if (doc.fonts) doc.fonts.ready.then(req);
    addEventListener("load", req);
  }

  /* Banner, month, countdown, apparition */
  doc.querySelectorAll("[data-month]").forEach((n) => {
    n.textContent = D.months[new Date().getMonth()];
  });
  const pad = (n: number) => (n < 10 ? "0" + n : "" + n);
  if ($("cd-d")) {
    const tick = () => {
      const n = new Date();
      let ms = Math.max(0, new Date(n.getFullYear(), n.getMonth() + 1, 1).getTime() - n.getTime());
      const d = Math.floor(ms / 864e5);
      ms -= d * 864e5;
      const h = Math.floor(ms / 36e5);
      ms -= h * 36e5;
      const m = Math.floor(ms / 6e4);
      const s = Math.floor((ms - m * 6e4) / 1e3);
      $("cd-d").textContent = pad(d);
      $("cd-h").textContent = pad(h);
      $("cd-m").textContent = pad(m);
      $("cd-s").textContent = pad(s);
    };
    tick();
    setInterval(tick, 1000);
  }
  const promo = $("promo");
  const art = $("promoArt");
  if (promo && art) {
    promo.addEventListener("pointermove", (e: PointerEvent) => {
      const r = promo.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      promo.style.setProperty("--gx", x * 100 + "%");
      promo.style.setProperty("--gy", y * 100 + "%");
      if (!reduce) {
        art.style.setProperty("--ry", (x - 0.5) * 16 + "deg");
        art.style.setProperty("--rx", (0.5 - y) * 10 + "deg");
      }
    });
    promo.addEventListener("pointerleave", () => {
      art.style.setProperty("--ry", "0deg");
      art.style.setProperty("--rx", "0deg");
    });
  }
  if ("IntersectionObserver" in window && !reduce && doc.documentElement.getAttribute("data-fx") !== "off") {
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.remove("pre");
            io.unobserve(en.target);
          }
        }),
      { threshold: 0.15 },
    );
    doc.querySelectorAll(".reveal").forEach((el) => {
      if (el.getBoundingClientRect().top > innerHeight) {
        el.classList.add("pre");
        io.observe(el);
      }
    });
  }

  /* Form */
  const form = $("bookForm") as unknown as HTMLFormElement;
  const d = new Date();
  d.setDate(d.getDate() + 2);
  if ($("f-date")) {
    $("f-date").value = d.toISOString().slice(0, 10);
    $("f-date").setAttribute("min", new Date().toISOString().slice(0, 10));
  }
  const sel = $("f-tx");
  if (sel) {
    T.forEach((t, i) => {
      const o = doc.createElement("option");
      o.value = String(i);
      o.textContent = t.name;
      sel.appendChild(o);
    });
  }
  if (form) {
    form.addEventListener("submit", (e) => {
      const ok = $("ok");
      const fail = (msg: string, el: string) => {
        e.preventDefault();
        ok.hidden = false;
        ok.textContent = msg;
        $(el).focus();
      };
      if (!$("f-name").value.trim()) return fail("Escribe tu nombre para poder confirmarte la cita.", "f-name");
      if (!$("f-phone").value.trim()) return fail("Escribe tu celular para enviarte la confirmación.", "f-phone");
      if (!$("f-ok").checked) return fail("Marca la autorización de datos para enviar la solicitud.", "f-ok");
      const fr = (doc.querySelector('input[name="franja"]:checked') as HTMLInputElement).value;
      const t = N && sel ? T[+sel.value] : null;
      ($("f-msg") as HTMLInputElement).value = ((t ? "Interesado en: " + t.name + ". " : "") + "Día: " + $("f-date").value + ", franja: " + fr + ".").slice(0, 480);
    });
  }

  if (!N) return;

  /* The collection fan */
  if ($("colTitle")) $("colTitle").textContent = D.collectionTitle;
  const fan = $("fan");
  const M = Math.max(N * 3, 9);
  let c = 0;
  let dragged = false;
  type FanCard = { el: HTMLElement; v: number; k: number | null };
  const cards: FanCard[] = [];
  const openSheet = (i: number) => {
    si = i;
    tab = "que";
    fill();
    if (typeof sheet.showModal === "function") sheet.showModal();
    else sheet.setAttribute("open", "");
  };
  for (let v = 0; v < M; v++) {
    const t = T[v % N];
    const i = v % N;
    const el = doc.createElement("div");
    el.className = "card";
    el.setAttribute("role", "group");
    el.setAttribute("aria-label", t.name);
    el.innerHTML =
      (t.tag ? '<span class="tag">' + esc(t.tag) + "</span>" : "") +
      '<button class="heart" type="button" aria-label="Guardar ' + esc(t.name) + '" aria-pressed="false"><svg viewBox="0 0 16 16"><path d="M8 13.5S2 10 2 6a3 3 0 0 1 6-1 3 3 0 0 1 6 1c0 4-6 7.5-6 7.5z"/></svg></button>' +
      '<img src="' + esc(t.img) + '" alt="" draggable="false"><div class="meta"><span><b>' + esc(t.name) + "</b><small>" + (priceOf(t) ? "Desde " + priceOf(t) : esc(t.zone)) + '</small></span><svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true"><path d="M0 6h14M9 1l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></div>';
    (el.querySelector(".heart") as HTMLElement).onclick = (e) => {
      e.stopPropagation();
      const b = e.currentTarget as HTMLElement;
      b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true"));
    };
    el.addEventListener("click", () => {
      if (!dragged) openSheet(i);
    });
    fan.appendChild(el);
    cards.push({ el, v, k: null });
  }
  const dotsEl = $("fDots");
  dotsEl.innerHTML = T.map(() => "<i></i>").join("");
  const layout = () => {
    cards.forEach((o) => {
      let k = (((o.v - c) % M) + M) % M;
      if (k > M / 2) k -= M;
      const jumped = o.k !== null && Math.abs(k - o.k) > 2;
      o.el.classList.toggle("jump", jumped);
      o.el.style.setProperty("--k", String(k));
      o.el.style.opacity = String(Math.abs(k) > 3 ? 0 : Math.abs(k) > 2 ? 0.55 : 1);
      o.el.style.zIndex = String(10 - Math.abs(k));
      o.el.style.pointerEvents = Math.abs(k) > 2 ? "none" : "";
      o.k = k;
      o.el.querySelectorAll("button").forEach((b) => {
        b.tabIndex = k === 0 ? 0 : -1;
      });
    });
    Array.from(dotsEl.children).forEach((dd, i) => dd.classList.toggle("on", i === ((c % N) + N) % N));
  };
  const stepFan = (dir: number) => {
    c += dir;
    layout();
  };
  let auto: ReturnType<typeof setInterval> | null = reduce ? null : setInterval(() => stepFan(1), 3600);
  const stopAuto = () => {
    if (auto) {
      clearInterval(auto);
      auto = null;
    }
  };
  $("fPrev").onclick = () => {
    stopAuto();
    stepFan(-1);
  };
  $("fNext").onclick = () => {
    stopAuto();
    stepFan(1);
  };
  fan.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      stopAuto();
      stepFan(1);
      e.preventDefault();
    }
    if (e.key === "ArrowLeft") {
      stopAuto();
      stepFan(-1);
      e.preventDefault();
    }
  });
  let sx: number | null = null;
  fan.addEventListener("pointerdown", (e: PointerEvent) => {
    sx = e.clientX;
    dragged = false;
  });
  addEventListener("pointermove", (e: PointerEvent) => {
    if (sx !== null && Math.abs(e.clientX - sx) > 8) dragged = true;
  });
  addEventListener("pointerup", (e: PointerEvent) => {
    if (sx === null) return;
    const dx = e.clientX - sx;
    sx = null;
    if (Math.abs(dx) > 50) {
      stopAuto();
      stepFan(dx < 0 ? 1 : -1);
    }
    setTimeout(() => {
      dragged = false;
    }, 0);
  });
  fan.addEventListener("pointerenter", stopAuto);
  layout();

  /* The sheet of a product */
  const sheet = $("sheet");
  let si = 0;
  let tab = "que";
  const has = (t: (typeof T)[number], k: string) => (k === "res" ? !!(t.res || t.ses || t.after) : true);
  const renderPanel = () => {
    const t = T[si];
    const p = $("s-panel");
    (["que", "res", "inv"] as const).forEach((k) => {
      const b = $("t-" + k);
      b.setAttribute("aria-selected", String(k === tab));
      b.hidden = !has(t, k);
    });
    p.setAttribute("aria-labelledby", "t-" + tab);
    const row = (a: string, b: string) => (b ? "<dt>" + a + "</dt><dd>" + esc(b) + "</dd>" : "");
    if (tab === "que") p.innerHTML = "<p>" + esc(t.what) + '</p><dl class="kv">' + row("Duración", t.dur) + row("Zona", t.zone) + "</dl>";
    if (tab === "res") p.innerHTML = "<p>" + esc(t.res) + '</p><dl class="kv">' + row("Sesiones", t.ses) + row("Después", t.after) + "</dl>";
    if (tab === "inv")
      p.innerHTML = priceOf(t)
        ? '<span class="small">Desde</span><div class="big-price">' + priceOf(t) + '</div><p class="small" style="margin-top:8px">' + esc(t.pack ? t.pack + ". " : "") + "El valor final se confirma con el negocio.</p>"
        : '<p class="small">Escríbenos y te contamos el valor.</p>';
  };
  const fill = () => {
    const t = T[si];
    $("s-count").textContent = pad(si + 1) + " / " + pad(N) + (t.tag ? "  ·  " + t.tag : "");
    $("s-name").textContent = t.name;
    $("s-sub").textContent = t.zone;
    $("s-art").innerHTML = '<img src="' + esc(t.img) + '" alt="' + esc(t.name) + '">';
    renderPanel();
  };
  $("s-prev").onclick = () => {
    si = (si - 1 + N) % N;
    tab = "que";
    fill();
  };
  $("s-next").onclick = () => {
    si = (si + 1) % N;
    tab = "que";
    fill();
  };
  $("s-close").onclick = () => sheet.close();
  sheet.addEventListener("click", (e) => {
    if (e.target === sheet) sheet.close();
  });
  (["que", "res", "inv"] as const).forEach((k) => {
    $("t-" + k).onclick = () => {
      tab = k;
      renderPanel();
    };
  });
  $("s-book").onclick = () => {
    sheet.close();
    if (sel) sel.value = String(si);
    $("agenda").scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    setTimeout(() => $("f-name").focus({ preventScroll: true }), 600);
  };
}
