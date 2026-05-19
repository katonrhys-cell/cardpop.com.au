// Mapping of collection names to image URLs for consistent display
export const collectionImages = {
  'NBA': 'https://images.unsplash.com/photo-1642692704110-1bcf24bb5689?auto=format&fit=crop&w=800&q=80',
  'Pokemon': 'https://images.unsplash.com/photo-1640499900704-b00dd6a1103a?auto=format&fit=crop&w=800&q=80',
  'Magic': 'https://images.unsplash.com/photo-1613771404721-1f92d799e49f?auto=format&fit=crop&w=800&q=80',
  'Yu-Gi-Oh': 'https://images.unsplash.com/photo-1593814681464-eef5af2b0628?auto=format&fit=crop&w=800&q=80',
  'Digimon': 'https://images.unsplash.com/photo-1681170920052-e083ae53fa48?auto=format&fit=crop&w=800&q=80',
  'Sports': 'https://images.unsplash.com/photo-1587280501635-68a0e82f5053?auto=format&fit=crop&w=800&q=80',
};

export const getCollectionImage = (collectionName, fallbackUrl) => {
  return collectionImages[collectionName] || fallbackUrl;
};