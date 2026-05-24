import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { Download, X, FileSpreadsheet, Loader2 } from 'lucide-react';
import pb from '@/lib/pocketbaseClient.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

const CSVPreviewModal = ({ fileRecord, isOpen, onClose }) => {
  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && fileRecord) {
      loadCSVData();
    } else {
      setData([]);
      setHeaders([]);
      setError(null);
    }
  }, [isOpen, fileRecord]);

  const loadCSVData = async () => {
    setLoading(true);
    setError(null);
    try {
      const fileUrl = pb.files.getUrl(fileRecord, fileRecord.file);
      
      Papa.parse(fileUrl, {
        download: true,
        header: true,
        preview: 100, // Only load first 100 rows for preview
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors && results.errors.length > 0 && !results.data.length) {
            setError('Failed to parse CSV file.');
          } else {
            setHeaders(results.meta.fields || []);
            setData(results.data || []);
          }
          setLoading(false);
        },
        error: (err) => {
          console.error('PapaParse error:', err);
          setError('Failed to download or parse the CSV file.');
          setLoading(false);
        }
      });
    } catch (err) {
      console.error('Error loading CSV:', err);
      setError('An unexpected error occurred while loading the file.');
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!fileRecord) return;
    const fileUrl = pb.files.getUrl(fileRecord, fileRecord.file);
    window.open(fileUrl, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col bg-card border-border p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="p-6 border-b border-border flex flex-row items-center justify-between sticky top-0 bg-card z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-foreground">
                {fileRecord?.filename || 'CSV Preview'}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Previewing first 100 rows
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload} className="rounded-lg font-bold">
              <Download className="w-4 h-4 mr-2" /> Download Full File
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-lg">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden bg-background">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
              <p className="font-medium">Parsing CSV data...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-destructive">
              <p className="font-bold">{error}</p>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <p className="font-medium">No data found in this file.</p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(90vh-100px)] w-full">
              <div className="min-w-max p-4">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border">
                      {headers.map((header, i) => (
                        <TableHead key={i} className="font-bold text-foreground whitespace-nowrap bg-muted/50">
                          {header}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((row, rowIndex) => (
                      <TableRow key={rowIndex} className="border-border hover:bg-muted/30">
                        {headers.map((header, colIndex) => (
                          <TableCell key={colIndex} className="whitespace-nowrap text-muted-foreground max-w-[300px] truncate">
                            {row[header] || ''}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CSVPreviewModal;