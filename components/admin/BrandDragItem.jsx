import React from 'react';
import { ChevronRight, ChevronDown, Pencil, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const BrandDragItem = ({ brand, expanded, onToggle, onEdit, onDelete, onAddChild, childCount }) => {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 group ml-8">
      <button onClick={onToggle} className="text-muted-foreground hover:text-foreground">
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      <span className="flex-1 text-sm">{brand?.name}</span>
      {childCount > 0 && <Badge variant="secondary" className="text-xs">{childCount}</Badge>}
      <div className="opacity-0 group-hover:opacity-100 flex gap-1">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onAddChild?.(brand)}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit?.(brand)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onDelete?.(brand)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

export default BrandDragItem;
