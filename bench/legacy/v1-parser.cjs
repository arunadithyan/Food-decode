/* FoodDecode v1 (prototype) label parser, kept verbatim for the OCR benchmark baseline. */
(function (root) {
  const NUTRIENTS = [
    { key: "addedSugarG", re: /add(?:ed)?\s*sug[ae]rs?/gi, unit: "g" },
    { key: "transFatG", re: /tr[ae]ns\s*-?\s*f[ae]t/gi, unit: "g" },
    { key: "saturatedFatG", re: /satur[a-z]*\s*(?:f[ae]t)?/gi, unit: "g" },
    { key: "energyKcal", re: /energ[yi]/gi, unit: "kcal" },
    { key: "proteinG", re: /prot[eoa]in/gi, unit: "g" },
    { key: "carbohydratesG", re: /carbo[a-z]*/gi, unit: "g" },
    { key: "sugarsG", re: /(?:total\s*)?sug[ae]rs?/gi, unit: "g" },
    { key: "totalFatG", re: /(?:total\s*)?f[ae]t\b/gi, unit: "g" },
    { key: "sodiumMg", re: /sod[il1]um/gi, unit: "mg" },
    { key: "fibreG", re: /(?:dietary\s*)?fib(?:re|er)/gi, unit: "g" },
    { key: "_stop", re: /cholest[a-z]*|vitamin|calcium|iron\b|potassium|%\s*rda|rda\b/gi, unit: "" },
  ];

  const num = (s) => parseFloat(String(s).replace(/,/g, "."));

  function findMatches(line) {
    const hits = [];
    for (const n of NUTRIENTS) {
      n.re.lastIndex = 0;
      let m;
      while ((m = n.re.exec(line))) hits.push({ key: n.key, start: m.index, end: m.index + m[0].length, text: m[0] });
    }
    hits.sort((a, b) => a.start - b.start || b.end - a.end);
    // drop overlaps: "added sugars" also matches "sugars"; "trans fat"/"saturated fat" also match "fat"
    const out = [];
    for (const h of hits) {
      const prev = out[out.length - 1];
      if (prev && h.start < prev.end) continue;
      out.push(h);
    }
    return out;
  }

  function numbersIn(seg) {
    // numbers not followed by % ; keep unit hint
    const res = [];
    const re = /(\d+(?:[.,]\d+)?)\s*(%|kcal|kj|mg|g|ml)?/gi;
    let m;
    while ((m = re.exec(seg))) {
      const unit = (m[2] || "").toLowerCase();
      if (unit === "%") continue;
      res.push({ value: num(m[1]), unit, raw: m[0], index: m.index });
    }
    return res;
  }

  function detectBasis(lines) {
    // returns {order:['100','serving',...]} based on header order
    for (const l of lines) {
      const low = l.toLowerCase();
      const i100 = low.search(/per\s*100\s*(g|m|ml)?|100\s*g\b|100\s*ml\b/);
      const iServ = low.search(/per\s*serv|per\s*portion|serve\b|serving\b(?!\s*size)/);
      if (i100 >= 0 && iServ >= 0) return { order: i100 < iServ ? ["100", "serving"] : ["serving", "100"], found: true };
      if (i100 >= 0 && /per/.test(low)) return { order: ["100"], found: true };
    }
    return { order: ["100"], found: false };
  }

  function parseLabel(text) {
    const clean = text.replace(/\r/g, "").replace(/[|]/g, " ");
    const lines = clean.split("\n").map((l) => l.trim()).filter(Boolean);
    const basis = detectBasis(lines);
    const fields = {};
    for (const line of lines) {
      const hits = findMatches(line);
      hits.forEach((h, i) => {
        if (h.key === "_stop") return;
        let seg = line.slice(h.end, i + 1 < hits.length ? hits[i + 1].start : undefined);
        // strip a unit in brackets right after the nutrient name: "(g)", "(mg)", "(kcal)", and OCR slips like "(q)" or "(9)"
        const unitParen = seg.match(/^\s*,?\s*[\(\[]\s*(k?cal|kj|mg|g|q|9|ml)\s*[\)\]]/i);
        if (unitParen) seg = seg.slice(unitParen[0].length);
        seg = seg.replace(/^\s*,\s*(k?cal|kj|mg|g|ml)\b/i, " ");
        const nums = numbersIn(seg).filter((n) => !(n.value === 100 && /per/i.test(seg.slice(Math.max(0, n.index - 6), n.index))));
        if (!nums.length) return;
        if (fields[h.key]) return; // first occurrence wins
        let pick = nums[0];
        let unit = pick.unit;
        let value = pick.value;
        const nutrient = NUTRIENTS.find((n) => n.key === h.key);
        // energy: prefer kcal; if only kJ present, convert and flag
        let note = "";
        if (h.key === "energyKcal") {
          const kcal = nums.find((n) => n.unit === "kcal");
          const kjOnly = /kj/i.test(seg) && !/kcal/i.test(seg) && !/kcal/i.test(line.slice(0, h.end + 12));
          if (kcal) { value = kcal.value; unit = "kcal"; }
          else if (kjOnly) { value = Math.round((pick.value / 4.184) * 10) / 10; note = "Converted from kJ"; unit = "kcal"; }
        }
        if (h.key === "sodiumMg") {
          const labelUnit = (line.slice(h.start, h.end + 12).match(/\(?\s*(mg|g)\s*\)?/i) || [])[1];
          if ((unit === "g" || (labelUnit && labelUnit.toLowerCase() === "g")) && value < 10) { value = Math.round(value * 1000); note = "Converted from g to mg"; }
        }
        fields[h.key] = { value, column: 0, raw: seg.trim().slice(0, 40), note, allValues: nums.map((n) => n.value) };
        void nutrient;
      });
    }

    const flat = lines.join(" ");
    let servingSize = null, servingUnit = null, servingsPerPack = null, packSize = null, packUnit = null;
    let m = flat.match(/serv(?:ing|e)?\s*size[^0-9]{0,15}(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i) || flat.match(/per\s*serv\w*\s*[\(\[]?\s*(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i);
    if (m) { servingSize = num(m[1]); servingUnit = m[2].toLowerCase(); }
    m = flat.match(/(?:servings?|serves)\s*per\s*(?:pack(?:age|et)?|container|pouch|bottle)[^0-9]{0,10}(\d+(?:[.,]\d+)?)/i) || flat.match(/no\.?\s*of\s*serv\w*\s*per\s*\w+[^0-9]{0,6}(\d+(?:[.,]\d+)?)/i);
    if (m) servingsPerPack = num(m[1]);
    m = flat.match(/net\s*(?:qty|quantity|wt|weight|content)[^0-9]{0,15}(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i);
    if (m) { packSize = num(m[1]); packUnit = m[2].toLowerCase(); if (packUnit === "kg") { packSize *= 1000; packUnit = "g"; } if (packUnit === "l") { packSize *= 1000; packUnit = "ml"; } }

    // ingredients
    let ingredients = "";
    const ii = flat.search(/ingred[il1]ents?\s*[:\-;]?/i);
    if (ii >= 0) {
      let rest = flat.slice(ii).replace(/^ingred[il1]ents?\s*[:\-;]?\s*/i, "");
      const stop = rest.search(/allergen|nutrition(al)?\s*info|best\s*before|manufactured|mfd|packed\s*by|marketed\s*by|storage|this is a made-up/i);
      if (stop > 0) rest = rest.slice(0, stop);
      ingredients = rest.trim().replace(/\s+/g, " ");
    }

    // which column did we take? if per-serving appears first in header, first number is per serving
    const firstIsServing = basis.order[0] === "serving";
    return { fields, cols: basis.order.length, basis: firstIsServing ? "serving" : "100", basisDetected: basis.found, servingSize, servingUnit, servingsPerPack, packSize, packUnit, ingredients, lineCount: lines.length };
  }

  const api = { parseLabel };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FDParser = api;
})(this);

