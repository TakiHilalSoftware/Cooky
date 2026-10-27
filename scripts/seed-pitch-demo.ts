/**
 * Seeds the demo user "Amina" (amina@demo.cooky) in cooky_dev database
 * with rich, realistic pitch data for the 45-second "Belief Machine" demo.
 *
 * Run with:
 *   pnpm tsx --tsconfig scripts/tsconfig.json scripts/seed-pitch-demo.ts
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // Environment variables already in process.env
}

export {};

export const DEMO_EMAIL = "amina@demo.cooky";
export const DEMO_NAME = "Amina";
export const DEMO_PASSWORD = "Journey kitchen password 42";

const { and, eq } = await import("drizzle-orm");
const { getDb } = await import("../src/server/db/client");
const {
  assistantMessages,
  assistantThreads,
  dishes,
  dishSteps,
  entitlements,
  pantryItems,
  profiles,
  shoppingItems,
  shoppingLists,
  user,
} = await import("../src/server/db/schema");
const { auth } = await import("../src/server/auth/auth");
const { saveCatalogCopy } = await import("../src/server/features/discover/write");
const { addToPantry } = await import("../src/server/features/kitchen/write");

export async function seedPitchDemoUser(): Promise<{ userId: string }> {
  const db = getDb();

  let userId: string;
  const [existingUser] = await db.select({ id: user.id }).from(user).where(eq(user.email, DEMO_EMAIL)).limit(1);

  if (existingUser) {
    console.log(`[seed] Reusing existing user ${DEMO_EMAIL} (id: ${existingUser.id}) to preserve active sessions...`);
    userId = existingUser.id;
    // Clean up previous demo state to reset fresh
    await db.delete(dishes).where(eq(dishes.userId, userId));
    await db.delete(pantryItems).where(eq(pantryItems.userId, userId));
    await db.delete(shoppingLists).where(eq(shoppingLists.ownerId, userId));
    await db.delete(assistantThreads).where(eq(assistantThreads.userId, userId));
  } else {
    console.log(`[seed] Creating user ${DEMO_EMAIL}...`);
    // Better Auth handles password hashing and account record creation.
    await auth.api.signUpEmail({
      body: {
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        name: DEMO_NAME,
      },
    });

    const [createdUser] = await db.select({ id: user.id }).from(user).where(eq(user.email, DEMO_EMAIL)).limit(1);
    if (!createdUser) {
      throw new Error(`Failed to create demo user ${DEMO_EMAIL}`);
    }
    userId = createdUser.id;
    await db.update(user).set({ emailVerified: true }).where(eq(user.id, userId));
  }

  // Update profile with Algiers coordinates and full onboarding.
  console.log(`[seed] Updating profile for ${DEMO_NAME} in Algiers...`);
  await db
    .insert(profiles)
    .values({
      userId,
      displayName: DEMO_NAME,
      locale: "en",
      city: "Algiers",
      latitude: 36.75,
      longitude: 3.06,
      onboardedAt: new Date(),
      dietaryPrefs: ["halal"],
    })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: {
        displayName: DEMO_NAME,
        locale: "en",
        city: "Algiers",
        latitude: 36.75,
        longitude: 3.06,
        onboardedAt: new Date(),
        dietaryPrefs: ["halal"],
      },
    });

  // Grant Pro plan comp so no quotas interfere during pitch recording.
  console.log(`[seed] Granting Pro entitlement to ${DEMO_NAME}...`);
  await db
    .insert(entitlements)
    .values({
      userId,
      plan: "pro",
      source: "comp",
      periodStart: new Date(),
    })
    .onConflictDoUpdate({
      target: entitlements.userId,
      set: { plan: "pro", source: "comp", periodStart: new Date() },
    });

  // Save 5 visually rich catalog dishes.
  console.log(`[seed] Saving catalog dishes into recipe box...`);
  const catalogSlugs = [
    "chicken-tagine-preserved-lemon",
    "shakshuka",
    "hummus",
    "chorba-frik",
    "couscous-seven-vegetables",
  ] as const;

  const savedDishMap = new Map<string, string>();
  for (const slug of catalogSlugs) {
    const res = await saveCatalogCopy(userId, slug, "en");
    if ("dishId" in res) {
      savedDishMap.set(slug, res.dishId);
      console.log(`  - Saved ${slug} (id: ${res.dishId})`);
    } else {
      console.warn(`  - Could not save ${slug}: ${res.status}`);
    }
  }

  const tagineDishId = savedDishMap.get("chicken-tagine-preserved-lemon");
  const shakshukaDishId = savedDishMap.get("shakshuka");
  if (!tagineDishId || !shakshukaDishId) {
    throw new Error("Failed to save required dishes (tagine or shakshuka).");
  }

  // Ensure step 1 of chicken tagine has a 5-minute timer so Cooking Mode has a timer immediately on screen 1.
  await db
    .update(dishSteps)
    .set({ timerSeconds: 300 })
    .where(and(eq(dishSteps.dishId, tagineDishId), eq(dishSteps.position, 0)));

  // Populate pantry items:
  console.log(`[seed] Populating pantry items...`);
  // Staples
  await addToPantry(userId, ["Olive oil", "Salt", "Garlic", "Black pepper", "Cumin"], true);

  // Ingredients for Shakshuka & Hummus (all present -> Ready to cook)
  // Ingredients for Tagine (all present EXCEPT chicken -> 1 missing!)
  await addToPantry(
    userId,
    [
      "Eggs",
      "Tomato",
      "Bell pepper",
      "Onion",
      "Harissa",
      "Chickpeas",
      "Tahini",
      "Lemon",
      "Ginger",
      "Turmeric",
      "Saffron",
      "Preserved lemon",
      "Olives",
      "Coriander",
      "Carrot",
      "Zucchini",
    ],
    false,
  );

  // Create active shopping list with 7 items across 3 aisles (2 checked).
  console.log(`[seed] Creating active shopping list...`);
  const [list] = await db
    .insert(shoppingLists)
    .values({ ownerId: userId, version: 1 })
    .onConflictDoUpdate({ target: shoppingLists.ownerId, set: { version: 1 } })
    .returning();

  await db.delete(shoppingItems).where(eq(shoppingItems.listId, list!.id));

  await db.insert(shoppingItems).values([
    // Produce aisle
    {
      listId: list!.id,
      name: "Fresh coriander",
      key: "coriander",
      unitFamily: "bunch",
      amount: 1,
      unit: "bunch",
      aisle: "produce",
      checked: false,
      sourceDishIds: [tagineDishId],
      manual: false,
    },
    {
      listId: list!.id,
      name: "Lemons",
      key: "lemon",
      unitFamily: "piece",
      amount: 3,
      unit: "piece",
      aisle: "produce",
      checked: false,
      sourceDishIds: [],
      manual: false,
    },
    {
      listId: list!.id,
      name: "Potatoes",
      key: "potato",
      unitFamily: "mass",
      amount: 1.5,
      unit: "kg",
      aisle: "produce",
      checked: false,
      sourceDishIds: [],
      manual: false,
    },
    // Meat & fish aisle
    {
      listId: list!.id,
      name: "Whole chicken",
      key: "chicken",
      unitFamily: "mass",
      amount: 1.2,
      unit: "kg",
      aisle: "meat_fish",
      checked: false,
      sourceDishIds: [tagineDishId],
      manual: false,
    },
    {
      listId: list!.id,
      name: "Lamb shoulder",
      key: "lamb",
      unitFamily: "mass",
      amount: 500,
      unit: "g",
      aisle: "meat_fish",
      checked: true,
      checkedAt: new Date(),
      sourceDishIds: [],
      manual: false,
    },
    // Dairy & eggs aisle
    {
      listId: list!.id,
      name: "Greek yogurt",
      key: "yogurt",
      unitFamily: "mass",
      amount: 400,
      unit: "g",
      aisle: "dairy_eggs",
      checked: false,
      sourceDishIds: [],
      manual: false,
    },
    {
      listId: list!.id,
      name: "Butter",
      key: "butter",
      unitFamily: "mass",
      amount: 250,
      unit: "g",
      aisle: "dairy_eggs",
      checked: true,
      checkedAt: new Date(),
      sourceDishIds: [],
      manual: false,
    },
  ]);

  // Create assistant sample conversation with 2 dish pick cards.
  console.log(`[seed] Creating assistant thread and messages...`);
  const [thread] = await db
    .insert(assistantThreads)
    .values({
      userId,
      title: "What can I cook with what's in my kitchen?",
      createdAt: new Date(Date.now() - 3600_000),
      updatedAt: new Date(),
    })
    .returning();

  await db.insert(assistantMessages).values([
    {
      threadId: thread!.id,
      role: "user",
      content: "What can I cook tonight with what's in my kitchen? Something warm and comforting.",
      picks: [],
      createdAt: new Date(Date.now() - 3600_000),
    },
    {
      threadId: thread!.id,
      role: "assistant",
      content:
        "Based on your kitchen, you have everything needed for a fragrant Shakshuka or silky Hummus right now! If you pick up chicken on your way home, a slow-simmered Chicken Tagine with preserved lemon and olives is also a wonderful match for tonight.",
      picks: [
        {
          kind: "mine",
          dishId: shakshukaDishId,
          why: "Ready to cook: you have fresh eggs, tomatoes, bell peppers, and spices ready in your pantry.",
        },
        {
          kind: "mine",
          dishId: tagineDishId,
          why: "Only 1 ingredient away: you have all spices, lemon and olives; just grab chicken.",
        },
      ],
      tokensIn: 145,
      tokensOut: 92,
      createdAt: new Date(Date.now() - 3500_000),
    },
  ]);

  console.log(`[seed] Demo user setup complete for ${DEMO_EMAIL} (id: ${userId})`);
  return { userId };
}

if (process.argv[1]?.endsWith("seed-pitch-demo.ts")) {
  seedPitchDemoUser()
    .then(() => {
      console.log("Finished successfully!");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seeding failed:", err);
      process.exit(1);
    });
}
