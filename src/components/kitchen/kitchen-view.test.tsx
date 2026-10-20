import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReadyToCookDto } from "@/server/features/cook/dto";
import type { PantryDto } from "@/server/features/kitchen/dto";

import { renderWithIntl, testQueryClient } from "../../../tests/setup/render";

const kitchen = vi.hoisted(() => ({
  addPantryItems: vi.fn(),
  removePantryItem: vi.fn(),
  setPantryStaple: vi.fn(),
  getKitchen: vi.fn(),
  getReadyToCook: vi.fn(),
}));
const shopping = vi.hoisted(() => ({ addShoppingItem: vi.fn() }));
const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
const push = vi.hoisted(() => vi.fn());
vi.mock("@/server/actions/kitchen", () => kitchen);
vi.mock("@/server/actions/shopping", () => shopping);
vi.mock("@/server/actions/ingredients", () => ({ suggestIngredients: vi.fn(async () => ({ data: [] })) }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push }),
}));

const { KitchenView } = await import("./kitchen-view");

const ID = {
  salt: "00000000-0000-4000-8000-000000000001",
  eggs: "00000000-0000-4000-8000-000000000002",
  onion: "00000000-0000-4000-8000-000000000003",
};
const pantry = (items: PantryDto["items"], suggestedStaples: string[] = []): PantryDto => ({
  items,
  suggestedStaples,
  limit: 300,
});
const SALT = { id: ID.salt, name: "Salt", isStaple: true };
const EGGS = { id: ID.eggs, name: "Eggs", isStaple: false };
const ONION = { id: ID.onion, name: "Onion", isStaple: false };

const NOTHING_READY: ReadyToCookDto = { ready: [], almost: [], readyCount: 0, almostCount: 0, total: 2 };
const SHAKSHUKA = { id: "d1", name: "Shakshuka", course: "main" as const, photoUrl: null, missing: ["Tomato"] };
const OMELETTE = { id: "d2", name: "Omelette", course: "main" as const, photoUrl: null, missing: [] };

/** A promise the test settles by hand, to look at the page while a write is in flight. */
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => {
  for (const fn of [...Object.values(kitchen), shopping.addShoppingItem, toast, toast.success, toast.error, push])
    fn.mockReset();
  kitchen.getReadyToCook.mockResolvedValue({ data: NOTHING_READY });
});

describe("My kitchen", () => {
  it("removes at once, keeps the server's answer, and offers Undo", async () => {
    const user = userEvent.setup();
    const answer = deferred<{ data: PantryDto }>();
    kitchen.removePantryItem.mockReturnValue(answer.promise);
    renderWithIntl(<KitchenView pantry={pantry([SALT, EGGS])} ready={NOTHING_READY} />);

    await user.click(screen.getByRole("button", { name: "Remove Eggs" }));
    // Gone before the server has answered.
    expect(screen.queryByText("Eggs")).not.toBeInTheDocument();
    expect(kitchen.removePantryItem).toHaveBeenCalledWith({ id: ID.eggs, locale: "en" });

    await act(async () => answer.resolve({ data: pantry([SALT]) }));
    expect(toast).toHaveBeenCalledWith("“Eggs” removed", expect.objectContaining({ duration: 6000 }));

    kitchen.addPantryItems.mockResolvedValue({ data: pantry([SALT, EGGS]) });
    const undo = toast.mock.calls[0]![1] as { action: { onClick: () => void } };
    await act(async () => undo.action.onClick());
    expect(kitchen.addPantryItems).toHaveBeenCalledWith({ names: ["Eggs"], staple: false, locale: "en" });
    expect(await screen.findByText("Eggs")).toBeInTheDocument();
  });

  it("puts an item back and says why when the server refuses", async () => {
    const user = userEvent.setup();
    kitchen.removePantryItem.mockResolvedValue({ serverError: "rate_limited" });
    kitchen.getKitchen.mockResolvedValue({ data: pantry([SALT, EGGS]) });
    renderWithIntl(<KitchenView pantry={pantry([SALT, EGGS])} ready={NOTHING_READY} />);

    await user.click(screen.getByRole("button", { name: "Remove Eggs" }));
    expect(await screen.findByText("Eggs")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/too many|slow down|moment/i));
    expect(toast).not.toHaveBeenCalled();
  });

  it("shows a typed item while it saves, then the dictionary's name for it", async () => {
    const user = userEvent.setup();
    const answer = deferred<{ data: PantryDto }>();
    kitchen.addPantryItems.mockReturnValue(answer.promise);
    renderWithIntl(<KitchenView pantry={pantry([SALT])} ready={NOTHING_READY} />);

    const field = screen.getByRole("combobox", { name: "Add an ingredient" });
    await user.type(field, "tomatoes{Enter}");
    expect(screen.getByRole("status", { name: "Saving “tomatoes”…" })).toBeInTheDocument();
    // Cleared at once, ready for the next one.
    expect(screen.getByRole("combobox", { name: "Add an ingredient" })).toHaveValue("");

    await act(async () => answer.resolve({ data: pantry([SALT, { id: ID.onion, name: "Tomato", isStaple: false }]) }));
    expect(await screen.findByText("Tomato")).toBeInTheDocument();
    expect(screen.queryByText("tomatoes")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Tomato" })).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("“tomatoes” added");
  });

  it("gives the typed text back and explains the cap when the kitchen is full", async () => {
    const user = userEvent.setup();
    kitchen.addPantryItems.mockResolvedValue({ serverError: "conflict" });
    kitchen.getKitchen.mockResolvedValue({ data: pantry([SALT]) });
    renderWithIntl(<KitchenView pantry={pantry([SALT])} ready={NOTHING_READY} />);

    await user.type(screen.getByRole("combobox", { name: "Add an ingredient" }), "Lentils{Enter}");
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("My kitchen holds up to 300 items. Remove a few to add more."),
    );
    expect(screen.getByRole("combobox", { name: "Add an ingredient" })).toHaveValue("Lentils");
    expect(screen.queryByText("Lentils", { selector: "span" })).not.toBeInTheDocument();
  });

  it("an earlier answer never undoes a later tap; the last answer wins", async () => {
    const user = userEvent.setup();
    const first = deferred<{ data: PantryDto }>();
    const second = deferred<{ data: PantryDto }>();
    kitchen.removePantryItem.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    renderWithIntl(<KitchenView pantry={pantry([SALT, EGGS, ONION])} ready={NOTHING_READY} />);

    await user.click(screen.getByRole("button", { name: "Remove Eggs" }));
    await user.click(screen.getByRole("button", { name: "Remove Onion" }));
    // The first answer still has Onion in it: it mustn't come back.
    await act(async () => first.resolve({ data: pantry([SALT, ONION]) }));
    expect(screen.queryByText("Onion")).not.toBeInTheDocument();
    expect(kitchen.getReadyToCook).not.toHaveBeenCalled();

    await act(async () => second.resolve({ data: pantry([SALT]) }));
    expect(screen.queryByText("Onion")).not.toBeInTheDocument();
    expect(screen.queryByText("Eggs")).not.toBeInTheDocument();
    // "Ready to cook" is asked once, when the kitchen has settled.
    await waitFor(() => expect(kitchen.getReadyToCook).toHaveBeenCalledTimes(1));
  });

  it("coming back to the page shows what the server just rendered, not an older cached kitchen", () => {
    const queryClient = testQueryClient();
    // A visit a few seconds ago left this in the cache…
    queryClient.setQueryData(["kitchen", "pantry", "en"], pantry([SALT]));
    // …then "Done shopping" stocked eggs, and the page renders again.
    renderWithIntl(<KitchenView pantry={pantry([SALT, EGGS])} ready={NOTHING_READY} />, { queryClient });
    expect(screen.getByText("Eggs")).toBeInTheDocument();
    expect(kitchen.getKitchen).not.toHaveBeenCalled();
  });

  it("blocks changes offline with the kitchen's message", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    renderWithIntl(<KitchenView pantry={pantry([SALT, EGGS])} ready={NOTHING_READY} />);
    await user.click(screen.getByRole("button", { name: "Remove Eggs" }));
    expect(toast.error).toHaveBeenCalledWith("You're offline. Changes to My kitchen need a connection.");
    expect(kitchen.removePantryItem).not.toHaveBeenCalled();
    expect(screen.getByText("Eggs")).toBeInTheDocument();
  });
});

describe("Ready to cook", () => {
  it("follows the kitchen: after a change it asks again and shows what's newly makeable", async () => {
    const user = userEvent.setup();
    kitchen.setPantryStaple.mockResolvedValue({ data: pantry([SALT, { ...EGGS, isStaple: true }]) });
    kitchen.getReadyToCook.mockResolvedValue({
      data: { ...NOTHING_READY, ready: [OMELETTE], readyCount: 1 },
    });
    renderWithIntl(<KitchenView pantry={pantry([SALT, EGGS])} ready={NOTHING_READY} />);
    expect(screen.getByRole("heading", { name: "Nothing ready yet" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mark Eggs as always have" }));
    expect(await screen.findByRole("link", { name: "Omelette" })).toHaveAttribute("href", "/dishes/d2");
    expect(screen.getByText("1 dish you can cook now")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cook: Omelette" })).toHaveAttribute("href", "/dishes/d2/cook");
    expect(kitchen.getReadyToCook).toHaveBeenCalledWith({ locale: "en" });
  });

  it("“I have it” adds the missing ingredient to the kitchen", async () => {
    const user = userEvent.setup();
    kitchen.addPantryItems.mockResolvedValue({ data: pantry([SALT, ONION]) });
    renderWithIntl(
      <KitchenView pantry={pantry([SALT])} ready={{ ...NOTHING_READY, almost: [SHAKSHUKA], almostCount: 1 }} />,
    );
    const card = screen.getByText("Shakshuka").closest("li")!;
    expect(within(card).getByText("Missing: Tomato")).toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "I have Tomato" }));
    expect(kitchen.addPantryItems).toHaveBeenCalledWith({ names: ["Tomato"], staple: false, locale: "en" });
  });

  it("puts what's missing on the shopping list, with a way there", async () => {
    const user = userEvent.setup();
    shopping.addShoppingItem.mockResolvedValue({ data: { name: "Tomato" } });
    renderWithIntl(
      <KitchenView pantry={pantry([SALT])} ready={{ ...NOTHING_READY, almost: [SHAKSHUKA], almostCount: 1 }} />,
    );
    await user.click(screen.getByRole("button", { name: "Add to list: Tomato" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Added to your shopping list", expect.anything()));
    expect(shopping.addShoppingItem).toHaveBeenCalledWith({ name: "Tomato" });
    const { action } = toast.success.mock.calls[0]![1] as { action: { onClick: () => void } };
    action.onClick();
    expect(push).toHaveBeenCalledWith("/shopping");
  });

  it("with an empty recipe box, points to adding a dish", () => {
    renderWithIntl(<KitchenView pantry={pantry([SALT])} ready={{ ...NOTHING_READY, total: 0 }} />);
    expect(screen.getByRole("heading", { name: "Add a dish to see what you can cook" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add a dish" })).toHaveAttribute("href", "/dishes/new");
    expect(screen.getByRole("link", { name: "Browse Discover" })).toHaveAttribute("href", "/discover");
  });

  it("says when it couldn't update, and retries on request", async () => {
    const user = userEvent.setup();
    kitchen.setPantryStaple.mockResolvedValue({ data: pantry([{ ...SALT, isStaple: false }]) });
    kitchen.getReadyToCook.mockResolvedValueOnce({ serverError: "unavailable" });
    renderWithIntl(<KitchenView pantry={pantry([SALT])} ready={NOTHING_READY} />);

    await user.click(screen.getByRole("button", { name: "Salt: stop marking as always have" }));
    expect(await screen.findByText("This list couldn't update. It may be out of date.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.queryByText(/couldn't update/)).not.toBeInTheDocument());
    expect(kitchen.getReadyToCook).toHaveBeenCalledTimes(2);
  });
});
