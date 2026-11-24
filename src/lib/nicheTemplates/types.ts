import type { Section, StyleKey } from "@/lib/websiteContentV2";

export type Icon = Extract<Section, { type: "features" }>["items"][number]["icon"];

export type Item = { icon: Icon; title: string; description: string };

/** One way of opening the page: what is promised first. `{negocio}` becomes the business's name. */
export type Angle = {
  eyebrow: string;
  heading: string;
  /** Words of `heading`, exactly as written, painted with the accent color. */
  highlight: string;
  sub: string;
  cta: string;
  secondary: string | null;
  chips: string[];
};

/**
 * Everything specific to a kind of business. The twelve blueprints (blueprints.ts) arrange these
 * pieces into twelve different pages, each in its own visual style. Nothing here may promise a
 * price, a number, a result or years of experience: those are for the owner to add.
 */
export type Niche = {
  id: string;
  /** One word for the library's side list. */
  short: string;
  name: string;
  emoji: string;
  /** Under the name in the library. */
  blurb: string;
  /** Visual style of template 1..12, most fitting first. */
  styleOrder: StyleKey[];
  /** Twelve openings, one per blueprint. */
  angles: Angle[];
  trust: Item[];
  servicesKicker: string;
  servicesHeading: string;
  services: Item[];
  stepsKicker: string;
  stepsHeading: string;
  steps: { title: string; description: string }[];
  faqHeading: string;
  faq: { question: string; answer: string }[];
  host: { kicker: string; heading: string; role: string; body: string };
  comparison: { heading: string; othersLabel: string; rows: { label: string; us: string; others: string }[] };
  marquee: string[];
  promo: { kicker: string; heading: string; body: string; cta: string };
  cta: { heading: string; body: string; label: string };
  form: { kicker: string; heading: string; body: string; button: string };
};
