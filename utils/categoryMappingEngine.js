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
        if (cat.name.toLowerCase() === collectionTypeLower || collectionTypeLower.includes(cat.name.toLowerCase())) {
          matchedCategory = cat;
          break;
        }
      }

      if (matchedCategory) {
        const updateData = { category_id: matchedCategory.id };
        await supabase.from('listings').update(updateData).eq('id', listing.id);
        mappedCount++;
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