export const CURATED_DISH_IMAGES: Record<string, string> = {
  "chicken-tagine-preserved-lemon": "/images/dishes/chicken-tagine-preserved-lemon.jpg",
  "couscous-seven-vegetables": "/images/dishes/couscous-seven-vegetables.jpg",
  shakshuka: "/images/dishes/shakshuka.jpg",
  harira: "/images/dishes/harira.jpg",
  tabbouleh: "/images/dishes/tabbouleh.jpg",
  koshari: "/images/dishes/koshari.jpg",
};

export function getCuratedDishPhoto(slug: string): string | null {
  return CURATED_DISH_IMAGES[slug] ?? null;
}
