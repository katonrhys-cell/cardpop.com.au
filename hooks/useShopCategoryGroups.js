// The shop taxonomy as the storefront and admin should see it: the built-in
// groups from utils/shopCategories.js with the admin's shop_categories rows
// (added / removed categories) merged over them.
//
// One fetch is shared by every component on the page (module-level cache), and
// the built-in list renders immediately so menus never wait on the network. If
// the read fails (e.g. the migration hasn't landed yet) the built-ins stand.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import {
  SHOP_CATEGORY_GROUPS, mergeShopCategoryGroups, flattenShopCategoryGroups,
} from '@/utils/shopCategories.js';

let cachedRows = null;
let inflight = null;
const listeners = new Set();

async function fetchRows() {
  try {
    const { data, error } = await supabase
      .from('shop_categories')
      .select('id, section_slug, name, description, hidden, created_at')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch {
    return cachedRows || [];
  }
}

/** (Re)load the rows and push them to every mounted hook. */
export function refreshShopCategories() {
  inflight = fetchRows().then((rows) => {
    cachedRows = rows;
    inflight = null;
    listeners.forEach((fn) => fn(rows));
    return rows;
  });
  return inflight;
}

/** Test hook: forget the cached rows. */
export function resetShopCategoryCache() {
  cachedRows = null;
  inflight = null;
}

/**
 * @returns {{ groups: object[], categories: object[], rows: object[], loaded: boolean,
 *             findCategory: (slug: string) => object|null }}
 */
export default function useShopCategoryGroups() {
  const [rows, setRows] = useState(cachedRows);

  useEffect(() => {
    listeners.add(setRows);
    if (cachedRows) setRows(cachedRows);
    else if (!inflight) refreshShopCategories();
    return () => { listeners.delete(setRows); };
  }, []);

  return useMemo(() => {
    const groups = rows ? mergeShopCategoryGroups(SHOP_CATEGORY_GROUPS, rows) : SHOP_CATEGORY_GROUPS;
    const categories = flattenShopCategoryGroups(groups);
    return {
      groups,
      categories,
      rows: rows || [],
      loaded: rows !== null,
      findCategory: (slug) => categories.find((c) => c.slug === slug) || null,
    };
  }, [rows]);
}
