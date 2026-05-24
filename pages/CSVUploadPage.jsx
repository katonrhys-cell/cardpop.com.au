import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, X, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import pb from '@/lib/pocketbaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const CSVUploadPage = ({ onUploadSuccess }) => {
  const { currentUser } = useAuth();
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (newFiles) => {
    const validFiles = Array.from(newFiles).filter(file => 
      file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')
    );

    if (validFiles.length !== newFiles.length) {
      toast.error('Only CSV files are allowed.');
    }

    setFiles(prev => [...prev, ...validFiles.map(f => ({ file: f, status: 'pending' }))]);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    if (!currentUser?.id) {
      toast.error('You must be logged in to upload files.');
      return;
    }
    
    setUploading(true);
    setProgress(0);
    
    let successCount = 0;
    let errorCount = 0;
    let lastError = null;

    for (let i = 0; i < files.length; i++) {
      const fileObj = files[i];
      if (fileObj.status === 'success') continue;

      try {
        const formData = new FormData();
        formData.append('file', fileObj.file);
        formData.append('filename', fileObj.file.name);
        formData.append('fileSize', fileObj.file.size);
        
        // Explicitly set uploadedBy from the authenticated user context
        formData.append('uploadedBy', currentUser.id);

        // Log for debugging to verify the field is being sent
        console.log(`Uploading ${fileObj.file.name} with uploadedBy: ${currentUser.id}`);

        await pb.collection('csvFiles').create(formData, { $autoCancel: false });
        
        setFiles(prev => prev.map((f, idx) => i === idx ? { ...f, status: 'success' } : f));
        successCount++;
      } catch (error) {
        console.error(`Upload error for ${fileObj.file.name}:`, error);
        
        // Capture validation errors from PocketBase
        const errorMsg = error.response?.message || error.message || 'Unknown error occurred';
        const validationErrors = error.response?.data ? JSON.stringify(error.response.data) : '';
        lastError = `${errorMsg} ${validationErrors}`;
        
        setFiles(prev => prev.map((f, idx) => i === idx ? { ...f, status: 'error' } : f));
        errorCount++;
      }
      
      setProgress(Math.round(((i + 1) / files.length) * 100));
    }

    setUploading(false);
    
    if (successCount > 0) {
      toast.success(`Successfully uploaded ${successCount} file(s).`);
      if (onUploadSuccess) onUploadSuccess();
      
      // Clear successful files after a delay
      setTimeout(() => {
        setFiles(prev => prev.filter(f => f.status !== 'success'));
        setProgress(0);
      }, 2000);
    }
    
    if (errorCount > 0) {
      toast.error(`Failed to upload ${errorCount} file(s). ${lastError ? `Details: ${lastError}` : ''}`);
    }
  };

  return (
    <div className="space-y-6">
      <div 
        className={`relative border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-300 ${
          dragActive ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/30'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".csv,text/csv"
          onChange={handleChange}
          className="hidden"
        />
        
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
            <UploadCloud className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground mb-2">Drag & Drop CSV Files</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Upload your spreadsheet data. Only .csv files are supported. Maximum file size is 100MB.
            </p>
          </div>
          <Button 
            onClick={() => inputRef.current?.click()} 
            variant="outline" 
            className="rounded-xl font-bold border-border bg-background shadow-sm"
            disabled={uploading}
          >
            Browse Files
          </Button>
        </div>
      </div>

      {files.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-foreground">Selected Files ({files.length})</h4>
            {uploading && <span className="text-sm font-bold text-primary">{progress}%</span>}
          </div>
          
          {uploading && <Progress value={progress} className="h-2 mb-6 bg-muted" />}

          <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto pr-2">
            {files.map((fileObj, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-xl border border-border bg-background">
                <div className="flex items-center gap-3 overflow-hidden">
                  <FileSpreadsheet className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-foreground truncate">{fileObj.file.name}</span>
                    <span className="text-xs text-muted-foreground">{formatFileSize(fileObj.file.size)}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  {fileObj.status === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                  {fileObj.status === 'error' && <span className="text-xs font-bold text-destructive">Failed</span>}
                  {fileObj.status === 'pending' && !uploading && (
                    <Button variant="ghost" size="icon" onClick={() => removeFile(index)} className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive">
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                  {fileObj.status === 'pending' && uploading && (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button 
              onClick={handleUpload} 
              disabled={uploading || files.every(f => f.status === 'success')}
              className="rounded-xl font-bold px-8 shadow-md"
            >
              {uploading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
              ) : (
                'Upload Files'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CSVUploadPage;