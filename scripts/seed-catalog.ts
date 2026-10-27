/**
 * The Discover catalog (PRD §3.3): curated dishes from 14 countries, fully
 * translated EN/FR/AR. Ingredients that are dictionary staples take their
 * names from the dictionary, so only notes and steps are written here.
 * Upserts by slug; a dish's ingredients and steps are replaced on re-run.
 *
 *   pnpm db:seed:catalog
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // Deployments provide variables directly.
}

export {};

type Text = { en: string; fr: string; ar: string };
type Unit = "g" | "kg" | "ml" | "l" | "tsp" | "tbsp" | "cup" | "piece" | "clove" | "pinch" | "bunch" | "can" | "slice";
type Course = "appetizer" | "main" | "side" | "dessert" | "drinks";
type Diet = "vegetarian" | "vegan" | "pescatarian" | "halal" | "gluten_free" | "dairy_free" | "nut_free" | "egg_free";
type Season = "spring" | "summer" | "autumn" | "winter";
type Collection = "ramadan_iftar" | "eid_sweets" | "summer_salads" | "winter_comfort" | "quick";

export type CatalogIngredient = {
  /** A dictionary slug (names come from the dictionary), or its own names. */
  staple: string | null;
  names?: Text;
  amount: number | null;
  unit: Unit | null;
  note?: Text;
};
export type CatalogStep = { text: Text; minutes?: number };
export type CatalogEntry = {
  slug: string;
  country: string;
  course: Course;
  difficulty: "easy" | "medium" | "hard";
  servings: number;
  seasons: Season[];
  dietaryTags: Diet[];
  collections: Collection[];
  featured?: boolean;
  name: Text;
  description: Text;
  ingredients: CatalogIngredient[];
  steps: CatalogStep[];
};

const i = (staple: string, amount: number | null, unit: Unit | null, note?: Text): CatalogIngredient => ({
  staple,
  amount,
  unit,
  note,
});
const own = (names: Text, amount: number | null, unit: Unit | null, note?: Text): CatalogIngredient => ({
  staple: null,
  names,
  amount,
  unit,
  note,
});
const s = (en: string, fr: string, ar: string, minutes?: number): CatalogStep => ({ text: { en, fr, ar }, minutes });
const t = (en: string, fr: string, ar: string): Text => ({ en, fr, ar });

const CHOPPED = t("chopped", "haché", "مفروم");
const FINELY_CHOPPED = t("finely chopped", "finement haché", "مفروم ناعمًا");
const JUICED = t("juiced", "pressé", "معصور");
const DICED = t("diced", "coupé en dés", "مقطع مكعبات");
const SOAKED = t("soaked overnight", "trempé la veille", "منقوع ليلة كاملة");

export const CATALOG: CatalogEntry[] = [
  {
    slug: "chicken-tagine-preserved-lemon",
    country: "MA",
    course: "main",
    difficulty: "medium",
    servings: 4,
    seasons: ["autumn", "winter"],
    dietaryTags: ["halal", "gluten_free", "dairy_free"],
    collections: [],
    featured: true,
    name: t(
      "Chicken tagine with preserved lemon and olives",
      "Tajine de poulet au citron confit et aux olives",
      "طاجين الدجاج بالليمون المصير والزيتون",
    ),
    description: t(
      "Slow-simmered chicken with ginger, saffron, preserved lemon and green olives.",
      "Poulet mijoté au gingembre, au safran, au citron confit et aux olives vertes.",
      "دجاج مطهو على نار هادئة مع الزنجبيل والزعفران والليمون المصير والزيتون الأخضر.",
    ),
    ingredients: [
      i("chicken", 1.2, "kg", t("in pieces", "en morceaux", "مقطع")),
      i("onion", 2, "piece", FINELY_CHOPPED),
      i("garlic", 3, "clove", CHOPPED),
      i("ginger", 1, "tsp"),
      i("turmeric", 1, "tsp"),
      i("saffron", 1, "pinch"),
      i("preserved-lemon", 1, "piece", t("cut in quarters", "coupé en quartiers", "مقطع أرباعًا")),
      i("olives", 150, "g"),
      i("coriander", 1, "bunch", CHOPPED),
      i("olive-oil", 3, "tbsp"),
      i("salt", null, null),
    ],
    steps: [
      s(
        "Rub the chicken with the spices, garlic and a little salt.",
        "Frottez le poulet avec les épices, l’ail et un peu de sel.",
        "افركي الدجاج بالتوابل والثوم وقليل من الملح.",
      ),
      s(
        "Soften the onions in the olive oil, then brown the chicken on all sides.",
        "Faites revenir les oignons dans l’huile d’olive, puis dorez le poulet de tous côtés.",
        "شوّحي البصل في زيت الزيتون، ثم حمّري الدجاج من كل الجهات.",
        10,
      ),
      s(
        "Add a glass of water, cover and simmer gently.",
        "Ajoutez un verre d’eau, couvrez et laissez mijoter doucement.",
        "أضيفي كوبًا من الماء، وغطّي القدر واتركيه على نار هادئة.",
        40,
      ),
      s(
        "Add the preserved lemon, olives and coriander, and cook until the sauce thickens.",
        "Ajoutez le citron confit, les olives et la coriandre, et laissez réduire la sauce.",
        "أضيفي الليمون المصير والزيتون والكزبرة، واتركي الصلصة حتى تتكاثف.",
        15,
      ),
    ],
  },
  {
    slug: "harira",
    country: "MA",
    course: "appetizer",
    difficulty: "medium",
    servings: 6,
    seasons: ["autumn", "winter"],
    dietaryTags: ["halal", "dairy_free"],
    collections: ["ramadan_iftar", "winter_comfort"],
    featured: true,
    name: t("Harira", "Harira", "الحريرة"),
    description: t(
      "Moroccan tomato, lentil and chickpea soup, the classic way to break the fast.",
      "Soupe marocaine aux tomates, lentilles et pois chiches, classique pour rompre le jeûne.",
      "شوربة مغربية بالطماطم والعدس والحمص، الطبق الكلاسيكي للإفطار.",
    ),
    ingredients: [
      i("lamb", 250, "g", DICED),
      i("lentils", 100, "g"),
      i("chickpeas", 100, "g", SOAKED),
      i("tomato", 4, "piece", t("grated", "râpées", "مبشورة")),
      i("tomato-paste", 2, "tbsp"),
      i("onion", 1, "piece", FINELY_CHOPPED),
      i("celery", 2, "piece", CHOPPED),
      i("parsley", 1, "bunch", CHOPPED),
      i("coriander", 1, "bunch", CHOPPED),
      i("flour", 3, "tbsp"),
      i("ginger", 1, "tsp"),
      i("cinnamon", 0.5, "tsp"),
      i("salt", null, null),
    ],
    steps: [
      s(
        "Brown the meat with the onion, celery and spices.",
        "Faites revenir la viande avec l’oignon, le céleri et les épices.",
        "حمّري اللحم مع البصل والكرفس والتوابل.",
        10,
      ),
      s(
        "Add the chickpeas, lentils, tomatoes, tomato paste and 2 litres of water.",
        "Ajoutez les pois chiches, les lentilles, les tomates, le concentré et 2 litres d’eau.",
        "أضيفي الحمص والعدس والطماطم ومعجون الطماطم ولترين من الماء.",
      ),
      s(
        "Simmer until the lentils and chickpeas are tender.",
        "Laissez mijoter jusqu’à ce que les lentilles et les pois chiches soient tendres.",
        "اتركي الشوربة على نار هادئة حتى ينضج العدس والحمص.",
        60,
      ),
      s(
        "Whisk the flour into a glass of water, stir it in with the herbs and cook until silky.",
        "Délayez la farine dans un verre d’eau, versez-la avec les herbes et laissez épaissir.",
        "اخلطي الطحين في كوب ماء، وأضيفيه مع الأعشاب حتى تصبح الشوربة ناعمة.",
        10,
      ),
    ],
  },
  {
    slug: "mint-tea",
    country: "MA",
    course: "drinks",
    difficulty: "easy",
    servings: 4,
    seasons: [],
    dietaryTags: ["vegan", "gluten_free", "halal"],
    collections: ["quick", "ramadan_iftar"],
    name: t("Moroccan mint tea", "Thé à la menthe", "الشاي المغربي بالنعناع"),
    description: t(
      "Green tea brewed with fresh mint and sugar, poured from high.",
      "Thé vert infusé avec de la menthe fraîche et du sucre, servi de haut.",
      "شاي أخضر بالنعناع الطازج والسكر، يُسكب من الأعلى.",
    ),
    ingredients: [i("green-tea", 2, "tsp"), i("mint", 1, "bunch"), i("sugar", 4, "tbsp"), i("water", 750, "ml")],
    steps: [
      s(
        "Rinse the tea with a little boiling water and pour it away.",
        "Rincez le thé avec un peu d’eau bouillante et jetez-la.",
        "اشطفي الشاي بقليل من الماء المغلي وتخلّصي منه.",
      ),
      s(
        "Add the mint, sugar and boiling water, and let it brew.",
        "Ajoutez la menthe, le sucre et l’eau bouillante, et laissez infuser.",
        "أضيفي النعناع والسكر والماء المغلي واتركيه ينقع.",
        4,
      ),
      s(
        "Pour a glass and back into the pot twice, then serve from high.",
        "Versez un verre puis remettez-le dans la théière deux fois, puis servez de haut.",
        "اسكبي كوبًا وأعيديه إلى الإبريق مرتين، ثم قدّميه من الأعلى.",
      ),
    ],
  },
  {
    slug: "almond-ghriba",
    country: "MA",
    course: "dessert",
    difficulty: "easy",
    servings: 20,
    seasons: [],
    dietaryTags: ["vegetarian", "gluten_free"],
    collections: ["eid_sweets"],
    name: t("Almond ghriba", "Ghriba aux amandes", "غريبة اللوز"),
    description: t(
      "Crackled almond cookies scented with orange blossom.",
      "Biscuits craquelés aux amandes, parfumés à la fleur d’oranger.",
      "حلوى اللوز المتشققة بنكهة ماء الزهر.",
    ),
    ingredients: [
      i("almonds", 300, "g", t("ground", "en poudre", "مطحون")),
      i("sugar", 120, "g"),
      i("egg", 2, "piece"),
      i("baking-powder", 1, "tsp"),
      i("orange-blossom-water", 1, "tbsp"),
      own(t("Icing sugar", "Sucre glace", "سكر ناعم"), 50, "g", t("for rolling", "pour enrober", "للتغليف")),
    ],
    steps: [
      s(
        "Mix the almonds, sugar, eggs, baking powder and orange blossom water into a soft dough.",
        "Mélangez amandes, sucre, œufs, levure et fleur d’oranger en une pâte souple.",
        "اخلطي اللوز والسكر والبيض والخميرة وماء الزهر حتى تحصلي على عجينة طرية.",
      ),
      s(
        "Roll into small balls and coat them in icing sugar.",
        "Formez de petites boules et roulez-les dans le sucre glace.",
        "شكّلي كرات صغيرة وغلّفيها بالسكر الناعم.",
      ),
      s(
        "Bake at 180 °C until cracked and just golden.",
        "Enfournez à 180 °C jusqu’à ce qu’elles craquellent et dorent à peine.",
        "اخبزيها على حرارة 180 درجة حتى تتشقق وتتحمّر قليلًا.",
        15,
      ),
    ],
  },
  {
    slug: "chorba-frik",
    country: "DZ",
    course: "appetizer",
    difficulty: "medium",
    servings: 6,
    seasons: ["autumn", "winter"],
    dietaryTags: ["halal", "dairy_free"],
    collections: ["ramadan_iftar", "winter_comfort"],
    name: t("Chorba frik", "Chorba frik", "شوربة الفريك"),
    description: t(
      "Algerian lamb and cracked green wheat soup with tomato and mint.",
      "Soupe algérienne à l’agneau et au blé vert concassé, tomate et menthe.",
      "شوربة جزائرية باللحم والفريك والطماطم والنعناع.",
    ),
    ingredients: [
      i("lamb", 300, "g", DICED),
      i("freekeh", 120, "g"),
      i("chickpeas", 80, "g", SOAKED),
      i("onion", 1, "piece", FINELY_CHOPPED),
      i("tomato-paste", 2, "tbsp"),
      i("paprika", 1, "tsp"),
      i("cinnamon", 0.5, "tsp"),
      i("coriander", 1, "bunch", CHOPPED),
      i("mint", 1, "bunch", t("dried or fresh", "séchée ou fraîche", "يابس أو طازج")),
      i("olive-oil", 2, "tbsp"),
      i("salt", null, null),
    ],
    steps: [
      s(
        "Brown the lamb and onion in the oil with the spices and tomato paste.",
        "Faites revenir l’agneau et l’oignon dans l’huile avec les épices et le concentré.",
        "حمّري اللحم والبصل في الزيت مع التوابل ومعجون الطماطم.",
        10,
      ),
      s(
        "Add the chickpeas and 2 litres of water, then simmer.",
        "Ajoutez les pois chiches et 2 litres d’eau, puis laissez mijoter.",
        "أضيفي الحمص ولترين من الماء واتركيه على نار هادئة.",
        40,
      ),
      s(
        "Stir in the freekeh and cook until tender, then finish with coriander and mint.",
        "Ajoutez le frik et laissez cuire, puis terminez avec la coriandre et la menthe.",
        "أضيفي الفريك حتى ينضج، ثم أنهي بالكزبرة والنعناع.",
        25,
      ),
    ],
  },
  {
    slug: "shakshuka",
    country: "TN",
    course: "main",
    difficulty: "easy",
    servings: 2,
    seasons: ["summer", "autumn"],
    dietaryTags: ["vegetarian", "halal", "gluten_free"],
    collections: ["quick"],
    featured: true,
    name: t("Shakshuka", "Chakchouka", "الشكشوكة"),
    description: t(
      "Eggs poached in a spiced tomato and pepper sauce.",
      "Œufs pochés dans une sauce tomate et poivrons épicée.",
      "بيض مطهو في صلصة الطماطم والفلفل المتبّلة.",
    ),
    ingredients: [
      i("tomato", 4, "piece", CHOPPED),
      i("bell-pepper", 2, "piece", t("sliced", "émincés", "مقطع شرائح")),
      i("onion", 1, "piece", CHOPPED),
      i("garlic", 2, "clove", CHOPPED),
      i("egg", 4, "piece"),
      i("harissa", 1, "tsp"),
      i("cumin", 1, "tsp"),
      i("olive-oil", 2, "tbsp"),
      i("salt", null, null),
    ],
    steps: [
      s(
        "Soften the onion, pepper and garlic in the oil.",
        "Faites fondre l’oignon, le poivron et l’ail dans l’huile.",
        "شوّحي البصل والفلفل والثوم في الزيت.",
        8,
      ),
      s(
        "Add the tomatoes, harissa and cumin, and cook into a thick sauce.",
        "Ajoutez les tomates, la harissa et le cumin, et laissez réduire.",
        "أضيفي الطماطم والهريسة والكمون حتى تتكاثف الصلصة.",
        12,
      ),
      s(
        "Make four wells, crack in the eggs, cover and cook until the whites set.",
        "Creusez quatre puits, cassez-y les œufs, couvrez et laissez prendre les blancs.",
        "اصنعي أربع حفر، واكسري فيها البيض، وغطّي حتى يجمد البياض.",
        6,
      ),
    ],
  },
  {
    slug: "lablabi",
    country: "TN",
    course: "main",
    difficulty: "easy",
    servings: 4,
    seasons: ["winter"],
    dietaryTags: ["vegan", "halal"],
    collections: ["winter_comfort"],
    name: t("Lablabi", "Lablabi", "اللبلابي"),
    description: t(
      "Tunisian garlicky chickpea soup poured over day-old bread.",
      "Soupe tunisienne de pois chiches à l’ail, versée sur du pain rassis.",
      "شوربة حمص تونسية بالثوم تُسكب على الخبز اليابس.",
    ),
    ingredients: [
      i("chickpeas", 300, "g", SOAKED),
      i("garlic", 4, "clove", t("crushed", "écrasé", "مهروس")),
      i("cumin", 2, "tsp"),
      i("harissa", 1, "tbsp"),
      i("bread", 4, "slice", t("day-old, torn", "rassis, en morceaux", "يابس ومقطع")),
      i("lemon", 1, "piece", JUICED),
      i("olive-oil", 4, "tbsp"),
      i("salt", null, null),
    ],
    steps: [
      s(
        "Cook the chickpeas in plenty of water until very tender.",
        "Faites cuire les pois chiches dans beaucoup d’eau jusqu’à ce qu’ils soient très tendres.",
        "اسلقي الحمص في كمية كبيرة من الماء حتى ينضج تمامًا.",
        60,
      ),
      s(
        "Add the garlic, cumin and salt to the broth.",
        "Ajoutez l’ail, le cumin et le sel au bouillon.",
        "أضيفي الثوم والكمون والملح إلى المرق.",
      ),
      s(
        "Put bread in each bowl, ladle over the soup and finish with harissa, lemon and olive oil.",
        "Mettez le pain dans les bols, versez la soupe et terminez avec harissa, citron et huile d’olive.",
        "ضعي الخبز في الأطباق، واسكبي الشوربة فوقه، وأنهي بالهريسة والليمون وزيت الزيتون.",
      ),
    ],
  },
  {
    slug: "tabbouleh",
    country: "LB",
    course: "side",
    difficulty: "easy",
    servings: 4,
    seasons: ["spring", "summer"],
    dietaryTags: ["vegan", "halal"],
    collections: ["summer_salads", "quick"],
    featured: true,
    name: t("Tabbouleh", "Taboulé libanais", "التبولة"),
    description: t(
      "A parsley salad with a little bulgur, tomato, mint and lemon.",
      "Salade de persil avec un peu de boulgour, tomate, menthe et citron.",
      "سلطة بقدونس مع قليل من البرغل والطماطم والنعناع والليمون.",
    ),
    ingredients: [
      i("parsley", 3, "bunch", FINELY_CHOPPED),
      i("mint", 1, "bunch", FINELY_CHOPPED),
      i("bulgur", 40, "g", t("fine", "fin", "ناعم")),
      i("tomato", 3, "piece", DICED),
      i("onion", 1, "piece", FINELY_CHOPPED),
      i("lemon", 2, "piece", JUICED),
      i("olive-oil", 5, "tbsp"),
      i("salt", null, null),
    ],
    steps: [
      s(
        "Soak the bulgur in the lemon juice.",
        "Faites tremper le boulgour dans le jus de citron.",
        "انقعي البرغل في عصير الليمون.",
        10,
      ),
      s(
        "Mix with the herbs, tomato and onion.",
        "Mélangez avec les herbes, la tomate et l’oignon.",
        "اخلطيه مع الأعشاب والطماطم والبصل.",
      ),
      s(
        "Dress with olive oil and salt just before serving.",
        "Assaisonnez d’huile d’olive et de sel juste avant de servir.",
        "تبّليها بزيت الزيتون والملح قبل التقديم مباشرة.",
      ),
    ],
  },
  {
    slug: "hummus",
    country: "LB",
    course: "appetizer",
    difficulty: "easy",
    servings: 4,
    seasons: [],
    dietaryTags: ["vegan", "halal", "gluten_free"],
    collections: ["quick"],
    name: t("Hummus", "Houmous", "الحمص بالطحينة"),
    description: t(
      "Silky chickpeas blended with tahini, lemon and garlic.",
      "Pois chiches mixés avec tahini, citron et ail, bien onctueux.",
      "حمص ناعم مع الطحينة والليمون والثوم.",
    ),
    ingredients: [
      i("chickpeas", 250, "g", t("cooked", "cuits", "مسلوق")),
      i("tahini", 4, "tbsp"),
      i("lemon", 1, "piece", JUICED),
      i("garlic", 1, "clove"),
      i("olive-oil", 2, "tbsp"),
      i("salt", null, null),
    ],
    steps: [
      s(
        "Blend the warm chickpeas with the tahini, lemon, garlic and a little ice water.",
        "Mixez les pois chiches tièdes avec le tahini, le citron, l’ail et un peu d’eau glacée.",
        "اخلطي الحمص الدافئ مع الطحينة والليمون والثوم وقليل من الماء البارد.",
      ),
      s(
        "Season, spread on a plate and finish with olive oil.",
        "Salez, étalez dans une assiette et arrosez d’huile d’olive.",
        "تبّليه وافرديه في طبق وأنهيه بزيت الزيتون.",
      ),
    ],
  },
  {
    slug: "mouhalabieh",
    country: "LB",
    course: "dessert",
    difficulty: "easy",
    servings: 6,
    seasons: [],
    dietaryTags: ["vegetarian", "gluten_free", "egg_free"],
    collections: ["eid_sweets", "ramadan_iftar"],
    name: t("Mouhalabieh", "Mouhalabié", "المهلبية"),
    description: t(
      "Milk pudding with rose water, topped with pistachios.",
      "Crème au lait à l’eau de rose, parsemée de pistaches.",
      "مهلبية بالحليب وماء الورد مع الفستق.",
    ),
    ingredients: [
      i("milk", 1, "l"),
      i("cornstarch", 6, "tbsp"),
      i("sugar", 100, "g"),
      i("rose-water", 1, "tbsp"),
      i("pistachios", 30, "g", CHOPPED),
    ],
    steps: [
      s(
        "Whisk the cornstarch and sugar into the cold milk.",
        "Délayez la fécule et le sucre dans le lait froid.",
        "اخلطي النشا والسكر في الحليب البارد.",
      ),
      s(
        "Cook, stirring, until it thickens, then add the rose water.",
        "Faites cuire en remuant jusqu’à épaississement, puis ajoutez l’eau de rose.",
        "اطهيه مع التحريك حتى يتكاثف، ثم أضيفي ماء الورد.",
        10,
      ),
      s(
        "Pour into cups, chill and top with pistachios.",
        "Versez dans des coupes, réfrigérez et parsemez de pistaches.",
        "اسكبيه في أكواب، وبرّديه، وزيّنيه بالفستق.",
        120,
      ),
    ],
  },
  {
    slug: "koshari",
    country: "EG",
    course: "main",
    difficulty: "medium",
    servings: 4,
    seasons: [],
    dietaryTags: ["vegan", "halal"],
    collections: [],
    featured: true,
    name: t("Koshari", "Koshari", "الكشري"),
    description: t(
      "Rice, lentils and pasta under a spiced tomato sauce and crispy onions.",
      "Riz, lentilles et pâtes sous une sauce tomate épicée et des oignons croustillants.",
      "أرز وعدس ومعكرونة مع صلصة طماطم متبّلة وبصل مقرمش.",
    ),
    ingredients: [
      i("rice", 200, "g"),
      i("lentils", 150, "g"),
      i("pasta", 150, "g"),
      i("chickpeas", 150, "g", t("cooked", "cuits", "مسلوق")),
      i("onion", 3, "piece", t("thinly sliced", "émincés finement", "مقطع شرائح رفيعة")),
      i("canned-tomatoes", 1, "can"),
      i("garlic", 3, "clove", CHOPPED),
      i("cumin", 1, "tsp"),
      i("vinegar", 2, "tbsp"),
      i("vegetable-oil", 6, "tbsp"),
      i("salt", null, null),
    ],
    steps: [
      s(
        "Fry the onions in the oil until deep golden and crisp; keep the oil.",
        "Faites frire les oignons dans l’huile jusqu’à ce qu’ils soient bien dorés ; gardez l’huile.",
        "اقلي البصل في الزيت حتى يصبح ذهبيًا مقرمشًا، واحتفظي بالزيت.",
        20,
      ),
      s(
        "Cook the lentils, then the rice in the onion oil, and the pasta separately.",
        "Faites cuire les lentilles, puis le riz dans l’huile des oignons, et les pâtes à part.",
        "اسلقي العدس، ثم اطهي الأرز في زيت البصل، والمعكرونة على حدة.",
        25,
      ),
      s(
        "Simmer the tomatoes with garlic, cumin and vinegar into a sauce.",
        "Faites mijoter les tomates avec l’ail, le cumin et le vinaigre.",
        "اطهي الطماطم مع الثوم والكمون والخل حتى تصبح صلصة.",
        15,
      ),
      s(
        "Layer rice, lentils, pasta and chickpeas; top with sauce and onions.",
        "Superposez riz, lentilles, pâtes et pois chiches ; nappez de sauce et d’oignons.",
        "رتّبي الأرز والعدس والمعكرونة والحمص، ثم الصلصة والبصل.",
      ),
    ],
  },
  {
    slug: "ful-medames",
    country: "EG",
    course: "main",
    difficulty: "easy",
    servings: 4,
    seasons: [],
    dietaryTags: ["vegan", "halal", "gluten_free"],
    collections: ["quick", "ramadan_iftar"],
    name: t("Ful medames", "Foul medames", "الفول المدمس"),
    description: t(
      "Warm fava beans with cumin, garlic, lemon and olive oil.",
      "Fèves tièdes au cumin, à l’ail, au citron et à l’huile d’olive.",
      "فول دافئ بالكمون والثوم والليمون وزيت الزيتون.",
    ),
    ingredients: [
      i("fava-beans", 400, "g", t("cooked", "cuites", "مسلوق")),
      i("garlic", 2, "clove", t("crushed", "écrasé", "مهروس")),
      i("cumin", 1, "tsp"),
      i("lemon", 1, "piece", JUICED),
      i("olive-oil", 3, "tbsp"),
      i("parsley", 0.5, "bunch", CHOPPED),
      i("salt", null, null),
    ],
    steps: [
      s(
        "Warm the beans with a splash of water and mash them lightly.",
        "Réchauffez les fèves avec un peu d’eau et écrasez-les légèrement.",
        "سخّني الفول مع قليل من الماء واهرسيه قليلًا.",
        8,
      ),
      s(
        "Stir in the garlic, cumin, lemon and salt; finish with olive oil and parsley.",
        "Ajoutez l’ail, le cumin, le citron et le sel ; terminez avec l’huile et le persil.",
        "أضيفي الثوم والكمون والليمون والملح، وأنهي بالزيت والبقدونس.",
      ),
    ],
  },
  {
    slug: "fattoush",
    country: "SY",
    course: "side",
    difficulty: "easy",
    servings: 4,
    seasons: ["spring", "summer"],
    dietaryTags: ["vegan", "halal"],
    collections: ["summer_salads", "ramadan_iftar"],
    name: t("Fattoush", "Fattouche", "الفتوش"),
    description: t(
      "Crunchy salad with toasted pita, sumac and pomegranate molasses.",
      "Salade croquante au pain pita grillé, sumac et mélasse de grenade.",
      "سلطة مقرمشة بالخبز المحمص والسماق ودبس الرمان.",
    ),
    ingredients: [
      i("pita", 2, "piece", t("toasted and broken", "grillé et cassé", "محمص ومكسر")),
      i("lettuce", 1, "piece", CHOPPED),
      i("tomato", 3, "piece", DICED),
      i("cucumber", 2, "piece", DICED),
      i("mint", 0.5, "bunch", CHOPPED),
      i("sumac", 1, "tbsp"),
      i("pomegranate-molasses", 1, "tbsp"),
      i("lemon", 1, "piece", JUICED),
      i("olive-oil", 4, "tbsp"),
    ],
    steps: [
      s(
        "Whisk the lemon, molasses, olive oil, sumac and salt.",
        "Fouettez citron, mélasse, huile d’olive, sumac et sel.",
        "اخفقي الليمون ودبس الرمان وزيت الزيتون والسماق والملح.",
      ),
      s(
        "Toss the vegetables and mint with the dressing, then add the pita just before serving.",
        "Mélangez légumes et menthe avec la sauce, puis ajoutez le pain au moment de servir.",
        "اخلطي الخضار والنعناع مع الصلصة، وأضيفي الخبز قبل التقديم.",
      ),
    ],
  },
  {
    slug: "maqluba",
    country: "PS",
    course: "main",
    difficulty: "hard",
    servings: 6,
    seasons: ["autumn", "winter"],
    dietaryTags: ["halal", "gluten_free"],
    collections: ["ramadan_iftar"],
    name: t("Maqluba", "Maqlouba", "المقلوبة"),
    description: t(
      "Chicken, fried eggplant and rice cooked together, then turned upside down.",
      "Poulet, aubergines frites et riz cuits ensemble, puis renversés.",
      "دجاج وباذنجان مقلي وأرز يُطهى معًا ثم يُقلب.",
    ),
    ingredients: [
      i("chicken", 1, "kg", t("in pieces", "en morceaux", "مقطع")),
      i("eggplant", 2, "piece", t("sliced", "en tranches", "شرائح")),
      i("cauliflower", 0.5, "piece", t("in florets", "en bouquets", "زهرات")),
      i("rice", 400, "g", t("rinsed", "rincé", "مغسول")),
      i("seven-spices", 2, "tsp"),
      i("turmeric", 1, "tsp"),
      i("vegetable-oil", 6, "tbsp"),
      i("pine-nuts", 30, "g", t("toasted", "grillés", "محمص")),
      i("salt", null, null),
    ],
    steps: [
      s(
        "Simmer the chicken with half the spices in water to make a broth.",
        "Faites cuire le poulet avec la moitié des épices dans l’eau pour obtenir un bouillon.",
        "اسلقي الدجاج مع نصف التوابل في الماء لتحضير المرق.",
        40,
      ),
      s(
        "Fry the eggplant and cauliflower until golden.",
        "Faites frire les aubergines et le chou-fleur jusqu’à ce qu’ils dorent.",
        "اقلي الباذنجان والقرنبيط حتى يتحمّرا.",
        15,
      ),
      s(
        "Layer chicken, vegetables and rice in a pot, pour over the broth and cook covered.",
        "Superposez poulet, légumes et riz, versez le bouillon et faites cuire à couvert.",
        "رتّبي الدجاج والخضار والأرز في القدر، واسكبي المرق واطهيه مغطى.",
        35,
      ),
      s(
        "Rest, turn out onto a large platter and scatter the pine nuts.",
        "Laissez reposer, renversez sur un grand plat et parsemez de pignons.",
        "اتركيها ترتاح، ثم اقلبيها على طبق كبير وزيّنيها بالصنوبر.",
        10,
      ),
    ],
  },
  {
    slug: "red-lentil-soup",
    country: "TR",
    course: "appetizer",
    difficulty: "easy",
    servings: 4,
    seasons: ["autumn", "winter"],
    dietaryTags: ["vegan", "halal", "gluten_free"],
    collections: ["winter_comfort", "ramadan_iftar", "quick"],
    name: t("Red lentil soup", "Soupe de lentilles corail", "شوربة العدس الأحمر"),
    description: t(
      "Turkish mercimek çorbası: smooth, lemony and ready in half an hour.",
      "Mercimek çorbası turque : veloutée, citronnée, prête en une demi-heure.",
      "شوربة عدس تركية ناعمة بالليمون، جاهزة في نصف ساعة.",
    ),
    ingredients: [
      i("red-lentils", 250, "g", t("rinsed", "rincées", "مغسول")),
      i("onion", 1, "piece", CHOPPED),
      i("carrot", 1, "piece", CHOPPED),
      i("tomato-paste", 1, "tbsp"),
      i("cumin", 1, "tsp"),
      i("paprika", 1, "tsp"),
      i("lemon", 1, "piece", t("in wedges", "en quartiers", "مقطع أرباعًا")),
      i("olive-oil", 2, "tbsp"),
      i("salt", null, null),
    ],
    steps: [
      s(
        "Soften the onion and carrot in the oil with the tomato paste and spices.",
        "Faites revenir l’oignon et la carotte dans l’huile avec le concentré et les épices.",
        "شوّحي البصل والجزر في الزيت مع معجون الطماطم والتوابل.",
        5,
      ),
      s(
        "Add the lentils and 1.2 litres of water and simmer until soft.",
        "Ajoutez les lentilles et 1,2 litre d’eau et laissez cuire jusqu’à ce qu’elles soient fondantes.",
        "أضيفي العدس و1.2 لتر من الماء واتركيه حتى ينضج.",
        20,
      ),
      s(
        "Blend until smooth and serve with lemon.",
        "Mixez jusqu’à obtenir une soupe lisse et servez avec du citron.",
        "اخلطيها حتى تصبح ناعمة وقدّميها مع الليمون.",
      ),
    ],
  },
  {
    slug: "ratatouille",
    country: "FR",
    course: "side",
    difficulty: "medium",
    servings: 4,
    seasons: ["summer"],
    dietaryTags: ["vegan", "gluten_free", "halal"],
    collections: [],
    name: t("Ratatouille", "Ratatouille", "الراتاتوي"),
    description: t(
      "Provençal summer vegetables slowly stewed in olive oil.",
      "Légumes d’été provençaux mijotés à l’huile d’olive.",
      "خضار الصيف البروفنسية مطهوة ببطء في زيت الزيتون.",
    ),
    ingredients: [
      i("eggplant", 1, "piece", DICED),
      i("zucchini", 2, "piece", DICED),
      i("bell-pepper", 2, "piece", DICED),
      i("tomato", 4, "piece", DICED),
      i("onion", 1, "piece", CHOPPED),
      i("garlic", 3, "clove", CHOPPED),
      i("thyme", 1, "tsp"),
      i("olive-oil", 5, "tbsp"),
      i("salt", null, null),
    ],
    steps: [
      s(
        "Brown each vegetable separately in olive oil.",
        "Faites dorer chaque légume séparément à l’huile d’olive.",
        "حمّري كل نوع من الخضار على حدة في زيت الزيتون.",
        20,
      ),
      s(
        "Combine everything with the garlic, thyme and tomatoes, then simmer gently.",
        "Réunissez le tout avec l’ail, le thym et les tomates, puis laissez mijoter.",
        "اجمعي كل شيء مع الثوم والزعتر والطماطم واتركيه على نار هادئة.",
        40,
      ),
    ],
  },
  {
    slug: "crepes",
    country: "FR",
    course: "dessert",
    difficulty: "easy",
    servings: 4,
    seasons: [],
    dietaryTags: ["vegetarian"],
    collections: ["quick"],
    name: t("Crêpes", "Crêpes", "الكريب"),
    description: t(
      "Thin French pancakes for sugar, jam or chocolate.",
      "Fines crêpes à garnir de sucre, de confiture ou de chocolat.",
      "فطائر فرنسية رقيقة مع السكر أو المربى أو الشوكولاتة.",
    ),
    ingredients: [
      i("flour", 250, "g"),
      i("egg", 3, "piece"),
      i("milk", 500, "ml"),
      i("butter", 30, "g", t("melted", "fondu", "مذاب")),
      i("sugar", 1, "tbsp"),
      i("salt", 1, "pinch"),
    ],
    steps: [
      s(
        "Whisk the flour, sugar, salt and eggs, then add the milk little by little.",
        "Fouettez farine, sucre, sel et œufs, puis ajoutez le lait petit à petit.",
        "اخفقي الطحين والسكر والملح والبيض، ثم أضيفي الحليب تدريجيًا.",
      ),
      s(
        "Stir in the melted butter and let the batter rest.",
        "Ajoutez le beurre fondu et laissez reposer la pâte.",
        "أضيفي الزبدة المذابة واتركي العجينة ترتاح.",
        30,
      ),
      s(
        "Cook thin crêpes in a hot buttered pan, about a minute per side.",
        "Faites cuire de fines crêpes dans une poêle chaude beurrée, une minute de chaque côté.",
        "اطهي كريبًا رقيقًا في مقلاة ساخنة مدهونة، دقيقة لكل جهة.",
      ),
    ],
  },
  {
    slug: "spaghetti-aglio-olio",
    country: "IT",
    course: "main",
    difficulty: "easy",
    servings: 2,
    seasons: [],
    dietaryTags: ["vegan", "halal"],
    collections: ["quick"],
    name: t("Spaghetti aglio e olio", "Spaghettis ail et huile", "سباغيتي بالثوم والزيت"),
    description: t(
      "Spaghetti with garlic, olive oil, chili and parsley: dinner in 15 minutes.",
      "Spaghettis à l’ail, à l’huile d’olive, au piment et au persil : prêts en 15 minutes.",
      "سباغيتي بالثوم وزيت الزيتون والفلفل الحار والبقدونس، جاهزة في 15 دقيقة.",
    ),
    ingredients: [
      i("spaghetti", 200, "g"),
      i("garlic", 4, "clove", t("thinly sliced", "émincé finement", "شرائح رفيعة")),
      i("chili-pepper", 1, "piece", CHOPPED),
      i("olive-oil", 5, "tbsp"),
      i("parsley", 0.5, "bunch", CHOPPED),
      i("salt", null, null),
    ],
    steps: [
      s(
        "Cook the spaghetti in salted boiling water.",
        "Faites cuire les spaghettis dans l’eau bouillante salée.",
        "اسلقي السباغيتي في ماء مغلي مملّح.",
        9,
      ),
      s(
        "Gently fry the garlic and chili in the oil until just golden.",
        "Faites revenir doucement l’ail et le piment dans l’huile jusqu’à ce qu’ils blondissent.",
        "حمّري الثوم والفلفل الحار في الزيت على نار هادئة حتى يذهبّا قليلًا.",
        3,
      ),
      s(
        "Toss the pasta with the oil, a splash of pasta water and the parsley.",
        "Mélangez les pâtes avec l’huile, un peu d’eau de cuisson et le persil.",
        "اخلطي المعكرونة مع الزيت وقليل من ماء السلق والبقدونس.",
      ),
    ],
  },
  {
    slug: "gazpacho",
    country: "ES",
    course: "appetizer",
    difficulty: "easy",
    servings: 4,
    seasons: ["summer"],
    dietaryTags: ["vegan", "halal"],
    collections: ["summer_salads", "quick"],
    name: t("Gazpacho", "Gaspacho", "الغازباتشو"),
    description: t(
      "Chilled Andalusian tomato soup with cucumber and pepper.",
      "Soupe andalouse glacée à la tomate, au concombre et au poivron.",
      "شوربة طماطم أندلسية باردة مع الخيار والفلفل.",
    ),
    ingredients: [
      i("tomato", 1, "kg", t("ripe", "bien mûres", "ناضجة")),
      i("cucumber", 1, "piece"),
      i("bell-pepper", 1, "piece"),
      i("garlic", 1, "clove"),
      i("bread", 1, "slice"),
      i("vinegar", 2, "tbsp"),
      i("olive-oil", 5, "tbsp"),
      i("salt", null, null),
    ],
    steps: [
      s(
        "Blend everything until very smooth.",
        "Mixez le tout jusqu’à obtenir une texture très lisse.",
        "اخلطي جميع المكونات حتى تصبح ناعمة جدًا.",
      ),
      s(
        "Season and chill well before serving.",
        "Assaisonnez et réfrigérez bien avant de servir.",
        "تبّليها وبرّديها جيدًا قبل التقديم.",
        120,
      ),
    ],
  },
  {
    slug: "chana-masala",
    country: "IN",
    course: "main",
    difficulty: "easy",
    servings: 4,
    seasons: ["autumn", "winter"],
    dietaryTags: ["vegan", "halal", "gluten_free"],
    collections: ["winter_comfort"],
    name: t("Chana masala", "Chana masala", "تشانا ماسالا"),
    description: t(
      "Chickpeas simmered in a spiced tomato and onion gravy.",
      "Pois chiches mijotés dans une sauce épicée à la tomate et à l’oignon.",
      "حمص مطهو في صلصة بصل وطماطم متبّلة.",
    ),
    ingredients: [
      i("chickpeas", 500, "g", t("cooked", "cuits", "مسلوق")),
      i("onion", 2, "piece", FINELY_CHOPPED),
      i("canned-tomatoes", 1, "can"),
      i("garlic", 3, "clove", CHOPPED),
      i("ginger", 1, "tsp"),
      i("cumin", 1, "tsp"),
      i("turmeric", 1, "tsp"),
      i("ground-coriander", 2, "tsp"),
      i("vegetable-oil", 3, "tbsp"),
      i("coriander", 0.5, "bunch", CHOPPED),
      i("salt", null, null),
    ],
    steps: [
      s(
        "Cook the onions in the oil until deep golden.",
        "Faites dorer les oignons dans l’huile.",
        "حمّري البصل في الزيت حتى يصبح ذهبيًا داكنًا.",
        12,
      ),
      s(
        "Add the garlic, ginger and spices, then the tomatoes, and cook into a thick sauce.",
        "Ajoutez l’ail, le gingembre et les épices, puis les tomates, et laissez épaissir.",
        "أضيفي الثوم والزنجبيل والتوابل ثم الطماطم حتى تتكاثف الصلصة.",
        10,
      ),
      s(
        "Add the chickpeas and a little water, simmer, and finish with coriander.",
        "Ajoutez les pois chiches et un peu d’eau, laissez mijoter et terminez avec la coriandre.",
        "أضيفي الحمص وقليلًا من الماء، واتركيه على نار هادئة، وأنهي بالكزبرة.",
        15,
      ),
    ],
  },
  {
    slug: "guacamole",
    country: "MX",
    course: "appetizer",
    difficulty: "easy",
    servings: 4,
    seasons: [],
    dietaryTags: ["vegan", "halal", "gluten_free"],
    collections: ["quick", "summer_salads"],
    name: t("Guacamole", "Guacamole", "الغواكامولي"),
    description: t(
      "Avocado mashed with lime, onion, chili and coriander.",
      "Avocat écrasé au citron vert, à l’oignon, au piment et à la coriandre.",
      "أفوكادو مهروس مع الليمون الأخضر والبصل والفلفل الحار والكزبرة.",
    ),
    ingredients: [
      i("avocado", 3, "piece"),
      i("lime", 1, "piece", JUICED),
      i("red-onion", 0.5, "piece", FINELY_CHOPPED),
      i("chili-pepper", 1, "piece", FINELY_CHOPPED),
      i("coriander", 0.5, "bunch", CHOPPED),
      i("salt", null, null),
    ],
    steps: [
      s(
        "Mash the avocados with the lime juice, leaving some chunks.",
        "Écrasez les avocats avec le jus de citron vert en gardant quelques morceaux.",
        "اهرسي الأفوكادو مع عصير الليمون مع ترك بعض القطع.",
      ),
      s(
        "Fold in the onion, chili, coriander and salt.",
        "Incorporez l’oignon, le piment, la coriandre et le sel.",
        "أضيفي البصل والفلفل الحار والكزبرة والملح.",
      ),
    ],
  },
  {
    slug: "greek-salad",
    country: "GR",
    course: "side",
    difficulty: "easy",
    servings: 4,
    seasons: ["summer"],
    dietaryTags: ["vegetarian", "halal", "gluten_free"],
    collections: ["summer_salads", "quick"],
    name: t("Greek salad", "Salade grecque", "السلطة اليونانية"),
    description: t(
      "Tomato, cucumber, onion, olives and feta with oregano and olive oil.",
      "Tomate, concombre, oignon, olives et feta à l’origan et à l’huile d’olive.",
      "طماطم وخيار وبصل وزيتون وجبنة فيتا مع الزعتر وزيت الزيتون.",
    ),
    ingredients: [
      i("tomato", 4, "piece", t("in wedges", "en quartiers", "مقطع أرباعًا")),
      i("cucumber", 1, "piece", t("in thick slices", "en rondelles épaisses", "شرائح سميكة")),
      i("red-onion", 1, "piece", t("thinly sliced", "émincé finement", "شرائح رفيعة")),
      i("olives", 80, "g"),
      i("feta", 200, "g"),
      i("thyme", 1, "tsp"),
      i("olive-oil", 4, "tbsp"),
    ],
    steps: [
      s(
        "Arrange the vegetables and olives in a bowl.",
        "Disposez les légumes et les olives dans un saladier.",
        "رتّبي الخضار والزيتون في وعاء.",
      ),
      s(
        "Top with the feta, sprinkle the herbs and pour over the olive oil.",
        "Posez la feta, parsemez d’herbes et arrosez d’huile d’olive.",
        "ضعي الفيتا فوقها، ورشّي الأعشاب، واسكبي زيت الزيتون.",
      ),
    ],
  },
  {
    slug: "couscous-seven-vegetables",
    country: "MA",
    course: "main",
    difficulty: "hard",
    servings: 6,
    seasons: ["autumn", "winter"],
    dietaryTags: ["halal", "dairy_free"],
    collections: ["winter_comfort"],
    featured: true,
    name: t("Couscous with seven vegetables", "Couscous aux sept légumes", "الكسكس بالخضار السبع"),
    description: t(
      "Friday couscous: steamed semolina under a lamb and vegetable broth.",
      "Le couscous du vendredi : semoule vapeur sous un bouillon d’agneau et de légumes.",
      "كسكس الجمعة: سميد مفوّر مع مرق اللحم والخضار.",
    ),
    ingredients: [
      i("couscous", 500, "g"),
      i("lamb", 600, "g", t("in pieces", "en morceaux", "مقطع")),
      i("carrot", 3, "piece"),
      i("zucchini", 2, "piece"),
      i("pumpkin", 300, "g"),
      i("cabbage", 0.25, "piece"),
      i("tomato", 2, "piece"),
      i("onion", 2, "piece"),
      i("chickpeas", 100, "g", SOAKED),
      i("ras-el-hanout", 2, "tsp"),
      i("butter", 30, "g"),
      i("salt", null, null),
    ],
    steps: [
      s(
        "Brown the lamb with the onions and spices, add the chickpeas and water, and simmer.",
        "Faites revenir l’agneau avec les oignons et les épices, ajoutez pois chiches et eau, laissez mijoter.",
        "حمّري اللحم مع البصل والتوابل، وأضيفي الحمص والماء واتركيه على نار هادئة.",
        45,
      ),
      s(
        "Add the hard vegetables first, then the soft ones, until all are tender.",
        "Ajoutez d’abord les légumes fermes, puis les tendres, jusqu’à ce que tout soit fondant.",
        "أضيفي الخضار الصلبة أولًا ثم الطرية حتى تنضج كلها.",
        30,
      ),
      s(
        "Steam the couscous over the broth twice, working in the butter between steamings.",
        "Faites cuire le couscous à la vapeur du bouillon deux fois, en ajoutant le beurre entre les deux.",
        "فوّري الكسكس فوق المرق مرتين، وأضيفي الزبدة بينهما.",
        30,
      ),
      s(
        "Mound the couscous, arrange the meat and vegetables on top and pour over broth.",
        "Dressez le couscous en dôme, disposez viande et légumes et arrosez de bouillon.",
        "ضعي الكسكس على شكل قبة، ورتّبي فوقه اللحم والخضار، واسقيه بالمرق.",
      ),
    ],
  },
  {
    slug: "zaalouk",
    country: "MA",
    course: "side",
    difficulty: "easy",
    servings: 4,
    seasons: ["summer", "autumn"],
    dietaryTags: ["vegan", "halal", "gluten_free"],
    collections: ["summer_salads"],
    name: t("Zaalouk", "Zaalouk", "الزعلوك"),
    description: t(
      "Smoky eggplant and tomato salad with cumin and paprika.",
      "Salade fumée d’aubergines et de tomates au cumin et au paprika.",
      "سلطة باذنجان وطماطم مدخنة بالكمون والفلفل الأحمر.",
    ),
    ingredients: [
      i("eggplant", 2, "piece"),
      i("tomato", 3, "piece", t("peeled and chopped", "pelées et hachées", "مقشرة ومفرومة")),
      i("garlic", 2, "clove", CHOPPED),
      i("cumin", 1, "tsp"),
      i("paprika", 1, "tsp"),
      i("coriander", 0.5, "bunch", CHOPPED),
      i("olive-oil", 3, "tbsp"),
      i("salt", null, null),
    ],
    steps: [
      s(
        "Char the eggplants over a flame or under the grill, then peel and chop.",
        "Grillez les aubergines sur la flamme ou au four, puis pelez-les et hachez-les.",
        "اشوي الباذنجان على اللهب أو في الفرن، ثم قشريه وافرميه.",
        15,
      ),
      s(
        "Cook with the tomatoes, garlic, spices and oil until thick, then add coriander.",
        "Faites cuire avec tomates, ail, épices et huile jusqu’à épaississement, puis ajoutez la coriandre.",
        "اطهيه مع الطماطم والثوم والتوابل والزيت حتى يتكاثف، ثم أضيفي الكزبرة.",
        15,
      ),
    ],
  },
];

if (process.argv[1]?.includes("seed-catalog")) {
  const { eq, inArray } = await import("drizzle-orm");
  const { getDb } = await import("../src/server/db/client");
  const { catalogDishes, catalogIngredients, catalogSteps, ingredients } = await import("../src/server/db/schema");
  const { getCuratedDishPhoto } = await import("../src/lib/curated-dishes");
  const db = getDb();
  const staples = await db.select().from(ingredients);
  const bySlug = new Map(staples.map((row) => [row.slug, row]));

  for (const entry of CATALOG) {
    await db.transaction(async (tx) => {
      const values = {
        slug: entry.slug,
        country: entry.country,
        course: entry.course,
        difficulty: entry.difficulty,
        servings: entry.servings,
        seasons: entry.seasons,
        dietaryTags: entry.dietaryTags,
        collections: entry.collections,
        featured: entry.featured ?? false,
        photoUrl: getCuratedDishPhoto(entry.slug) ?? null,
        source: "curated",
        nameEn: entry.name.en,
        nameFr: entry.name.fr,
        nameAr: entry.name.ar,
        descriptionEn: entry.description.en,
        descriptionFr: entry.description.fr,
        descriptionAr: entry.description.ar,
      };
      const [row] = await tx
        .insert(catalogDishes)
        .values(values)
        .onConflictDoUpdate({ target: catalogDishes.slug, set: { ...values, updatedAt: new Date() } })
        .returning({ id: catalogDishes.id });
      const dishId = row!.id;
      await tx.delete(catalogIngredients).where(eq(catalogIngredients.catalogDishId, dishId));
      await tx.delete(catalogSteps).where(eq(catalogSteps.catalogDishId, dishId));
      await tx.insert(catalogIngredients).values(
        entry.ingredients.map((ing, position) => {
          const staple = ing.staple ? bySlug.get(ing.staple) : undefined;
          if (ing.staple && !staple)
            throw new Error(`${entry.slug}: unknown staple "${ing.staple}" (run db:seed:ingredients)`);
          const names = staple ? { en: staple.nameEn, fr: staple.nameFr, ar: staple.nameAr } : ing.names!;
          return {
            catalogDishId: dishId,
            position,
            amount: ing.amount,
            unit: ing.unit,
            ingredientId: staple?.id ?? null,
            nameEn: names.en,
            nameFr: names.fr,
            nameAr: names.ar,
            noteEn: ing.note?.en ?? null,
            noteFr: ing.note?.fr ?? null,
            noteAr: ing.note?.ar ?? null,
          };
        }),
      );
      await tx.insert(catalogSteps).values(
        entry.steps.map((step, position) => ({
          catalogDishId: dishId,
          position,
          textEn: step.text.en,
          textFr: step.text.fr,
          textAr: step.text.ar,
          timerSeconds: step.minutes ? step.minutes * 60 : null,
        })),
      );
    });
  }
  // Dishes removed from this list leave the catalog (saved copies keep their own text).
  const keep = CATALOG.map((e) => e.slug);
  const all = await db.select({ slug: catalogDishes.slug, source: catalogDishes.source }).from(catalogDishes);
  const stale = all.filter((r) => r.source === "curated" && !keep.includes(r.slug)).map((r) => r.slug);
  if (stale.length > 0) await db.delete(catalogDishes).where(inArray(catalogDishes.slug, stale));
  console.log(`Seeded ${CATALOG.length} catalog dishes.`);
  process.exit(0);
}
