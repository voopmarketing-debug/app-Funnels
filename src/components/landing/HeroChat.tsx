"use client";

import { useEffect, useState } from "react";

const ROWS: [("in" | "out"), string][] = [
  ["in", "Hola, ¿cuánto cuesta la limpieza dental?"],
  ["out", "¡Hola! La limpieza dental cuesta $120.000 y dura unos 45 minutos. ¿Te agendo para esta semana?"],
  ["in", "Sí, el jueves en la tarde"],
  ["out", "Listo, quedaste el jueves a las 4:00 p. m. Te esperamos."],
];

/**
 * A made-up WhatsApp conversation that types itself in a loop. The server
 * renders the first exchange already visible, so the card is never empty.
 */
export function HeroChat() {
  const [shown, setShown] = useState(2);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (ms: number, fn: () => void) => timers.push(setTimeout(() => alive && fn(), ms));

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      later(0, () => setShown(ROWS.length));
      return () => {
        alive = false;
        timers.forEach(clearTimeout);
      };
    }

    const play = (from: number) => {
      let t = 0;
      for (let i = from; i < ROWS.length; i++) {
        const isBot = ROWS[i][0] === "out";
        if (isBot) {
          later((t += 700), () => setTyping(true));
          later((t += 1300), () => {
            setTyping(false);
            setShown(i + 1);
          });
        } else {
          later((t += 1100), () => setShown(i + 1));
        }
      }
      later((t += 4200), () => {
        setShown(0);
        later(500, () => play(0));
      });
    };
    later(1800, () => play(2));
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="lp-float p-3" aria-label="Ejemplo de conversación de WhatsApp">
      <div className="mb-3 flex items-center gap-2.5 border-b border-white/10 pb-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25d366] text-xs font-bold text-white">CS</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Clínica Sonrisa</p>
          <p className="flex items-center gap-1.5 text-[11px] text-[#25d366]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#25d366]" />
            Asistente respondiendo
          </p>
        </div>
        <span className="text-[11px] text-white/50">10:42 p. m.</span>
      </div>
      <div className="flex min-h-[15.5rem] flex-col gap-2">
        {ROWS.slice(0, shown).map(([dir, text], i) => (
          <p
            key={i}
            className={`lp-msg max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-snug text-white ${dir === "in" ? "self-start rounded-tl-md bg-[#202c33]" : "self-end rounded-tr-md bg-[#005c4b]"}`}
          >
            {text}
          </p>
        ))}
        {typing && (
          <p className="lp-msg flex max-w-[88%] items-center gap-1 self-end rounded-2xl rounded-tr-md bg-[#005c4b] px-3.5 py-3" aria-label="Escribiendo">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/70 [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/70 [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/70" />
          </p>
        )}
      </div>
    </div>
  );
}
