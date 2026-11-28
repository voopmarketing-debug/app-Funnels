// A small drawing for each kind of business, used in the photo frames of the template previews (and in a page's
// empty photo spaces while it is being edited): the library shows each template with its own look, not a grey box.
// Pure SVG in the page's accent color ("currentColor" = var(--primary)); decorative, never published.

const W = 400;
const H = 300;

function wrap(body: string): string {
  return `<svg class="ph-art" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

const ART: Record<string, string> = {
  // Accounts: a ledger grid with rising bars and a coin.
  contadores: wrap(
    `<g opacity=".16">${Array.from({ length: 9 }, (_, i) => `<path d="M0 ${30 + i * 32}H400"/>`).join("")}${Array.from({ length: 9 }, (_, i) => `<path d="M${25 + i * 48} 0V300"/>`).join("")}</g>` +
      `<g opacity=".55" fill="currentColor" stroke="none"><rect x="70" y="190" width="38" height="70" rx="4" opacity=".5"/><rect x="128" y="160" width="38" height="100" rx="4" opacity=".6"/><rect x="186" y="128" width="38" height="132" rx="4" opacity=".75"/><rect x="244" y="92" width="38" height="168" rx="4"/></g>` +
      `<circle cx="318" cy="84" r="34" opacity=".7"/><path d="M318 66v36M306 74c0-6 24-6 24 2s-24 4-24 12 24 8 24 2" opacity=".7"/>`,
  ),
  // Aesthetics: overlapping petals.
  esteticas: wrap(
    `<g transform="translate(200 150)" opacity=".5">${Array.from({ length: 8 }, (_, i) => `<ellipse cx="0" cy="-62" rx="30" ry="62" transform="rotate(${i * 45})"/>`).join("")}</g>` +
      `<circle cx="200" cy="150" r="14" fill="currentColor" stroke="none" opacity=".65"/><circle cx="70" cy="60" r="22" opacity=".3"/><circle cx="338" cy="238" r="30" opacity=".3"/>`,
  ),
  // Dental: a smile and a row of rounded teeth.
  odontologos: wrap(
    `<path d="M70 120c40 90 220 90 260 0" stroke-width="5" opacity=".7"/>` +
      `<g opacity=".55">${Array.from({ length: 6 }, (_, i) => `<rect x="${108 + i * 32}" y="${i === 0 || i === 5 ? 168 : 178}" width="26" height="40" rx="12"/>`).join("")}</g>` +
      `<circle cx="96" cy="72" r="12" opacity=".4"/><circle cx="318" cy="64" r="8" opacity=".4"/><path d="M200 40v22M189 51h22" opacity=".6"/>`,
  ),
  // Law: a temple with columns.
  abogados: wrap(
    `<path d="M70 120L200 56l130 64z" opacity=".7"/><path d="M84 132h232" opacity=".7"/>` +
      `<g opacity=".6">${Array.from({ length: 5 }, (_, i) => `<path d="M${112 + i * 44} 144V232"/><path d="M${104 + i * 44} 144h16M${104 + i * 44} 232h16"/>`).join("")}</g>` +
      `<path d="M70 248h260M84 262h232" opacity=".7"/>`,
  ),
  // Psychology: calm concentric rings.
  psicologos: wrap(
    `<g opacity=".5">${[28, 56, 84, 112, 140].map((r, i) => `<circle cx="200" cy="150" r="${r}" opacity="${1 - i * 0.14}"/>`).join("")}</g>` +
      `<circle cx="200" cy="150" r="10" fill="currentColor" stroke="none" opacity=".6"/><path d="M40 252c40-26 80 26 120 0s80 26 120 0 60 14 80 0" opacity=".45"/>`,
  ),
  // Vets: paw prints.
  veterinarias: wrap(
    [[110, 110, -14], [250, 80, 10], [190, 200, -4]]
      .map(
        ([x, y, r]) =>
          `<g transform="translate(${x} ${y}) rotate(${r})" opacity=".6" fill="currentColor" stroke="none"><ellipse cx="0" cy="26" rx="26" ry="22"/><ellipse cx="-34" cy="-6" rx="9" ry="13" transform="rotate(-18 -34 -6)"/><ellipse cx="-12" cy="-24" rx="9" ry="14"/><ellipse cx="12" cy="-24" rx="9" ry="14"/><ellipse cx="34" cy="-6" rx="9" ry="13" transform="rotate(18 34 -6)"/></g>`,
      )
      .join("") + `<circle cx="340" cy="230" r="18" opacity=".3"/><circle cx="60" cy="238" r="12" opacity=".3"/>`,
  ),
  // Gym: bold diagonal stripes and a dumbbell.
  gimnasios: wrap(
    `<g opacity=".3" stroke-width="22">${Array.from({ length: 7 }, (_, i) => `<path d="M${-40 + i * 80} 320L${100 + i * 80} -20"/>`).join("")}</g>` +
      `<g opacity=".85" fill="currentColor" stroke="none"><rect x="96" y="124" width="22" height="64" rx="5"/><rect x="124" y="110" width="22" height="92" rx="5"/><rect x="146" y="144" width="108" height="14" rx="4"/><rect x="254" y="110" width="22" height="92" rx="5"/><rect x="282" y="124" width="22" height="64" rx="5"/></g>`,
  ),
  // Real estate: a skyline and a house.
  inmobiliarias: wrap(
    `<g opacity=".5">${[[40, 150, 46], [92, 110, 52], [150, 170, 40], [196, 90, 58], [260, 140, 48], [314, 120, 50]]
      .map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="${270 - y}" rx="3"/>${[0, 1, 2].map((k) => `<path d="M${x + 10} ${y + 22 + k * 26}h${w - 20}" opacity=".6"/>`).join("")}`)
      .join("")}</g>` +
      `<path d="M30 270H370" opacity=".7"/><path d="M300 60l32-24 32 24v22h-64z" opacity=".7"/>`,
  ),
};

/** The drawing of a niche (by its id), or "" for an unknown one. */
export function nicheArt(id: string | undefined | null): string {
  return (id && ART[id]) || "";
}
