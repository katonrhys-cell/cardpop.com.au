import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';
import { validateRow } from '@/utils/CSVImportProcessor.js';

const LISTING_FIELDS = [
  { id: 'title', label: 'Title', required: true, type: 'text' },
  { id: 'price', label: 'Price', required: true, type: 'number' },
  { id: 'description', label: 'Description', required: false, type: 'text' },
  { id: 'category', label: 'Category', required: false, type: 'text' },
  { id: 'quantity', label: 'Quantity', required: false, type: 'number' },
  { id: 'sku', label: 'SKU', required: false, type: 'text' },
];

const CSVMappingInterface = ({ csvHeaders, csvData, onBack, onImport }) => {
  const [mapping, setMapping] = useState(() => {
    const initial = {};
    LISTING_FIELDS.forEach(field => {
      // Auto-map if exact match (case insensitive)
      const match = csvHeaders.find(h => h.toLowerCase() === field.id.toLowerCase());
      if (match) initial[field.id] = match;
    });
    return initial;
  });

  const handleMapChange = (listingField, csvColumn) => {
    setMapping(prev => ({
      ...prev,
      [listingField]: csvColumn === 'unmapped' ? null : csvColumn
    }));
  };

  const validationSummary = useMemo(() => {
    let valid = 0;
    let invalid = 0;
    
    csvData.forEach(row => {
      const { isValid } = validateRow(row, mapping);
      if (isValid) valid++;
      else invalid++;
    });

    return { valid, invalid, total: csvData.length };
  }, [csvData, mapping]);

  const previewData = csvData.slice(0, 3);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Mapping Section */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-bold mb-4">Field Mapping</h3>
          <div className="space-y-4">
            {LISTING_FIELDS.map(field => (
              <div key={field.id} className="flex items-center justify-between gap-4 p-3 rounded-xl border border-border bg-background">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{field.label}</span>
                    {field.required && <span className="text-xs text-destructive font-bold">*</span>}
                  </div>
                  <span className="text-xs text-muted-foreground">Type: {field.type}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <Select 
                    value={mapping[field.id] || 'unmapped'} 
                    onValueChange={(val) => handleMapChange(field.id, val)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select CSV Column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unmapped" className="text-muted-foreground italic">-- Unmapped --</SelectItem>
                      {csvHeaders.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Validation & Preview Section */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold mb-4">Validation Summary</h3>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-muted text-center">
                <div className="text-2xl font-bold">{validationSummary.total}</div>
                <div className="text-xs text-muted-foreground mt-1">Total Rows</div>
              </div>
              <div className="p-4 rounded-xl bg-emerald-500/10 text-center border border-emerald-500/20">
                <div className="text-2xl font-bold text-emerald-600">{validationSummary.valid}</div>
                <div className="text-xs text-emerald-600/80 mt-1">Valid Rows</div>
              </div>
              <div className="p-4 rounded-xl bg-destructive/10 text-center border border-destructive/20">
                <div className="text-2xl font-bold text-destructive">{validationSummary.invalid}</div>
                <div className="text-xs text-destructive/80 mt-1">Invalid Rows</div>
              </div>
            </div>

            {validationSummary.invalid > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-700 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p>Some rows are missing required fields or have invalid data types based on your current mapping. They will be skipped during import.</p>
              </div>
            )}
            {validationSummary.invalid === 0 && validationSummary.total > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <p>All rows look good and are ready to import!</p>
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm overflow-hidden">
            <h3 className="text-lg font-bold mb-4">Data Preview (Mapped)</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {LISTING_FIELDS.filter(f => mapping[f.id]).map(field => (
                      <TableHead key={field.id}>{field.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row, idx) => (
                    <TableRow key={idx}>
                      {LISTING_FIELDS.filter(f => mapping[f.id]).map(field => (
                        <TableCell key={field.id} className="truncate max-w-[150px]">
                          {row[mapping[field.id]] || '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-border">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to File Selection
        </Button>
        <Button 
          onClick={() => onImport(mapping)} 
          disabled={validationSummary.valid === 0}
          className="gap-2 px-8"
        >
          Start Import <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default CSVMappingInterface;