import React from 'react';
import { ChevronRight, ChevronDown, FolderOpen, Folder, Pencil, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const CategoryDragItem = ({ category, expanded, onToggle, onEdit, onDelete, onAddChild, childCount }) => {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 group">
      <button onClick={onToggle} className="text-muted-foreground hover:text-foreground">
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {expanded ? <FolderOpen className="h-4 w-4 text-primary" /> : <Folder className="h-4 w-4 text-primary" />}
      <span className="flex-1 font-medium text-sm">{category?.name}</span>
      {childCount > 0 && <Badge variant="secondary" className="text-xs">{childCount}</Badge>}
      <div className="opacity-0 group-hover:opacity-100 flex gap-1">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onAddChild?.(category)}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit?.(category)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onDelete?.(category)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

export default CategoryDragItem;
