import { describe, expect, it } from "vitest";

import { extractRecipe } from "./recipe";

const url = new URL("https://www.example-recipes.com/harira");
const page = (jsonLd: unknown, head = "") =>
  `<html><head>${head}<script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head><body></body></html>`;

describe("extractRecipe", () => {
  it("reads a schema.org Recipe: name, servings, parsed ingredients and HowToSteps", () => {
    const recipe = extractRecipe(
      page(
        {
          "@context": "https://schema.org",
          "@type": "Recipe",
          name: "Harira &amp; dates",
          description: "<p>A Moroccan soup.</p>",
          recipeYield: ["6", "6 servings"],
          recipeIngredient: ["250 g lamb, diced", "1 cup lentils", "Salt, to taste"],
          recipeInstructions: [
            { "@type": "HowToStep", text: "Brown the lamb." },
            { "@type": "HowToStep", text: "Add the lentils and simmer." },
          ],
        },
        '<meta property="og:site_name" content="Example Recipes">',
      ),
      url,
    );
    expect(recipe).toEqual({
      name: "Harira & dates",
      description: "A Moroccan soup.",
      servings: 6,
      ingredients: [
        { amount: 250, unit: "g", name: "lamb", note: "diced" },
        { amount: 1, unit: "cup", name: "lentils", note: null },
        { amount: null, unit: null, name: "Salt", note: null },
      ],
      steps: ["Brown the lamb.", "Add the lentils and simmer."],
      siteName: "Example Recipes",
      imageUrl: null,
    });
  });

  it.each([
    ["a plain URL", "https://cdn.example.com/harira.jpg", "https://cdn.example.com/harira.jpg"],
    ["a relative path", "/img/harira.jpg", "https://www.example-recipes.com/img/harira.jpg"],
    [
      "a list of ImageObjects",
      [{ "@type": "ImageObject", url: "https://cdn.example.com/a.jpg" }],
      "https://cdn.example.com/a.jpg",
    ],
    [
      "a non-web link first",
      ["data:image/png;base64,AAAA", "https://cdn.example.com/b.jpg"],
      "https://cdn.example.com/b.jpg",
    ],
    ["nothing usable", [{ "@type": "ImageObject" }, "javascript:alert(1)"], null],
  ])("takes the photo from %s", (_, image, expected) => {
    const recipe = extractRecipe(
      page({ "@type": "Recipe", name: "Harira", recipeIngredient: ["1 cup lentils"], image }),
      url,
    );
    expect(recipe?.imageUrl).toBe(expected);
  });

  it("finds the recipe inside @graph, with @type as a list and sections of steps", () => {
    const recipe = extractRecipe(
      page({
        "@graph": [
          { "@type": "WebSite", name: "Site" },
          {
            "@type": ["Recipe", "NewsArticle"],
            name: "Tagine",
            recipeYield: "Serves 4",
            recipeIngredient: ["1 chicken"],
            recipeInstructions: [
              {
                "@type": "HowToSection",
                name: "Sauce",
                itemListElement: [{ "@type": "HowToStep", text: "Make the sauce." }],
              },
              {
                "@type": "HowToSection",
                name: "Finish",
                itemListElement: [{ "@type": "HowToStep", text: "Serve hot." }],
              },
            ],
          },
        ],
      }),
      url,
    );
    expect(recipe).toMatchObject({ name: "Tagine", servings: 4, steps: ["Make the sauce.", "Serve hot."] });
    // No og:site_name: the host name, without www.
    expect(recipe?.siteName).toBe("example-recipes.com");
  });

  it("splits instructions given as one paragraph into steps", () => {
    const recipe = extractRecipe(
      page({
        "@type": "Recipe",
        name: "Tea",
        recipeIngredient: ["Tea"],
        recipeInstructions: "Boil water. Add the tea. Serve.",
      }),
      url,
    );
    expect(recipe?.steps).toEqual(["Boil water.", "Add the tea.", "Serve."]);
  });

  it("skips a broken JSON-LD block and reads the next one", () => {
    const html =
      '<script type="application/ld+json">{ not json </script>' +
      `<script type="application/ld+json">${JSON.stringify({ "@type": "Recipe", name: "Soup", recipeIngredient: ["Water"] })}</script>`;
    expect(extractRecipe(html, url)?.name).toBe("Soup");
  });

  it("returns null when the page publishes no recipe (or one without ingredients)", () => {
    expect(extractRecipe("<html><body>No recipe here</body></html>", url)).toBeNull();
    expect(extractRecipe(page({ "@type": "Article", name: "News" }), url)).toBeNull();
    expect(extractRecipe(page({ "@type": "Recipe", name: "Empty", recipeIngredient: [] }), url)).toBeNull();
  });

  it("caps what it takes to the dish form's limits", () => {
    const recipe = extractRecipe(
      page({
        "@type": "Recipe",
        name: "x".repeat(300),
        recipeYield: "400",
        recipeIngredient: Array.from({ length: 150 }, (_, i) => `${i} g thing`),
        recipeInstructions: Array.from({ length: 80 }, (_, i) => `Step ${i}.`),
      }),
      url,
    );
    expect(recipe?.name).toHaveLength(120);
    expect(recipe?.servings).toBe(100);
    expect(recipe?.ingredients).toHaveLength(100);
    expect(recipe?.steps).toHaveLength(60);
  });
});
