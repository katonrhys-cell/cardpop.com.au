// Insert a row that carries columns which may not exist in the database yet.
//
// Vercel deploys the app through its own Git integration while migrations are
// applied by the merge workflow, so there is a window where the code writes a
// column `supabase db push` hasn't created. An order insert failing in that
// window means a buyer who has paid and has no order — so the amounts that
// column would have held are dropped and the insert retried, rather than lost.
//
// PostgREST reports a missing column as PGRST204 ("Could not find the '<col>'
// column ... in the schema cache"), not the raw Postgres 42703 — match both.

const isMissingColumnError = error => error?.code === 'PGRST204' || error?.code === '42703';

/**
 * @param row           the insert payload — MUTATED: dropped columns are deleted
 * @param optionalCols  columns that may be dropped, in the order they should be
 *                      tried when the error doesn't name one
 * @param insert        (row) => Promise<{ error }>
 * @param onDrop        optional callback for logging each dropped column
 */
export async function insertWithOptionalColumns(row, optionalCols, insert, onDrop) {
  let { error } = await insert(row);

  while (isMissingColumnError(error)) {
    // Always prefer the column the error actually names. Falling straight back
    // to "drop the first optional column" would discard a perfectly good value
    // (and still not fix the error) whenever a *different* column is the
    // missing one — the codes above don't say which.
    const named = optionalCols.find(col => col in row && new RegExp(col).test(error.message || ''));
    const col = named || optionalCols.find(c => c in row);
    if (!col) break; // nothing left to drop — the error is something else

    onDrop?.(col);
    delete row[col];
    ({ error } = await insert(row));
  }

  return { error };
}

export { isMissingColumnError };
