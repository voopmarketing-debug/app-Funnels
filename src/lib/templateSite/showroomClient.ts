// The Showroom page's browser code. Compiled to plain JS by scripts/build-site-scripts.mjs (npm run build:site-scripts)
// text (see showroom.ts). It must stay SELF-CONTAINED: no imports and no reference to anything
// outside its own body, because only its source text reaches the browser.

export type ShowroomClientData = {
  cars: {
    id: string;
    model: string;
    sub: string;
    frames: string[];
    price: number | null;
    cur: string;
    stats: [string, string, string][];
    bubbles: { t: string; d: string }[];
  }[];
  icons: Record<string, string>;
  fin: { months: number; rate: number; down: number };
  noun: string;
  months: string[];
};

export function showroomClient(D: ShowroomClientData): void {
  const doc = document;
  const $ = (id: string) => doc.getElementById(id) as HTMLElement & HTMLInputElement & HTMLSelectElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cars = D.cars;
  const N = cars.length;
  const money = (v: number, cur: string) => {
    const r = Math.round(v);
    return cur === "USD" ? "US$" + r.toLocaleString("en-US") : cur === "EUR" ? "€" + r.toLocaleString("de-DE") : "$" + r.toLocaleString("es-CO");
  };
  const cur0 = cars.length ? cars[0].cur : "COP";
  const fmt = (v: number) => money(v, cur0);
  const short = (v: number) => (v >= 1e6 ? "$ " + (v / 1e6).toLocaleString("es-CO", { maximumFractionDigits: 1 }) + " M" : fmt(v));
  const RATE = D.fin.rate / 100;
  const DOWN = D.fin.down / 100;
  const TERM = D.fin.months;
  const monthly = (p: number) => {
    const fin = p * (1 - DOWN);
    return RATE > 0 ? (fin * RATE) / (1 - Math.pow(1 + RATE, -TERM)) : fin / TERM;
  };
  const maxPriceFor = (m: number) => (RATE > 0 ? (m * (1 - Math.pow(1 + RATE, -TERM))) / RATE : m * TERM) / (1 - DOWN);
  const icon = (k: string) =>
    '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (D.icons[k] || D.icons.check || "") + "</svg>";
  const esc = (t: string) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  /* Month, countdown, glow and apparition */
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
        art.style.setProperty("--ry", (x - 0.5) * 14 + "deg");
        art.style.setProperty("--rx", (0.5 - y) * 8 + "deg");
      }
    });
    promo.addEventListener("pointerleave", () => {
      art.style.setProperty("--ry", "0deg");
      art.style.setProperty("--rx", "0deg");
    });
  }
  const reveals = doc.querySelectorAll<HTMLElement>(".reveal");
  if ("IntersectionObserver" in window && !reduce && doc.documentElement.getAttribute("data-fx") !== "off") {
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.remove("pre");
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        }),
      { threshold: 0.15 },
    );
    reveals.forEach((el, i) => {
      if (el.getBoundingClientRect().top > innerHeight) {
        el.classList.add("pre");
        el.style.transitionDelay = (i % 3) * 80 + "ms";
        io.observe(el);
      } else el.classList.add("in");
    });
  } else reveals.forEach((el) => el.classList.add("in"));

  /* Form: validated here, then it goes to the lead capture of the page */
  const form = $("bookForm") as unknown as HTMLFormElement;
  const d = new Date();
  d.setDate(d.getDate() + 1);
  if ($("f-date")) {
    $("f-date").value = d.toISOString().slice(0, 10);
    $("f-date").setAttribute("min", new Date().toISOString().slice(0, 10));
  }
  if (N && $("f-car")) {
    cars.forEach((c, i) => {
      const o = doc.createElement("option");
      o.value = String(i);
      o.textContent = c.model + (c.price !== null ? " · " + short(c.price) : "");
      $("f-car").appendChild(o);
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
      if (!$("f-name").value.trim()) return fail("Escribe tu nombre para poder confirmarte.", "f-name");
      if (!$("f-phone").value.trim()) return fail("Escribe tu celular para enviarte la confirmación.", "f-phone");
      if (!$("f-ok").checked) return fail("Marca la autorización de datos para enviar la solicitud.", "f-ok");
      const c = N ? cars[+$("f-car").value] : null;
      const bud = $("f-bud") && $("f-bud").value ? " Presupuesto: " + $("f-bud").value + "." : "";
      ($("f-msg") as HTMLInputElement).value = ((c ? "Quiere " + D.noun + ": " + c.model + ". " : "") + "Día: " + $("f-date").value + ", hora: " + $("f-time").value + "." + bud).slice(0, 480);
    });
  }

  if (!N) return;

  /* Viewer 360 */
  const stage = $("stage");
  const bubblesEl = $("bubbles");
  let cur = 0;
  let carEl: HTMLElement | null = null;
  let angle = 0;
  const arCache: Record<string, string> = {};
  const SLOTS = [
    { x: 92, y: 40, al: "r" },
    { x: 40, y: 6, al: "c" },
    { x: 80, y: 82, al: "r", down: 1 },
  ];
  function mountCar(i: number, animate: boolean) {
    const c = cars[i];
    if (carEl) carEl.remove();
    carEl = doc.createElement("div");
    carEl.className = "car" + (animate ? " enter" : "");
    carEl.style.setProperty("--ar", arCache[c.frames[0]] || "16/7");
    carEl.innerHTML = '<div class="spin">' + c.frames.map((f, k) => '<img src="' + esc(f) + '" alt="' + (k ? "" : esc(c.model)) + '" draggable="false" ' + (k ? "hidden" : "") + ">").join("") + "</div>";
    stage.insertBefore(carEl, bubblesEl);
    const first = carEl.querySelector("img");
    if (first) {
      const fit = () => {
        if (first.naturalWidth && carEl) {
          arCache[c.frames[0]] = first.naturalWidth + "/" + first.naturalHeight;
          carEl.style.setProperty("--ar", arCache[c.frames[0]]);
          placeBubbles();
        }
      };
      if (first.complete) fit();
      else first.addEventListener("load", fit);
    }
    angle = 0;
    render360();
    placeBubbles();
  }
  function placeBubbles() {
    if (!carEl) return;
    const c = cars[cur];
    bubblesEl.innerHTML = "";
    $("bubblesM").innerHTML = "";
    const mobile = matchMedia("(max-width:640px)").matches;
    const cw = carEl.offsetWidth;
    const ch = carEl.offsetHeight;
    const cl = carEl.offsetLeft - cw / 2;
    const ct = carEl.offsetTop;
    c.bubbles.slice(0, 3).forEach((b, k) => {
      const sl = SLOTS[k];
      const left = cl + (cw * sl.x) / 100;
      const top = ct + (ch * sl.y) / 100;
      const el = doc.createElement("div");
      el.className = "bubble" + (sl.down ? " down" : "");
      el.style.setProperty("--d", String(k));
      const tx = ({ l: "-14%", c: "-50%", r: "-86%" } as Record<string, string>)[sl.al];
      const tail = ({ l: "14%", c: "50%", r: "86%" } as Record<string, string>)[sl.al];
      el.style.setProperty("--tx", tx);
      el.style.setProperty("--tail", tail);
      if (!mobile) {
        el.style.left = left + "px";
        el.style.top = top + "px";
      }
      el.innerHTML = "<b>" + esc(b.t) + "</b><span>" + esc(b.d) + "</span>";
      (mobile ? $("bubblesM") : bubblesEl).appendChild(el);
    });
  }
  function render360() {
    if (!carEl) return;
    const c = cars[cur];
    const n = c.frames.length;
    const imgs = carEl.querySelectorAll("img");
    const a = ((angle % 360) + 360) % 360;
    const spin = carEl.querySelector(".spin") as HTMLElement;
    if (n >= 3) {
      const k = Math.round(a / (360 / n)) % n;
      imgs.forEach((im, j) => {
        im.hidden = j !== k;
      });
      spin.style.transform = "";
    } else {
      const tilt = Math.max(-14, Math.min(14, angle / 6));
      spin.style.transform = "rotateY(" + tilt + "deg)";
    }
    stage.classList.toggle("turned", n >= 3 ? Math.abs(a) > 8 && Math.abs(a - 360) > 8 : Math.abs(angle) > 20);
    $("hintBar").style.setProperty("--hp", 35 + (n >= 3 ? (a / 360 - 0.5) * 70 : (angle / 6 / 14) * 35) + "%");
  }
  let sx: number | null = null;
  let sa = 0;
  stage.addEventListener("pointerdown", (e: PointerEvent) => {
    sx = e.clientX;
    sa = angle;
    stage.classList.add("drag");
    try {
      stage.setPointerCapture(e.pointerId);
    } catch {
      /* the browser may refuse the capture; dragging still works */
    }
  });
  stage.addEventListener("pointermove", (e: PointerEvent) => {
    if (sx === null) return;
    angle = sa + (e.clientX - sx) * 0.6;
    render360();
  });
  const end = () => {
    if (sx === null) return;
    sx = null;
    stage.classList.remove("drag");
    if (cars[cur].frames.length < 3) {
      angle = 0;
      render360();
    }
  };
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);
  stage.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      angle += e.key === "ArrowRight" ? 30 : -30;
      render360();
      e.preventDefault();
      if (cars[cur].frames.length < 3)
        setTimeout(() => {
          angle = 0;
          render360();
        }, 500);
    }
  });
  addEventListener("resize", () => placeBubbles());

  /* Chooser and key facts */
  const chips = $("chips");
  cars.forEach((c, i) => {
    const b = doc.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.innerHTML = '<img src="' + esc(c.frames[0]) + '" alt=""><span><b>' + esc(c.model) + "</b><small>" + (c.price !== null ? short(c.price) : "") + "</small></span>";
    b.onclick = () => select(i, false);
    chips.appendChild(b);
  });
  function select(i: number, scroll: boolean) {
    cur = i;
    mountCar(i, !reduce);
    $("carName").innerHTML = esc(cars[i].model) + (cars[i].sub ? "<small>" + esc(cars[i].sub) + "</small>" : "");
    Array.from(chips.children).forEach((b, j) => b.setAttribute("aria-pressed", String(j === i)));
    $("stats").innerHTML = cars[i].stats.map((s) => '<div class="stat">' + icon(s[0]) + "<div><small>" + esc(s[1]) + "</small><b>" + esc(s[2]) + "</b></div></div>").join("");
    if ($("f-car")) $("f-car").value = String(i);
    if (scroll) $("vitrina").scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  }

  /* Quoter */
  const priced = cars.filter((c) => c.price !== null);
  if (priced.length >= 2 && $("budget")) {
    const prices = priced.map((c) => c.price as number).sort((a, b) => a - b);
    const nice = (v: number, up: boolean) => {
      const step = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(v, 1))) - 1));
      return (up ? Math.ceil(v / step) : Math.floor(v / step)) * step;
    };
    const mp = prices.map(monthly);
    const pick = (arr: number[]) => {
      const idx = [0, Math.floor((arr.length - 1) / 3), Math.floor(((arr.length - 1) * 2) / 3), arr.length - 1];
      return Array.from(new Set(idx)).map((k) => arr[k]);
    };
    const tmin = nice(prices[0] * 0.5, false);
    const tmax = nice(prices[prices.length - 1] * 1.15, true);
    const cmin = nice(mp[0] * 0.5, false);
    const cmax = nice(mp[mp.length - 1] * 1.15, true);
    const R: Record<string, { min: number; max: number; step: number; val: number; quick: number[] }> = {
      total: { min: tmin, max: tmax, step: Math.max(1, Math.round((tmax - tmin) / 100)), val: nice(prices[Math.floor(prices.length / 2)], false), quick: pick(prices).map((v) => nice(v, true)) },
      cuota: { min: cmin, max: cmax, step: Math.max(1, Math.round((cmax - cmin) / 100)), val: nice(mp[Math.floor(mp.length / 2)], false), quick: pick(mp).map((v) => nice(v, true)) },
    };
    let mode = "total";
    const bar = $("budget");
    const setMode = (m: string) => {
      mode = m;
      $("m-total").setAttribute("aria-pressed", String(m === "total"));
      $("m-cuota").setAttribute("aria-pressed", String(m === "cuota"));
      const r = R[m];
      bar.min = String(r.min);
      bar.max = String(r.max);
      bar.step = String(r.step);
      bar.value = String(r.val);
      $("minTxt").textContent = short(r.min);
      $("maxTxt").textContent = short(r.max);
      $("quick").innerHTML = r.quick.map((v) => '<button type="button" data-v="' + v + '">' + short(v) + (m === "cuota" ? " /mes" : "") + "</button>").join("");
      $("quick")
        .querySelectorAll("button")
        .forEach((b) => {
          (b as HTMLElement).onclick = () => {
            bar.value = (b as HTMLElement).dataset.v as string;
            update();
          };
        });
      update();
    };
    const update = () => {
      const r = R[mode];
      const v = +bar.value;
      r.val = v;
      bar.style.setProperty("--p", ((v - r.min) / (r.max - r.min)) * 100 + "%");
      const maxPrice = mode === "total" ? v : maxPriceFor(v);
      $("amount").innerHTML = fmt(v) + "<small>" + (mode === "total" ? "Precio total" : "Cuota mensual · " + (D.fin.down ? D.fin.down + " % de inicial · " : "") + TERM + " meses") + "</small>";
      const sim = RATE > 0 ? " Simulación con tasa de referencia de " + D.fin.rate.toLocaleString("es-CO") + " % mes vencido; la tasa final depende de la entidad." : " Simulación sin intereses; las condiciones reales las confirma un asesor.";
      $("reach").innerHTML =
        mode === "total"
          ? "Con este presupuesto te alcanzan los " + esc(D.noun) + "s de hasta <b>" + fmt(v) + "</b>."
          : "Con esta cuota te alcanzan los " + esc(D.noun) + "s de hasta <b>" + fmt(maxPrice) + "</b>" + (DOWN ? ", dando <b>" + fmt(maxPrice * DOWN) + "</b> de cuota inicial" : "") + "." + sim;
      if ($("f-bud")) $("f-bud").value = fmt(v) + (mode === "cuota" ? " al mes" : "");
      const sorted = cars.map((c, i) => ({ c, i })).filter((o) => o.c.price !== null).sort((a, b) => (a.c.price as number) - (b.c.price as number));
      const fits = sorted.filter((o) => (o.c.price as number) <= maxPrice).length;
      $("results").innerHTML =
        '<div class="res-head"><b>' + fits + " de " + sorted.length + " " + esc(D.noun) + "s te alcanzan</b><span class=\"mono\" style=\"color:var(--muted)\">Barra: cuánto usa de tu presupuesto</span></div>" +
        sorted
          .map((o) => {
            const c = o.c;
            const price = c.price as number;
            const need = mode === "total" ? price : monthly(price);
            const pct = need / v;
            const over = pct > 1;
            const suffix = mode === "cuota" ? " al mes" : "";
            const verdict = over ? "Te faltan " + fmt(need - v) + suffix : "Te alcanza · te sobran " + fmt(v - need) + suffix;
            return (
              '<article class="res' + (over ? " over" : "") + '"><img src="' + esc(c.frames[0]) + '" alt="">' +
              '<div class="nm">' + esc(c.model) + (c.sub ? "<small>" + esc(c.sub) + "</small>" : "") + "</div>" +
              '<div class="pr">' + fmt(price) + "<small>" + (mode === "cuota" ? "Cuota: " + fmt(need) + " al mes" : "o " + fmt(monthly(price)) + " al mes") + "</small></div>" +
              '<div class="track" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(Math.min(pct, 1) * 100) + '" aria-label="Uso del presupuesto"><i style="--w:' + Math.min(pct, 1) * 100 + '%"></i></div>' +
              '<span class="verdict">' + verdict + "</span>" +
              '<button class="ghost see" type="button" data-i="' + o.i + '">Verlo en 360° →</button></article>'
            );
          })
          .join("");
      $("results")
        .querySelectorAll(".see")
        .forEach((b) => {
          (b as HTMLElement).onclick = () => select(+((b as HTMLElement).dataset.i as string), true);
        });
    };
    bar.addEventListener("input", update);
    $("m-total").onclick = () => setMode("total");
    $("m-cuota").onclick = () => setMode("cuota");
    setMode("total");
  }

  select(0, false);
  addEventListener("load", () => placeBubbles());
}
