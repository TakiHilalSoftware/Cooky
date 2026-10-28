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
    expect(container.querySelector("[data-cover]")).toBeNull();
  });

  it("without a photo, shows one hidden illustration of the course in its colours", () => {
    const { container } = render(<DishCover photoUrl={null} course="dessert" seed="ghriba" />);
    const cover = container.firstElementChild!;
    expect(cover).toHaveAttribute("aria-hidden", "true");
    expect(cover).toHaveAttribute("data-cover", "dessert");
    expect(cover.className).toContain("bg-primary");
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    expect(container.querySelector("svg")!.getAttribute("class")).toContain("lucide-cake-slice");
  });

  it("varies the light per dish, the same way every time", () => {
    const light = (seed: string) =>
      render(<DishCover photoUrl={null} course="main" seed={seed} />).container.querySelector("[data-cover] > div")!
        .className;
    expect(light("tagine")).toBe(light("tagine"));
    expect(new Set(["tagine", "harira", "couscous", "zaalouk", "chorba"].map(light)).size).toBeGreaterThan(1);
  });
});
