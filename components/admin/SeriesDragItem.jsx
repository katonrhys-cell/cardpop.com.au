import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SeriesDragItem = ({ series, onEdit, onDelete }) => {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 group ml-12">
      <span className="flex-1 text-sm text-muted-foreground">{series?.name}</span>
      <div className="opacity-0 group-hover:opacity-100 flex gap-1">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit?.(series)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onDelete?.(series)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

export default SeriesDragItem;
