/* Debug helper: npx tsx bench/debug-variant.ts <image file> <variant> — prints OCR text and parsed fields for one variant. */
import sharp from "sharp"; import path from "node:path";
import { createWorker } from "tesseract.js";
import { basePrep, variantsFor } from "../src/lib/ocr/image";
import { parseLabel } from "../src/lib/ocr/parser";
const ROOT=path.resolve(__dirname,".."); const file=process.argv[2]; const want=process.argv[3]||"adaptive";
(async()=>{
 const { data, info } = await sharp(path.join(ROOT,"bench/images",file)).rotate().ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const img={width:info.width,height:info.height,data:new Uint8ClampedArray(data.buffer,data.byteOffset,data.length)};
 const w=await createWorker("eng",1,{langPath:path.join(ROOT,"public/ocr/lang"),cachePath:path.join(ROOT,".data/tess-cache"),gzip:true});
 for (const v of variantsFor(basePrep(img))) { if (v.name!==want) continue;
  const png=await sharp(Buffer.from(v.image.data),{raw:{width:v.image.width,height:v.image.height,channels:1}}).png().toBuffer();
  await sharp(png).toFile(path.join(ROOT,".data/variant.png"));
  const {data:d}=await w.recognize(png); const lines=d.lines.map(l=>({text:l.text.trim(),conf:l.confidence}));
  console.log(lines.map(l=>l.text).join("\n")); const p=parseLabel(lines); console.log(p.columns, Object.fromEntries(Object.entries(p.fields).map(([k,f])=>[k,[f!.per100,f!.perServing]])));
 }
 await w.terminate();
})();
