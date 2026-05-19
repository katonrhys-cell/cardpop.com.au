import { useMemo } from 'react';

export const parseCSVStructure = (csvData) => {
  if (!csvData || !Array.isArray(csvData) || csvData.length === 0) return { categories: [], navigationTree: {} };

  const categoryMap = {};
  const productMappings = {};

  csvData.forEach((row, index) => {
    // Try to find category columns (case-insensitive)
    const keys = Object.keys(row);
    const catKey = keys.find(k => k.toLowerCase() === 'category');
    const subCatKey = keys.find(k => k.toLowerCase() === 'subcategory');
    const titleKey = keys.find(k => k.toLowerCase() === 'title' || k.toLowerCase() === 'name');

    const catValue = catKey ? row[catKey]?.trim() : 'Uncategorized';
    const subCatValue = subCatKey ? row[subCatKey]?.trim() : null;
    const titleValue = titleKey ? row[titleKey]?.trim() : `Product ${index}`;

    if (catValue) {
      if (!categoryMap[catValue]) {
        categoryMap[catValue] = {
          id: catValue.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          name: catValue,
          subcategories: new Set()
        };
      }
      if (subCatValue) {
        categoryMap[catValue].subcategories.add(subCatValue);
      }

      productMappings[titleValue] = {
        category: catValue,
        subcategory: subCatValue
      };
    }
  });

  const categories = Object.values(categoryMap).map(c => ({
    ...c,
    subcategories: Array.from(c.subcategories).map(sub => ({
      id: sub.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: sub
    }))
  }));

  const navigationTree = categories.reduce((acc, cat) => {
    acc[cat.id] = {
      name: cat.name,
      children: cat.subcategories
    };
    return acc;
  }, {});

  return { categories, navigationTree, productMappings };
};

export const useCSVAnalyzer = (csvData) => {
  return useMemo(() => parseCSVStructure(csvData), [csvData]);
};