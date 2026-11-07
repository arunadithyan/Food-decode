/* Ingredient glossary — ported from FoodDecode v1. */
export interface GlossaryEntry { k: string[]; title: string; body: string }
export const GLOSSARY: GlossaryEntry[] = [
  { k: ["maida", "refined wheat flour"], title: "Refined wheat flour (Maida)", body: "Wheat flour with the bran and germ removed. It makes soft, light textures but has less fibre than whole wheat flour (atta)." },
  { k: ["atta", "whole wheat", "wheat flour (atta)"], title: "Whole wheat flour (Atta)", body: "Flour made from the whole wheat grain, so it keeps more of the bran and fibre than maida." },
  { k: ["palmolein", "palm oil", "refined palm oil", "palm"], title: "Palm oil / Palmolein", body: "Palmolein is the liquid part of palm oil. It is stable for frying and baking. It has a higher share of saturated fat than oils like sunflower or groundnut, which is why the saturated fat line is worth reading." },
  { k: ["hydrogenated"], title: "Hydrogenated vegetable fat", body: "Oil that has been processed to become solid. Partial hydrogenation can create trans fat, so check the trans fat line on the label." },
  { k: ["fractionated"], title: "Fractionated fat", body: "A fat separated into parts with different melting points, used to get a particular texture (for example, a cream that stays firm). These fats are often high in saturated fat." },
  { k: ["invert sugar", "invert syrup", "invert sugar syrup"], title: "Invert sugar syrup", body: "Sugar split into glucose and fructose. It keeps baked goods soft and moist. It counts as added sugar." },
  { k: ["liquid glucose", "glucose syrup"], title: "Liquid glucose", body: "A syrup made from starch. It adds sweetness and stops sugar crystallising. It counts as added sugar." },
  { k: ["maltodextrin"], title: "Maltodextrin", body: "A starch-derived powder. In seasonings it carries flavour and adds bulk. It is a carbohydrate that the body digests quickly." },
  { k: ["dextrose"], title: "Dextrose", body: "Another name for glucose. A sugar." },
  { k: ["sugar", "refined sugar"], title: "Sugar", body: "Ingredients are listed in descending order by weight, so sugar near the start of the list means it is one of the main ingredients. Sugar can appear under several names: invert syrup, liquid glucose, dextrose." },
  { k: ["milk solids"], title: "Milk solids", body: "Dried milk components (protein, milk sugar, milk fat). They add flavour and browning." },
  { k: ["iodised salt", "iodized salt", "edible common salt", "salt"], title: "Iodised salt", body: "Common salt with added iodine, which India requires for most edible salt to prevent iodine deficiency. Salt is the main source of sodium on the label." },
  { k: ["black salt"], title: "Black salt (Kala namak)", body: "A mineral salt with a sulphurous flavour, common in chaat masala. It still contributes sodium." },
  { k: ["hydrolysed", "hydrolyzed"], title: "Hydrolysed protein", body: "Protein broken down into amino acids, including glutamate. It adds savoury (umami) taste, similar to a flavour enhancer." },
  { k: ["yeast extract"], title: "Yeast extract", body: "A savoury ingredient made from yeast. It is naturally rich in glutamate and adds umami taste." },
  { k: ["cocoa solids"], title: "Cocoa solids", body: "The non-fat part of cocoa beans that gives chocolate flavour. The percentage tells you how much is actually there." },
  { k: ["cocoa butter"], title: "Cocoa butter", body: "The natural fat of cocoa beans. It is rich in saturated fat and gives chocolate its melt." },
  { k: ["wheat gluten"], title: "Wheat gluten", body: "The main protein in wheat. It adds strength and chew. People with coeliac disease must avoid it." },
  { k: ["malt extract", "cereal extract", "malt"], title: "Malt / cereal extract", body: "Made by sprouting and drying grains like barley, then extracting the sweet, flavourful sugars. It provides malt flavour and some sugar." },
  { k: ["nature identical", "artificial flavouring", "natural flavouring", "flavouring substances", "flavours", "flavour"], title: "Flavouring substances", body: "Indian labels classify flavours as natural, nature-identical (chemically the same as natural, but made) or artificial (not found in nature). All must be permitted flavours." },
  { k: ["starch", "edible starch", "potato starch", "tapioca starch"], title: "Starch", body: "A carbohydrate from potato, corn or tapioca that thickens and gives crispness." },
  { k: ["besan", "bengal gram flour", "gram meal"], title: "Besan (gram flour)", body: "Flour made from chana dal. It adds protein and is the base of many namkeens." },
  { k: ["moth dal", "tepary"], title: "Moth dal flour", body: "Flour from moth beans, traditional in bhujia." },
  { k: ["carbonated water"], title: "Carbonated water", body: "Water with dissolved carbon dioxide, which makes the fizz." },
  { k: ["caffeine"], title: "Caffeine", body: "A stimulant naturally found in coffee, tea and kola nuts. Colas state their caffeine per 100 ml on the label. High-caffeine energy drinks in India must also carry a warning for children, pregnant or lactating women and caffeine-sensitive people." },
  { k: ["mango pulp", "fruit pulp"], title: "Fruit pulp", body: "Crushed fruit. The percentage on the label tells you how much real fruit is in the drink." },
  { k: ["active culture"], title: "Active culture", body: "Live bacteria used to ferment milk into curd or lassi." },
  { k: ["vitamins", "minerals", "ferrous salt", "potassium iodate", "calcium salt"], title: "Added vitamins and minerals", body: "Nutrients added to fortify the product. The label's nutrition table usually lists the amounts." },
  { k: ["corn grits"], title: "Corn grits", body: "Coarsely milled maize, the base of corn flakes." },
  { k: ["butter"], title: "Butter", body: "Milk fat. It adds flavour and contributes saturated fat." },
  { k: ["cashew"], title: "Cashew nuts", body: "A tree nut. The percentage shows how much is in the product. It is also a common allergen." },
  { k: ["potato"], title: "Potato", body: "The main ingredient of chips; the percentage shows how much of the pack is potato." },
  { k: ["sweetener"], title: "Sweeteners", body: "Non-sugar sweeteners give sweetness with few or no calories. Each one has an INS number; tap the number to learn which sweetener it is." },
];

export function glossFor(text: string): GlossaryEntry | null {
  const low = text.toLowerCase();
  let best: { g: GlossaryEntry; len: number } | null = null;
  for (const g of GLOSSARY) for (const k of g.k) if (low.includes(k) && (!best || k.length > best.len)) best = { g, len: k.length };
  return best ? best.g : null;
}
