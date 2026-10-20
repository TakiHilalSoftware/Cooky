import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SearchResultsDto } from "@/server/features/search/dto";

import { renderWithIntl } from "../../../tests/setup/render";

const actions = vi.hoisted(() => ({ search: vi.fn() }));
const push = vi.hoisted(() => vi.fn());
vi.mock("@/server/actions/search", () => actions);
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push }) }));

const { SearchPalette } = await import("./search-palette");

const EMPTY: SearchResultsDto = { dishes: [], shared: [], friends: [], discover: [], events: [] };

/** A promise the test settles by hand, to look at the palette while the server thinks. */
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => {
  actions.search.mockReset();
  push.mockReset();
});

async function openPalette() {
  const user = userEvent.setup();
  renderWithIntl(<SearchPalette />);
  await user.keyboard("{Control>}k{/Control}");
  return { user, box: await screen.findByRole("combobox", { name: "Search Cooky" }) };
}

describe("SearchPalette", () => {
  it("says it's searching instead of “nothing found” while the server answers", async () => {
    const answer = deferred<{ data: SearchResultsDto }>();
    actions.search.mockReturnValue(answer.promise);
    const { user, box } = await openPalette();
    await user.type(box, "tagine");
    expect(await screen.findByText("Searching…")).toBeInTheDocument();
    expect(screen.queryByText(/Nothing found/)).not.toBeInTheDocument();

    answer.resolve({ data: { ...EMPTY, dishes: [{ id: "d1", name: "Chicken tagine" }] } });
    const option = await screen.findByRole("option", { name: "Chicken tagine" });
    await user.click(option);
    expect(push).toHaveBeenCalledWith("/dishes/d1");
  });

  it("asks once per settled word, and answers a word typed again from memory", async () => {
    actions.search.mockImplementation(async ({ q }: { q: string }) => ({
      data: { ...EMPTY, dishes: [{ id: q, name: `Dish ${q}` }] },
    }));
    const { user, box } = await openPalette();
    await user.type(box, "soup");
    await screen.findByRole("option", { name: "Dish soup" });
    expect(actions.search).toHaveBeenCalledTimes(1);
    expect(actions.search).toHaveBeenCalledWith({ q: "soup", locale: "en" });

    await user.clear(box);
    await user.type(box, "salad");
    await screen.findByRole("option", { name: "Dish salad" });
    await user.clear(box);
    await user.type(box, "soup");
    expect(await screen.findByRole("option", { name: "Dish soup" })).toBeInTheDocument();
    expect(actions.search).toHaveBeenCalledTimes(2);
  });

  it("says nothing was found, or that search is down, in plain words", async () => {
    actions.search.mockResolvedValueOnce({ data: EMPTY }).mockResolvedValueOnce({ serverError: "unavailable" });
    const { user, box } = await openPalette();
    await user.type(box, "zzz");
    expect(await screen.findByText("Nothing found for “zzz”. Try another spelling.")).toBeInTheDocument();
    await user.clear(box);
    await user.type(box, "qqq");
    await waitFor(() =>
      expect(
        screen.getByText("Search isn't available right now. Check your connection and try again."),
      ).toBeInTheDocument(),
    );
  });

  it("matches pages instantly, before the server answers", async () => {
    actions.search.mockReturnValue(new Promise(() => {}));
    const { user, box } = await openPalette();
    await user.type(box, "kitchen");
    expect(screen.getByRole("option", { name: "My kitchen" })).toBeInTheDocument();
  });
});
