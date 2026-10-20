import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DishCover } from "./dish-cover";

describe("DishCover", () => {
  it("shows the photo when there is one, decorative and lazy", () => {
    const { container } = render(<DishCover photoUrl="https://r2.example/x.webp" course="main" seed="a" />);
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("src", "https://r2.example/x.webp");
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("without a photo, lays a hidden zellige tile in the course's colours", () => {
    const { container } = render(<DishCover photoUrl={null} course="dessert" seed="ghriba" />);
    const tile = container.firstElementChild!;
    expect(tile).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("img")).toBeNull();
    const ground = container.querySelector("pattern rect")!;
    expect(ground.getAttribute("class")).toContain("fill-primary");
  });

  it("offsets the tiles per dish, the same way every time", () => {
    const x = (seed: string) =>
      render(<DishCover photoUrl={null} course="main" seed={seed} />)
        .container.querySelector("pattern")!
        .getAttribute("x");
    expect(x("tagine")).toBe(x("tagine"));
    expect(new Set(["tagine", "harira", "couscous", "zaalouk"].map(x)).size).toBeGreaterThan(1);
  });
});
