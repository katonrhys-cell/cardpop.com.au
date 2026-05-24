import React from 'react';
import { BarChart3, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const AnalyticsPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading">Analytics & Reports</h1>
          <p className="text-muted-foreground text-sm">Deep dive into platform performance metrics.</p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="w-4 h-4" /> Export Report
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="min-h-[300px] flex flex-col items-center justify-center text-center p-6 border-dashed">
          <BarChart3 className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <CardTitle className="mb-2">Revenue Chart Setup</CardTitle>
          <CardDescription>Chart visualization will appear here when enough data is collected.</CardDescription>
        </Card>

        <Card className="min-h-[300px] flex flex-col items-center justify-center text-center p-6 border-dashed">
          <BarChart3 className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <CardTitle className="mb-2">User Growth Analytics</CardTitle>
          <CardDescription>Demographics and acquisition metrics.</CardDescription>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticsPage;