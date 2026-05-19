import React from 'react';
import { Upload, FileSpreadsheet, History } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const CSVImportManagementPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">CSV Imports</h1>
        <p className="text-muted-foreground text-sm">Bulk import catalog items, market data, and user databases.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-dashed border-2 border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">Upload New Dataset</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              Drag and drop your CSV file here, or click to browse. Max file size 100MB.
            </p>
            <Button size="lg">Select File</Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileSpreadsheet className="w-5 h-5" /> Import Templates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">Download Product Catalog Template</Button>
              <Button variant="outline" className="w-full justify-start">Download Market Pricing Template</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="w-5 h-5" /> Recent Imports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground italic text-center py-4">No recent import history.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CSVImportManagementPage;