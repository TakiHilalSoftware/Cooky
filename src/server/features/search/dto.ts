// What the UI may know about search results. Types only: safe for the UI.

export type SearchResultsDto = {
  dishes: { id: string; name: string }[];
  /** Dishes friends share with the viewer. */
  shared: { id: string; name: string }[];
  /** The viewer's friends (display names only). */
  friends: { id: string; name: string }[];
  discover: { slug: string; name: string }[];
  events: { id: string; name: string; date: string }[];
};
