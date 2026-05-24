import React, { useState, useEffect } from 'react';
import { useCSVAnalyzer, parseCSVStructure } from '@/hooks/useCSVAnalyzer.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Upload, LayoutGrid, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import pb from '@/lib/pocketbaseClient.js';
import Papa from 'papaparse';

const MarketplaceCSVManager = () => {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewStructure, setPreviewStructure] = useState(null);
  const [currentStructureDate, setCurrentStructureDate] = useState(null);

  useEffect(() => {
    checkCurrentStructure();
  }, []);

  const checkCurrentStructure = async () => {
    try {
      const records = await pb.collection('marketplaceStructure').getList(1, 1, {
        sort: '-created',
        $autoCancel: false
      });
      if (records.items.length > 0) {
        setCurrentStructureDate(records.items[0].created);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPreviewStructure(null);
    }
  };

  const handleAnalyze = () => {
    if (!file) return;
    setIsProcessing(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const structure = parseCSVStructure(results.data);
          setPreviewStructure(structure);
          toast.success(`Found ${structure.categories.length} main categories`);
        } catch (error) {
          toast.error('Failed to parse structure from CSV.');
        } finally {
          setIsProcessing(false);
        }
      },
      error: (error) => {
        toast.error(`CSV Parsing error: ${error.message}`);
        setIsProcessing(false);
      }
    });
  };

  const handleApplyStructure = async () => {
    if (!previewStructure || !file) return;
    setIsProcessing(true);

    try {
      await pb.collection('marketplaceStructure').create({
        csvFileName: file.name,
        categories: previewStructure.categories,
        navigationTree: previewStructure.navigationTree,
        productMappings: previewStructure.productMappings,
        uploadedBy: pb.authStore.model.id
      }, { $autoCancel: false });

      toast.success('Marketplace structure updated successfully! Navigation menu will now use this data.');
      checkCurrentStructure();
      setFile(null);
      setPreviewStructure(null);
      // Optional: force reload to refresh layout
      window.location.reload();
    } catch (error) {
      console.error(error);
      toast.error('Failed to save marketplace structure.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-primary" />
            Marketplace Structure Engine
          </CardTitle>
          <CardDescription>
            Upload a master CSV to dynamically generate your marketplace categories and navigation tree.
            {currentStructureDate && (
              <span className="block mt-2 text-emerald-600 font-medium bg-emerald-500/10 p-2 rounded-lg inline-flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Active structure loaded (from {new Date(currentStructureDate).toLocaleDateString()})
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Select Structure CSV</label>
              <Input type="file" accept=".csv" onChange={handleFileChange} />
            </div>
            <Button onClick={handleAnalyze} disabled={!file || isProcessing} variant="secondary">
              {isProcessing && !previewStructure ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Analyze File
            </Button>
          </div>

          {previewStructure && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 border border-border rounded-xl p-6 bg-muted/30">
              <h3 className="font-bold text-lg mb-4">Structure Preview</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-3">Detected Categories</h4>
                  <ul className="space-y-2">
                    {previewStructure.categories.slice(0, 8).map(cat => (
                      <li key={cat.id} className="text-sm bg-background p-2 rounded border border-border flex justify-between items-center">
                        <span className="font-medium">{cat.name}</span>
                        <span className="text-xs text-muted-foreground">{cat.subcategories?.length || 0} subcats</span>
                      </li>
                    ))}
                    {previewStructure.categories.length > 8 && (
                      <li className="text-sm text-muted-foreground italic">+ {previewStructure.categories.length - 8} more...</li>
                    )}
                  </ul>
                </div>
                <div>
                   <h4 className="text-sm font-semibold text-muted-foreground mb-3">Summary</h4>
                   <div className="bg-background p-4 rounded-xl border border-border space-y-2 text-sm">
                     <p><strong>Total Main Categories:</strong> {previewStructure.categories.length}</p>
                     <p><strong>Total Subcategories:</strong> {previewStructure.categories.reduce((acc, c) => acc + (c.subcategories?.length || 0), 0)}</p>
                     <p><strong>Mapped Products:</strong> {Object.keys(previewStructure.productMappings).length}</p>
                   </div>
                   <div className="mt-4 flex items-start gap-2 text-sm text-amber-600 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                     <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                     <p>Applying this structure will immediately update the main navigation for all users.</p>
                   </div>
                </div>
              </div>
              
              <Button onClick={handleApplyStructure} disabled={isProcessing} className="w-full">
                {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Apply Structure to Live Site
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketplaceCSVManager;