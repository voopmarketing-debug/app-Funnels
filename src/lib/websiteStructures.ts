// "Selecciona tu estructura": the column layouts a Contenedor block can have (like Elementor's container structures).
// Each row lists the width of its columns in twelfths.

export const STRUCTURES: { key: string; label: string; rows: number[][] }[] = [
  { key: "1", label: "1 columna", rows: [[12]] },
  { key: "2", label: "2 columnas iguales", rows: [[6, 6]] },
  { key: "1-2", label: "2 columnas, ancha a la derecha", rows: [[4, 8]] },
  { key: "2-1", label: "2 columnas, ancha a la izquierda", rows: [[8, 4]] },
  { key: "3", label: "3 columnas", rows: [[4, 4, 4]] },
  { key: "4", label: "4 columnas", rows: [[3, 3, 3, 3]] },
  { key: "1-2-1", label: "3 columnas, ancha al centro", rows: [[3, 6, 3]] },
  { key: "2x2", label: "4 cuadros (2 × 2)", rows: [[6, 6], [6, 6]] },
  { key: "3x2", label: "6 cuadros (3 × 2)", rows: [[4, 4, 4], [4, 4, 4]] },
  { key: "1+2", label: "1 arriba y 2 abajo", rows: [[12], [6, 6]] },
  { key: "2+1", label: "2 arriba y 1 abajo", rows: [[6, 6], [12]] },
  { key: "1+3", label: "1 arriba y 3 abajo", rows: [[12], [4, 4, 4]] },
];

export type LayoutCell = { w: number; row: number };

/** The empty cells of a structure, in reading order. */
export function cellsFor(key: string | null | undefined): LayoutCell[] {
  const s = STRUCTURES.find((x) => x.key === key);
  if (!s) return [];
  return s.rows.flatMap((widths, row) => widths.map((w) => ({ w, row })));
}
