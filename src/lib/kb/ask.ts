/*
 * "Ask FoodDecode": the prototype's rule-based label Q&A, ported. Deterministic keyword rules over the
 * additive list, glossary and reference values — no AI model, no personal medical advice.
 */
import { searchLocal, norm } from "../catalogue";
import { per100Band } from "../nutrition/calc";
import { DAILY_REFERENCE } from "../nutrition/reference";
import type { NutrientKey } from "../types";
import { glossFor } from "./glossary";
import { insLookup } from "./ins";

export interface AskPart { text: string; link?: { href: string; label: string }; src?: string }

export const SUGGESTIONS = ["What does INS 330 mean?", "Why is serving size important?", "Is 10 g sugar a lot?", "What is saturated fat?", "Why do packaged foods contain emulsifiers?", "Is 600 mg sodium a lot?", "What is maida?", "What's the difference between sugar and added sugar?"];

const TOPICS: { re: RegExp; a: string; link: [string, string] }[] = [
  { re: /serving size|per serving|serve size/, a: "The serving size is the amount the manufacturer used for the per-serving column. Everything in that column depends on it, and many people eat more than one serving at a time. Compare products using the per-100 g column, and use the serving size to work out what you actually ate.", link: ["/learn/serving-size", "Lesson: Understanding serving size"] },
  { re: /added sugar|total sugar|sugar vs|difference between sugar/, a: "Total sugars include sugars naturally present (lactose in milk, fructose in fruit) plus added sugars. Added sugar is only what was added during manufacturing. The 50 g daily reference on Indian labels is for added sugar.", link: ["/learn/sugar", "Lesson: Sugar vs added sugar"] },
  { re: /carb/, a: "Total carbohydrate includes starch and all sugars; added sugar is only a part of it. If you are monitoring carbohydrates, look at total carbohydrate for your portion; if you are cutting sugar, look at added sugar.", link: ["/learn/carbs", "Lesson: Total carbohydrates vs added sugars"] },
  { re: /saturat/, a: "Saturated fat is found mostly in palm oil, coconut oil, butter, ghee and cocoa butter. Indian labels show it under total fat, and the daily reference is 22 g.", link: ["/learn/fats", "Lesson: Saturated, unsaturated and trans fat"] },
  { re: /trans fat|hydrogenat/, a: "Trans fat can form when vegetable oils are partially hydrogenated. The label reference is 2 g a day, and lower is better.", link: ["/learn/fats", "Lesson: Saturated, unsaturated and trans fat"] },
  { re: /sodium|salt/, a: "Labels list sodium. Salt is about 40% sodium, so salt (g) ≈ sodium (mg) × 2.5 ÷ 1000. The daily reference is 2,000 mg sodium (about 5 g salt).", link: ["/learn/sodium", "Lesson: Sodium vs salt"] },
  { re: /may contain|trace|allergen/, a: "“May contain” is a voluntary warning about cross-contact. Its absence does not prove there is no cross-contact, and a label with no allergen statement is unknown, not allergen-free.", link: ["/learn/allergens", "Lesson: Allergens and “may contain” labels"] },
  { re: /emulsif/, a: "Emulsifiers help ingredients that normally separate, like oil and water, stay evenly mixed. Common ones are lecithin (322), mono- and diglycerides (471) and DATEM (472e).", link: ["/learn/ins", "Lesson: What are INS numbers?"] },
  { re: /preservativ/, a: "Preservatives slow the growth of microbes so a product stays safe for its shelf life — e.g. sodium benzoate (211) in soft drinks. Each permitted preservative has limits on which foods it can be used in and how much.", link: ["/learn/ins", "Lesson: What are INS numbers?"] },
  { re: /\bins\b|e.?number|additive|code/, a: "INS numbers are international codes for food additives. The word before the number tells you the job (emulsifier, raising agent); the number tells you the substance. Ask about any number, e.g. “What is INS 471?”", link: ["/learn/ins", "Lesson: What are INS numbers?"] },
  { re: /read.*label|how.*label/, a: "Start with the serving size, check which column you're reading, then energy, then added sugar, saturated fat, trans fat and sodium, and finally the ingredients in order of weight.", link: ["/learn/read-label", "Lesson: How to read a nutrition label"] },
  { re: /rda|%|percent|daily value|reference/, a: "%RDA shows how much of a day's reference amount one serving gives. Indian labels use 2,000 kcal energy, 67 g total fat, 22 g saturated fat, 2 g trans fat, 50 g added sugar and 2,000 mg sodium.", link: ["/learn/read-label", "Lesson: How to read a nutrition label"] },
  { re: /zero sugar|sugar.?free|sweetener/, a: "“Zero sugar” products replace sugar with non-sugar sweeteners such as sucralose (955), acesulfame potassium (950), aspartame (951) or stevia (960). Check the ingredient list to see which ones are used.", link: ["/product/coke-zero", "Decode Coca-Cola Zero Sugar"] },
  { re: /healthy|unhealthy|good for|bad for|should i eat|safe/, a: "FoodDecode doesn't label foods healthy or unhealthy. It shows what's in the amount you eat and how that compares with reference values — and, if you add a profile, how it fits your allergies, diet and goals.", link: ["/profile", "Your health profile"] },
  { re: /portion|how much.*eat|whole pack/, a: "Labels give values per serving, but you might eat two servings or the whole pack. Every product page has a portion control that rescales all numbers and updates the YES / NO / CAUTION answer.", link: ["/learn/portion", "Lesson: Why portion size changes the picture"] },
];
const MEDICAL = /diabet|blood pressure|hypertens|\bbp\b|pregnan|kidney|heart disease|cholesterol level|medicine|medication|celiac|coeliac|my doctor|dose|cure|weight loss plan|diet plan/i;
const MAP: Record<string, NutrientKey | "salt"> = { "added sugar": "addedSugarG", sugar: "sugarsG", sodium: "sodiumMg", salt: "salt", "saturated fat": "saturatedFatG", "sat fat": "saturatedFatG", fat: "totalFatG", protein: "proteinG", fibre: "fibreG", fiber: "fibreG", "trans fat": "transFatG", calories: "energyKcal", kcal: "energyKcal" };

export function answer(q: string): AskPart[] {
  const ql = q.toLowerCase();
  const parts: AskPart[] = [];
  if (MEDICAL.test(ql)) parts.push({ text: "For a medical condition or a personal diet plan, please talk to a doctor or registered dietitian. FoodDecode can explain labels and check them against the limits you enter in your profile, but it can't tell you what's right for your health." });
  let im = ql.match(/\b(?:ins|e)\s*-?\s*(\d{3,4}\s*[a-f]?(?:\s*\(\s*[ivx]+\s*\))?)/i);
  if (!im) {
    const bare = ql.match(/\b(\d{3,4}[a-f]?(?:\([ivx]+\))?)(?!\s*(?:mg|g|kcal|ml|%|grams?|calories))\b/);
    if (bare && insLookup(bare[1])) im = bare;
  }
  if (im) {
    const code = im[1].replace(/\s+/g, "");
    const d = insLookup(code);
    if (d) parts.push({ text: `INS ${code}: ${d.name} (${d.cls}). ${d.what} Why it's used: ${d.why} ${d.ctx || ""}`.trim(), src: "FoodDecode additive explainer" });
    else parts.push({ text: `INS ${code} isn't in FoodDecode's additive list yet. The word in front of the number on the label (e.g. “Stabiliser” or “Colour”) tells you what job it does.` });
  }
  const nm = ql.match(/(\d+(?:\.\d+)?)\s*(mg|g|grams?|kcal|calories)\s*(?:of\s*)?(added sugar|sugar|salt|sodium|saturated fat|sat fat|fat|protein|fibre|fiber|trans fat|calories|kcal)?/);
  if (nm && !im) {
    let v = parseFloat(nm[1]);
    const unit = nm[2];
    let what = nm[3] || (/(kcal|calor)/.test(unit) ? "calories" : "");
    if (!what) what = ql.match(/(added sugar|sugar|salt|sodium|saturated fat|fat|protein|fibre|fiber|calories)/)?.[1] || "";
    let k = MAP[what];
    if (k === "salt") { k = "sodiumMg"; v = unit === "mg" ? v / 2.5 : (v * 1000) / 2.5; parts.push({ text: `${nm[1]} ${unit} of salt is about ${Math.round(v)} mg of sodium.` }); }
    else if (k === "sodiumMg" && unit.startsWith("g")) v *= 1000;
    if (k) {
      const ref = DAILY_REFERENCE[k === "sugarsG" ? "addedSugarG" : k];
      let text = "";
      if (ref) text += `If that's what you eat in one sitting, it's ${Math.round((v / ref.value) * 100)}% of the ${ref.source}${k === "sugarsG" ? " (that reference is for added sugar)" : ""}. `;
      const b = per100Band(k, v, "g");
      if (b) text += `If it's the per-100 g value on a label, it's in the ${b.code.toUpperCase()} band (${b.rule}). `;
      text += "So whether it's “a lot” depends on the column and on how much you eat.";
      parts.push({ text, src: "Calculated with FoodDecode's reference values" });
    }
  }
  const g = glossFor(ql);
  if (g && !parts.length) parts.push({ text: `${g.title}. ${g.body}`, src: "FoodDecode ingredient glossary" });
  if (parts.length < 2) for (const tp of TOPICS) if (tp.re.test(ql)) { parts.push({ text: tp.a, link: { href: tp.link[0], label: tp.link[1] } }); break; }
  const prod = searchLocal(q.replace(/what|is|in|the|about|how|much|does|have|contain|sugar|sodium/gi, " "))[0];
  if (prod && norm(q).split(" ").some((w) => w.length > 3 && norm(prod.name).includes(w))) parts.push({ text: `Want to see the numbers for ${prod.name}?`, link: { href: `/product/${prod.id}`, label: `Decode ${prod.name}` } });
  if (!parts.length) parts.push({ text: "I can answer questions about nutrition labels, INS numbers, ingredients and serving sizes. Try a suggestion below, or ask about an additive like “INS 471”." });
  return parts;
}
