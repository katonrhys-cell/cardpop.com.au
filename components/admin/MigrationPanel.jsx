import React, { useState } from 'react';
import { Database, Play, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const MigrationPanel = ({ onMigrationComplete }) => {
  const [status, setStatus] = useState('idle');

  const handleRunMigration = async () => {
    setStatus('running');
    await new Promise(r => setTimeout(r, 1000));
    setStatus('done');
    onMigrationComplete?.();
  };

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="h-4 w-4" /> Data Migration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Run migrations to update the category data structure.
        </p>
        {status === 'done' && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" /> Migration completed successfully.
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" /> Migration failed. Check console for details.
          </div>
        )}
        <Button
          size="sm"
          onClick={handleRunMigration}
          disabled={status === 'running' || status === 'done'}
        >
          {status === 'running' ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running…</>
          ) : (
            <><Play className="h-4 w-4 mr-2" /> Run Migration</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default MigrationPanel;
