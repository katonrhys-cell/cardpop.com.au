import { describe, it, expect, vi } from 'vitest';
import { insertWithOptionalColumns } from '../../../src/utils/insertWithOptionalColumns.js';

const missing = col => ({ code: 'PGRST204', message: `Could not find the '${col}' column of 'orders' in the schema cache` });

describe('insertWithOptionalColumns', () => {
  it('inserts once and drops nothing when the columns all exist', async () => {
    const row = { total_aud: 10, gst_included_aud: 1, processing_fee_aud: 2 };
    const insert = vi.fn().mockResolvedValue({ error: null });

    const { error } = await insertWithOptionalColumns(row, ['gst_included_aud', 'processing_fee_aud'], insert);

    expect(error).toBeNull();
    expect(insert).toHaveBeenCalledTimes(1);
    expect(row).toEqual({ total_aud: 10, gst_included_aud: 1, processing_fee_aud: 2 });
  });

  it('drops only the column the error names, not the first candidate', async () => {
    // The regression this helper exists for: PGRST204 doesn't say which column
    // is missing in its code, so a loop keying off the code alone would throw
    // away a perfectly good gst_included_aud and still not fix the error.
    const row = { total_aud: 10, gst_included_aud: 1, processing_fee_aud: 2 };
    const insert = vi.fn()
      .mockResolvedValueOnce({ error: missing('processing_fee_aud') })
      .mockResolvedValueOnce({ error: null });

    const { error } = await insertWithOptionalColumns(row, ['gst_included_aud', 'processing_fee_aud'], insert);

    expect(error).toBeNull();
    expect(insert).toHaveBeenCalledTimes(2);
    expect(row).toEqual({ total_aud: 10, gst_included_aud: 1 });
  });

  it('drops several columns when several are missing', async () => {
    const row = { total_aud: 10, gst_included_aud: 1, processing_fee_aud: 2 };
    const insert = vi.fn()
      .mockResolvedValueOnce({ error: missing('processing_fee_aud') })
      .mockResolvedValueOnce({ error: missing('gst_included_aud') })
      .mockResolvedValueOnce({ error: null });

    const { error } = await insertWithOptionalColumns(row, ['gst_included_aud', 'processing_fee_aud'], insert);

    expect(error).toBeNull();
    expect(row).toEqual({ total_aud: 10 });
  });

  it('falls back to dropping candidates in order when the error names none of them', async () => {
    const row = { total_aud: 10, processing_fee_aud: 2 };
    const insert = vi.fn()
      .mockResolvedValueOnce({ error: { code: '42703', message: 'column does not exist' } })
      .mockResolvedValueOnce({ error: null });

    const { error } = await insertWithOptionalColumns(row, ['gst_included_aud', 'processing_fee_aud'], insert);

    expect(error).toBeNull();
    expect(row).toEqual({ total_aud: 10 });
  });

  it('gives up (rather than looping) when nothing is left to drop', async () => {
    const row = { total_aud: 10 };
    const err = { code: 'PGRST204', message: 'Could not find the ‘something_else’ column' };
    const insert = vi.fn().mockResolvedValue({ error: err });

    const { error } = await insertWithOptionalColumns(row, ['gst_included_aud'], insert);

    expect(error).toBe(err);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('returns an unrelated error untouched, without dropping anything', async () => {
    const row = { total_aud: 10, processing_fee_aud: 2 };
    const err = { code: '23505', message: 'duplicate key' };
    const insert = vi.fn().mockResolvedValue({ error: err });

    const { error } = await insertWithOptionalColumns(row, ['processing_fee_aud'], insert);

    expect(error).toBe(err);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(row.processing_fee_aud).toBe(2);
  });

  it('reports each dropped column to the logging callback', async () => {
    const row = { total_aud: 10, processing_fee_aud: 2 };
    const onDrop = vi.fn();
    const insert = vi.fn()
      .mockResolvedValueOnce({ error: missing('processing_fee_aud') })
      .mockResolvedValueOnce({ error: null });

    await insertWithOptionalColumns(row, ['processing_fee_aud'], insert, onDrop);

    expect(onDrop).toHaveBeenCalledWith('processing_fee_aud');
  });
});
