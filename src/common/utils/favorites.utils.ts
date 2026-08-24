export function markItemsAsFavorites<T extends { id: string }>(
  items: T[],
  favoriteIds: Set<string>,
): T[] {
  return items.map((item) => ({
    ...item,
    isFavorite: favoriteIds.has(String(item.id)),
  }));
}
