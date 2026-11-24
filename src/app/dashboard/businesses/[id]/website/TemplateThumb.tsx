import type { CSSProperties } from "react";
import type { TemplateCard } from "@/lib/websiteNicheTemplates";

/**
 * A light picture of a template for the library grid: its colors, its real opening headline and the
 * shape of its sections, drawn with plain elements (a grid of ninety-six live pages would be far too
 * heavy, especially on a phone). The full page is one tap away in "Ver página".
 */
export function TemplateThumb({ card }: { card: TemplateCard }) {
  const { colors: c } = card;
  const soft = `color-mix(in srgb, ${c.text} 14%, transparent)`;
  const muted = `color-mix(in srgb, ${c.text} 38%, transparent)`;
  const pill = (w: string): CSSProperties => ({ width: w, height: "2.6cqw", borderRadius: "99cqw", background: c.primary });
  const bar = (w: string, o = soft): CSSProperties => ({ width: w, height: "1.3cqw", borderRadius: "1cqw", background: o });

  const heading = (size: string, center = false) => {
    const i = card.highlight ? card.heading.indexOf(card.highlight) : -1;
    return (
      <p
        style={{
          margin: 0,
          fontSize: size,
          lineHeight: 1.12,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          fontFamily: `"${card.headingFont}", ui-sans-serif, system-ui, sans-serif`,
          textAlign: center ? "center" : "left",
          display: "-webkit-box",
          WebkitLineClamp: 4,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {i >= 0 ? (
          <>
            {card.heading.slice(0, i)}
            <span style={{ color: c.primary }}>{card.highlight}</span>
            {card.heading.slice(i + card.highlight.length)}
          </>
        ) : (
          card.heading
        )}
      </p>
    );
  };

  const eyebrow = (center = false) => (
    <p style={{ margin: 0, fontSize: "2cqw", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, color: c.primary, textAlign: center ? "center" : "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
      {card.eyebrow}
    </p>
  );

  const button = (label: string) => (
    <span style={{ display: "inline-block", background: c.primary, color: card.dark ? "#0a0a0a" : "#fff", borderRadius: "99cqw", padding: "1.3cqw 3.4cqw", fontSize: "2.3cqw", fontWeight: 700, whiteSpace: "nowrap" }}>{label}</span>
  );

  const block = (item: TemplateCard["shape"][number], key: number) => {
    const box: CSSProperties = { background: c.surface, borderRadius: "2cqw" };
    const { type, variant } = item;
    switch (type) {
      case "trustBar":
        if (variant === "ticker") {
          return (
            <div key={key} style={{ display: "flex", gap: "3cqw", alignItems: "center", overflow: "hidden", borderBlock: `0.3cqw solid ${soft}`, padding: "1.6cqw 0" }}>
              {[0, 1, 2, 3].map((n) => (
                <span key={n} style={{ display: "flex", alignItems: "center", gap: "3cqw", flex: "none" }}>
                  <i style={bar("14cqw", muted)} />
                  <i style={{ width: "1.6cqw", height: "1.6cqw", borderRadius: "99cqw", background: c.primary }} />
                </span>
              ))}
            </div>
          );
        }
        return (
          <div key={key} style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "2cqw" }}>
            {[0, 1, 2].map((n) => (
              <div key={n} style={{ ...box, padding: "2cqw", display: "grid", gap: "1cqw" }}>
                <i style={{ ...pill("3cqw"), height: "3cqw" }} />
                <i style={bar("80%")} />
              </div>
            ))}
          </div>
        );
      case "features":
        if (variant === "bento") {
          return (
            <div key={key} style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gridTemplateRows: "repeat(2,7cqw)", gap: "2cqw" }}>
              <div style={{ ...box, gridRow: "span 2", background: `color-mix(in srgb, ${c.primary} 16%, ${c.surface})`, padding: "2cqw", display: "grid", alignContent: "end", gap: "1cqw" }}>
                <i style={bar("70%", muted)} />
                <i style={bar("90%")} />
              </div>
              <div style={{ ...box, gridColumn: "span 2", padding: "2cqw", display: "grid", alignContent: "center", gap: "1cqw" }}>
                <i style={bar("50%", muted)} />
                <i style={bar("85%")} />
              </div>
              <div style={{ ...box, padding: "2cqw" }}><i style={bar("70%", muted)} /></div>
              <div style={{ ...box, padding: "2cqw" }}><i style={bar("70%", muted)} /></div>
            </div>
          );
        }
        if (variant === "numbered") {
          return (
            <div key={key} style={{ display: "grid" }}>
              {[1, 2, 3].map((n) => (
                <div key={n} style={{ display: "grid", gridTemplateColumns: "6cqw 1fr 1.5fr", gap: "2cqw", alignItems: "center", borderTop: `0.3cqw solid ${soft}`, padding: "1.8cqw 0" }}>
                  <i style={{ ...bar("4cqw", c.primary), height: "1.6cqw" }} />
                  <i style={bar("80%", muted)} />
                  <i style={bar("90%")} />
                </div>
              ))}
            </div>
          );
        }
        return (
          <div key={key} style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "2cqw" }}>
            {[0, 1, 2].map((n) => (
              <div key={n} style={{ ...box, padding: "2.4cqw", display: "grid", gap: "1.2cqw" }}>
                <i style={{ width: "3.2cqw", height: "3.2cqw", borderRadius: "1cqw", background: c.primary, opacity: 0.85 }} />
                <i style={bar("70%", muted)} />
                <i style={bar("95%")} />
              </div>
            ))}
          </div>
        );
      case "steps":
        if (variant === "timeline") {
          return (
            <div key={key} style={{ display: "grid" }}>
              {[1, 2, 3].map((n) => (
                <div key={n} style={{ display: "grid", gridTemplateColumns: "9cqw 1fr", gap: "2.4cqw", alignItems: "center", borderTop: `0.3cqw solid ${soft}`, padding: "1.6cqw 0" }}>
                  <i style={{ ...bar("8cqw", c.primary), height: "3.4cqw", opacity: 0.85 }} />
                  <div style={{ display: "grid", gap: "1cqw" }}>
                    <i style={bar("55%", muted)} />
                    <i style={bar("85%")} />
                  </div>
                </div>
              ))}
            </div>
          );
        }
        if (variant === "big") {
          return (
            <div key={key} style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "2cqw" }}>
              {[1, 2].map((n) => (
                <div key={n} style={{ border: `0.3cqw solid ${soft}`, borderRadius: "2cqw", padding: "2cqw", display: "grid", gap: "1cqw" }}>
                  <span style={{ fontSize: "7cqw", lineHeight: 1, fontWeight: 700, color: "transparent", WebkitTextStroke: `0.35cqw ${c.primary}` }}>{`0${n}`}</span>
                  <i style={bar("70%", muted)} />
                </div>
              ))}
            </div>
          );
        }
        return (
          <div key={key} style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "2cqw" }}>
            {[1, 2, 3, 4].map((n) => (
              <div key={n} style={{ display: "grid", gap: "1cqw", justifyItems: "start" }}>
                <i style={{ width: "4cqw", height: "4cqw", borderRadius: "99cqw", background: c.primary, opacity: 0.9 }} />
                <i style={bar("85%", muted)} />
                <i style={bar("60%")} />
              </div>
            ))}
          </div>
        );
      case "objections":
        if (variant === "split") {
          return (
            <div key={key} style={{ display: "grid", gridTemplateColumns: "1fr 1.7fr", gap: "3cqw" }}>
              <div style={{ display: "grid", gap: "1.2cqw", alignContent: "start" }}>
                <i style={bar("60%", c.primary)} />
                <i style={bar("90%", muted)} />
              </div>
              <div style={{ display: "grid", gap: "1.2cqw" }}>
                {[0, 1, 2].map((n) => (
                  <div key={n} style={{ ...box, padding: "1.4cqw 2cqw" }}><i style={bar("65%", muted)} /></div>
                ))}
              </div>
            </div>
          );
        }
        return (
          <div key={key} style={{ display: "grid", gap: "1.4cqw" }}>
            {[0, 1, 2].map((n) => (
              <div key={n} style={{ ...box, padding: "1.8cqw 2.4cqw", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <i style={bar("55%", muted)} />
                <i style={{ ...bar("2.4cqw", c.primary), height: "2.4cqw" }} />
              </div>
            ))}
          </div>
        );
      case "html":
        return (
          <div key={key} style={{ ...box, padding: "3cqw", fontFamily: "monospace", fontSize: "4cqw", color: muted }}>
            {"</>"}
          </div>
        );
      case "video":
        return (
          <div key={key} style={{ ...box, padding: "3cqw" }}>
            <i style={{ ...bar("100%", "#0b0b0f"), height: "20cqw", borderRadius: "2cqw", display: "block" }} />
          </div>
        );
      case "host":
        return (
          <div key={key} style={{ ...box, padding: "3cqw", display: "flex", gap: "3cqw", alignItems: "center" }}>
            <i style={{ width: "9cqw", height: "9cqw", borderRadius: "99cqw", background: muted, flex: "none" }} />
            <div style={{ display: "grid", gap: "1.2cqw", flex: 1 }}>
              <i style={bar("50%", muted)} />
              <i style={bar("95%")} />
              <i style={bar("80%")} />
            </div>
          </div>
        );
      case "comparison":
        return (
          <div key={key} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2cqw" }}>
            <div style={{ ...box, padding: "2.4cqw", border: `0.4cqw solid ${c.primary}`, display: "grid", gap: "1.2cqw" }}>
              <i style={bar("60%", c.primary)} />
              <i style={bar("90%")} />
              <i style={bar("75%")} />
            </div>
            <div style={{ ...box, padding: "2.4cqw", display: "grid", gap: "1.2cqw", opacity: 0.7 }}>
              <i style={bar("60%", muted)} />
              <i style={bar("90%")} />
              <i style={bar("75%")} />
            </div>
          </div>
        );
      case "promo":
        return (
          <div key={key} style={{ background: c.primary, borderRadius: "2.4cqw", padding: "3.4cqw", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "3cqw" }}>
            <div style={{ display: "grid", gap: "1.3cqw", flex: 1 }}>
              <i style={bar("70%", card.dark ? "#0a0a0a" : "#fff")} />
              <i style={bar("90%", card.dark ? "rgba(10,10,10,.35)" : "rgba(255,255,255,.55)")} />
            </div>
            <i style={{ width: "13cqw", height: "4.4cqw", borderRadius: "99cqw", background: card.dark ? "#0a0a0a" : "#fff" }} />
          </div>
        );
      case "marquee":
        return (
          <p key={key} style={{ margin: 0, fontSize: "6.4cqw", fontWeight: 800, letterSpacing: "-0.02em", color: soft, whiteSpace: "nowrap", overflow: "hidden", textTransform: "uppercase", fontFamily: `"${card.headingFont}", ui-sans-serif, sans-serif` }}>
            {card.eyebrow} · {card.name} ·
          </p>
        );
      case "leadForm":
        return (
          <div key={key} style={{ ...box, padding: "3cqw", display: "grid", gap: "1.6cqw", justifyItems: "center" }}>
            <i style={bar("45%", muted)} />
            <div style={{ display: "flex", gap: "1.6cqw", width: "100%" }}>
              <i style={{ flex: 1, height: "4.4cqw", borderRadius: "1.2cqw", background: c.bg }} />
              <i style={{ flex: 1, height: "4.4cqw", borderRadius: "1.2cqw", background: c.bg }} />
            </div>
            <i style={pill("24cqw")} />
          </div>
        );
      case "cta":
        if (variant === "giant") {
          return (
            <div key={key} style={{ display: "grid", gap: "1.4cqw", padding: "1cqw 0" }}>
              <span style={{ fontSize: "8cqw", lineHeight: 0.95, fontWeight: 700, letterSpacing: "-0.04em", fontFamily: `"${card.headingFont}", ui-sans-serif, system-ui, sans-serif` }}>{card.cta}</span>
              <i style={pill("22cqw")} />
            </div>
          );
        }
        return (
          <div key={key} style={{ textAlign: "center", display: "grid", gap: "1.4cqw", justifyItems: "center", padding: "1cqw 0" }}>
            <i style={bar("55%", muted)} />
            <i style={pill("22cqw")} />
          </div>
        );
      default:
        return null;
    }
  };

  const split = card.heroVariant === "split";
  const wordmark = card.heroVariant === "wordmark";
  return (
    <div
      aria-hidden="true"
      style={{ containerType: "inline-size", background: c.bg, color: c.text, aspectRatio: "4 / 3.4", overflow: "hidden", position: "relative", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      <div style={{ padding: "3cqw 5cqw", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `0.3cqw solid ${soft}` }}>
        <span style={{ display: "flex", alignItems: "center", gap: "1.6cqw" }}>
          <i style={{ width: "3cqw", height: "3cqw", borderRadius: "99cqw", background: c.primary }} />
          <i style={bar("14cqw", muted)} />
        </span>
        <i style={pill("10cqw")} />
      </div>

      <div style={{ padding: "5cqw", display: "grid", gap: "4cqw" }}>
        {wordmark ? (
          <div style={{ display: "grid", gap: "1.6cqw" }}>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `0.3cqw solid ${soft}`, paddingBottom: "1.2cqw" }}>
              <i style={bar("18cqw", muted)} />
              <i style={bar("8cqw", muted)} />
            </div>
            <span style={{ fontSize: "15cqw", lineHeight: 0.85, fontWeight: 700, letterSpacing: "-0.05em", fontFamily: `"${card.headingFont}", ui-sans-serif, system-ui, sans-serif`, whiteSpace: "nowrap", overflow: "hidden" }}>Tu negocio</span>
            {heading("3.6cqw")}
            {button(card.cta)}
          </div>
        ) : split ? (
          <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: "4cqw", alignItems: "center" }}>
            <div style={{ display: "grid", gap: "1.8cqw", justifyItems: "start" }}>
              {eyebrow()}
              {heading("4.4cqw")}
              {button(card.cta)}
            </div>
            {card.heroForm ? (
              <div style={{ background: c.surface, borderRadius: "2.4cqw", padding: "3cqw", display: "grid", gap: "1.6cqw" }}>
                <i style={bar("60%", muted)} />
                <i style={{ height: "3.6cqw", borderRadius: "1cqw", background: c.bg }} />
                <i style={{ height: "3.6cqw", borderRadius: "1cqw", background: c.bg }} />
                <i style={{ ...pill("100%"), height: "3.6cqw" }} />
              </div>
            ) : (
              <div style={{ aspectRatio: "1 / 1", borderRadius: "3cqw", background: `linear-gradient(135deg, ${c.surface}, color-mix(in srgb, ${c.primary} 30%, ${c.surface}))`, position: "relative" }}>
                <i style={{ position: "absolute", left: "18%", bottom: "16%", width: "46%", height: "46%", borderRadius: "50%", background: c.primary, opacity: 0.35 }} />
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gap: "2cqw", justifyItems: "center", textAlign: "center", padding: "0 3cqw" }}>
            {eyebrow(true)}
            {heading(card.heroVariant === "giant" ? "7.4cqw" : "5cqw", true)}
            {button(card.cta)}
          </div>
        )}
        {card.shape.slice(1, 5).map((type, i) => block(type, i))}
      </div>
    </div>
  );
}
