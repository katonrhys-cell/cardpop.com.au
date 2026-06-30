import { supabase } from '@/lib/supabaseClient.js';

export const autoMapCategories = async (onProgress) => {
  try {
    // Fetch all categories from Supabase
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('*')
      .is('parent_id', null);
    if (catError) throw catError;
    if (!categories || categories.length === 0) {
      throw new Error("No categories found");
    }

    // Fetch unmapped listings (category_id is null)
    const { data: unmappedListings, error: listError } = await supabase
      .from('listings')
      .select('*')
      .is('category_id', null);
    if (listError) throw listError;

    const listings = unmappedListings || [];
    let mappedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < listings.length; i++) {
      const listing = listings[i];
      let matchedCategory = null;

      // Basic matching logic based on collection_type or brand
      const collectionTypeLower = (listing.collection_type || listing.collectionType || listing.brand || '').toLowerCase();

      for (const cat of categories) {
        const catName = (cat.name || '').toLowerCase();
        if (!catName) continue; // a null category name must not crash the batch
        if (catName === collectionTypeLower || (collectionTypeLower && collectionTypeLower.includes(catName))) {
          matchedCategory = cat;
          break;
        }
      }

      if (matchedCategory) {
        const updateData = { category_id: matchedCategory.id };
        const { error: updateError } = await supabase
          .from('listings')
          .update(updateData)
          .eq('id', listing.id);
        // Only count rows that actually changed — an ignored {error} (e.g. RLS
        // denial) previously reported false "Successfully mapped N" with 0 writes.
        if (updateError) {
          failedCount++;
        } else {
          mappedCount++;
        }
      } else {
        failedCount++;
      }

      if (onProgress) {
        onProgress(Math.round(((i + 1) / listings.length) * 100));
      }
    }

    return { success: true, mappedCount, failedCount, total: listings.length };
  } catch (error) {
    console.error("Auto mapping failed:", error);
    return { success: false, error: error.message };
  }
};