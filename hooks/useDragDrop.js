import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient.js';

// Drag-and-drop for the category taxonomy admin panel.
// In the Supabase schema categories are a single table with parent_id.
// brands/series/subcategories as separate tables no longer exist.
export const useDragDrop = () => {
  const [draggedItem, setDraggedItem] = useState(null);
  const [isDragging, setIsDragging]   = useState(false);

  const handleDragStart = useCallback((e, item, type, parentId = null) => {
    e.stopPropagation();
    const dragData = { ...item, type, parentId };
    setDraggedItem(dragData);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    setTimeout(() => e.target?.classList?.add('dragging'), 0);
  }, []);

  const handleDragEnd = useCallback((e) => {
    e.stopPropagation();
    setDraggedItem(null);
    setIsDragging(false);
    e.target?.classList?.remove('dragging');
  }, []);

  const getDraggedItem = useCallback(() => draggedItem, [draggedItem]);

  const validateDropZone = useCallback((draggedType, targetType) => {
    const valid = { category: ['category_list', 'category'] };
    return valid[draggedType]?.includes(targetType) ?? false;
  }, []);

  const calculateNewOrder = useCallback((items, draggedId, targetId, position = 'after') => {
    const newItems = [...items];
    const draggedIdx = newItems.findIndex(i => i.id === draggedId);
    const targetIdx  = newItems.findIndex(i => i.id === targetId);
    if (draggedIdx === -1 || targetIdx === -1) return items;
    const [removed] = newItems.splice(draggedIdx, 1);
    const adjusted  = draggedIdx < targetIdx ? targetIdx - 1 : targetIdx;
    newItems.splice(position === 'after' ? adjusted + 1 : adjusted, 0, removed);
    return newItems.map((item, index) => ({ ...item, order: index }));
  }, []);

  // Reparent a category (set parent_id)
  const updateItemParent = useCallback(async (_itemType, itemId, newParentId) => {
    const { error } = await supabase
      .from('categories')
      .update({ parent_id: newParentId })
      .eq('id', itemId);
    if (error) throw error;
    return true;
  }, []);

  // Update sort_order for a list of categories
  const updateItemOrder = useCallback(async (_itemType, itemsWithNewOrder) => {
    await Promise.all(
      itemsWithNewOrder.map(item =>
        supabase.from('categories').update({ sort_order: item.order }).eq('id', item.id)
          .then(() => {}, err => console.warn(`Could not update order for ${item.id}:`, err.message))
      )
    );
    return true;
  }, []);

  // Delete a category
  const deleteCategory = useCallback(async (categoryId) => {
    const { error } = await supabase.from('categories').delete().eq('id', categoryId);
    if (error) throw error;
    return true;
  }, []);

  // Legacy stubs — brands/series/subcategories no longer exist as tables
  const updateSeriesParentBrand      = async () => true;
  const updateBrandParentSubcategory = async () => true;
  const deleteSeries                 = async () => true;
  const deleteBrand                  = async () => true;
  const convertCategoryToSubcategory = useCallback(async (categoryId, targetCategoryId) => {
    // Convert to a child category by setting parent_id
    const { data: cat } = await supabase.from('categories').select('*').eq('id', categoryId).single();
    if (!cat) throw new Error('Category not found');
    await supabase.from('categories').update({ parent_id: targetCategoryId }).eq('id', categoryId);
    return cat;
  }, []);
  const convertBrandToSubcategory = async () => { throw new Error('brands table removed'); };
  const convertBrandToSeries      = async () => { throw new Error('brands table removed'); };
  const convertSeriesToBrand      = async () => { throw new Error('series table removed'); };

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
    updateItemOrder,
    deleteCategory,
  };
};
