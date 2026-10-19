#!/usr/bin/env node
// Funnels Labs's internal prospecting tracker. Not part of the platform: two
// CSV files (leads + activity) and the commands the sales agent uses to add
// leads, log every touch, see who to follow up today and get the metrics.
//
//   node ventas/scripts/ventas.mjs <command> [...]
//
// Data lives in ventas/datos/ (git-ignored: the repo is public and these are
// real people). Override it with VENTAS_DIR=/some/folder.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = process.env.VENTAS_DIR ? path.resolve(process.env.VENTAS_DIR) : path.join(ROOT, "datos");
const LEADS = path.join(DIR, "leads.csv");
const ACTIVIDAD = path.join(DIR, "actividad.csv");

export const LEAD_COLS = [
  "id", "fecha_alta", "negocio", "contacto", "cargo", "segmento", "ciudad", "pais",
  "canal", "instagram", "facebook", "linkedin", "email", "email_estado", "whatsapp", "web",
  "fuente", "gancho", "prioridad", "etapa", "toques", "ultimo_toque", "proximo_toque", "notas",
];
export const ACT_COLS = ["fecha", "lead_id", "canal", "tipo", "plantilla", "nota"];

export const CANALES = ["instagram", "facebook", "linkedin", "email", "whatsapp", "referido", "otro"];

// Pipeline stages, in order. The last three are closed.
export const ETAPAS = ["nuevo", "contactado", "respondio", "interesado", "reunion", "prueba", "cliente", "perdido", "sin_respuesta", "no_contactar"];
const CERRADAS = new Set(["cliente", "perdido", "sin_respuesta", "no_contactar"]);

// What each kind of touch does to the lead. `salida` = an outreach message we
// sent (counts as a contact attempt and moves the follow-up cadence).
const TIPOS = {
  calentar: { etapa: null, salida: false }, // like / comment / story reply before the first message
  mensaje: { etapa: "contactado", salida: true }, // first message
  seguimiento: { etapa: null, salida: true },
  conexion: { etapa: null, salida: false }, // LinkedIn connection request
  conexion_aceptada: { etapa: null, salida: false },
  respuesta: { etapa: "respondio", salida: false },
  interesado: { etapa: "interesado", salida: false },
  reunion_agendada: { etapa: "reunion", salida: false },
  reunion_hecha: { etapa: "reunion", salida: false },
  no_asistio: { etapa: "interesado", salida: false },
  prueba: { etapa: "prueba", salida: false },
  cliente: { etapa: "cliente", salida: false },
  perdido: { etapa: "perdido", salida: false },
  no_contactar: { etapa: "no_contactar", salida: false },
  rebote: { etapa: null, salida: false }, // email bounced
};

// Days to wait after the Nth outreach before the next one. After the last
// one with no reply the lead goes to "sin_respuesta" (revive in 90 days).
export const CADENCIA = [3, 4, 7, 14];
// Next step after a reply-type touch, if no date is given.
const DESPUES = { respuesta: 1, interesado: 1, reunion_agendada: null, reunion_hecha: 1, no_asistio: 1, prueba: 2, conexion_aceptada: 0, rebote: 0 };

const STAGE_RANK = Object.fromEntries(ETAPAS.map((e, i) => [e, i]));

// ---------- CSV ----------

export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", q = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

function toObjects(rows, cols) {
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => Object.fromEntries(cols.map((c) => [c, (r[head.indexOf(c)] ?? "").trim()])));
}

const esc = (v) => (/[",\n\r]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ""));
export const toCsv = (objs, cols) => [cols.join(","), ...objs.map((o) => cols.map((c) => esc(o[c])).join(","))].join("\n") + "\n";

function load(file, cols) {
  if (!fs.existsSync(file)) return [];
  return toObjects(parseCsv(fs.readFileSync(file, "utf8")), cols);
}
function save(file, objs, cols) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, toCsv(objs, cols));
  fs.renameSync(tmp, file);
}

// ---------- helpers ----------

const pad = (n) => String(n).padStart(2, "0");
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => process.env.VENTAS_HOY || fmt(new Date());
export function addDays(iso, n) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return fmt(d);
}
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

// Key that identifies the same business across channels, to avoid writing
// twice to the same person.
export function normalizeHandle(v) {
  return String(v || "")
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/^(instagram\.com|facebook\.com|linkedin\.com\/in|linkedin\.com\/company)\//, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "");
}
const normPhone = (v) => String(v || "").replace(/\D/g, "").slice(-10);
const normName = (v) => String(v || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

export function findDuplicate(leads, lead) {
  const keys = [
    ["instagram", normalizeHandle], ["facebook", normalizeHandle], ["linkedin", normalizeHandle],
    ["email", (v) => String(v || "").toLowerCase().trim()], ["whatsapp", normPhone],
    ["web", (v) => normalizeHandle(v).replace(/^www\./, "")],
  ];
  return leads.find((l) => {
    for (const [k, f] of keys) if (f(lead[k]) && f(lead[k]) === f(l[k])) return true;
    return normName(lead.negocio) && normName(lead.negocio) === normName(l.negocio) && normName(lead.ciudad) === normName(l.ciudad);
  });
}

function nextId(leads) {
  const max = leads.reduce((m, l) => Math.max(m, Number(String(l.id).replace(/\D/g, "")) || 0), 0);
  return `L${String(max + 1).padStart(4, "0")}`;
}

function parseKv(args) {
  const o = {};
  for (const a of args) {
    const i = a.indexOf("=");
    if (i < 1) die(`Argumento "${a}" no es campo=valor`);
    o[a.slice(0, i).trim().toLowerCase()] = a.slice(i + 1).trim();
  }
  return o;
}

function die(msg) {
  console.error("✗ " + msg);
  process.exit(1);
}

// ---------- core (pure, exported for tests) ----------

export function newLead(leads, fields, fecha = today()) {
  const unknown = Object.keys(fields).filter((k) => !LEAD_COLS.includes(k));
  if (unknown.length) throw new Error(`Campos desconocidos: ${unknown.join(", ")}`);
  if (!fields.negocio) throw new Error("Falta negocio=...");
  if (fields.canal && !CANALES.includes(fields.canal)) throw new Error(`canal debe ser uno de: ${CANALES.join(", ")}`);
  const dup = findDuplicate(leads, fields);
  if (dup) return { duplicate: dup };
  const lead = Object.fromEntries(LEAD_COLS.map((c) => [c, fields[c] ?? ""]));
  lead.id = nextId(leads);
  lead.fecha_alta = fecha;
  lead.etapa = fields.etapa || "nuevo";
  lead.prioridad = fields.prioridad || "B";
  lead.toques = "0";
  if (!lead.canal) lead.canal = ["instagram", "linkedin", "email", "facebook"].find((c) => lead[c]) || "otro";
  return { lead };
}

// Applies one touch to a lead: logs it and moves stage + next follow-up date.
export function applyTouch(lead, { tipo, canal, plantilla = "", nota = "", fecha = today(), proximo }) {
  const t = TIPOS[tipo];
  if (!t) throw new Error(`tipo debe ser uno de: ${Object.keys(TIPOS).join(", ")}`);
  canal = canal || lead.canal || "otro";
  if (!CANALES.includes(canal)) throw new Error(`canal debe ser uno de: ${CANALES.join(", ")}`);
  if (proximo && !isDate(proximo)) throw new Error("proximo debe ser AAAA-MM-DD");

  const act = { fecha, lead_id: lead.id, canal, tipo, plantilla, nota };
  const updated = { ...lead };
  if (t.etapa) {
    // Never move a lead backwards by accident (e.g. a late "respuesta" after
    // the meeting), except the explicit closing/"no show" ones.
    const forward = STAGE_RANK[t.etapa] >= STAGE_RANK[updated.etapa] || CERRADAS.has(t.etapa) || tipo === "no_asistio";
    if (forward || CERRADAS.has(updated.etapa)) updated.etapa = t.etapa;
  }
  if (t.salida && (updated.etapa === "nuevo" || updated.etapa === "sin_respuesta")) updated.etapa = "contactado";

  if (t.salida) {
    const n = (Number(updated.toques) || 0) + 1;
    updated.toques = String(n);
    updated.ultimo_toque = fecha;
    const repliedAlready = STAGE_RANK[updated.etapa] >= STAGE_RANK.respondio;
    if (proximo) updated.proximo_toque = proximo;
    else if (repliedAlready) updated.proximo_toque = addDays(fecha, 2);
    else if (n <= CADENCIA.length) updated.proximo_toque = addDays(fecha, CADENCIA[n - 1]);
    else updated.proximo_toque = "";
  } else if (proximo) updated.proximo_toque = proximo;
  else if (tipo in DESPUES) updated.proximo_toque = DESPUES[tipo] == null ? "" : addDays(fecha, DESPUES[tipo]);

  if (tipo === "rebote") updated.email_estado = "rebotado";
  if (CERRADAS.has(updated.etapa)) updated.proximo_toque = updated.etapa === "sin_respuesta" ? addDays(fecha, 90) : "";
  if (nota && ["perdido", "no_contactar"].includes(tipo)) updated.notas = [updated.notas, `${fecha}: ${nota}`].filter(Boolean).join(" | ");
  return { lead: updated, act };
}

// Leads whose last follow-up went unanswered and the cadence ran out.
export function expire(leads, fecha = today()) {
  return leads.map((l) => {
    if (l.etapa === "contactado" && Number(l.toques) > CADENCIA.length && !l.proximo_toque) {
      return { ...l, etapa: "sin_respuesta", proximo_toque: addDays(fecha, 90) };
    }
    return l;
  });
}

export function agenda(leads, fecha = today()) {
  const prio = { A: 0, B: 1, C: 2 };
  const due = leads
    .filter((l) => l.proximo_toque && l.proximo_toque <= fecha && !["cliente", "perdido", "no_contactar"].includes(l.etapa))
    .sort((a, b) => STAGE_RANK[b.etapa] - STAGE_RANK[a.etapa] || a.proximo_toque.localeCompare(b.proximo_toque));
  const nuevos = leads
    .filter((l) => l.etapa === "nuevo")
    .sort((a, b) => (prio[a.prioridad] ?? 1) - (prio[b.prioridad] ?? 1) || a.fecha_alta.localeCompare(b.fecha_alta));
  return { due, nuevos };
}

const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");

// Funnel metrics from the activity log, so they hold even if a lead's stage
// is later edited by hand. A lead "reached" a step once it has that touch.
export function metrics(leads, acts, { desde = "", hasta = "9999-12-31" } = {}) {
  const inRange = acts.filter((a) => a.fecha >= desde && a.fecha <= hasta);
  const leadById = Object.fromEntries(leads.map((l) => [l.id, l]));
  const firstOut = {}; // lead -> first outreach act (ever)
  for (const a of [...acts].sort((x, y) => x.fecha.localeCompare(y.fecha))) {
    if (TIPOS[a.tipo]?.salida && !firstOut[a.lead_id]) firstOut[a.lead_id] = a;
  }
  // Cohort: leads first contacted inside the range. Their later results count
  // even if they happened after `hasta`, so rates are not undercounted.
  const cohort = Object.values(firstOut).filter((a) => a.fecha >= desde && a.fecha <= hasta);
  const reached = (id, tipos) => acts.some((a) => a.lead_id === id && tipos.includes(a.tipo));
  const STEPS = {
    respondieron: ["respuesta", "interesado", "reunion_agendada", "reunion_hecha", "no_asistio", "prueba", "cliente"],
    interesados: ["interesado", "reunion_agendada", "reunion_hecha", "no_asistio", "prueba", "cliente"],
    reuniones: ["reunion_agendada", "reunion_hecha", "no_asistio"],
    reuniones_hechas: ["reunion_hecha"],
    pruebas: ["prueba", "cliente"],
    clientes: ["cliente"],
  };
  function funnel(group) {
    const r = { contactados: group.length };
    for (const [k, tipos] of Object.entries(STEPS)) r[k] = group.filter((a) => reached(a.lead_id, tipos)).length;
    return r;
  }
  const by = (keyFn) => {
    const g = {};
    for (const a of cohort) (g[keyFn(a)] ||= []).push(a);
    return Object.fromEntries(Object.entries(g).map(([k, v]) => [k, funnel(v)]).sort((a, b) => b[1].contactados - a[1].contactados));
  };
  const actividad = {};
  for (const a of inRange) actividad[a.tipo] = (actividad[a.tipo] || 0) + 1;
  const salidas = inRange.filter((a) => TIPOS[a.tipo]?.salida);
  const porDia = {};
  for (const a of salidas) porDia[a.fecha] = (porDia[a.fecha] || 0) + 1;
  const etapas = {};
  for (const l of leads) etapas[l.etapa] = (etapas[l.etapa] || 0) + 1;
  return {
    total: funnel(cohort),
    canal: by((a) => a.canal),
    segmento: by((a) => leadById[a.lead_id]?.segmento || "(sin segmento)"),
    plantilla: by((a) => a.plantilla || "(sin plantilla)"),
    actividad,
    mensajes_enviados: salidas.length,
    por_dia: porDia,
    etapas,
  };
}

function funnelTable(title, groups) {
  const rows = Object.entries(groups);
  if (!rows.length) return "";
  let s = `### ${title}\n\n| ${title} | Contactados | Respondieron | % resp. | Reuniones | % reunión | Pruebas | Clientes |\n|---|---:|---:|---:|---:|---:|---:|---:|\n`;
  for (const [k, f] of rows) {
    s += `| ${k} | ${f.contactados} | ${f.respondieron} | ${pct(f.respondieron, f.contactados)} | ${f.reuniones} | ${pct(f.reuniones, f.contactados)} | ${f.pruebas} | ${f.clientes} |\n`;
  }
  return s + "\n";
}

export function report(m, { desde, hasta, metaDiaria }) {
  const t = m.total;
  const dias = Object.keys(m.por_dia).length;
  let s = `# Métricas de prospección\n\nPeriodo: ${desde || "inicio"} → ${hasta}\n\n`;
  s += `## Embudo (leads contactados por primera vez en el periodo)\n\n`;
  s += `| Paso | Cantidad | Conversión desde el paso anterior | Desde contactados |\n|---|---:|---:|---:|\n`;
  const steps = [["Contactados", t.contactados], ["Respondieron", t.respondieron], ["Interesados", t.interesados], ["Reunión agendada", t.reuniones], ["Reunión hecha", t.reuniones_hechas], ["Prueba gratis", t.pruebas], ["Clientes", t.clientes]];
  steps.forEach(([n, v], i) => {
    s += `| ${n} | ${v} | ${i ? pct(v, steps[i - 1][1]) : "—"} | ${pct(v, t.contactados)} |\n`;
  });
  s += `\nMensajes enviados en el periodo (primeros + seguimientos): **${m.mensajes_enviados}**`;
  if (dias) s += ` en ${dias} día(s) activos, promedio **${(m.mensajes_enviados / dias).toFixed(1)}/día**`;
  if (metaDiaria) s += ` (meta: ${metaDiaria}/día)`;
  s += "\n\n";
  s += funnelTable("Canal", m.canal);
  s += funnelTable("Segmento", m.segmento);
  s += funnelTable("Plantilla", m.plantilla);
  s += `### Pipeline actual (todas las etapas)\n\n` + ETAPAS.filter((e) => m.etapas[e]).map((e) => `- ${e}: ${m.etapas[e]}`).join("\n") + "\n\n";
  s += `### Actividad registrada en el periodo\n\n` + (Object.entries(m.actividad).map(([k, v]) => `- ${k}: ${v}`).join("\n") || "- (nada)") + "\n";
  return s;
}

// ---------- CLI ----------

function line(l) {
  const where = [l.instagram && `IG @${normalizeHandle(l.instagram)}`, l.linkedin && "LinkedIn", l.facebook && "FB", l.email && `✉ ${l.email}`, l.whatsapp && `WA ${l.whatsapp}`].filter(Boolean).join(" · ");
  return `${l.id} [${l.prioridad || "B"}] ${l.negocio}${l.contacto ? ` (${l.contacto})` : ""} — ${l.segmento || "?"}, ${l.ciudad || "?"} — ${l.etapa}, toques ${l.toques || 0}${l.proximo_toque ? `, próximo ${l.proximo_toque}` : ""}\n      ${where}${l.gancho ? `\n      gancho: ${l.gancho}` : ""}`;
}

const AYUDA = `Uso: node ventas/scripts/ventas.mjs <comando>

  init                                   Crea los CSV vacíos en ${path.relative(process.cwd(), DIR) || DIR}
  nuevo negocio="..." campo=valor ...    Agrega un lead (avisa si ya existe)
        campos: ${LEAD_COLS.filter((c) => !["id", "fecha_alta", "toques", "ultimo_toque", "proximo_toque"].includes(c)).join(", ")}
  importar archivo.csv [fuente=...]      Agrega en bloque desde un CSV con columnas de leads (salta duplicados)
  toque <id> <tipo> [canal=..] [plantilla=..] [nota=..] [fecha=AAAA-MM-DD] [proximo=AAAA-MM-DD]
        tipos: ${Object.keys(TIPOS).join(", ")}
  editar <id> campo=valor ...            Cambia campos de un lead
  ver <id>                               Muestra el lead y su historial
  buscar <texto>                         Busca por nombre, usuario, correo o ciudad
  hoy [limite]                           Seguimientos que tocan hoy + nuevos por contactar
  metricas [desde=AAAA-MM-DD] [hasta=AAAA-MM-DD] [semana|mes] [meta=60] [guardar]
                                         Embudo por canal, segmento y plantilla
`;

function main(argv) {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === "ayuda" || cmd === "help" || cmd === "-h") return console.log(AYUDA);

  if (cmd === "init") {
    if (!fs.existsSync(LEADS)) save(LEADS, [], LEAD_COLS);
    if (!fs.existsSync(ACTIVIDAD)) save(ACTIVIDAD, [], ACT_COLS);
    return console.log(`✓ Datos en ${DIR}`);
  }

  let leads = expire(load(LEADS, LEAD_COLS));
  const acts = load(ACTIVIDAD, ACT_COLS);
  const get = (id) => leads.find((l) => l.id.toLowerCase() === String(id || "").toLowerCase()) || die(`No existe el lead ${id}`);

  switch (cmd) {
    case "nuevo": {
      let r;
      try { r = newLead(leads, parseKv(rest)); } catch (e) { die(e.message); }
      if (r.duplicate) return console.log(`⚠ Ya existe, no se agregó:\n  ${line(r.duplicate)}`);
      leads.push(r.lead);
      save(LEADS, leads, LEAD_COLS);
      return console.log(`✓ ${line(r.lead)}`);
    }
    case "importar": {
      const [file, ...kv] = rest;
      if (!file || !fs.existsSync(file)) die("Indica un CSV que exista");
      const extra = parseKv(kv);
      const rows = parseCsv(fs.readFileSync(file, "utf8"));
      const head = rows[0].map((h) => h.trim().toLowerCase());
      let added = 0, dups = 0, bad = 0;
      for (const r of rows.slice(1)) {
        const f = { ...extra };
        head.forEach((h, i) => { if (LEAD_COLS.includes(h) && r[i]?.trim()) f[h] = r[i].trim(); });
        delete f.id;
        try {
          const res = newLead(leads, f);
          if (res.duplicate) dups++;
          else { leads.push(res.lead); added++; }
        } catch { bad++; }
      }
      save(LEADS, leads, LEAD_COLS);
      return console.log(`✓ ${added} agregados, ${dups} duplicados saltados, ${bad} filas inválidas`);
    }
    case "toque": {
      const [id, tipo, ...kv] = rest;
      const lead = get(id);
      const o = parseKv(kv);
      let r;
      try { r = applyTouch(lead, { tipo, ...o }); } catch (e) { die(e.message); }
      leads = leads.map((l) => (l.id === lead.id ? r.lead : l));
      acts.push(r.act);
      save(ACTIVIDAD, acts, ACT_COLS);
      save(LEADS, leads, LEAD_COLS);
      return console.log(`✓ ${line(r.lead)}`);
    }
    case "editar": {
      const [id, ...kv] = rest;
      const lead = get(id);
      const o = parseKv(kv);
      const unknown = Object.keys(o).filter((k) => !LEAD_COLS.includes(k) || k === "id");
      if (unknown.length) die(`Campos no editables: ${unknown.join(", ")}`);
      if (o.etapa && !ETAPAS.includes(o.etapa)) die(`etapa debe ser una de: ${ETAPAS.join(", ")}`);
      Object.assign(lead, o);
      save(LEADS, leads, LEAD_COLS);
      return console.log(`✓ ${line(lead)}`);
    }
    case "ver": {
      const lead = get(rest[0]);
      console.log(line(lead));
      for (const c of LEAD_COLS) if (lead[c]) console.log(`  ${c}: ${lead[c]}`);
      console.log("  historial:");
      for (const a of acts.filter((x) => x.lead_id === lead.id)) console.log(`   ${a.fecha} ${a.canal} ${a.tipo}${a.plantilla ? ` [${a.plantilla}]` : ""}${a.nota ? ` — ${a.nota}` : ""}`);
      return;
    }
    case "buscar": {
      const q = normName(rest.join(" "));
      const hits = leads.filter((l) => normName(Object.values(l).join(" ")).includes(q));
      return console.log(hits.map(line).join("\n") || "Sin resultados");
    }
    case "hoy": {
      save(LEADS, leads, LEAD_COLS); // persist expirations
      const limit = Number(rest[0]) || 30;
      const { due, nuevos } = agenda(leads);
      console.log(`📅 ${today()}\n\n🔁 Seguimientos que tocan (${due.length}):`);
      console.log(due.map(line).join("\n") || "  (ninguno)");
      console.log(`\n🆕 Nuevos por contactar (${nuevos.length}, mostrando ${Math.min(limit, nuevos.length)}):`);
      console.log(nuevos.slice(0, limit).map(line).join("\n") || "  (ninguno — toca prospectar)");
      const sentToday = acts.filter((a) => a.fecha === today() && TIPOS[a.tipo]?.salida).length;
      return console.log(`\n✉ Mensajes enviados hoy: ${sentToday}`);
    }
    case "metricas": {
      const o = {};
      for (const a of rest) {
        if (a === "semana") o.desde = addDays(today(), -6);
        else if (a === "mes") o.desde = addDays(today(), -29);
        else if (a === "guardar") o.guardar = true;
        else Object.assign(o, parseKv([a]));
      }
      const desde = o.desde || "";
      const hasta = o.hasta || today();
      const md = report(metrics(leads, acts, { desde, hasta }), { desde, hasta, metaDiaria: o.meta });
      console.log(md);
      if (o.guardar) {
        const out = path.join(DIR, "reportes", `${hasta}.md`);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, md);
        console.log(`✓ Guardado en ${out}`);
      }
      return;
    }
    default:
      die(`Comando desconocido "${cmd}".\n\n${AYUDA}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
