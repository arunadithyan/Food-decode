/* Ingredient-list parsing: statement splitting, item splitting, INS code extraction. Pure functions. */
import { glossFor, type GlossaryEntry } from "../kb/glossary";

export interface IngredientSections {
  /** The ingredient list itself (without "Contains"/"May contain" statements) */
  ingredients: string;
  /** "Contains …" allergen declarations */
  contains: string[];
  /** "May contain …", "traces of …", shared-facility statements (precautionary / cross-contact) */
  mayContain: string[];
}

const MAY_RE = /\b(may\s+contain|may\s+have\s+traces|traces?\s+of|manufactured\s+in\s+a\s+facility[^.]*|processed\s+(?:in|on)\s+(?:a\s+)?(?:facility|shared\s+equipment)[^.]*|produced\s+in\s+a\s+(?:factory|facility)[^.]*)\b[^.]*\.?/gi;
const CONTAINS_RE = /\b(?:allergen\s+(?:information|advice)\s*:?\s*)?contains?\s*:?\s+(?!added|permitted|natural|artificial|\d)[^.]*\.?/gi;

/** Split full label text into ingredient list, "contains" and "may contain" statements. */
export function splitStatements(text: string | null | undefined, extraStatement?: string | null): IngredientSections {
  const src = [text || "", extraStatement || ""].join(" ").replace(/\s+/g, " ").trim();
  const mayContain: string[] = [];
  let rest = src.replace(MAY_RE, (m) => {
    mayContain.push(m.trim());
    return " ";
  });
  const contains: string[] = [];
  rest = rest.replace(CONTAINS_RE, (m) => {
    contains.push(m.trim());
    return " ";
  });
  return { ingredients: rest.replace(/\s+/g, " ").trim(), contains, mayContain };
}

export const ADDITIVE_WORDS =
  /(emulsifier|raising agent|leavening|acidity regulator|thickener|stabili[sz]er|humectant|flavou?r enhancer|colou?r|preservative|antioxidant|sweetener|anticaking|anti-caking|flour treatment|dough conditioner|antifoaming|\bins\b|firming|mineral|glazing)/i;

/** Extract INS codes like 503(ii), 472e, 160a(iii) — only from items that name an additive class or "INS". */
export function findCodes(item: string): string[] {
  const codes: string[] = [];
  if (!ADDITIVE_WORDS.test(item)) return codes;
  const re = /(?:INS\s*|E\s?)?\b(\d{3,4})\s*([a-f])?\s*(?:\(\s*([ivx]{1,4})\s*\))?(?!\s*(?:%|mg|g\b|\.\d|mcg))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(item))) {
    const n = parseInt(m[1], 10);
    if (n < 100 || n > 1600) continue;
    const code = m[1] + (m[2] || "").toLowerCase() + (m[3] ? `(${m[3].toLowerCase()})` : "");
    if (!codes.includes(code)) codes.push(code);
  }
  return codes;
}

/** All INS codes mentioned anywhere in the ingredient text. */
export function allCodes(text: string | null | undefined): string[] {
  if (!text) return [];
  const out = new Set<string>();
  for (const item of splitTop(text)) findCodes(item).forEach((c) => out.add(c));
  return [...out];
}

function splitTop(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of text) {
    if ("([{".includes(ch)) depth++;
    if (")]}".includes(ch)) depth = Math.max(0, depth - 1);
    if ((ch === "," || ch === ";") && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((s) => s.trim()).filter(Boolean);
}

export type IngredientItem =
  | { type: "section"; name: string }
  | { type: "additive"; name: string; codes: string[]; raw: string }
  | { type: "ing"; name: string; pct?: string; raw: string; gloss: GlossaryEntry | null };

/** Turn the ingredient list into display items (sections, ingredients, additives with INS codes). */
export function parseIngredients(text: string | null | undefined): IngredientItem[] {
  if (!text) return [];
  const { ingredients } = splitStatements(text);
  const out: IngredientItem[] = [];
  const sections = ingredients.split(/\.\s+(?=[A-Z][A-Za-z ®]{2,30}:)/);
  for (const sec of sections) {
    let body = sec.trim().replace(/\.$/, "");
    const sm = body.match(/^([A-Z][A-Za-z ®]{2,30}):\s*/);
    if (sm) {
      out.push({ type: "section", name: sm[1].replace("®", "").trim() });
      body = body.slice(sm[0].length);
    }
    for (const raw of splitTop(body)) {
      const item = raw.replace(/^(and|&)\s+/i, "").trim();
      if (!item) continue;
      const codes = findCodes(item);
      const pct = (item.match(/\((\d+(?:\.\d+)?)\s*%\)/) || [])[1];
      const nameOnly = item.replace(/\s*[([].*$/, "").trim() || item;
      if (codes.length) out.push({ type: "additive", name: nameOnly, codes, raw: item });
      else out.push({ type: "ing", name: nameOnly, pct, raw: item, gloss: glossFor(item) });
    }
  }
  return out;
}

/** Lower-cased text with whitespace normalised, used for keyword matching. */
export function normText(s: string): string {
  return s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ");
}
