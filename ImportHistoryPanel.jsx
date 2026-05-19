import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Eye, Download, Trash2 } from 'lucide-react';
import { getImportHistory } from '@/utils/CSVImportProcessor.js';
import pb from '@/lib/pocketbaseClient.js';
import { toast } from 'sonner';

const ImportHistoryPanel = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const result = await getImportHistory(1, 50);
      setHistory(result.items);
    } catch (error) {
      console.error('Failed to fetch import history:', error);
      toast.error('Failed to load import history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this import record?')) return;
    try {
      await pb.collection('importHistory').delete(id, { $autoCancel: false });
      toast.success('Record deleted');
      fetchHistory();
    } catch (error) {
      toast.error('Failed to delete record');
    }
  };

  const exportReport = (report) => {
    const dataStr = JSON.stringify(report.errorDetails, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `error_report_${report.id}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>File Name</TableHead>
              <TableHead className="text-center">Total</TableHead>
              <TableHead className="text-center">Success</TableHead>
              <TableHead className="text-center">Failed</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : history.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No import history found.
                </TableCell>
              </TableRow>
            ) : (
              history.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(record.created).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-medium">{record.csvFileName}</TableCell>
                  <TableCell className="text-center">{record.totalRecords}</TableCell>
                  <TableCell className="text-center text-emerald-600 font-medium">{record.successfulRecords}</TableCell>
                  <TableCell className="text-center text-destructive font-medium">{record.failedRecords}</TableCell>
                  <TableCell>
                    {record.importStatus === 'success' && <Badge className="bg-emerald-500/10 text-emerald-600 border-none">Success</Badge>}
                    {record.importStatus === 'partial' && <Badge className="bg-orange-500/10 text-orange-600 border-none">Partial</Badge>}
                    {record.importStatus === 'failed' && <Badge variant="destructive">Failed</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedReport(record)} title="View Report">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => exportReport(record)} title="Export Errors">
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(record.id)} title="Delete Record">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Report: {selectedReport?.csvFileName}</DialogTitle>
          </DialogHeader>
          
          {selectedReport && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-muted text-center">
                  <div className="text-2xl font-bold">{selectedReport.totalRecords}</div>
                  <div className="text-xs text-muted-foreground mt-1">Total</div>
                </div>
                <div className="p-4 rounded-xl bg-emerald-500/10 text-center border border-emerald-500/20">
                  <div className="text-2xl font-bold text-emerald-600">{selectedReport.successfulRecords}</div>
                  <div className="text-xs text-emerald-600/80 mt-1">Success</div>
                </div>
                <div className="p-4 rounded-xl bg-destructive/10 text-center border border-destructive/20">
                  <div className="text-2xl font-bold text-destructive">{selectedReport.failedRecords}</div>
                  <div className="text-xs text-destructive/80 mt-1">Failed</div>
                </div>
              </div>

              {selectedReport.errorDetails && selectedReport.errorDetails.length > 0 ? (
                <div>
                  <h4 className="font-bold mb-3">Error Details</h4>
                  <div className="space-y-3">
                    {selectedReport.errorDetails.slice(0, 50).map((err, idx) => (
                      <div key={idx} className="p-3 rounded-lg border border-destructive/20 bg-destructive/5 text-sm">
                        <span className="font-bold text-destructive">Row {err.row}:</span> {err.errors.join(', ')}
                      </div>
                    ))}
                    {selectedReport.errorDetails.length > 50 && (
                      <p className="text-sm text-muted-foreground italic">Showing first 50 errors. Export to view all.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No errors recorded for this import.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImportHistoryPanel;