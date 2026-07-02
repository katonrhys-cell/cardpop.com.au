import React from 'react';
import { Trash2, Archive, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BulkActionsBar = ({ selectedCount = 0, onBulkDelete, onBulkArchive, onClearSelection }) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-background border border-border rounded-xl shadow-lg px-4 py-2.5">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CheckSquare className="h-4 w-4 text-primary" />
        {selectedCount} selected
      </div>
      <div className="h-4 w-px bg-border" />
      {onBulkArchive && (
        <Button size="sm" variant="outline" onClick={onBulkArchive}>
          <Archive className="h-3.5 w-3.5 mr-1.5" /> Archive
        </Button>
      )}
      {onBulkDelete && (
        <Button size="sm" variant="destructive" onClick={onBulkDelete}>
          <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={onClearSelection}>Clear</Button>
    </div>
  );
};

export default BulkActionsBar;
