/*
 * FoodDecode label parser v2: turns OCR lines into candidate label fields.
 *
 * Rules:
 *  - It never fills a value it did not read. Missing fields stay null.
 *  - Every conversion it makes (kJ→kcal, g→mg, "Nil"→0, a letter O read inside a number) is recorded in
 *    `notes` so the review screen can show it. Nothing is changed silently.
 *  - It reads both columns of a two-column table (per 100 g/ml and per serving) when the header says which is which.
 *  - It tolerates OCR output with missing spaces ("Protein(g)8.2", "TotalFat12.5") and labels split across lines.
 */
import { allCodes } from "../ingredients/parse";
import type { NutrientKey } from "../types";

export interface OcrLine { text: string; conf?: number | null }
export type FieldKey = NutrientKey | "saltG";
export type Basis = "100" | "serving";

export interface FieldReading {
  per100: number | null;
  perServing: number | null;
  /** the text the numbers were read from */
  raw: string;
  line: number;
  /** OCR engine confidence for that line, 0–100, when the engine reports it */
  conf: number | null;
  notes: string[];
  /** the unit printed on the label, before any conversion */
  printedUnit: string | null;
}

export interface ParsedLabel {
  fields: Partial<Record<FieldKey, FieldReading>>;
  columns: Basis[];
  basisDetected: boolean;
  unit: "g" | "ml" | null;
  servingSize: number | null;
  servingUnit: "g" | "ml" | null;
  servingsPerPack: number | null;
  packSize: number | null;
  packUnit: "g" | "ml" | null;
  ingredientsText: string | null;
  allergenStatement: string | null;
  insCodes: string[];
  lineCount: number;
  meanConf: number | null;
}

export const FIELD_KEYS: FieldKey[] = [
  "energyKcal", "proteinG", "carbohydratesG", "sugarsG", "addedSugarG", "totalFatG", "saturatedFatG", "transFatG", "sodiumMg", "saltG", "fibreG",
];

// "not followed by another letter" — works without spaces, unlike \b; a glued unit ("Fatg", "Sodiummg") is allowed
const NA = "(?=[^a-z]|g|mg|kcal|$)";
const SODIUM_COMPOUND = "(?!\\s*(?:bi)?carbonate|\\s*benzoate|\\s*citrate|\\s*chloride|\\s*meta|\\s*phosphate|\\s*glutamate|\\s*erythorbate|\\s*nitrite|\\s*alginate|\\s*caseinate|\\s*hydrogen|\\s*acid|\\s*ascorbate|\\s*inosinate|\\s*guanylate|\\s*carboxy)";
/* Label words with tolerance for common OCR slips seen in the benchmark photos ("Proten", "Segars", "Carbodrate", "nergy"). */
const PATTERNS: { key: FieldKey | "_stop"; re: RegExp }[] = [
  { key: "_stop", re: /(?:mono|poly)\s*-?\s*un\s*satur[a-z]*\s*(?:f[ae]t[a-z]*)?(?:\s*acids?)?|\bm\s*u\s*f\s*a\b|\bp\s*u\s*f\s*a\b|cholest[a-z]*|vitamin|calcium|\biron\b|potassium|%\s*rda|\brda\b|polyols?|sugar\s*alcohols?|lactose|starch|(?:energy|calories)\s*from\s*fat/gi },
  { key: "addedSugarG", re: /a\s*d{1,2}\s*e?\s*d\s*-?\s*s[eu]g[a-z]{0,3}/gi },
  { key: "transFatG", re: new RegExp(`tr[ae]ns\\s*-?\\s*f(?:[ae]t(?:ty)?(?:\\s*acids?)?)?${NA}`, "gi") },
  { key: "saturatedFatG", re: /sat[u]?r[a-z]*\s*(?:f[ae]t(?:ty)?(?:\s*acids?)?)?/gi },
  { key: "energyKcal", re: /(?<![a-z])[ea]?ne?rg?[yio](?:\s*value)?|calories/gi },
  { key: "proteinG", re: /pr[o0]t[ea]?[il1]?[nm]/gi },
  { key: "carbohydratesG", re: /ca[r]?[bh](?!on)[a-z]*/gi },
  { key: "sugarsG", re: new RegExp(`(?:t[o0]ta?[il1]?\\s*)?s[eu]g[ae]rs?${NA}`, "gi") },
  { key: "totalFatG", re: new RegExp(`(?:t[o0]ta?[il1]?\\s*)?f[ae]t${NA}`, "gi") },
  { key: "sodiumMg", re: new RegExp(`s[o0]d[il1]um${SODIUM_COMPOUND}`, "gi") },
  { key: "saltG", re: new RegExp(`(?<![a-z]\\s?)salt${NA}`, "gi") },
  { key: "fibreG", re: /(?:dietary\s*)?f[il1]b(?:re|er|r)/gi },
];

interface Hit { key: FieldKey | "_stop"; start: number; end: number }

function findHits(line: string): Hit[] {
  const hits: Hit[] = [];
  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.re.exec(line))) {
      if (!m[0]) { p.re.lastIndex++; continue; }
      hits.push({ key: p.key, start: m.index, end: m.index + m[0].length });
    }
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Hit[] = [];
  for (const h of hits) {
    const prev = out[out.length - 1];
    if (prev && h.start < prev.end) continue; // "added sugars" also matches "sugars"; keep the longer, earlier one
    out.push(h);
  }
  return out;
}

interface Num { value: number; unit: string; index: number; raw: string; notes: string[]; lessThan: boolean }

/** Parse a number token: handles "12,5" (decimal comma), "1,247.1" (thousands), "<0.5", letter O inside digits. */
function readNumber(token: string): { value: number; notes: string[] } | null {
  const notes: string[] = [];
  let t = token;
  if (/\d[oO]|[oO]\d/.test(t)) {
    const fixed = t.replace(/(?<=\d)[oO]|[oO](?=\d)/g, "0");
    notes.push(`Read “${t}” as ${fixed} (letter O taken as zero)`);
    t = fixed;
  }
  if (/^0\d/.test(t)) notes.push(`“${t}” has a leading zero — it may be 0.${t.slice(1)} with the decimal point not read`);
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, "");
  else t = t.replace(",", ".");
  const v = parseFloat(t);
  return Number.isFinite(v) ? { value: v, notes } : null;
}

function numbersIn(seg: string): Num[] {
  const res: Num[] = [];
  const re = /(<\s*)?((?:\d|[oO](?=[\d.,]))[\doO]*(?:[.,][\doO]+)*)\s*(%|kcal|kj|mg|mcg|µg|g|ml)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(seg))) {
    const unit = (m[3] || "").toLowerCase();
    if (unit === "%") continue;
    // a percentage sign separated by a space or "*" ("4.8 %", "12*%")
    if (/^\s*\*?\s*%/.test(seg.slice(m.index + m[0].length))) continue;
    const n = readNumber(m[2]);
    if (!n) continue;
    res.push({ value: n.value, unit, index: m.index, raw: m[0].trim(), notes: n.notes, lessThan: !!m[1] });
  }
  return res;
}

/**
 * OCR sometimes runs two columns together ("384 269 13%" → "38426913%", "8.2 5.7 11%" → "8.25.711%").
 * When the table has a per-100 and a per-serving column and the serving size is known, the only split where
 * per-serving ≈ per-100 × serving/100 is taken — and the reading is flagged for the user to check.
 */
function splitMerged(seg: string, ratio: number, integerish: boolean): Num[] | null {
  const tok = seg.match(/\d[\d.]{3,}/)?.[0];
  if (!tok) return null;
  const valid = (x: string) => /^(0|[1-9]\d*)(\.\d+)?$/.test(x);
  const cands: { a: number; b: number; err: number; sameDp: boolean }[] = [];
  const dp = (x: string) => (x.split(".")[1] || "").length;
  for (let i = 1; i < tok.length; i++) {
    const as = tok.slice(0, i);
    if (!valid(as)) continue;
    for (let j = i + 1; j <= tok.length; j++) {
      const bs = tok.slice(i, j);
      if (!valid(bs)) continue;
      const a = parseFloat(as), b = parseFloat(bs);
      const exp = a * ratio;
      const tol = Math.max(exp * 0.02, integerish ? 1 : 0.051);
      if (a > 0 && Math.abs(b - exp) <= tol) cands.push({ a, b, err: Math.abs(b - exp) / Math.max(exp, 0.1), sameDp: dp(as) === dp(bs) });
    }
  }
  // labels print both columns with the same number of decimals; if that still leaves several readings, give up
  const pick = cands.length === 1 ? cands : cands.filter((c) => c.sameDp);
  if (pick.length !== 1) return null;
  const { a, b } = pick[0];
  const note = `Digits ran together (“${tok}”); read as ${a} and ${b} using the serving size — please check`;
  return [
    { value: a, unit: "", index: 0, raw: String(a), notes: [note], lessThan: false },
    { value: b, unit: "", index: 1, raw: String(b), notes: [], lessThan: false },
  ];
}

function detectColumns(lines: string[]): { columns: Basis[]; found: boolean; unit: "g" | "ml" | null } {
  for (const l of lines) {
    const low = l.toLowerCase().replace(/\s+/g, " ");
    const m100 = low.match(/(?:per|\/)\s*100\s*(g|gm|ml|m\s?l)?|100\s*(g|gm|ml)(?![a-z]{2})|100\s*(g|gm|ml)(?=per)/);
    const i100 = m100 ? low.indexOf(m100[0]) : -1;
    const iServ = low.search(/per\s*se[rn]v|amount\s*per\s*pa|\/\s*\d+(?:\.\d+)?\s*(?:g|ml)|per\s*serv|per\s*portion|per\s*\d+(?:\.\d+)?\s*(?:g|ml)\s*serv|\bserve\b|\bserving\b(?!\s*size)|per\s*pack|per\s*biscuit|per\s*bar|per\s*piece|per\s*(?!100(?!\d))\d+\s*(?:g|ml)\b/);
    const unit = m100 ? ((m100[1] || m100[2] || "").replace(/\s/g, "").startsWith("m") ? "ml" : (m100[1] || m100[2]) ? "g" : null) : null;
    if (i100 >= 0 && iServ >= 0) return { columns: i100 <= iServ ? ["100", "serving"] : ["serving", "100"], found: true, unit };
    if (i100 >= 0 && /per|approx|value|nutri/.test(low)) return { columns: ["100"], found: true, unit };
    if (iServ >= 0 && /amount\s*per\s*(?:serving|pa)|per\s*serv(?:e|ing)\s*[(\d]|per\s*\d+(?:\.\d+)?\s*(?:g|ml)/.test(low) && !/serving\s*size/.test(low)) return { columns: ["serving"], found: true, unit: null };
  }
  return { columns: ["100"], found: false, unit: null };
}

function printedUnitAfter(seg: string): string | null {
  const m = seg.match(/^\s*[,:]?\s*[(\[{]\s*(kcal|kj|mg|mcg|g|q|9|ml)\s*[)\]}]/i) || seg.match(/^\s*[,:]?\s*(kcal|kj|mg|g)(?=\s|\d|$)/i);
  if (!m) return null;
  const u = m[1].toLowerCase();
  return u === "q" || u === "9" ? "g" : u;
}

/** Splits an ingredients block from the rest so ingredient words ("sugar", "salt") are not read as table rows. */
function inIngredientsBlock(lines: string[]): boolean[] {
  const flags: boolean[] = [];
  let inside = false;
  for (const l of lines) {
    const low = l.toLowerCase();
    if (/ingred[il1]ents?/.test(low)) inside = true;
    else if (/nutrition|nutritional|energy|per\s*100|serv(?:ing|e)\s*size|allergen|best\s*before|mfd|manufactured|packed|marketed|net\s*(?:qty|wt|weight)/.test(low)) inside = false;
    flags.push(inside);
  }
  return flags;
}

export function parseLabel(input: OcrLine[] | string): ParsedLabel {
  const raw: OcrLine[] = typeof input === "string" ? input.split(/\r?\n/).map((text) => ({ text })) : input;
  const lines = raw
    .map((l) => ({ text: l.text.replace(/[|]/g, " ").replace(/\s+/g, " ").trim(), conf: l.conf ?? null }))
    .filter((l) => l.text.length > 0);
  const texts = lines.map((l) => l.text);
  const header = detectColumns(texts);
  const ingr = inIngredientsBlock(texts);
  const fields: ParsedLabel["fields"] = {};
  const flat = texts.join(" ");
  const num = (s: string) => readNumber(s)?.value ?? null;
  let servingSize: number | null = null, servingUnit: "g" | "ml" | null = null;
  const servingRes = [
    /(?:se[rn]?[nv]?[il1]ng|serv(?:ing|e))\s*size[^0-9]{0,30}?(?:\d+\s*[a-z]+\s*)?\(?\s*(\d+(?:[.,]\d+)?)\s*(g|gm|ml)(?![a-z]{2})/i,
    /serv(?:ing|e)\s*[=:\-]\s*(\d+(?:[.,]\d+)?)\s*(g|gm|ml)/i,
    /100\s*(?:g|ml)\s*\/\s*(\d+(?:[.,]\d+)?)\s*(g|gm|ml)/i,
    /per\s*serv(?:ing|e)\s*[(\[]\s*(\d+(?:[.,]\d+)?)\s*(g|gm|ml)\b/i,
    /amount\s*per\s*serving\s*[(\[]?\s*(\d+(?:[.,]\d+)?)\s*(g|gm|ml)\b/i,
    /per\s*(\d+(?:[.,]\d+)?)\s*(g|gm|ml)\s*serv/i,
    /per\s*serv(?:ing|e)\s*(?:of\s*)?(\d+(?:[.,]\d+)?)\s*(g|gm|ml)\b/i,
  ];
  for (const re of servingRes) {
    const m = flat.match(re);
    if (m) { servingSize = num(m[1]); servingUnit = m[2].toLowerCase().startsWith("m") ? "ml" : "g"; break; }
  }
  const ratio = header.columns.length === 2 && servingSize ? servingSize / 100 : null;

  const assign = (key: FieldKey, nums: Num[], lineIdx: number, seg: string, labelUnit: string | null, extraNotes: string[] = []) => {
    if (fields[key]) return; // first table row wins
    const notes = [...extraNotes];
    let vals = nums;
    let printedUnit = labelUnit || vals.find((n) => n.unit)?.unit || null;
    if (key === "energyKcal") {
      const kcal = vals.filter((n) => n.unit === "kcal");
      const kj = vals.filter((n) => n.unit === "kj");
      if (kcal.length) { vals = kcal; printedUnit = "kcal"; }
      else if (kj.length || labelUnit === "kj") {
        vals = (kj.length ? kj : vals).map((n) => ({ ...n, value: Math.round((n.value / 4.184) * 10) / 10 }));
        printedUnit = "kj";
        notes.push("Label shows kJ; converted to kcal (÷ 4.184)");
      }
    }
    if (key === "sodiumMg" && (printedUnit === "g")) {
      vals = vals.map((n) => ({ ...n, value: Math.round(n.value * 1000 * 10) / 10 }));
      notes.push("Label shows sodium in g; converted to mg (× 1000)");
    }
    if (key === "saltG" && printedUnit === "mg") {
      vals = vals.map((n) => ({ ...n, value: n.value / 1000 }));
      notes.push("Label shows salt in mg; converted to g (÷ 1000)");
    }
    for (const n of vals) notes.push(...n.notes);
    if (vals.some((n) => n.lessThan)) notes.push("Label shows “less than” (<) — the upper bound is used");
    const cols = header.columns;
    const reading: FieldReading = { per100: null, perServing: null, raw: seg.trim().slice(0, 60), line: lineIdx, conf: lines[lineIdx].conf, notes, printedUnit };
    for (let i = 0; i < Math.min(vals.length, cols.length); i++) {
      if (cols[i] === "100") reading.per100 = vals[i].value;
      else reading.perServing = vals[i].value;
    }
    if (!header.found && vals.length > 1) notes.push("Table header not found: the first number was taken as per 100 g/ml. Please check.");
    fields[key] = reading;
  };

  // a nutrient name whose numbers are on the next line(s)
  let pending: { key: FieldKey; line: number; labelUnit: string | null } | null = null;

  lines.forEach((ln, idx) => {
    if (ingr[idx]) { pending = null; return; }
    const line = ln.text;
    // long comma-separated text is an ingredient or address line, not a table row
    if ((line.match(/,/g) || []).length >= 4 && !/\d+\s*(?:g|mg|kcal)\b.*\d+\s*(?:g|mg|kcal)\b/i.test(line)) return;
    const hits = findHits(line);
    if (!hits.length) {
      if (pending) {
        const nums = numbersIn(line);
        if (nums.length) assign(pending.key, nums, idx, line, pending.labelUnit, ["Values were on the line after the nutrient name — check the row alignment"]);
        pending = null;
      }
      return;
    }
    pending = null;
    hits.forEach((h, i) => {
      if (h.key === "_stop") return;
      let seg = line.slice(h.end, i + 1 < hits.length ? hits[i + 1].start : undefined);
      const labelUnit = printedUnitAfter(seg) ?? (h.key === "energyKcal" && /k\s*cal/i.test(line.slice(h.start, h.end + 14)) ? "kcal" : null);
      seg = seg.replace(/^\s*[,:]?\s*[(\[{]\s*(?:kcal|kj|mg|mcg|g|q|9|ml)\s*[)\]}]/i, " ");
      // "per 100 g" fragments inside a row are not values
      let nums = numbersIn(seg).filter((n) => !(n.value === 100 && (/per\s*$|\/\s*$/i.test(seg.slice(Math.max(0, n.index - 6), n.index)) || (/^(g|gm|ml)$/.test(n.unit) && /per|se[rn]v/i.test(seg)))));
      if (ratio && nums.length < 2) {
        const split = splitMerged(seg, ratio, h.key === "energyKcal" || h.key === "sodiumMg");
        if (split) nums = split;
      }
      if (!nums.length) {
        const nil = seg.match(/\b(nil|nill|not\s*detected|nd)\b/i);
        if (nil) {
          assign(h.key as FieldKey, header.columns.map((_, k) => ({ value: 0, unit: "", index: k, raw: nil[0], notes: [], lessThan: false })), idx, seg, labelUnit, [`Label says “${nil[0]}”; read as 0`]);
          return;
        }
        if (i === hits.length - 1) pending = { key: h.key as FieldKey, line: idx, labelUnit };
        return;
      }
      assign(h.key as FieldKey, nums, idx, seg, labelUnit);
    });
  });

  let servingsPerPack: number | null = null;
  const sp = flat.match(/(?:no\.?\s*of\s*)?(?:servings?|serves)\s*per\s*(?:pack(?:age|et)?|container|pouch|bottle|unit)[^0-9]{0,14}(\d+(?:[.,]\d+)?)/i)
    || flat.match(/approx\.?\s*(\d+(?:[.,]\d+)?)\s*servings/i);
  if (sp) servingsPerPack = num(sp[1]);
  let packSize: number | null = null, packUnit: "g" | "ml" | null = null;
  const pk = flat.match(/net\s*(?:qty|quantity|wt|weight|content|vol(?:ume)?)\.?[^0-9]{0,15}(\d+(?:[.,]\d+)?)\s*(kg|g|gm|ml|l|ltr)\b/i);
  if (pk) {
    packSize = num(pk[1]);
    const u = pk[2].toLowerCase();
    if (packSize != null && u === "kg") { packSize *= 1000; packUnit = "g"; }
    else if (packSize != null && (u === "l" || u === "ltr")) { packSize *= 1000; packUnit = "ml"; }
    else packUnit = u.startsWith("m") ? "ml" : "g";
  }

  let ingredientsText: string | null = null;
  const ii = flat.search(/ingred[il1]ents?\s*[:\-;.]?/i);
  if (ii >= 0) {
    let rest = flat.slice(ii).replace(/^ingred[il1]ents?\s*[:\-;.]?\s*/i, "");
    const stop = rest.search(/allergen|nutrition(?:al)?\s*(?:info|facts|value)|best\s*before|manufactured|mfd\b|packed\s*by|marketed\s*by|storage|store\s*in|net\s*(?:qty|wt)|this is a made-up|\bcontains\s*[:\-]|may\s*contain/i);
    if (stop > 0) rest = rest.slice(0, stop);
    ingredientsText = rest.trim().replace(/\s+/g, " ") || null;
  }
  const stmts: string[] = [];
  const al = flat.match(/allergen[a-z ]*(?:information|advice|declaration|info)?\s*[:\-]\s*([^.]{3,200}\.?)/i);
  if (al) stmts.push(al[1].trim());
  const ct = flat.match(/\bcontains\s*[:\-]\s*([^.]{3,160}\.?)/i);
  if (ct && !stmts.some((s) => s.includes(ct[1].trim()))) stmts.push("Contains: " + ct[1].trim());
  const mc = flat.match(/may\s*contain[^.]{3,160}\.?/i);
  if (mc && !stmts.some((s) => s.toLowerCase().includes(mc[0].toLowerCase().slice(0, 20)))) stmts.push(mc[0].trim());
  const allergenStatement = stmts.length ? stmts.join(" ") : null;

  const confs = lines.map((l) => l.conf).filter((c): c is number => typeof c === "number");
  return {
    fields,
    columns: header.columns,
    basisDetected: header.found,
    unit: header.unit ?? servingUnit ?? packUnit,
    servingSize,
    servingUnit,
    servingsPerPack,
    packSize,
    packUnit,
    ingredientsText,
    allergenStatement,
    insCodes: allCodes(ingredientsText),
    lineCount: lines.length,
    meanConf: confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : null,
  };
}

/** Number of nutrient fields with at least one value — used to rank OCR variants. */
export function fieldCount(p: ParsedLabel): number {
  return Object.values(p.fields).filter((f) => f && (f.per100 != null || f.perServing != null)).length;
}
