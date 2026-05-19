import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { FileSpreadsheet, Download, Eye, Trash2, Search, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import pb from '@/lib/pocketbaseClient.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import CSVPreviewModal from '@/components/CSVPreviewModal.jsx';

const CSVFileManager = ({ refreshTrigger }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewFile, setPreviewFile] = useState(null);

  useEffect(() => {
    fetchFiles();
  }, [refreshTrigger]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const records = await pb.collection('csvFiles').getFullList({
        sort: '-created',
        $autoCancel: false
      });
      setFiles(records);
    } catch (error) {
      console.error('Error fetching CSV files:', error);
      toast.error('Failed to load files.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, filename) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await pb.collection('csvFiles').delete(id, { $autoCancel: false });
      toast.success('File deleted successfully.');
      setFiles(files.filter(f => f.id !== id));
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file.');
    }
  };

  const handleDownload = (record) => {
    const url = pb.files.getUrl(record, record.file);
    window.open(url, '_blank');
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredFiles = files.filter(f => 
    f.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search files..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background border-border rounded-xl h-11"
          />
        </div>
        <div className="text-sm font-medium text-muted-foreground bg-muted/50 px-4 py-2 rounded-lg border border-border">
          Total Files: {filteredFiles.length}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent border-border">
                <TableHead className="font-bold">Filename</TableHead>
                <TableHead className="font-bold">Size</TableHead>
                <TableHead className="font-bold">Uploaded</TableHead>
                <TableHead className="font-bold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i} className="border-border">
                    <TableCell><Skeleton className="h-5 w-48 bg-background" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 bg-background" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32 bg-background" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto bg-background" /></TableCell>
                  </TableRow>
                ))
              ) : filteredFiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <FileSpreadsheet className="w-12 h-12 mb-3 opacity-20" />
                      <p className="font-bold text-foreground">No files found</p>
                      <p className="text-sm">Upload a CSV file to get started.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredFiles.map((file) => (
                  <TableRow key={file.id} className="border-border hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium text-foreground">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <FileSpreadsheet className="w-4 h-4" />
                        </div>
                        <span className="truncate max-w-[200px] sm:max-w-xs" title={file.filename}>
                          {file.filename}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatFileSize(file.fileSize)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(file.created), 'MMM d, yyyy HH:mm')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => setPreviewFile(file)} title="Preview" className="h-8 w-8 rounded-lg hover:bg-background hover:text-primary">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDownload(file)} title="Download" className="h-8 w-8 rounded-lg hover:bg-background hover:text-primary">
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(file.id, file.filename)} title="Delete" className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive">
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
      </div>

      <CSVPreviewModal 
        isOpen={!!previewFile} 
        onClose={() => setPreviewFile(null)} 
        fileRecord={previewFile} 
      />
    </div>
  );
};

export default CSVFileManager;