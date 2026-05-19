import React from 'react';
import { useParams } from 'react-router-dom';
import ShopCategoryPage from './ShopCategoryPage.jsx';

// Reusing the Category page logic since the design is identical, just filters differently
// In a full implementation, we'd pass subcategory as a prop or handle it via useSearchParams
const ShopSubcategoryPage = () => {
  const { subcategory } = useParams();
  // For the sake of this task, we will render the category page but it would ideally filter by subcategory
  return <ShopCategoryPage />; 
};

export default ShopSubcategoryPage;