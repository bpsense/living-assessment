/**
 * supabase-paged.ts
 *
 * Fetch ALL rows for a Supabase/PostgREST query, paginating past the project's
 * default API row cap (Supabase "Max Rows" = 1000). Without this, a dense table
 * (e.g. a demo class with tens of thousands of observations) silently returns
 * only the first 1000 rows — which, combined with an ORDER BY, quietly truncates
 * the data a view sees (e.g. only the earliest/most-recent months load).
 *
 * `makeQuery` MUST return a FRESH builder each call (PostgREST builders are
 * single-use) with all filters + ordering applied and `{ count: 'exact' }` on
 * the select. The first page also yields the total count, then the remaining
 * pages are fetched in parallel.
 */
export async function fetchAllRows<T>(
  makeQuery: () => any,
  pageSize = 1000
): Promise<T[]> {
  const first = await makeQuery().range(0, pageSize - 1)
  if (first.error) throw first.error
  let rows = (first.data ?? []) as T[]
  const total: number = first.count ?? rows.length
  if (total <= rows.length) return rows

  const pages = Math.ceil(total / pageSize)
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) =>
      makeQuery().range((i + 1) * pageSize, (i + 2) * pageSize - 1)
    )
  )
  for (const r of rest) {
    if (r.error) throw r.error
    rows = rows.concat((r.data ?? []) as T[])
  }
  return rows
}
