// {{1}}, {{2}}… in a WhatsApp template's body: the values that change for each
// customer (name, date, time). Meta wants them numbered from 1 with no gaps,
// never at the very start or end of the text, and an example for each one so
// its reviewers see what the message will look like.

export const MAX_EXAMPLE_LENGTH = 100;

const TOKEN = /\{\{\s*([^{}]*?)\s*\}\}/g;

/** The variable numbers in order of appearance, without repeats. */
export function variableNumbers(body: string): number[] {
  const seen: number[] = [];
  for (const m of body.matchAll(TOKEN)) {
    const n = Number(m[1]);
    if (Number.isInteger(n) && !seen.includes(n)) seen.push(n);
  }
  return seen;
}

export function variableCount(body: string): number {
  return variableNumbers(body).length;
}

/** A sentence for the person if the variables break one of Meta's rules; null when they are fine. */
export function checkTemplateVariables(body: string): string | null {
  const text = body.trim();
  const withoutTokens = text.replace(TOKEN, "");
  if (/\{\{|\}\}/.test(withoutTokens)) return "Hay llaves {{ }} mal cerradas. Cada variable se escribe así: {{1}}.";
  for (const m of text.matchAll(TOKEN)) {
    if (!/^\d+$/.test(m[1])) return "Las variables van con números: {{1}}, {{2}}… (no con nombres).";
  }
  const numbers = variableNumbers(text).sort((a, b) => a - b);
  if (numbers.length === 0) return null;
  if (numbers.some((n, i) => n !== i + 1)) return "Numera las variables desde 1 y sin saltarte ninguno: {{1}}, {{2}}, {{3}}.";
  if (/^\{\{\s*\d+\s*\}\}/.test(text)) return "El mensaje no puede empezar con una variable. Escribe antes algo de texto, por ejemplo «Hola [nombre del lead]».";
  if (/\{\{\s*\d+\s*\}\}$/.test(text)) return "El mensaje no puede terminar con una variable. Agrega una frase después, por ejemplo «Estamos para ayudarte.».";
  return null;
}

/** An error if the examples don't match the variables one for one; null when they do. */
export function checkExamples(body: string, examples: string[]): string | null {
  const count = variableCount(body);
  if (count === 0) return null;
  if (examples.length !== count) return `Escribe un ejemplo para cada una de las ${count} variables.`;
  for (const ex of examples) {
    if (!ex.trim()) return "Falta el ejemplo de alguna variable.";
    if (ex.length > MAX_EXAMPLE_LENGTH || /[\r\n\t]/.test(ex)) return "Cada ejemplo debe ser corto y de una sola línea.";
  }
  return null;
}

/** The body with each {{N}} replaced by its example (for the preview); a variable without one stays as written. */
export function fillTemplateExamples(body: string, examples: string[]): string {
  return body.replace(TOKEN, (whole, raw: string) => {
    const n = Number(raw);
    return Number.isInteger(n) && examples[n - 1]?.trim() ? examples[n - 1] : whole;
  });
}
