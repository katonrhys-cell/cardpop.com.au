import pb from '@/lib/pocketbaseClient.js';

export const autoMapCategories = async (onProgress) => {
  try {
    const structure = await pb.collection('marketplaceStructure').getFirstListItem('', { $autoCancel: false });
    if (!structure || !structure.categories) {
      throw new Error("Marketplace structure not found");
    }

    const categories = structure.categories;

    // Fetch unmapped listings
    const unmappedListings = await pb.collection('cardListings').getFullList({
      filter: 'categoryId = "" || categoryId = null',
      $autoCancel: false
    });

    let mappedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < unmappedListings.length; i++) {
      const listing = unmappedListings[i];
      let matchedCategory = null;

      // Basic matching logic based on collectionType or brand
      const collectionTypeLower = (listing.collectionType || listing.brand || '').toLowerCase();
      
      for (const cat of categories) {
        if (cat.name.toLowerCase() === collectionTypeLower || collectionTypeLower.includes(cat.name.toLowerCase())) {
          matchedCategory = cat;
          break;
        }
      }

      if (matchedCategory) {
        const updateData = { categoryId: matchedCategory.id };
        
        // Match subcategory (e.g. Set/Series)
        if (matchedCategory.subcategories && listing.series) {
          const seriesLower = listing.series.toLowerCase();
          const matchedSub = matchedCategory.subcategories.find(s => 
            s.name.toLowerCase() === seriesLower || seriesLower.includes(s.name.toLowerCase())
          );
          if (matchedSub) {
            updateData.subcategoryId = matchedSub.id;
          }
        }

        await pb.collection('cardListings').update(listing.id, updateData, { $autoCancel: false });
        mappedCount++;
      } else {
        failedCount++;
      }

      if (onProgress) {
        onProgress(Math.round(((i + 1) / unmappedListings.length) * 100));
      }
    }

    return { success: true, mappedCount, failedCount, total: unmappedListings.length };
  } catch (error) {
    console.error("Auto mapping failed:", error);
    return { success: false, error: error.message };
  }
};