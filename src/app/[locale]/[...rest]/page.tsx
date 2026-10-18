import { notFound } from "next/navigation";

// Any unknown path under a locale renders the branded, translated 404.
export default function CatchAllPage() {
  notFound();
}
