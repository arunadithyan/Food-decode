/*
 * Dietary-pattern checks (vegetarian, vegan, eggetarian, Jain). Deterministic keyword rules over the
 * ingredient text. The FSSAI green/brown veg symbol on the pack is the legal indicator; FoodDecode does
 * not have it for most products, so additives that can be animal-derived produce a "check the symbol" caution.
 */
import { checkAllergen } from "./allergens";
import { normText, splitStatements } from "./parse";

export const DIET_PATTERNS = ["none", "vegetarian", "eggetarian", "vegan", "jain", "non-vegetarian"] as const;
export type DietPattern = (typeof DIET_PATTERNS)[number];

export const DIET_LABEL: Record<DietPattern, string> = {
  none: "No specific pattern",
  vegetarian: "Vegetarian",
  eggetarian: "Eggetarian (vegetarian + eggs)",
  vegan: "Vegan",
  jain: "Jain",
  "non-vegetarian": "Non-vegetarian",
};

const MEAT = /\b(chicken|mutton|beef|pork|lamb|goat meat|meat|bacon|ham|sausage|gelatine?|lard|tallow|animal fat|animal rennet|rennet|bone|collagen|isinglass|carmine|cochineal|fish|anchov(?:y|ies)|tuna|prawns?|shrimps?|crabs?|squid|oysters?|chicken fat|meat extract)\b/;
const EGG = /\b(eggs?|egg yolk|egg white|albumin|ovalbumin|mayonnaise)\b/;
const HONEY = /\bhoney\b/;
const JAIN_CONFIRMED = /\b(onions?|garlic|potato(?:es)?|potato flakes|potato starch|carrots?|beetroot|beet|radish|mooli|sweet potato|yam|mushrooms?|honey|alcohol)\b/;
const JAIN_VARIES = /\b(ginger|turmeric|haldi|yeast|yeast extract)\b/;
const UNSPECIFIED_SPICES = /\b(spices?(?: and condiments)?|condiments|dehydrated vegetables|vegetable powder|seasoning)\b/;
/** INS additives that can be plant- or animal-derived */
const AMBIGUOUS_ANIMAL = [
  { re: /\b(471|472e|472 e|481|482|470|570|mono-? and diglycerides)\b/, what: "emulsifiers such as INS 471/472e can be made from plant or animal fats" },
  { re: /\b(627|631|635|disodium guanylate|disodium inosinate|ribonucleotides?)\b/, what: "flavour enhancers INS 627/631 can be made from fish, meat or by fermentation" },
  { re: /\b(542|bone phosphate)\b/, what: "INS 542 is made from animal bone" },
  { re: /\b(901|beeswax|904|shellac|913|lanolin)\b/, what: "beeswax (901), shellac (904) and lanolin (913) are animal-derived" },
];
const VEG_ORIGIN = /\b(of vegetable origin|vegetable origin|plant origin|of plant origin|vegetarian)\b/;

export type DietVerdict = "conflict" | "uncertain" | "ok" | "unknown";
export interface DietFinding {
  verdict: DietVerdict;
  matches: string[];
  reasons: string[];
}

function hits(re: RegExp, text: string): string[] {
  const g = new RegExp(re.source, "g");
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = g.exec(text))) out.add(m[0]);
  return [...out];
}

export function checkDiet(pattern: DietPattern, ingredientsText: string | null | undefined, allergenStatement?: string | null): DietFinding {
  if (pattern === "none" || pattern === "non-vegetarian") return { verdict: "ok", matches: [], reasons: [] };
  if (!ingredientsText && !allergenStatement) return { verdict: "unknown", matches: [], reasons: ["No ingredient list is available, so FoodDecode can't check this against your diet."] };
  const sec = splitStatements(ingredientsText, allergenStatement);
  const text = normText(sec.ingredients + " " + sec.contains.join(" "));
  const conflicts: string[] = [];
  const reasons: string[] = [];

  const meat = hits(MEAT, text);
  if (meat.length) {
    conflicts.push(...meat);
    reasons.push(`Lists ${meat.join(", ")}, which is not vegetarian.`);
  }
  if (pattern !== "eggetarian") {
    const egg = hits(EGG, text);
    if (egg.length) {
      conflicts.push(...egg);
      reasons.push(`Lists ${egg.join(", ")}.`);
    }
  }
  if (pattern === "vegan" || pattern === "jain") {
    if (pattern === "vegan") {
      const milk = checkAllergen("milk", ingredientsText, allergenStatement);
      if (milk.kind === "confirmed") {
        conflicts.push(...milk.matches);
        reasons.push(`Lists dairy (${milk.matches.join(", ")}), which is not vegan.`);
      }
    }
    const honey = hits(HONEY, text);
    if (honey.length) {
      conflicts.push("honey");
      reasons.push("Lists honey.");
    }
  }
  if (pattern === "jain") {
    const j = hits(JAIN_CONFIRMED, text).filter((x) => x !== "honey");
    if (j.length) {
      conflicts.push(...j);
      reasons.push(`Lists ${j.join(", ")}, which Jain diets usually exclude (root vegetables, onion, garlic).`);
    }
  }
  if (conflicts.length) return { verdict: "conflict", matches: [...new Set(conflicts)], reasons };

  const uncertain: string[] = [];
  const uReasons: string[] = [];
  {
    for (const a of AMBIGUOUS_ANIMAL) {
      const h = hits(a.re, text);
      if (h.length && !(VEG_ORIGIN.test(text) && /471|472|glycerides/.test(h.join(" ")))) {
        uncertain.push(...h);
        uReasons.push(`The source isn't stated: ${a.what}. Check for the green (veg) symbol on the pack.`);
      }
    }
  }
  if (pattern === "jain") {
    const v = hits(JAIN_VARIES, text);
    if (v.length) {
      uncertain.push(...v);
      uReasons.push(`Lists ${v.join(", ")}; whether these are acceptable varies between Jain practices.`);
    }
    const sp = hits(UNSPECIFIED_SPICES, text);
    if (sp.length) {
      uncertain.push(...sp);
      uReasons.push(`Lists “${sp[0]}” without naming each one; it may include onion or garlic.`);
    }
  }
  if (pattern === "vegan" && /\b(natural flavou?rs?|flavou?ring substances?)\b/.test(text)) {
    uncertain.push("flavourings");
    uReasons.push("Flavourings don't state their source and could include dairy.");
  }
  if (uncertain.length) return { verdict: "uncertain", matches: [...new Set(uncertain)], reasons: uReasons };
  return { verdict: "ok", matches: [], reasons: [] };
}
