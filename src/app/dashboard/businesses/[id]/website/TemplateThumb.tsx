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

  const block = (type: TemplateCard["shape"][number], key: number) => {
    const box: CSSProperties = { background: c.surface, borderRadius: "2cqw" };
    switch (type) {
      case "trustBar":
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
        {split ? (
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
