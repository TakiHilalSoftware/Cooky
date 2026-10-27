import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DishDraftDto, DishFormDto } from "@/server/features/dishes/dto";

import { renderWithIntl } from "../../../tests/setup/render";

const actions = vi.hoisted(() => ({ createDish: vi.fn(), updateDish: vi.fn() }));
vi.mock("@/server/actions/dishes", () => actions);
const photoActions = vi.hoisted(() => ({ uploadDishPhoto: vi.fn() }));
vi.mock("@/server/actions/photos", () => photoActions);
vi.mock("@/server/actions/ingredients", () => ({ suggestIngredients: vi.fn(async () => ({ data: [] })) }));
vi.mock("@/server/actions/voice", () => ({ dictateIngredients: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => router }));
const onActionError = vi.hoisted(() => vi.fn());
vi.mock("@/components/paywall/upgrade-sheet-provider", () => ({ useActionErrorHandler: () => onActionError }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const { DishForm } = await import("./dish-form");

beforeEach(() => {
  for (const fn of [
    actions.createDish,
    actions.updateDish,
    photoActions.uploadDishPhoto,
    router.push,
    onActionError,
    toast.success,
    toast.error,
  ])
    fn.mockReset();
});

const rows = () => within(screen.getByRole("region", { name: "Ingredients" })).getAllByRole("listitem");

describe("DishForm (new)", () => {
  it("explains what's missing, focuses it, and doesn't call the server", async () => {
    const user = userEvent.setup();
    renderWithIntl(<DishForm />);
    await user.click(screen.getByRole("button", { name: "Add dish" }));
    expect(screen.getByText("Some details need fixing. They're highlighted below.")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveFocus();
    expect(screen.getByLabelText("Name")).toHaveAccessibleDescription("Give the dish a name.");
    expect(within(rows()[0]!).getByRole("combobox", { name: "Ingredient" })).toHaveAccessibleDescription(
      "Name the ingredient, or remove this row.",
    );
    expect(actions.createDish).not.toHaveBeenCalled();
  });

  it("sends a clean payload: decimal commas, empty amounts as 'to taste', rows in order", async () => {
    const user = userEvent.setup();
    actions.createDish.mockResolvedValue({ data: { id: "0192f0c8-0000-7000-8000-000000000001" } });
    renderWithIntl(<DishForm />);

    await user.type(screen.getByLabelText("Name"), "  Harira  ");
    await user.type(within(rows()[0]!).getByLabelText("Amount"), "1,5");
    await user.selectOptions(within(rows()[0]!).getByLabelText("Unit"), "l");
    await user.type(within(rows()[0]!).getByRole("combobox", { name: "Ingredient" }), "Water");
    await user.click(screen.getByRole("button", { name: "Add ingredient" }));
    // The new row's ingredient field takes the focus, so typing continues there.
    expect(within(rows()[1]!).getByRole("combobox", { name: "Ingredient" })).toHaveFocus();
    await user.keyboard("Salt");
    await user.click(screen.getByRole("button", { name: "Move Ingredient 2 up" }));
    await user.click(screen.getByRole("radio", { name: "Hard" }));
    await user.click(screen.getByRole("button", { name: "Winter" }));
    await user.click(screen.getByRole("button", { name: "One serving more" }));
    await user.click(screen.getByRole("button", { name: "Add step" }));
    await user.type(screen.getByLabelText("What to do"), "Simmer.");
    await user.type(screen.getByLabelText("Timer (minutes)"), "30");
    await user.click(screen.getByRole("button", { name: "Add dish" }));

    await waitFor(() => expect(actions.createDish).toHaveBeenCalledOnce());
    expect(actions.createDish).toHaveBeenCalledWith({
      name: "Harira",
      course: "main",
      difficulty: "hard",
      servings: 5,
      seasons: ["winter"],
      dietaryTags: [],
      ingredients: [
        { name: "Salt", amount: null, unit: null, note: null },
        { name: "Water", amount: 1.5, unit: "l", note: null },
      ],
      steps: [{ text: "Simmer.", timerMinutes: 30, prepDayBefore: false }],
      caloriesKcal: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
    });
    expect(toast.success).toHaveBeenCalledWith("“Harira” added");
    expect(router.push).toHaveBeenCalledWith("/dishes/0192f0c8-0000-7000-8000-000000000001");
  });

  it("says why an amount is wrong", async () => {
    const user = userEvent.setup();
    renderWithIntl(<DishForm />);
    await user.type(screen.getByLabelText("Name"), "Tea");
    await user.type(within(rows()[0]!).getByRole("combobox", { name: "Ingredient" }), "Mint");
    await user.type(within(rows()[0]!).getByLabelText("Amount"), "a handful");
    await user.click(screen.getByRole("button", { name: "Add dish" }));
    expect(within(rows()[0]!).getByLabelText("Amount")).toHaveFocus();
    expect(within(rows()[0]!).getByLabelText("Amount")).toHaveAccessibleDescription(/Use a number like 2, 0\.5 or 1,5/);
  });

  it("a full recipe box opens the upgrade sheet for dishes instead of a dead-end error", async () => {
    const user = userEvent.setup();
    actions.createDish.mockResolvedValue({ serverError: "quota_exceeded" });
    renderWithIntl(<DishForm />);
    await user.type(screen.getByLabelText("Name"), "Tea");
    await user.type(within(rows()[0]!).getByRole("combobox", { name: "Ingredient" }), "Mint");
    await user.click(screen.getByRole("button", { name: "Add dish" }));
    await waitFor(() => expect(onActionError).toHaveBeenCalledWith("quota_exceeded", "dishes"));
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert", { name: /available/ })).not.toBeInTheDocument();
  });

  it("keeps one ingredient row (it can't be removed) and stops servings at 1", async () => {
    const user = userEvent.setup();
    renderWithIntl(<DishForm />);
    expect(screen.getByRole("button", { name: "Remove Ingredient 1" })).toBeDisabled();
    const servings = screen.getByLabelText("Servings");
    await user.clear(servings);
    await user.type(servings, "1");
    expect(screen.getByRole("button", { name: "One serving fewer" })).toBeDisabled();
  });

  it("asks before throwing away changes, and leaves straight away when nothing changed", async () => {
    const user = userEvent.setup();
    renderWithIntl(<DishForm />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(router.push).toHaveBeenCalledWith("/dishes");

    router.push.mockReset();
    await user.type(screen.getByLabelText("Name"), "Soup");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("alertdialog", { name: "Discard your changes?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Name")).toHaveValue("Soup");
  });
});

describe("DishForm (edit)", () => {
  const dish: DishFormDto = {
    id: "0192f0c8-0000-7000-8000-000000000002",
    name: "Tagine",
    difficulty: "medium",
    course: "main",
    servings: 4,
    seasons: [],
    dietaryTags: ["halal"],
    ingredients: [{ name: "Chicken", amount: 1.2, unit: "kg", note: null }],
    steps: [],
    caloriesKcal: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
  };

  it("starts from the saved dish and saves changes to the same id", async () => {
    const user = userEvent.setup();
    actions.updateDish.mockResolvedValue({ data: { id: dish.id } });
    renderWithIntl(<DishForm dish={dish} />);
    expect(screen.getByLabelText("Name")).toHaveValue("Tagine");
    expect(within(rows()[0]!).getByLabelText("Amount")).toHaveValue("1.2");
    expect(screen.getByRole("button", { name: "Halal" })).toHaveAttribute("aria-pressed", "true");

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Lamb tagine");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(actions.updateDish).toHaveBeenCalledWith(expect.objectContaining({ id: dish.id, name: "Lamb tagine" })),
    );
    expect(toast.success).toHaveBeenCalledWith("Changes saved");
    expect(router.push).toHaveBeenCalledWith(`/dishes/${dish.id}`);
  });
});

describe("DishForm (new, with a photo)", () => {
  const id = "0192f0c8-0000-7000-8000-000000000003";
  const fileInput = () => document.querySelector<HTMLInputElement>('input[type="file"]')!;
  const jpeg = () => new File(["jpeg bytes"], "tagine.jpg", { type: "image/jpeg" });

  beforeEach(() => {
    vi.stubGlobal(
      "URL",
      Object.assign(URL, { createObjectURL: vi.fn(() => "blob:preview"), revokeObjectURL: vi.fn() }),
    );
  });

  async function fillMinimum(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText("Name"), "Tagine");
    await user.type(within(rows()[0]!).getByRole("combobox", { name: "Ingredient" }), "Chicken");
  }

  it("shows the picked photo, then uploads it to the new dish once it's saved", async () => {
    const user = userEvent.setup();
    actions.createDish.mockResolvedValue({ data: { id } });
    photoActions.uploadDishPhoto.mockResolvedValue({ data: { photo: { url: "u", smallUrl: "s" } } });
    renderWithIntl(<DishForm photosEnabled />);

    await fillMinimum(user);
    await user.upload(fileInput(), jpeg());
    expect(screen.getByRole("img", { name: "Tagine" })).toHaveAttribute("src", "blob:preview");
    expect(screen.getByRole("button", { name: "Change photo" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add dish" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/dishes/${id}`));
    const form = photoActions.uploadDishPhoto.mock.calls[0]![0] as FormData;
    expect(form.get("dishId")).toBe(id);
    expect((form.get("photo") as File).name).toBe("tagine.jpg");
    expect(toast.success).toHaveBeenCalledWith("“Tagine” added");
  });

  it("keeps the dish when the photo fails, and says so honestly", async () => {
    const user = userEvent.setup();
    actions.createDish.mockResolvedValue({ data: { id } });
    photoActions.uploadDishPhoto.mockResolvedValue({ serverError: "invalid" });
    renderWithIntl(<DishForm photosEnabled />);

    await fillMinimum(user);
    await user.upload(fileInput(), jpeg());
    await user.click(screen.getByRole("button", { name: "Add dish" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/dishes/${id}`));
    expect(toast.error).toHaveBeenCalledWith(
      "“Tagine” added, but its photo couldn't be saved. Try again from the dish page.",
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("refuses a file that isn't a photo before anything is sent", async () => {
    const user = userEvent.setup({ applyAccept: false });
    actions.createDish.mockResolvedValue({ data: { id } });
    renderWithIntl(<DishForm photosEnabled />);

    await fillMinimum(user);
    await user.upload(fileInput(), new File(["%PDF"], "menu.pdf", { type: "application/pdf" }));
    expect(
      screen.getByText("That file isn't a photo we can use. Pick a JPEG, PNG, WebP or AVIF image."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add dish" }));
    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(photoActions.uploadDishPhoto).not.toHaveBeenCalled();
  });

  it("removing the picked photo saves the dish without one", async () => {
    const user = userEvent.setup();
    actions.createDish.mockResolvedValue({ data: { id } });
    renderWithIntl(<DishForm photosEnabled />);

    await fillMinimum(user);
    await user.upload(fileInput(), jpeg());
    await user.click(screen.getByRole("button", { name: "Remove photo" }));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add dish" }));
    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(photoActions.uploadDishPhoto).not.toHaveBeenCalled();
  });

  describe("from an imported recipe", () => {
    const draft: DishDraftDto = {
      name: "Harira",
      difficulty: "easy",
      course: "main",
      servings: 6,
      seasons: [],
      dietaryTags: [],
      ingredients: [{ name: "Lentils", amount: 200, unit: "g", note: null }],
      steps: [],
      caloriesKcal: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
      source: { url: "https://example.com/harira", siteName: "Example", imageUrl: "https://example.com/h.jpg" },
    };

    it("says the site's photo comes along, and keeps it when none is picked", async () => {
      const user = userEvent.setup();
      actions.createDish.mockResolvedValue({ data: { id } });
      renderWithIntl(<DishForm draft={draft} photosEnabled />);
      expect(screen.getByText(/The photo from Example is added when you save/)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Add dish" }));
      await waitFor(() => expect(actions.createDish).toHaveBeenCalled());
      expect(actions.createDish.mock.calls[0]![0].source).toEqual(draft.source);
    });

    it("doesn't fetch the site's photo when the person picked their own", async () => {
      const user = userEvent.setup();
      actions.createDish.mockResolvedValue({ data: { id } });
      photoActions.uploadDishPhoto.mockResolvedValue({ data: { photo: { url: "u", smallUrl: "s" } } });
      renderWithIntl(<DishForm draft={draft} photosEnabled />);

      await user.upload(fileInput(), jpeg());
      expect(screen.queryByText(/The photo from Example/)).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Add dish" }));
      await waitFor(() => expect(photoActions.uploadDishPhoto).toHaveBeenCalled());
      expect(actions.createDish.mock.calls[0]![0].source).toEqual({ ...draft.source, imageUrl: null });
    });
  });

  it("explains when photos are switched off, without blocking the dish", () => {
    renderWithIntl(<DishForm photosEnabled={false} />);
    expect(screen.getByText("Photo uploads aren't available yet. Everything else works as usual.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add a photo" })).not.toBeInTheDocument();
  });

  it("isn't offered on the edit form, where the photo has its own card", () => {
    const dish: DishFormDto = {
      id,
      name: "Tagine",
      difficulty: "easy",
      course: "main",
      servings: 4,
      seasons: [],
      dietaryTags: [],
      ingredients: [{ name: "Chicken", amount: null, unit: null, note: null }],
      steps: [],
      caloriesKcal: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
    };
    renderWithIntl(<DishForm dish={dish} photosEnabled />);
    expect(screen.queryByRole("region", { name: "Photo" })).not.toBeInTheDocument();
  });
});
