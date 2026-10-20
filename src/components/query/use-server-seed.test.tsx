import { useQuery } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl, testQueryClient } from "../../../tests/setup/render";

import { useServerSeed } from "./use-server-seed";

const KEY = ["kitchen", "test"];

function Seeded({ fresh }: { fresh: { names: string[] } }) {
  useServerSeed(KEY, fresh);
  const { data } = useQuery({ queryKey: KEY, queryFn: () => fresh, initialData: fresh });
  return <p>{data.names.join(", ")}</p>;
}

describe("useServerSeed", () => {
  it("writes each new server render into the cache", () => {
    const queryClient = testQueryClient();
    const { rerender } = renderWithIntl(<Seeded fresh={{ names: ["Eggs"] }} />, { queryClient });
    rerender(<Seeded fresh={{ names: ["Eggs", "Salt"] }} />);
    expect(screen.getByText("Eggs, Salt")).toBeInTheDocument();
  });

  it("doesn't let a page brought back from the page cache overwrite newer data", () => {
    const queryClient = testQueryClient();
    const kept = { names: ["Eggs"] };
    const first = renderWithIntl(<Seeded fresh={kept} />, { queryClient });
    // A write since then put a newer kitchen in the cache.
    queryClient.setQueryData(KEY, { names: ["Eggs", "Garlic"] });
    first.unmount();

    // Coming back, Next hands over the very same render it kept.
    renderWithIntl(<Seeded fresh={kept} />, { queryClient });
    expect(screen.getByText("Eggs, Garlic")).toBeInTheDocument();
  });
});
