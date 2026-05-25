import React from 'react';
import { Shield, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const AuditLog = ({ entries = [] }) => {
  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4" /> Security Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <Clock className="h-8 w-8" />
            <p className="text-sm">No security events recorded.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry, i) => (
              <li key={i} className="flex items-start gap-3 text-sm border-b border-border pb-2 last:border-0">
                <span className="text-muted-foreground whitespace-nowrap">{entry.timestamp}</span>
                <span>{entry.description}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default AuditLog;
