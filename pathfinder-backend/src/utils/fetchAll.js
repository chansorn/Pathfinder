// Supabase cuts every select off at the project's "Max rows" setting (1000 by default) and says
// nothing - .limit(10000) doesn't get around it. This pages through with .range() instead.
//
// build() must return a NEW query each time, with an .order() on a unique column so the pages
// don't overlap or skip rows. Returns { data, error } like a normal supabase call.
// Pages continue from however many rows actually came back and stop at an empty page, so it is
// still complete if someone lowers Max rows below pageSize (costs one extra small request).
export async function fetchAll(build, { pageSize = 1000, maxRows = 100_000 } = {}) {
  const rows = [];
  while (rows.length < maxRows) {
    const { data, error } = await build().range(rows.length, rows.length + pageSize - 1);
    if (error) return { data: null, error };
    if (!data.length) break;
    rows.push(...data);
  }
  return { data: rows, error: null };
}
