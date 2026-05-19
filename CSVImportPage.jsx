import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { FileSpreadsheet, Play, AlertCircle, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import apiServerClient from '@/lib/apiServerClient';
import { toast } from 'sonner';

const CSVImportPage = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  const handleImport = async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    setProgress(10);

    try {
      const progressInterval = setInterval(() => {
        setProgress(prev => (prev < 90 ? prev + 10 : prev));
      }, 500);

      const response = await apiServerClient.fetch('/csv/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Import failed');
      }

      const data = await response.json();
      setResults(data);
      toast.success('CSV Import completed successfully');
    } catch (err) {
      console.error('Import error:', err);
      setError(err.message);
      toast.error('Failed to import CSV files');
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const collections = [
    { key: 'products', name: 'Shop Products', link: '/shop' },
    { key: 'marketplace', name: 'Marketplace Listings', link: '/marketplace' },
    { key: 'markets', name: 'Market Data', link: '/markets' },
    { key: 'grading', name: 'Grading Guides', link: '/grading' },
    { key: 'community', name: 'Community Content', link: '/community' },
    { key: 'blog', name: 'Blog Articles', link: '/blog' }
  ];

  return (
    <div className="container-default section-padding min-h-screen">
      <Helmet><title>CSV Import Manager | Admin</title></Helmet>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <FileSpreadsheet className="w-8 h-8 text-primary" />
          CSV Import Manager
        </h1>
        <p className="text-muted-foreground">
          Import data from CSV files located in the backend <code>csvfiles</code> directory.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Import Action</CardTitle>
              <CardDescription>
                Reads all CSV files from the server and imports them into their respective PocketBase collections.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleImport} 
                disabled={loading} 
                className="w-full h-12 text-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    Start Import
                  </>
                )}
              </Button>

              {loading && (
                <div className="mt-6 space-y-2">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Importing data...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              {error && (
                <div className="mt-6 p-4 bg-destructive/10 text-destructive rounded-xl flex items-start gap-3 text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {results ? (
            <Card className="shadow-sm border-emerald-500/20">
              <CardHeader className="bg-emerald-500/5 border-b border-border">
                <CardTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                  Import Results
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {collections.map(({ key, name, link }) => {
                    const stats = results.collections?.[key] || { imported: 0, failed: 0 };
                    return (
                      <div key={key} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h3 className="font-bold text-lg">{name}</h3>
                          <div className="flex gap-3 mt-2">
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
                              {stats.imported} Imported
                            </Badge>
                            {stats.failed > 0 && (
                              <Badge variant="destructive">
                                {stats.failed} Failed
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button variant="outline" asChild size="sm">
                          <Link to={link}>
                            View Data <ArrowRight className="w-4 h-4 ml-2" />
                          </Link>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-sm h-full flex flex-col items-center justify-center p-12 text-center text-muted-foreground border-dashed">
              <FileSpreadsheet className="w-12 h-12 mb-4 opacity-20" />
              <h3 className="text-lg font-medium mb-2">No Import Results Yet</h3>
              <p className="max-w-sm">Click the Start Import button to process CSV files and view the results here.</p>
            </Card>
          )}

          {results?.errors?.length > 0 && (
            <Card className="shadow-sm border-destructive/20">
              <CardHeader>
                <CardTitle className="text-destructive flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Import Errors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {results.errors.map((fileError, idx) => (
                    <div key={idx} className="space-y-2">
                      <h4 className="font-semibold text-sm bg-muted px-3 py-1 rounded-md inline-block">
                        {fileError.file} ({fileError.collection})
                      </h4>
                      <ul className="space-y-1 text-sm text-muted-foreground pl-4 list-disc">
                        {fileError.errors.map((err, errIdx) => (
                          <li key={errIdx}>
                            Row {err.row}: {err.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default CSVImportPage;