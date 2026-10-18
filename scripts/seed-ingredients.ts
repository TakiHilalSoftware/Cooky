/**
 * The ingredient dictionary (PRD §3.2): everyday staples in EN/FR/AR, with
 * the other words people use as variants: plurals, spellings, and regional
 * Arabic (Maghreb and Mashreq). Upserts by slug, so re-running applies edits.
 *
 *   pnpm db:seed:ingredients
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // Deployments provide variables directly.
}

// A module, so top-level await works; imports are dynamic so .env.local loads first.
export {};

type Aisle =
  | "produce"
  | "meat_fish"
  | "dairy_eggs"
  | "bakery"
  | "grains_pasta"
  | "canned_jars"
  | "spices"
  | "oils_condiments"
  | "baking"
  | "frozen"
  | "drinks"
  | "other";
type Unit = "g" | "kg" | "ml" | "l" | "tsp" | "tbsp" | "cup" | "piece" | "clove" | "pinch" | "bunch" | "can";

export type Staple = {
  slug: string;
  nameEn: string;
  nameFr: string;
  nameAr: string;
  variants: string[];
  aisle: Aisle;
  defaultUnit: Unit | null;
  isCommonStaple: boolean;
};

const i = (
  slug: string,
  nameEn: string,
  nameFr: string,
  nameAr: string,
  aisle: Aisle,
  options: { unit?: Unit; staple?: boolean; variants?: string[] } = {},
): Staple => ({
  slug,
  nameEn,
  nameFr,
  nameAr,
  variants: options.variants ?? [],
  aisle,
  defaultUnit: options.unit ?? null,
  isCommonStaple: options.staple ?? false,
});

export const STAPLES: Staple[] = [
  // Produce
  i("tomato", "Tomato", "Tomate", "طماطم", "produce", {
    unit: "piece",
    variants: ["tomatoes", "بندورة", "مطيشة", "طماطة"],
  }),
  i("onion", "Onion", "Oignon", "بصل", "produce", { unit: "piece", variants: ["onions", "oignons", "بصلة"] }),
  i("red-onion", "Red onion", "Oignon rouge", "بصل أحمر", "produce", { unit: "piece", variants: ["red onions"] }),
  i("garlic", "Garlic", "Ail", "ثوم", "produce", { unit: "clove", variants: ["gousse d'ail", "ثومة"] }),
  i("potato", "Potato", "Pomme de terre", "بطاطس", "produce", {
    unit: "piece",
    variants: ["potatoes", "pommes de terre", "patate", "بطاطا"],
  }),
  i("sweet-potato", "Sweet potato", "Patate douce", "بطاطا حلوة", "produce", {
    unit: "piece",
    variants: ["sweet potatoes", "patates douces"],
  }),
  i("carrot", "Carrot", "Carotte", "جزر", "produce", { unit: "piece", variants: ["carrots", "carottes", "خيزو"] }),
  i("zucchini", "Zucchini", "Courgette", "كوسة", "produce", {
    unit: "piece",
    variants: ["courgettes", "كوسا", "قرعة"],
  }),
  i("eggplant", "Eggplant", "Aubergine", "باذنجان", "produce", {
    unit: "piece",
    variants: ["aubergines", "بدنجان", "دنجال"],
  }),
  i("bell-pepper", "Bell pepper", "Poivron", "فلفل حلو", "produce", {
    unit: "piece",
    variants: ["peppers", "poivrons", "فلفل رومي", "فليفلة"],
  }),
  i("chili-pepper", "Chili pepper", "Piment", "فلفل حار", "produce", {
    unit: "piece",
    variants: ["chilli", "chillies", "piments", "شطة"],
  }),
  i("cucumber", "Cucumber", "Concombre", "خيار", "produce", { unit: "piece", variants: ["cucumbers", "concombres"] }),
  i("lettuce", "Lettuce", "Laitue", "خس", "produce", { unit: "piece", variants: ["salade verte"] }),
  i("spinach", "Spinach", "Épinards", "سبانخ", "produce", { unit: "g", variants: ["épinard"] }),
  i("cabbage", "Cabbage", "Chou", "ملفوف", "produce", { unit: "piece", variants: ["chou blanc", "كرنب"] }),
  i("cauliflower", "Cauliflower", "Chou-fleur", "قرنبيط", "produce", { unit: "piece", variants: ["زهرة", "شيفلور"] }),
  i("broccoli", "Broccoli", "Brocoli", "بروكلي", "produce", { unit: "piece", variants: ["brocolis"] }),
  i("green-beans", "Green beans", "Haricots verts", "فاصوليا خضراء", "produce", {
    unit: "g",
    variants: ["لوبيا خضراء"],
  }),
  i("peas", "Peas", "Petits pois", "بازلاء", "produce", { unit: "g", variants: ["green peas", "جلبانة", "بسلة"] }),
  i("pumpkin", "Pumpkin", "Potiron", "يقطين", "produce", {
    unit: "g",
    variants: ["squash", "citrouille", "courge", "قرع", "كابويا"],
  }),
  i("mushroom", "Mushroom", "Champignon", "فطر", "produce", {
    unit: "g",
    variants: ["mushrooms", "champignons", "مشروم", "عيش الغراب"],
  }),
  i("lemon", "Lemon", "Citron", "ليمون", "produce", { unit: "piece", variants: ["lemons", "citrons", "حامض"] }),
  i("preserved-lemon", "Preserved lemon", "Citron confit", "ليمون مصير", "canned_jars", {
    unit: "piece",
    variants: ["preserved lemons", "citrons confits", "حامض مرقد", "ليمون مخلل"],
  }),
  i("lime", "Lime", "Citron vert", "ليمون أخضر", "produce", { unit: "piece", variants: ["limes", "لايم"] }),
  i("orange", "Orange", "Orange", "برتقال", "produce", { unit: "piece", variants: ["oranges", "بردقان"] }),
  i("apple", "Apple", "Pomme", "تفاح", "produce", { unit: "piece", variants: ["apples", "pommes", "تفاحة"] }),
  i("banana", "Banana", "Banane", "موز", "produce", { unit: "piece", variants: ["bananas", "bananes"] }),
  i("dates", "Dates", "Dattes", "تمر", "produce", { unit: "piece", variants: ["date", "datte", "تمور"] }),
  i("raisins", "Raisins", "Raisins secs", "زبيب", "produce", { unit: "g", variants: ["sultanas"] }),
  i("avocado", "Avocado", "Avocat", "أفوكادو", "produce", { unit: "piece", variants: ["avocados", "avocats"] }),
  i("parsley", "Parsley", "Persil", "بقدونس", "produce", { unit: "bunch", variants: ["معدنوس", "مقدونس"] }),
  i("coriander", "Coriander", "Coriandre", "كزبرة", "produce", {
    unit: "bunch",
    variants: ["cilantro", "قصبر", "كسبر"],
  }),
  i("mint", "Mint", "Menthe", "نعناع", "produce", { unit: "bunch", variants: ["fresh mint", "نعنع"] }),
  i("dill", "Dill", "Aneth", "شبت", "produce", { unit: "bunch", variants: ["شبث"] }),
  i("basil", "Basil", "Basilic", "ريحان", "produce", { unit: "bunch", variants: ["حبق"] }),
  i("celery", "Celery", "Céleri", "كرفس", "produce", { unit: "piece", variants: ["celery stalk"] }),
  i("leek", "Leek", "Poireau", "كراث", "produce", { unit: "piece", variants: ["leeks", "poireaux", "بوارو"] }),
  i("ginger", "Ginger", "Gingembre", "زنجبيل", "spices", { unit: "tsp", variants: ["سكينجبير"] }),
  i("olives", "Olives", "Olives", "زيتون", "canned_jars", {
    unit: "g",
    variants: ["olive", "green olives", "black olives"],
  }),

  // Meat & fish
  i("chicken", "Chicken", "Poulet", "دجاج", "meat_fish", { unit: "kg", variants: ["poule", "فروج", "دجاجة"] }),
  i("chicken-breast", "Chicken breast", "Blanc de poulet", "صدر دجاج", "meat_fish", {
    unit: "g",
    variants: ["chicken breasts", "filet de poulet", "صدور دجاج"],
  }),
  i("chicken-thigh", "Chicken thighs", "Cuisses de poulet", "أفخاذ دجاج", "meat_fish", {
    unit: "g",
    variants: ["chicken thigh", "haut de cuisse", "فخذ دجاج"],
  }),
  i("beef", "Beef", "Bœuf", "لحم بقري", "meat_fish", { unit: "g", variants: ["viande de boeuf", "لحم عجل"] }),
  i("ground-beef", "Ground beef", "Viande hachée", "لحم مفروم", "meat_fish", {
    unit: "g",
    variants: ["minced meat", "mince", "haché", "kefta", "كفتة"],
  }),
  i("lamb", "Lamb", "Agneau", "لحم غنم", "meat_fish", {
    unit: "g",
    variants: ["mutton", "mouton", "لحم خروف", "لحم ضاني"],
  }),
  i("veal", "Veal", "Veau", "لحم عجل صغير", "meat_fish", { unit: "g" }),
  i("turkey", "Turkey", "Dinde", "ديك رومي", "meat_fish", { unit: "g", variants: ["حبش"] }),
  i("merguez", "Merguez", "Merguez", "مرقاز", "meat_fish", { unit: "piece", variants: ["مركاز"] }),
  i("white-fish", "White fish", "Poisson blanc", "سمك أبيض", "meat_fish", {
    unit: "g",
    variants: ["fish", "cod", "poisson", "cabillaud", "سمك"],
  }),
  i("salmon", "Salmon", "Saumon", "سلمون", "meat_fish", { unit: "g", variants: ["سالمون"] }),
  i("tuna", "Tuna", "Thon", "تونة", "canned_jars", { unit: "can", variants: ["tinned tuna", "thon en boîte", "تن"] }),
  i("shrimp", "Shrimp", "Crevettes", "جمبري", "meat_fish", {
    unit: "g",
    variants: ["prawns", "crevette", "روبيان", "قمرون"],
  }),
  i("sardines", "Sardines", "Sardines", "سردين", "meat_fish", { unit: "g", variants: ["sardine", "سردينة"] }),

  // Dairy & eggs
  i("egg", "Eggs", "Œufs", "بيض", "dairy_eggs", { unit: "piece", variants: ["egg", "oeuf", "œuf", "بيضة"] }),
  i("milk", "Milk", "Lait", "حليب", "dairy_eggs", { unit: "ml", variants: ["whole milk", "lait entier"] }),
  i("butter", "Butter", "Beurre", "زبدة", "dairy_eggs", { unit: "g", variants: ["زبد"] }),
  i("ghee", "Ghee", "Smen", "سمن", "dairy_eggs", { unit: "tbsp", variants: ["smen", "beurre clarifié", "سمن بلدي"] }),
  i("yogurt", "Yogurt", "Yaourt", "زبادي", "dairy_eggs", {
    unit: "g",
    variants: ["yoghurt", "yogourt", "لبن رائب", "روب"],
  }),
  i("cream", "Cream", "Crème fraîche", "قشطة", "dairy_eggs", {
    unit: "ml",
    variants: ["heavy cream", "crème liquide", "كريمة"],
  }),
  i("cheese", "Cheese", "Fromage", "جبن", "dairy_eggs", { unit: "g", variants: ["جبنة"] }),
  i("feta", "Feta", "Feta", "جبنة فيتا", "dairy_eggs", { unit: "g", variants: ["جبنة بيضاء"] }),
  i("mozzarella", "Mozzarella", "Mozzarella", "موزاريلا", "dairy_eggs", { unit: "g" }),
  i("parmesan", "Parmesan", "Parmesan", "بارميزان", "dairy_eggs", { unit: "g", variants: ["parmigiano"] }),
  i("labneh", "Labneh", "Labneh", "لبنة", "dairy_eggs", { unit: "g", variants: ["labne"] }),

  // Bakery
  i("bread", "Bread", "Pain", "خبز", "bakery", { unit: "piece", variants: ["baguette", "عيش"] }),
  i("pita", "Pita bread", "Pain pita", "خبز عربي", "bakery", {
    unit: "piece",
    variants: ["pita", "pitta", "خبز لبناني"],
  }),

  // Grains, pasta & pulses
  i("rice", "Rice", "Riz", "أرز", "grains_pasta", { unit: "g", variants: ["رز"] }),
  i("basmati-rice", "Basmati rice", "Riz basmati", "أرز بسمتي", "grains_pasta", { unit: "g", variants: ["رز بسمتي"] }),
  i("pasta", "Pasta", "Pâtes", "معكرونة", "grains_pasta", { unit: "g", variants: ["مكرونة", "macaroni"] }),
  i("spaghetti", "Spaghetti", "Spaghettis", "سباغيتي", "grains_pasta", { unit: "g", variants: ["spaghettis"] }),
  i("couscous", "Couscous", "Couscous", "كسكس", "grains_pasta", { unit: "g", variants: ["كسكسي", "سكسو"] }),
  i("semolina", "Semolina", "Semoule", "سميد", "grains_pasta", { unit: "g", variants: ["smida"] }),
  i("bulgur", "Bulgur", "Boulgour", "برغل", "grains_pasta", { unit: "g", variants: ["bulghur", "burghul"] }),
  i("freekeh", "Freekeh", "Frik", "فريكة", "grains_pasta", { unit: "g", variants: ["frik", "فريك"] }),
  i("vermicelli", "Vermicelli", "Vermicelles", "شعيرية", "grains_pasta", { unit: "g" }),
  i("oats", "Oats", "Flocons d'avoine", "شوفان", "grains_pasta", { unit: "g", variants: ["rolled oats", "avoine"] }),
  i("lentils", "Lentils", "Lentilles", "عدس", "grains_pasta", { unit: "g", variants: ["lentil", "lentille"] }),
  i("red-lentils", "Red lentils", "Lentilles corail", "عدس أحمر", "grains_pasta", {
    unit: "g",
    variants: ["lentilles rouges"],
  }),
  i("chickpeas", "Chickpeas", "Pois chiches", "حمص", "grains_pasta", {
    unit: "g",
    variants: ["garbanzo", "pois chiche", "حمص حب"],
  }),
  i("white-beans", "White beans", "Haricots blancs", "فاصوليا بيضاء", "grains_pasta", {
    unit: "g",
    variants: ["cannellini", "لوبيا"],
  }),
  i("fava-beans", "Fava beans", "Fèves", "فول", "grains_pasta", { unit: "g", variants: ["broad beans", "فول مدمس"] }),

  // Canned & jars
  i("tomato-paste", "Tomato paste", "Concentré de tomate", "معجون طماطم", "canned_jars", {
    unit: "tbsp",
    variants: ["tomato puree", "double concentré", "صلصة طماطم"],
  }),
  i("canned-tomatoes", "Canned tomatoes", "Tomates pelées", "طماطم معلبة", "canned_jars", {
    unit: "can",
    variants: ["chopped tomatoes", "tomates concassées"],
  }),
  i("harissa", "Harissa", "Harissa", "هريسة", "canned_jars", { unit: "tsp" }),
  i("tahini", "Tahini", "Tahini", "طحينة", "canned_jars", { unit: "tbsp", variants: ["tahina", "crème de sésame"] }),

  // Oils & condiments
  i("olive-oil", "Olive oil", "Huile d'olive", "زيت زيتون", "oils_condiments", {
    unit: "tbsp",
    staple: true,
    variants: ["extra virgin olive oil"],
  }),
  i("vegetable-oil", "Vegetable oil", "Huile végétale", "زيت نباتي", "oils_condiments", {
    unit: "tbsp",
    staple: true,
    variants: ["sunflower oil", "huile de tournesol", "زيت دوار الشمس"],
  }),
  i("vinegar", "Vinegar", "Vinaigre", "خل", "oils_condiments", { unit: "tbsp", staple: true }),
  i("soy-sauce", "Soy sauce", "Sauce soja", "صلصة الصويا", "oils_condiments", { unit: "tbsp" }),
  i("mustard", "Mustard", "Moutarde", "خردل", "oils_condiments", { unit: "tsp", variants: ["موتارد"] }),
  i("mayonnaise", "Mayonnaise", "Mayonnaise", "مايونيز", "oils_condiments", { unit: "tbsp", variants: ["mayo"] }),
  i("honey", "Honey", "Miel", "عسل", "oils_condiments", { unit: "tbsp" }),
  i("pomegranate-molasses", "Pomegranate molasses", "Mélasse de grenade", "دبس رمان", "oils_condiments", {
    unit: "tbsp",
    variants: ["دبس الرمان"],
  }),
  i("orange-blossom-water", "Orange blossom water", "Eau de fleur d'oranger", "ماء الزهر", "oils_condiments", {
    unit: "tbsp",
    variants: ["orange flower water", "ماء زهر"],
  }),
  i("rose-water", "Rose water", "Eau de rose", "ماء الورد", "oils_condiments", { unit: "tbsp", variants: ["ماء ورد"] }),

  // Spices & herbs
  i("salt", "Salt", "Sel", "ملح", "spices", { unit: "tsp", staple: true, variants: ["sea salt", "sel fin"] }),
  i("black-pepper", "Black pepper", "Poivre noir", "فلفل أسود", "spices", {
    unit: "tsp",
    staple: true,
    variants: ["pepper", "poivre", "إبزار"],
  }),
  i("cumin", "Cumin", "Cumin", "كمون", "spices", { unit: "tsp", variants: ["ground cumin", "كامون"] }),
  i("paprika", "Paprika", "Paprika", "فلفل أحمر حلو", "spices", {
    unit: "tsp",
    variants: ["sweet paprika", "piment doux", "بابريكا", "تحميرة"],
  }),
  i("turmeric", "Turmeric", "Curcuma", "كركم", "spices", { unit: "tsp", variants: ["خرقوم"] }),
  i("cinnamon", "Cinnamon", "Cannelle", "قرفة", "spices", { unit: "tsp", variants: ["دارسين"] }),
  i("ras-el-hanout", "Ras el hanout", "Ras el hanout", "راس الحانوت", "spices", {
    unit: "tsp",
    variants: ["ras el hanout"],
  }),
  i("saffron", "Saffron", "Safran", "زعفران", "spices", { unit: "pinch" }),
  i("cayenne", "Cayenne pepper", "Piment de Cayenne", "فلفل حار مطحون", "spices", {
    unit: "tsp",
    variants: ["chili powder", "chili flakes", "سودانية", "شطة مطحونة"],
  }),
  i("ground-coriander", "Ground coriander", "Coriandre moulue", "كزبرة مطحونة", "spices", {
    unit: "tsp",
    variants: ["coriander seeds", "كزبرة يابسة"],
  }),
  i("caraway", "Caraway", "Carvi", "كروية", "spices", { unit: "tsp", variants: ["كراوية"] }),
  i("sumac", "Sumac", "Sumac", "سماق", "spices", { unit: "tsp" }),
  i("zaatar", "Za'atar", "Zaatar", "زعتر", "spices", { unit: "tbsp", variants: ["zaatar", "zatar", "zahtar"] }),
  i("thyme", "Thyme", "Thym", "زعتر بري", "spices", { unit: "tsp", variants: ["زعيترة"] }),
  i("bay-leaf", "Bay leaf", "Laurier", "ورق الغار", "spices", {
    unit: "piece",
    variants: ["bay leaves", "feuille de laurier", "ورق الرند"],
  }),
  i("nutmeg", "Nutmeg", "Muscade", "جوزة الطيب", "spices", { unit: "pinch", variants: ["noix de muscade"] }),
  i("cardamom", "Cardamom", "Cardamome", "هيل", "spices", { unit: "piece", variants: ["حبهان"] }),
  i("cloves", "Cloves", "Clous de girofle", "قرنفل", "spices", {
    unit: "piece",
    variants: ["clou de girofle", "عود النوار"],
  }),
  i("aniseed", "Aniseed", "Anis vert", "يانسون", "spices", { unit: "tsp", variants: ["anise", "حبة حلاوة"] }),
  i("sesame", "Sesame seeds", "Graines de sésame", "سمسم", "spices", {
    unit: "tbsp",
    variants: ["sesame", "sésame", "جلجلان"],
  }),
  i("nigella", "Nigella seeds", "Nigelle", "حبة البركة", "spices", {
    unit: "tsp",
    variants: ["black seed", "حبة سوداء", "سانوج"],
  }),
  i("seven-spices", "Seven spices", "Sept épices", "بهارات سبعة", "spices", {
    unit: "tsp",
    variants: ["baharat", "بهارات"],
  }),

  // Baking
  i("flour", "Flour", "Farine", "طحين", "baking", { unit: "g", staple: true, variants: ["all-purpose flour", "دقيق"] }),
  i("sugar", "Sugar", "Sucre", "سكر", "baking", {
    unit: "g",
    staple: true,
    variants: ["caster sugar", "sucre en poudre"],
  }),
  i("brown-sugar", "Brown sugar", "Sucre roux", "سكر بني", "baking", { unit: "g", variants: ["cassonade"] }),
  i("baking-powder", "Baking powder", "Levure chimique", "بيكنج باودر", "baking", {
    unit: "tsp",
    variants: ["خميرة كيميائية"],
  }),
  i("yeast", "Yeast", "Levure boulangère", "خميرة", "baking", {
    unit: "tsp",
    variants: ["dry yeast", "levure", "خميرة جافة"],
  }),
  i("vanilla", "Vanilla", "Vanille", "فانيليا", "baking", {
    unit: "tsp",
    variants: ["vanilla extract", "sucre vanillé", "فانيلا"],
  }),
  i("cocoa", "Cocoa powder", "Cacao", "كاكاو", "baking", { unit: "tbsp", variants: ["cocoa", "cacao en poudre"] }),
  i("chocolate", "Chocolate", "Chocolat", "شوكولاتة", "baking", {
    unit: "g",
    variants: ["dark chocolate", "chocolat noir"],
  }),
  i("cornstarch", "Cornstarch", "Fécule de maïs", "نشا", "baking", {
    unit: "tbsp",
    variants: ["cornflour", "maïzena"],
  }),
  i("almonds", "Almonds", "Amandes", "لوز", "baking", { unit: "g", variants: ["almond", "amande"] }),
  i("walnuts", "Walnuts", "Noix", "جوز", "baking", { unit: "g", variants: ["walnut", "عين الجمل"] }),
  i("pistachios", "Pistachios", "Pistaches", "فستق حلبي", "baking", { unit: "g", variants: ["pistachio", "فستق"] }),
  i("pine-nuts", "Pine nuts", "Pignons de pin", "صنوبر", "baking", { unit: "g", variants: ["pignons"] }),
  i("peanuts", "Peanuts", "Cacahuètes", "فول سوداني", "baking", { unit: "g", variants: ["arachides", "كاوكاو"] }),
  i("coconut", "Desiccated coconut", "Noix de coco râpée", "جوز الهند", "baking", {
    unit: "g",
    variants: ["coconut", "coco"],
  }),

  // Drinks & other
  i("water", "Water", "Eau", "ماء", "drinks", { unit: "ml", staple: true }),
  i("stock", "Stock", "Bouillon", "مرق", "other", {
    unit: "ml",
    variants: ["broth", "chicken stock", "bouillon cube", "مكعب مرق"],
  }),
  i("green-tea", "Green tea", "Thé vert", "شاي أخضر", "drinks", { unit: "tsp", variants: ["thé", "أتاي"] }),
  i("coffee", "Coffee", "Café", "قهوة", "drinks", { unit: "tbsp", variants: ["قهوة عربية"] }),
];

if (process.argv[1]?.includes("seed-ingredients")) {
  const { sql } = await import("drizzle-orm");
  const { getDb } = await import("../src/server/db/client");
  const { ingredients } = await import("../src/server/db/schema");
  const { searchTextFor } = await import("../src/server/features/ingredients/service");

  await getDb()
    .insert(ingredients)
    .values(STAPLES.map((s) => ({ ...s, search: searchTextFor(s) })))
    .onConflictDoUpdate({
      target: ingredients.slug,
      set: {
        nameEn: sql`excluded.name_en`,
        nameFr: sql`excluded.name_fr`,
        nameAr: sql`excluded.name_ar`,
        variants: sql`excluded.variants`,
        aisle: sql`excluded.aisle`,
        defaultUnit: sql`excluded.default_unit`,
        isCommonStaple: sql`excluded.is_common_staple`,
        search: sql`excluded.search`,
        updatedAt: new Date(),
      },
    });
  console.log(`Seeded ${STAPLES.length} ingredients.`);
  process.exit(0);
}
