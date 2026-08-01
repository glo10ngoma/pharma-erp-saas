type PaginatedResponse<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages?: number;
};

type FetchPageParams = {
  page: number;
  limit: number;
};

type FetchAllPagesOptions<T> = {
  limit?: number;
  maxPages?: number;
  getKey?: (item: T) => string | number;
};

export const MAX_API_PAGE_LIMIT = 100;

export async function fetchAllPages<T>(
  fetchPage: (params: FetchPageParams) => Promise<PaginatedResponse<T>>,
  options: FetchAllPagesOptions<T> = {},
) {
  const limit = Math.max(1, Math.min(options.limit ?? MAX_API_PAGE_LIMIT, MAX_API_PAGE_LIMIT));
  const maxPages = Math.max(1, options.maxPages ?? 500);
  const items: T[] = [];
  const seenKeys = options.getKey ? new Set<string | number>() : null;
  let page = 1;
  let receivedCount = 0;

  while (page <= maxPages) {
    const response = await fetchPage({ page, limit });
    const pageItems = Array.isArray(response.items) ? response.items : [];
    receivedCount += pageItems.length;

    if (seenKeys && options.getKey) {
      for (const item of pageItems) {
        const key = options.getKey(item);
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        items.push(item);
      }
    } else {
      items.push(...pageItems);
    }

    const totalPages = Math.max(
      1,
      response.totalPages ?? Math.ceil(Number(response.total ?? 0) / Math.max(1, Number(response.limit ?? limit))),
    );

    if (pageItems.length < limit || receivedCount >= Number(response.total ?? 0) || page >= totalPages) {
      break;
    }

    page += 1;
  }

  return items;
}
