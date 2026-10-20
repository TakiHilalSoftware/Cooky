"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";

import { unwrap } from "@/components/query/action-query";
import { mutationKeys, queryKeys } from "@/components/query/keys";
import { useServerSeed } from "@/components/query/use-server-seed";
import type { AppLocale } from "@/i18n/routing";
import {
  addPantryItems,
  getKitchen,
  getReadyToCook,
  removePantryItem,
  setPantryStaple,
} from "@/server/actions/kitchen";
import type { ReadyToCookDto } from "@/server/features/cook/dto";
import type { PantryDto, PantryItemDto } from "@/server/features/kitchen/dto";

import { withAdded } from "./pantry-preview";

function useKitchenKeys() {
  const locale = useLocale() as AppLocale;
  return { locale, pantry: queryKeys.kitchen.pantry(locale), ready: queryKeys.kitchen.ready(locale) };
}

/** My kitchen, starting from the page's render; checked again when the tab comes back into view. */
export function usePantry(initial: PantryDto) {
  const { locale, pantry } = useKitchenKeys();
  useServerSeed(pantry, initial, mutationKeys.kitchen);
  return useQuery({
    queryKey: pantry,
    queryFn: async () => unwrap(await getKitchen({ locale })),
    initialData: initial,
  });
}

/** What the kitchen lets you cook, refreshed after every kitchen change. */
export function useReadyToCook(initial: ReadyToCookDto) {
  const { locale, ready } = useKitchenKeys();
  useServerSeed(ready, initial, mutationKeys.kitchen);
  return useQuery({
    queryKey: ready,
    queryFn: async () => unwrap(await getReadyToCook({ locale })),
    initialData: initial,
  });
}

/**
 * One kitchen write: the change shows at once, the server's updated kitchen
 * replaces it, and a failure puts back the server's version.
 *
 * Several taps can be in flight (Server Actions run one after another). Only
 * the last one to finish writes its answer into the cache, so an earlier
 * answer never briefly undoes a later tap; "Ready to cook" is asked again
 * once, when the kitchen has settled.
 */
function useKitchenMutation<V>(
  write: (input: V & { locale: AppLocale }) => Promise<{ data?: PantryDto; serverError?: unknown } | undefined>,
  preview: (items: PantryItemDto[], input: V) => PantryItemDto[],
) {
  const client = useQueryClient();
  const { locale, pantry, ready } = useKitchenKeys();
  const isLast = () => client.isMutating({ mutationKey: mutationKeys.kitchen }) <= 1;

  return useMutation({
    mutationKey: mutationKeys.kitchen,
    mutationFn: async (input: V) => unwrap(await write({ ...input, locale })),
    onMutate: async (input) => {
      // A refetch landing now would overwrite the preview with the old kitchen.
      await client.cancelQueries({ queryKey: pantry });
      const previous = client.getQueryData<PantryDto>(pantry);
      if (previous) client.setQueryData<PantryDto>(pantry, { ...previous, items: preview(previous.items, input) });
      return { previous };
    },
    onSuccess: (updated) => {
      if (isLast()) client.setQueryData(pantry, updated);
    },
    onError: (_error, _input, context) => {
      if (isLast() && context?.previous) client.setQueryData(pantry, context.previous);
      // Other taps may have changed it meanwhile: the server says what really happened.
      void client.invalidateQueries({ queryKey: pantry });
    },
    onSettled: () => {
      if (isLast()) void client.invalidateQueries({ queryKey: ready });
    },
  });
}

export function useAddPantryItems() {
  return useKitchenMutation(addPantryItems, (items, { names, staple }: { names: string[]; staple: boolean }) =>
    withAdded(items, names, staple),
  );
}

export function useRemovePantryItem() {
  return useKitchenMutation(removePantryItem, (items, { id }: { id: string }) => items.filter((i) => i.id !== id));
}

export function useSetPantryStaple() {
  return useKitchenMutation(setPantryStaple, (items, { id, staple }: { id: string; staple: boolean }) =>
    items.map((i) => (i.id === id ? { ...i, isStaple: staple } : i)),
  );
}
