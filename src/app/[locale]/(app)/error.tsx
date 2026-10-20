"use client";

import { RouteError } from "@/components/feedback/route-error";

export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  return <RouteError error={error} retry={retry} />;
}
