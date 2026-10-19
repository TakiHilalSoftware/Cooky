import { describe, expect, it } from "vitest";

import { pageText } from "./ai-recipe";

describe("pageText", () => {
  it("keeps the readable text and drops scripts, styles and navigation", () => {
    const html = `<html><head><style>p{color:red}</style><script>track()</script></head><body>
      <nav>Home · Recipes</nav><h1>Mint tea</h1><p>Serves&nbsp;4</p><ul><li>1 tbsp green tea</li><li>Fresh mint &amp; sugar</li></ul>
      <footer>© Site</footer></body></html>`;
    expect(pageText(html)).toBe("Mint tea\n Serves 4\n 1 tbsp green tea\n Fresh mint & sugar");
  });

  it("caps very long pages", () => {
    expect(pageText(`<p>${"word ".repeat(10_000)}</p>`).length).toBe(12_000);
  });
});
