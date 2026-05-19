
import { useState, useCallback } from 'react';
import pb from '@/lib/pocketbaseClient.js';
import { toast } from 'sonner';

export const useDragDrop = () => {
  const [draggedItem, setDraggedItem] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback((e, item, type, parentId = null) => {
    e.stopPropagation();
    const dragData = { ...item, type, parentId };
    setDraggedItem(dragData);
    setIsDragging(true);
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    
    setTimeout(() => {
      if (e.target && e.target.classList) {
        e.target.classList.add('dragging');
      }
    }, 0);
  }, []);

  const handleDragEnd = useCallback((e) => {
    e.stopPropagation();
    setDraggedItem(null);
    setIsDragging(false);
    if (e.target && e.target.classList) {
      e.target.classList.remove('dragging');
    }
  }, []);

  const getDraggedItem = useCallback(() => {
    return draggedItem;
  }, [draggedItem]);

  const validateDropZone = useCallback((draggedType, targetType) => {
    const validDrops = {
      'category': ['category_list', 'category'], 
      'subcategory': ['category', 'subcategory_list', 'subcategory'], 
      'brand': ['subcategory', 'brand_list', 'category', 'brand'], 
      'series': ['brand', 'series_list', 'subcategory', 'category'] 
    };

    return validDrops[draggedType]?.includes(targetType) || false;
  }, []);

  const calculateNewOrder = useCallback((items, draggedId, targetId, position = 'after') => {
    const newItems = [...items];
    const draggedIndex = newItems.findIndex(item => item.id === draggedId);
    const targetIndex = newItems.findIndex(item => item.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return items;
    
    const [removed] = newItems.splice(draggedIndex, 1);
    const adjustedTargetIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
    const insertIndex = position === 'after' ? adjustedTargetIndex + 1 : adjustedTargetIndex;
    
    newItems.splice(insertIndex, 0, removed);
    
    return newItems.map((item, index) => ({
      ...item,
      order: index
    }));
  }, []);

  const updateItemParent = useCallback(async (itemType, itemId, newParentId) => {
    const collectionMap = {
      'subcategory': { collection: 'subcategories', parentField: 'parentCategory' },
      'brand': { collection: 'brands', parentField: 'parentSubcategory' },
      'series': { collection: 'series', parentField: 'parentBrand' }
    };

    const config = collectionMap[itemType];
    if (!config) throw new Error('Invalid item type for reparenting');

    try {
      await pb.collection(config.collection).update(itemId, {
        [config.parentField]: newParentId
      }, { $autoCancel: false });
      return true;
    } catch (error) {
      console.error('Error updating parent:', error);
      throw error;
    }
  }, []);

  const updateSeriesParentBrand = useCallback(async (seriesId, newBrandId) => {
    try {
      await pb.collection('series').update(seriesId, { parentBrand: newBrandId }, { $autoCancel: false });
      return true;
    } catch (error) {
      console.error('Error updating series parent brand:', error);
      throw error;
    }
  }, []);

  const updateBrandParentSubcategory = useCallback(async (brandId, newSubcategoryId) => {
    try {
      await pb.collection('brands').update(brandId, { parentSubcategory: newSubcategoryId }, { $autoCancel: false });
      return true;
    } catch (error) {
      console.error('Error updating brand parent subcategory:', error);
      throw error;
    }
  }, []);

  const deleteSeries = useCallback(async (seriesId) => {
    try {
      await pb.collection('series').delete(seriesId, { $autoCancel: false });
      return true;
    } catch (error) {
      console.error('Error deleting series:', error);
      throw error;
    }
  }, []);

  const deleteBrand = useCallback(async (brandId) => {
    try {
      await pb.collection('brands').delete(brandId, { $autoCancel: false });
      return true;
    } catch (error) {
      console.error('Error deleting brand:', error);
      throw error;
    }
  }, []);

  const convertCategoryToSubcategory = useCallback(async (categoryId, targetCategoryId) => {
    const category = await pb.collection('categories').getOne(categoryId, { $autoCancel: false });
    const newSubcategory = await pb.collection('subcategories').create({
      name: category.name,
      slug: category.slug,
      description: category.description,
      parentCategory: targetCategoryId
    }, { $autoCancel: false });
    await pb.collection('categories').delete(categoryId, { $autoCancel: false });
    return newSubcategory;
  }, []);

  const convertBrandToSubcategory = useCallback(async (brandId, targetCategoryId) => {
    const brand = await pb.collection('brands').getOne(brandId, { $autoCancel: false });
    const newSubcategory = await pb.collection('subcategories').create({
      name: brand.name,
      slug: brand.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: brand.description,
      parentCategory: targetCategoryId
    }, { $autoCancel: false });
    await pb.collection('brands').delete(brandId, { $autoCancel: false });
    return newSubcategory;
  }, []);

  const convertBrandToSeries = useCallback(async (brandId, targetBrandId) => {
    const brand = await pb.collection('brands').getOne(brandId, { $autoCancel: false });
    const newSeries = await pb.collection('series').create({
      name: brand.name,
      description: brand.description,
      parentBrand: targetBrandId
    }, { $autoCancel: false });
    await pb.collection('brands').delete(brandId, { $autoCancel: false });
    return newSeries;
  }, []);

  const convertSeriesToBrand = useCallback(async (seriesId, targetSubcategoryId) => {
    const series = await pb.collection('series').getOne(seriesId, { $autoCancel: false });
    const newBrand = await pb.collection('brands').create({
      name: series.name,
      description: series.description,
      parentSubcategory: targetSubcategoryId
    }, { $autoCancel: false });
    await pb.collection('series').delete(seriesId, { $autoCancel: false });
    return newBrand;
  }, []);

  const updateItemOrder = useCallback(async (itemType, itemsWithNewOrder) => {
    const collectionMap = {
      'category': 'categories',
      'subcategory': 'subcategories',
      'brand': 'brands',
      'series': 'series'
    };

    const collection = collectionMap[itemType];
    if (!collection) return;

    try {
      const promises = itemsWithNewOrder.map(item => 
        pb.collection(collection).update(item.id, { order: item.order }, { $autoCancel: false })
          .catch(err => console.warn(`Could not update order for ${item.id}:`, err.message))
      );
      await Promise.all(promises);
      return true;
    } catch (error) {
      console.error('Error updating order:', error);
      throw error;
    }
  }, []);

  return {
    draggedItem,
    isDragging,
    handleDragStart,
    handleDragEnd,
    getDraggedItem,
    validateDropZone,
    calculateNewOrder,
    updateItemParent,
    updateSeriesParentBrand,
    updateBrandParentSubcategory,
    deleteSeries,
    deleteBrand,
    convertCategoryToSubcategory,
    convertBrandToSubcategory,
    convertBrandToSeries,
    convertSeriesToBrand,
    updateItemOrder
  };
};
