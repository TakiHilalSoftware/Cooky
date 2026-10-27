import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { COOKY_ICON_PATH, COOKY_ICON_VIEWBOX } from "./brand-icon-path";
import { CookyIcon, ZelligeStar } from "./cooky-icon";

describe("CookyIcon", () => {
  it("renders the SVG brand mark with the SSOT path", () => {
    const { container } = render(<CookyIcon className="size-8" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("viewBox", COOKY_ICON_VIEWBOX);
    expect(svg).toHaveAttribute("aria-hidden", "true");

    const path = svg?.querySelector("path");
    expect(path).toBeInTheDocument();
    expect(path).toHaveAttribute("d", COOKY_ICON_PATH);
    expect(path).toHaveAttribute("fill-rule", "evenodd");
  });

  it("exports ZelligeStar as an alias for backward compatibility", () => {
    expect(ZelligeStar).toBe(CookyIcon);
  });
});
