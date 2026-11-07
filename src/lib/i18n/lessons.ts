/*
 * Teach Me lessons, in English, Hindi and Tamil. The full lesson text is translated, not just the titles.
 * Hindi and Tamil were drafted for this project and still need review by native-speaker nutrition educators
 * (see docs/LIMITATIONS.md).
 */
export type Lang = "en" | "hi" | "ta";
export type Block = { p: string } | { list: string[] } | { tip: string } | { example: string };
export interface LessonText { title: string; blurb: string; body: Block[] }
export interface Lesson { id: string; mins: number; illustration: string; text: Record<Lang, LessonText> }

export const LESSONS: Lesson[] = [
  {
    id: "read-label", mins: 2, illustration: "reader",
    text: {
      en: {
        title: "How to read a nutrition label",
        blurb: "Five things to look at, in the order that saves time.",
        body: [
          { p: "A packet label has a lot on it. Look at these five things, in this order:" },
          { list: [
            "Serving size and servings per pack — every other number depends on it.",
            "Which column you are reading: per 100 g/ml or per serving.",
            "Energy (kcal), then the nutrients to limit: added sugar, saturated and trans fat, sodium.",
            "Nutrients to get enough of: protein and dietary fibre.",
            "The ingredient list and allergen statement.",
          ] },
          { tip: "Use the per-100 column to compare two products. Use the per-serving column (or your own portion) to see what you actually eat." },
        ],
      },
      hi: {
        title: "पोषण लेबल कैसे पढ़ें",
        blurb: "पाँच चीज़ें, उस क्रम में जिससे समय बचता है।",
        body: [
          { p: "पैकेट के लेबल पर बहुत कुछ लिखा होता है। ये पाँच चीज़ें इसी क्रम में देखें:" },
          { list: [
            "सर्विंग साइज़ और प्रति पैक सर्विंग — बाकी सभी संख्याएँ इसी पर निर्भर हैं।",
            "आप कौन-सा कॉलम पढ़ रहे हैं: प्रति 100 ग्राम/मि.ली. या प्रति सर्विंग।",
            "ऊर्जा (kcal), फिर सीमित रखने वाले पोषक तत्व: मिलाई गई चीनी, संतृप्त और ट्रांस वसा, सोडियम।",
            "पर्याप्त मात्रा में लेने वाले पोषक तत्व: प्रोटीन और आहार रेशा (फाइबर)।",
            "सामग्री सूची और एलर्जी संबंधी जानकारी।",
          ] },
          { tip: "दो उत्पादों की तुलना के लिए प्रति-100 कॉलम देखें। आप असल में कितना खाते हैं, यह जानने के लिए प्रति-सर्विंग कॉलम (या अपना हिस्सा) देखें।" },
        ],
      },
      ta: {
        title: "ஊட்டச்சத்து லேபிளை எப்படிப் படிப்பது",
        blurb: "நேரம் மிச்சமாகும் வரிசையில் பார்க்க வேண்டிய ஐந்து விஷயங்கள்.",
        body: [
          { p: "பாக்கெட் லேபிளில் நிறைய தகவல்கள் இருக்கும். இந்த ஐந்தையும் இதே வரிசையில் பாருங்கள்:" },
          { list: [
            "பரிமாறும் அளவு (serving size) மற்றும் ஒரு பாக்கெட்டில் எத்தனை பரிமாறல்கள் — மற்ற எல்லா எண்களும் இதைச் சார்ந்தவை.",
            "நீங்கள் படிக்கும் நெடுவரிசை: 100 கி/மி.லி.க்கு அல்லது ஒரு பரிமாறலுக்கு.",
            "ஆற்றல் (kcal), பிறகு குறைக்க வேண்டியவை: சேர்க்கப்பட்ட சர்க்கரை, நிறைவுற்ற மற்றும் டிரான்ஸ் கொழுப்பு, சோடியம்.",
            "போதுமான அளவு தேவையானவை: புரதம் மற்றும் நார்ச்சத்து.",
            "பொருட்கள் பட்டியல் மற்றும் ஒவ்வாமை (அலர்ஜி) அறிவிப்பு.",
          ] },
          { tip: "இரண்டு பொருட்களை ஒப்பிட 100-க்கான நெடுவரிசையைப் பயன்படுத்துங்கள். நீங்கள் உண்மையில் சாப்பிடுவதை அறிய ஒரு பரிமாறலுக்கான நெடுவரிசையை (அல்லது உங்கள் அளவை) பயன்படுத்துங்கள்." },
        ],
      },
    },
  },
  {
    id: "serving-size", mins: 2, illustration: "calculator",
    text: {
      en: {
        title: "Understanding serving size",
        blurb: "The label's serving and what you actually eat are often different.",
        body: [
          { p: "The serving size is chosen by the manufacturer. It is not a recommendation, and it is often smaller than what people eat in one sitting." },
          { example: "A 70 g noodle cake is one serving, but the 140 g pack has two. Eating the whole pack doubles every per-serving number." },
          { list: ["Check “servings per pack”.", "Multiply per-serving values by how many servings you eat.", "Or use FoodDecode's portion buttons to enter what you actually eat."] },
          { tip: "Some labels list per-serving values only. To compare products fairly, convert to per 100 g: value × 100 ÷ serving size." },
        ],
      },
      hi: {
        title: "सर्विंग साइज़ को समझें",
        blurb: "लेबल की सर्विंग और आप असल में जितना खाते हैं, अक्सर अलग होते हैं।",
        body: [
          { p: "सर्विंग साइज़ निर्माता तय करता है। यह कोई सलाह नहीं है, और अक्सर लोग एक बार में इससे ज़्यादा खाते हैं।" },
          { example: "नूडल्स का 70 ग्राम का एक केक एक सर्विंग है, पर 140 ग्राम के पैक में दो सर्विंग हैं। पूरा पैक खाने पर हर प्रति-सर्विंग संख्या दोगुनी हो जाती है।" },
          { list: ["“प्रति पैक सर्विंग” देखें।", "प्रति-सर्विंग मान को उतनी सर्विंग से गुणा करें जितनी आप खाते हैं।", "या FoodDecode के पोर्शन बटन से अपनी असली मात्रा डालें।"] },
          { tip: "कुछ लेबल केवल प्रति-सर्विंग मान दिखाते हैं। सही तुलना के लिए प्रति 100 ग्राम में बदलें: मान × 100 ÷ सर्विंग साइज़।" },
        ],
      },
      ta: {
        title: "பரிமாறும் அளவைப் புரிந்துகொள்ளுதல்",
        blurb: "லேபிளில் உள்ள அளவும் நீங்கள் உண்மையில் சாப்பிடும் அளவும் பெரும்பாலும் வேறுபடும்.",
        body: [
          { p: "பரிமாறும் அளவை உற்பத்தியாளர் தீர்மானிக்கிறார். இது பரிந்துரை அல்ல; பலர் ஒரே முறையில் இதைவிட அதிகமாகச் சாப்பிடுவார்கள்." },
          { example: "70 கி நூடுல்ஸ் கேக் ஒரு பரிமாறல்; 140 கி பாக்கெட்டில் இரண்டு உள்ளன. முழு பாக்கெட்டையும் சாப்பிட்டால் ஒவ்வொரு எண்ணும் இரட்டிப்பாகும்." },
          { list: ["“ஒரு பாக்கெட்டில் பரிமாறல்கள்” என்பதைப் பாருங்கள்.", "நீங்கள் சாப்பிடும் பரிமாறல்களின் எண்ணிக்கையால் பெருக்குங்கள்.", "அல்லது FoodDecode-இன் அளவு பொத்தான்களில் உண்மையான அளவை உள்ளிடுங்கள்."] },
          { tip: "சில லேபிள்கள் ஒரு பரிமாறலுக்கான மதிப்புகளை மட்டுமே காட்டும். சரியாக ஒப்பிட 100 கி-க்கு மாற்றுங்கள்: மதிப்பு × 100 ÷ பரிமாறும் அளவு." },
        ],
      },
    },
  },
  {
    id: "portion", mins: 1, illustration: "chart",
    text: {
      en: {
        title: "Why portion size changes the picture",
        blurb: "Same packet, different story at 30 g and 90 g.",
        body: [
          { p: "Whether a food fits your goals depends on how much of it you eat. FoodDecode compares each portion with daily reference amounts used on Indian labels (for example 2,000 mg sodium and 50 g added sugar a day)." },
          { example: "30 g of a namkeen may give about 10% of the daily sodium reference. 90 g gives about 30% — a different answer for someone watching sodium." },
          { tip: "If one portion gives 20% or more of a daily reference, FoodDecode calls it high for that portion. 5% or less is low. These are label reference values, not medical limits." },
        ],
      },
      hi: {
        title: "हिस्से का आकार तस्वीर क्यों बदल देता है",
        blurb: "एक ही पैकेट, 30 ग्राम और 90 ग्राम पर अलग कहानी।",
        body: [
          { p: "कोई खाद्य आपके लक्ष्यों के अनुकूल है या नहीं, यह इस पर निर्भर है कि आप कितना खाते हैं। FoodDecode हर हिस्से की तुलना भारतीय लेबल पर उपयोग होने वाली दैनिक संदर्भ मात्राओं से करता है (जैसे प्रतिदिन 2,000 मि.ग्रा. सोडियम और 50 ग्राम मिलाई गई चीनी)।" },
          { example: "30 ग्राम नमकीन से दैनिक सोडियम संदर्भ का लगभग 10% मिल सकता है। 90 ग्राम से लगभग 30% — सोडियम पर ध्यान रखने वाले व्यक्ति के लिए अलग उत्तर।" },
          { tip: "अगर एक हिस्से से किसी दैनिक संदर्भ का 20% या अधिक मिलता है, तो FoodDecode उसे उस हिस्से के लिए ‘अधिक’ कहता है। 5% या कम ‘कम’ है। ये लेबल के संदर्भ मान हैं, चिकित्सा सीमाएँ नहीं।" },
        ],
      },
      ta: {
        title: "அளவு ஏன் முடிவை மாற்றுகிறது",
        blurb: "ஒரே பாக்கெட், 30 கி-க்கும் 90 கி-க்கும் வேறு கதை.",
        body: [
          { p: "ஒரு உணவு உங்கள் இலக்குகளுக்குப் பொருந்துமா என்பது நீங்கள் எவ்வளவு சாப்பிடுகிறீர்கள் என்பதைப் பொறுத்தது. FoodDecode ஒவ்வொரு அளவையும் இந்திய லேபிள்களில் பயன்படுத்தப்படும் தினசரி குறிப்பு அளவுகளுடன் ஒப்பிடுகிறது (எ.கா. நாளொன்றுக்கு 2,000 மி.கி சோடியம், 50 கி சேர்க்கப்பட்ட சர்க்கரை)." },
          { example: "30 கி நம்கீன் தினசரி சோடியம் குறிப்பில் சுமார் 10% தரலாம். 90 கி சுமார் 30% — சோடியத்தைக் கவனிப்பவருக்கு வேறு பதில்." },
          { tip: "ஒரு அளவு ஏதேனும் தினசரி குறிப்பில் 20% அல்லது அதற்கு மேல் தந்தால், அந்த அளவுக்கு ‘அதிகம்’ என்று FoodDecode கூறும். 5% அல்லது குறைவு ‘குறைவு’. இவை லேபிள் குறிப்பு மதிப்புகள், மருத்துவ வரம்புகள் அல்ல." },
        ],
      },
    },
  },
  {
    id: "sugar", mins: 2, illustration: "magnifier",
    text: {
      en: {
        title: "Sugar vs added sugar",
        blurb: "Why Indian labels now show both, and which one the 50 g reference is for.",
        body: [
          { p: "Total sugars include sugars naturally present in milk and fruit plus any sugar added during manufacturing. Added sugar is only the part that was added — sugar, jaggery, honey, syrups, glucose." },
          { p: "FSSAI's labelling rules (2020) ask manufacturers to declare added sugars. The 50 g daily reference on Indian labels is for added sugar." },
          { example: "A plain lassi can have several grams of total sugar from milk (lactose) with little or no added sugar. A sweetened lassi has both." },
          { tip: "If a label shows only total sugars, FoodDecode marks added sugar as unknown — it does not assume zero." },
        ],
      },
      hi: {
        title: "चीनी बनाम मिलाई गई चीनी",
        blurb: "भारतीय लेबल अब दोनों क्यों दिखाते हैं, और 50 ग्राम का संदर्भ किसके लिए है।",
        body: [
          { p: "कुल शर्करा में दूध और फल में स्वाभाविक रूप से मौजूद शर्करा और निर्माण के दौरान मिलाई गई चीनी दोनों शामिल हैं। मिलाई गई चीनी केवल वह हिस्सा है जो ऊपर से डाला गया — चीनी, गुड़, शहद, सिरप, ग्लूकोज़।" },
          { p: "FSSAI के लेबलिंग नियम (2020) निर्माताओं से मिलाई गई चीनी बताने को कहते हैं। भारतीय लेबल पर 50 ग्राम का दैनिक संदर्भ मिलाई गई चीनी के लिए है।" },
          { example: "सादी लस्सी में दूध (लैक्टोज़) से कुछ ग्राम कुल शर्करा हो सकती है, पर मिलाई गई चीनी बहुत कम या नहीं। मीठी लस्सी में दोनों होती हैं।" },
          { tip: "अगर लेबल केवल कुल शर्करा दिखाता है, तो FoodDecode मिलाई गई चीनी को ‘अज्ञात’ मानता है — शून्य नहीं।" },
        ],
      },
      ta: {
        title: "சர்க்கரையும் சேர்க்கப்பட்ட சர்க்கரையும்",
        blurb: "இந்திய லேபிள்கள் ஏன் இரண்டையும் காட்டுகின்றன, 50 கி குறிப்பு எதற்கானது.",
        body: [
          { p: "மொத்த சர்க்கரையில் பால், பழத்தில் இயற்கையாக உள்ள சர்க்கரையும் தயாரிப்பின்போது சேர்த்த சர்க்கரையும் அடங்கும். சேர்க்கப்பட்ட சர்க்கரை என்பது சேர்த்த பகுதி மட்டுமே — சர்க்கரை, வெல்லம், தேன், சிரப், குளுக்கோஸ்." },
          { p: "FSSAI லேபிள் விதிகள் (2020) சேர்க்கப்பட்ட சர்க்கரையை அறிவிக்கக் கேட்கின்றன. இந்திய லேபிள்களில் உள்ள 50 கி தினசரி குறிப்பு சேர்க்கப்பட்ட சர்க்கரைக்கானது." },
          { example: "சாதாரண லஸ்ஸியில் பாலிலிருந்து (லாக்டோஸ்) சில கிராம் மொத்த சர்க்கரை இருக்கலாம்; சேர்க்கப்பட்ட சர்க்கரை குறைவு அல்லது இல்லை. இனிப்பு லஸ்ஸியில் இரண்டும் உண்டு." },
          { tip: "லேபிள் மொத்த சர்க்கரையை மட்டும் காட்டினால், FoodDecode சேர்க்கப்பட்ட சர்க்கரையை ‘தெரியாது’ எனக் குறிக்கும் — பூஜ்ஜியம் என்று கருதாது." },
        ],
      },
    },
  },
  {
    id: "carbs", mins: 2, illustration: "head",
    text: {
      en: {
        title: "Total carbohydrates vs added sugars",
        blurb: "Why someone monitoring carbs looks at a different line from someone cutting sugar.",
        body: [
          { p: "Total carbohydrate includes starch (from wheat, rice, potato), all sugars and, on most Indian labels, fibre is listed separately. Added sugar is a small part of total carbohydrate." },
          { example: "Instant noodles may have about 60 g carbohydrate per 100 g with only 1–2 g added sugar. A cola has about 10 g carbohydrate per 100 ml — almost all of it added sugar." },
          { list: [
            "If you are monitoring carbohydrates (for example with diabetes, as advised by your clinician), look at total carbohydrate for your portion.",
            "If your goal is less added sugar, look at the added sugar line.",
          ] },
          { tip: "FoodDecode shows total carbohydrate per portion when your profile says you monitor carbs. It does not set a carb target for you — that is for your doctor or dietitian." },
        ],
      },
      hi: {
        title: "कुल कार्बोहाइड्रेट बनाम मिलाई गई चीनी",
        blurb: "कार्ब पर नज़र रखने वाला व्यक्ति और चीनी कम करने वाला व्यक्ति अलग पंक्ति क्यों देखते हैं।",
        body: [
          { p: "कुल कार्बोहाइड्रेट में स्टार्च (गेहूँ, चावल, आलू से) और सभी शर्कराएँ शामिल हैं; अधिकतर भारतीय लेबल पर फाइबर अलग से लिखा होता है। मिलाई गई चीनी कुल कार्बोहाइड्रेट का एक छोटा हिस्सा है।" },
          { example: "इंस्टेंट नूडल्स में प्रति 100 ग्राम लगभग 60 ग्राम कार्बोहाइड्रेट पर केवल 1–2 ग्राम मिलाई गई चीनी हो सकती है। कोला में प्रति 100 मि.ली. लगभग 10 ग्राम कार्बोहाइड्रेट है — लगभग सारा मिलाई गई चीनी।" },
          { list: [
            "अगर आप कार्बोहाइड्रेट पर नज़र रखते हैं (जैसे डायबिटीज़ में, अपने डॉक्टर की सलाह अनुसार), तो अपने हिस्से का कुल कार्बोहाइड्रेट देखें।",
            "अगर लक्ष्य कम मिलाई गई चीनी है, तो मिलाई गई चीनी वाली पंक्ति देखें।",
          ] },
          { tip: "जब आपकी प्रोफ़ाइल में कार्ब मॉनिटरिंग चुनी हो, FoodDecode हर हिस्से का कुल कार्बोहाइड्रेट दिखाता है। यह आपके लिए कार्ब लक्ष्य तय नहीं करता — यह आपके डॉक्टर या आहार विशेषज्ञ का काम है।" },
        ],
      },
      ta: {
        title: "மொத்த கார்போஹைட்ரேட்டும் சேர்க்கப்பட்ட சர்க்கரையும்",
        blurb: "கார்ப்ஸைக் கண்காணிப்பவரும் சர்க்கரையைக் குறைப்பவரும் ஏன் வெவ்வேறு வரியைப் பார்க்கிறார்கள்.",
        body: [
          { p: "மொத்த கார்போஹைட்ரேட்டில் மாவுச்சத்து (கோதுமை, அரிசி, உருளைக்கிழங்கு) மற்றும் எல்லாச் சர்க்கரைகளும் அடங்கும்; பெரும்பாலான இந்திய லேபிள்களில் நார்ச்சத்து தனியாகக் காட்டப்படும். சேர்க்கப்பட்ட சர்க்கரை அதில் ஒரு சிறு பகுதி." },
          { example: "இன்ஸ்டன்ட் நூடுல்ஸில் 100 கி-க்கு சுமார் 60 கி கார்போஹைட்ரேட் இருந்தாலும் சேர்க்கப்பட்ட சர்க்கரை 1–2 கி மட்டுமே இருக்கலாம். கோலாவில் 100 மி.லி-க்கு சுமார் 10 கி கார்போஹைட்ரேட் — கிட்டத்தட்ட முழுவதும் சேர்க்கப்பட்ட சர்க்கரை." },
          { list: [
            "கார்போஹைட்ரேட்டைக் கண்காணிப்பவர் (எ.கா. நீரிழிவு, உங்கள் மருத்துவர் அறிவுரைப்படி) தன் அளவுக்கான மொத்த கார்போஹைட்ரேட்டைப் பார்க்க வேண்டும்.",
            "சேர்க்கப்பட்ட சர்க்கரையைக் குறைப்பது இலக்கு என்றால், அந்த வரியைப் பாருங்கள்.",
          ] },
          { tip: "உங்கள் சுயவிவரத்தில் கார்ப் கண்காணிப்பு இருந்தால், FoodDecode ஒவ்வொரு அளவுக்கான மொத்த கார்போஹைட்ரேட்டைக் காட்டும். உங்களுக்கான கார்ப் இலக்கை அது நிர்ணயிக்காது — அது உங்கள் மருத்துவர் அல்லது உணவியல் நிபுணரின் பணி." },
        ],
      },
    },
  },
  {
    id: "fats", mins: 2, illustration: "chart",
    text: {
      en: {
        title: "Saturated, unsaturated and trans fat",
        blurb: "Not all fats are the same on a label.",
        body: [
          { p: "Total fat is split into types. Saturated fat (high in palm oil, ghee, butter, coconut oil) and trans fat (from partially hydrogenated oils, e.g. some vanaspati) are the ones to limit." },
          { list: ["Daily reference on Indian labels: 67 g total fat, 22 g saturated fat, 2 g trans fat.", "“Partially hydrogenated” in the ingredients is a sign of trans fat.", "Unsaturated fats (MUFA, PUFA) from most vegetable oils, nuts and seeds are not counted as fats to limit."] },
          { tip: "Saturated + trans fat can never be more than total fat. If a scan shows that, a digit was misread — FoodDecode flags it." },
        ],
      },
      hi: {
        title: "संतृप्त, असंतृप्त और ट्रांस वसा",
        blurb: "लेबल पर हर वसा एक जैसी नहीं होती।",
        body: [
          { p: "कुल वसा को प्रकारों में बाँटा जाता है। संतृप्त वसा (पाम तेल, घी, मक्खन, नारियल तेल में अधिक) और ट्रांस वसा (आंशिक रूप से हाइड्रोजनीकृत तेलों से, जैसे कुछ वनस्पति) सीमित रखनी चाहिए।" },
          { list: ["भारतीय लेबल पर दैनिक संदर्भ: 67 ग्राम कुल वसा, 22 ग्राम संतृप्त वसा, 2 ग्राम ट्रांस वसा।", "सामग्री में “आंशिक रूप से हाइड्रोजनीकृत” लिखा हो तो ट्रांस वसा का संकेत है।", "अधिकतर वनस्पति तेलों, मेवों और बीजों की असंतृप्त वसा (MUFA, PUFA) सीमित रखने वाली वसा में नहीं गिनी जाती।"] },
          { tip: "संतृप्त + ट्रांस वसा कभी कुल वसा से ज़्यादा नहीं हो सकती। स्कैन में ऐसा दिखे तो कोई अंक गलत पढ़ा गया है — FoodDecode इसे चिह्नित करता है।" },
        ],
      },
      ta: {
        title: "நிறைவுற்ற, நிறைவுறா மற்றும் டிரான்ஸ் கொழுப்பு",
        blurb: "லேபிளில் எல்லாக் கொழுப்பும் ஒன்றல்ல.",
        body: [
          { p: "மொத்தக் கொழுப்பு வகைகளாகப் பிரிக்கப்படுகிறது. நிறைவுற்ற கொழுப்பு (பாமாயில், நெய், வெண்ணெய், தேங்காய் எண்ணெயில் அதிகம்) மற்றும் டிரான்ஸ் கொழுப்பு (பகுதியளவு ஹைட்ரஜனேற்றப்பட்ட எண்ணெய்கள், சில வனஸ்பதி) குறைக்க வேண்டியவை." },
          { list: ["இந்திய லேபிள் தினசரி குறிப்பு: மொத்தக் கொழுப்பு 67 கி, நிறைவுற்றது 22 கி, டிரான்ஸ் 2 கி.", "பொருட்களில் “பகுதியளவு ஹைட்ரஜனேற்றப்பட்ட” என்றால் டிரான்ஸ் கொழுப்பின் அடையாளம்.", "பெரும்பாலான தாவர எண்ணெய்கள், கொட்டைகள், விதைகளில் உள்ள நிறைவுறா கொழுப்புகள் (MUFA, PUFA) குறைக்க வேண்டியவையாகக் கணக்கிடப்படுவதில்லை."] },
          { tip: "நிறைவுற்ற + டிரான்ஸ் கொழுப்பு மொத்தக் கொழுப்பைவிட அதிகமாக இருக்க முடியாது. ஸ்கேனில் அப்படித் தெரிந்தால் ஓர் எண் தவறாகப் படிக்கப்பட்டுள்ளது — FoodDecode அதைச் சுட்டிக்காட்டும்." },
        ],
      },
    },
  },
  {
    id: "sodium", mins: 1, illustration: "magnifier",
    text: {
      en: {
        title: "Sodium vs salt",
        blurb: "Sodium is not the same as salt. Here's the conversion.",
        body: [
          { p: "Salt is sodium chloride. About 40% of salt by weight is sodium. Indian labels usually show sodium in milligrams (mg); some imported labels show salt in grams (g)." },
          { example: "Salt (g) = sodium (mg) × 2.5 ÷ 1000. So 1,000 mg sodium ≈ 2.5 g salt. The 2,000 mg daily sodium reference ≈ 5 g salt — about one level teaspoon." },
          { list: ["Check the unit: 0.4 g sodium is 400 mg.", "Sodium also comes from baking soda (500), MSG (621) and other sodium additives, not only salt."] },
          { tip: "If a scanned label shows both sodium and salt and they don't match the 2.5× rule, FoodDecode asks you to check them." },
        ],
      },
      hi: {
        title: "सोडियम बनाम नमक",
        blurb: "सोडियम और नमक एक ही चीज़ नहीं हैं। यह रहा रूपांतरण।",
        body: [
          { p: "नमक सोडियम क्लोराइड है। वज़न के हिसाब से नमक का लगभग 40% सोडियम होता है। भारतीय लेबल आमतौर पर सोडियम मिलीग्राम (मि.ग्रा.) में दिखाते हैं; कुछ आयातित लेबल नमक ग्राम में दिखाते हैं।" },
          { example: "नमक (ग्राम) = सोडियम (मि.ग्रा.) × 2.5 ÷ 1000। यानी 1,000 मि.ग्रा. सोडियम ≈ 2.5 ग्राम नमक। 2,000 मि.ग्रा. का दैनिक सोडियम संदर्भ ≈ 5 ग्राम नमक — लगभग एक समतल चम्मच।" },
          { list: ["इकाई जाँचें: 0.4 ग्राम सोडियम = 400 मि.ग्रा.।", "सोडियम केवल नमक से नहीं, बेकिंग सोडा (500), MSG (621) और अन्य सोडियम योजकों से भी आता है।"] },
          { tip: "अगर स्कैन किए गए लेबल पर सोडियम और नमक दोनों हों और वे 2.5× नियम से मेल न खाएँ, तो FoodDecode आपसे उन्हें जाँचने को कहता है।" },
        ],
      },
      ta: {
        title: "சோடியமும் உப்பும்",
        blurb: "சோடியமும் உப்பும் ஒன்றல்ல. மாற்றும் முறை இதோ.",
        body: [
          { p: "உப்பு என்பது சோடியம் குளோரைடு. எடையில் உப்பின் சுமார் 40% சோடியம். இந்திய லேபிள்கள் பொதுவாக சோடியத்தை மில்லிகிராமில் (மி.கி) காட்டும்; சில இறக்குமதி லேபிள்கள் உப்பைக் கிராமில் காட்டும்." },
          { example: "உப்பு (கி) = சோடியம் (மி.கி) × 2.5 ÷ 1000. எனவே 1,000 மி.கி சோடியம் ≈ 2.5 கி உப்பு. 2,000 மி.கி தினசரி சோடியம் குறிப்பு ≈ 5 கி உப்பு — சுமார் ஒரு சமமான தேக்கரண்டி." },
          { list: ["அலகைச் சரிபாருங்கள்: 0.4 கி சோடியம் = 400 மி.கி.", "சோடியம் உப்பிலிருந்து மட்டுமல்ல; சமையல் சோடா (500), MSG (621) போன்ற சேர்க்கைகளிலிருந்தும் வரும்."] },
          { tip: "ஸ்கேன் செய்த லேபிளில் சோடியமும் உப்பும் இருந்து அவை 2.5× விதிக்குப் பொருந்தாவிட்டால், FoodDecode அவற்றைச் சரிபார்க்கச் சொல்லும்." },
        ],
      },
    },
  },
  {
    id: "allergens", mins: 2, illustration: "confused",
    text: {
      en: {
        title: "Allergens and “may contain” labels",
        blurb: "What a missing allergen statement does and doesn't tell you.",
        body: [
          { p: "Indian labelling rules require common allergens to be declared, including cereals with gluten, crustaceans, milk, eggs, fish, peanuts, tree nuts, soy and sulphites (10 mg/kg or more). Sesame and mustard are not on India's mandatory list." },
          { list: [
            "“Contains: milk, wheat” — the allergen is an ingredient.",
            "“May contain traces of nuts” or “made in a facility that also handles…” — a precautionary statement about cross-contact. It is voluntary, so its absence does not prove there is no cross-contact.",
            "No statement at all — unknown, not allergen-free.",
          ] },
          { tip: "FoodDecode answers NO when an allergen you listed is an ingredient, and CAUTION for cross-contact warnings or ambiguous ingredients such as “vegetable protein” or “lecithin”. If you have a severe allergy, always read the physical pack and follow your doctor's advice." },
        ],
      },
      hi: {
        title: "एलर्जेन और “हो सकता है” वाले लेबल",
        blurb: "एलर्जी की जानकारी न होने से क्या पता चलता है और क्या नहीं।",
        body: [
          { p: "भारतीय लेबलिंग नियमों के अनुसार आम एलर्जेन बताने होते हैं, जैसे ग्लूटेन वाले अनाज, क्रस्टेशियन, दूध, अंडा, मछली, मूंगफली, ट्री नट्स, सोया और सल्फाइट (10 मि.ग्रा./कि.ग्रा. या अधिक)। तिल और सरसों भारत की अनिवार्य सूची में नहीं हैं।" },
          { list: [
            "“इसमें है: दूध, गेहूँ” — एलर्जेन एक सामग्री है।",
            "“इसमें मेवों के अंश हो सकते हैं” या “ऐसी इकाई में बना जहाँ … भी बनता है” — क्रॉस-संपर्क की एहतियाती सूचना। यह स्वैच्छिक है, इसलिए इसका न होना यह साबित नहीं करता कि क्रॉस-संपर्क नहीं है।",
            "कोई सूचना नहीं — अज्ञात, एलर्जेन-मुक्त नहीं।",
          ] },
          { tip: "आपकी सूची का एलर्जेन सामग्री में हो तो FoodDecode ‘नहीं’ कहता है, और क्रॉस-संपर्क चेतावनी या “वनस्पति प्रोटीन”, “लेसिथिन” जैसी अस्पष्ट सामग्री पर ‘सावधानी’। गंभीर एलर्जी हो तो हमेशा असली पैक पढ़ें और अपने डॉक्टर की सलाह मानें।" },
        ],
      },
      ta: {
        title: "ஒவ்வாமைப் பொருட்களும் “இருக்கலாம்” லேபிள்களும்",
        blurb: "ஒவ்வாமை அறிவிப்பு இல்லாதது எதைச் சொல்கிறது, எதைச் சொல்லவில்லை.",
        body: [
          { p: "இந்திய லேபிள் விதிகள் பொதுவான ஒவ்வாமைப் பொருட்களை அறிவிக்கக் கோருகின்றன: குளூட்டன் உள்ள தானியங்கள், ஓடுடைய கடல் உயிரினங்கள், பால், முட்டை, மீன், நிலக்கடலை, மரக் கொட்டைகள், சோயா, சல்பைட் (10 மி.கி/கி.கி அல்லது அதிகம்). எள்ளும் கடுகும் இந்தியாவின் கட்டாயப் பட்டியலில் இல்லை." },
          { list: [
            "“உள்ளது: பால், கோதுமை” — ஒவ்வாமைப் பொருள் ஒரு மூலப்பொருள்.",
            "“கொட்டைகளின் சுவடுகள் இருக்கலாம்” அல்லது “… கையாளும் இடத்தில் தயாரிக்கப்பட்டது” — குறுக்குத் தொடர்பு பற்றிய முன்னெச்சரிக்கை. இது விருப்பத்தேர்வு; இல்லாதது குறுக்குத் தொடர்பு இல்லை என்பதை நிரூபிக்காது.",
            "எந்த அறிவிப்பும் இல்லை — தெரியாது; ஒவ்வாமை இல்லாதது அல்ல.",
          ] },
          { tip: "நீங்கள் குறிப்பிட்ட ஒவ்வாமைப் பொருள் மூலப்பொருளாக இருந்தால் FoodDecode ‘இல்லை’ என்கிறது; குறுக்குத் தொடர்பு எச்சரிக்கை அல்லது “தாவரப் புரதம்”, “லெசித்தின்” போன்ற தெளிவற்ற பொருட்களுக்கு ‘கவனம்’. கடுமையான ஒவ்வாமை இருந்தால் எப்போதும் பாக்கெட்டைப் படித்து உங்கள் மருத்துவரின் ஆலோசனையைப் பின்பற்றுங்கள்." },
        ],
      },
    },
  },
  {
    id: "ingredients", mins: 1, illustration: "reader",
    text: {
      en: {
        title: "Understanding ingredients",
        blurb: "The order of the list tells you a lot.",
        body: [
          { p: "Ingredients are listed in descending order of weight at the time of manufacture. The first two or three ingredients make up most of the product." },
          { list: ["“Refined wheat flour (maida)” first means the product is mostly maida.", "Sugar can appear under several names: sugar, invert syrup, liquid glucose, jaggery, dextrose.", "A percentage in brackets, like “cocoa solids (4%)”, tells you exactly how much is there."] },
          { tip: "FoodDecode splits the list into ingredients, additives (with INS codes explained) and allergen statements." },
        ],
      },
      hi: {
        title: "सामग्री को समझें",
        blurb: "सूची का क्रम बहुत कुछ बताता है।",
        body: [
          { p: "सामग्री निर्माण के समय वज़न के घटते क्रम में लिखी जाती है। पहली दो-तीन सामग्री उत्पाद का अधिकांश हिस्सा होती हैं।" },
          { list: ["पहले “रिफाइंड गेहूँ का आटा (मैदा)” का मतलब है उत्पाद ज़्यादातर मैदा है।", "चीनी कई नामों से आ सकती है: चीनी, इनवर्ट सिरप, लिक्विड ग्लूकोज़, गुड़, डेक्सट्रोज़।", "कोष्ठक में प्रतिशत, जैसे “कोको सॉलिड्स (4%)”, ठीक-ठीक मात्रा बताता है।"] },
          { tip: "FoodDecode सूची को सामग्री, योजक (INS कोड की व्याख्या सहित) और एलर्जेन सूचनाओं में बाँटता है।" },
        ],
      },
      ta: {
        title: "மூலப்பொருட்களைப் புரிந்துகொள்ளுதல்",
        blurb: "பட்டியலின் வரிசை நிறையச் சொல்கிறது.",
        body: [
          { p: "தயாரிக்கும்போது இருந்த எடையின் இறங்கு வரிசையில் மூலப்பொருட்கள் பட்டியலிடப்படுகின்றன. முதல் இரண்டு மூன்று பொருட்களே பெரும்பகுதி." },
          { list: ["முதலில் “சுத்திகரிக்கப்பட்ட கோதுமை மாவு (மைதா)” என்றால் பொருள் பெரும்பாலும் மைதா.", "சர்க்கரை பல பெயர்களில் வரலாம்: சர்க்கரை, இன்வர்ட் சிரப், திரவ குளுக்கோஸ், வெல்லம், டெக்ஸ்ட்ரோஸ்.", "அடைப்புக்குறிக்குள் சதவீதம், “கோகோ திடப்பொருள் (4%)” போல, சரியான அளவைச் சொல்கிறது."] },
          { tip: "FoodDecode பட்டியலை மூலப்பொருட்கள், சேர்க்கைகள் (INS குறியீடு விளக்கத்துடன்), ஒவ்வாமை அறிவிப்புகள் எனப் பிரிக்கிறது." },
        ],
      },
    },
  },
  {
    id: "ins", mins: 2, illustration: "magnifier",
    text: {
      en: {
        title: "What are INS numbers?",
        blurb: "Codes for additives, and how to look them up.",
        body: [
          { p: "INS (International Numbering System) codes identify food additives: emulsifiers, colours, preservatives, raising agents and more. For example 322 is lecithin, 500(ii) is sodium bicarbonate (baking soda), 621 is monosodium glutamate (MSG)." },
          { list: ["Additives used in India must be permitted by FSSAI for that food category.", "Some codes can come from plant or animal sources (e.g. 471, mono- and diglycerides). Labels don't always say which — relevant if you are vegan or Jain.", "A code tells you what the additive does, not whether it is “good” or “bad”."] },
          { tip: "Tap any INS code in FoodDecode to see what it is and why it is used." },
        ],
      },
      hi: {
        title: "INS नंबर क्या हैं?",
        blurb: "योजकों के कोड, और उन्हें कैसे समझें।",
        body: [
          { p: "INS (अंतर्राष्ट्रीय क्रमांकन प्रणाली) कोड खाद्य योजकों की पहचान करते हैं: इमल्सीफ़ायर, रंग, परिरक्षक, उठाने वाले एजेंट आदि। जैसे 322 लेसिथिन है, 500(ii) सोडियम बाइकार्बोनेट (बेकिंग सोडा), 621 मोनोसोडियम ग्लूटामेट (MSG)।" },
          { list: ["भारत में योजक उस खाद्य श्रेणी के लिए FSSAI द्वारा अनुमत होने चाहिए।", "कुछ कोड पौधों या पशु स्रोतों से आ सकते हैं (जैसे 471, मोनो- और डाइग्लिसराइड्स)। लेबल हमेशा नहीं बताते — शाकाहारी (वीगन) या जैन हों तो यह मायने रखता है।", "कोड बताता है कि योजक क्या करता है, यह नहीं कि वह “अच्छा” है या “बुरा”।"] },
          { tip: "FoodDecode में किसी भी INS कोड पर टैप करके देखें कि वह क्या है और क्यों उपयोग होता है।" },
        ],
      },
      ta: {
        title: "INS எண்கள் என்றால் என்ன?",
        blurb: "சேர்க்கைப் பொருட்களுக்கான குறியீடுகள், அவற்றை எப்படிப் பார்ப்பது.",
        body: [
          { p: "INS (சர்வதேச எண்ணிடல் முறை) குறியீடுகள் உணவுச் சேர்க்கைகளை அடையாளம் காட்டுகின்றன: குழம்பாக்கிகள், நிறமிகள், பாதுகாப்புப் பொருட்கள், புளிப்பேற்றிகள் போன்றவை. எ.கா. 322 லெசித்தின், 500(ii) சோடியம் பைகார்பனேட் (சமையல் சோடா), 621 மோனோசோடியம் குளுட்டமேட் (MSG)." },
          { list: ["இந்தியாவில் சேர்க்கைகள் அந்த உணவு வகைக்கு FSSAI அனுமதித்தவையாக இருக்க வேண்டும்.", "சில குறியீடுகள் தாவர அல்லது விலங்கு மூலங்களிலிருந்து வரலாம் (எ.கா. 471). லேபிள்கள் எப்போதும் சொல்வதில்லை — வீகன் அல்லது ஜைனராக இருந்தால் இது முக்கியம்.", "குறியீடு சேர்க்கை என்ன செய்கிறது என்று சொல்கிறது; அது “நல்லது” அல்லது “கெட்டது” என்று அல்ல."] },
          { tip: "FoodDecode-இல் எந்த INS குறியீட்டையும் தட்டி, அது என்ன, ஏன் பயன்படுத்தப்படுகிறது என்று பாருங்கள்." },
        ],
      },
    },
  },
];

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id) || null;

/** Which lesson explains a finding, by the finding's tags / nutrient. */
export const LESSON_FOR_TAG: Record<string, string> = {
  sodiumMg: "sodium", addedSugarG: "sugar", sugarsG: "sugar", carbohydratesG: "carbs", saturatedFatG: "fats", transFatG: "fats",
  totalFatG: "fats", energyKcal: "portion", proteinG: "read-label", fibreG: "read-label", allergen: "allergens", diet: "ins",
  portion: "portion", serving: "serving-size", ingredients: "ingredients",
};
