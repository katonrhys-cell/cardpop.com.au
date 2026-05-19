import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ChevronRight, FileSpreadsheet, History, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import pb from '@/lib/pocketbaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { parseCSVFile, importCSVData } from '@/utils/CSVImportProcessor.js';
import CSVMappingInterface from '@/components/CSVMappingInterface.jsx';
import ImportHistoryPanel from '@/components/ImportHistoryPanel.jsx';

const CSVParserPage = () => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('parse');
  
  // Flow State
  const [step, setStep] = useState('select'); // select, mapping, importing, complete
  const [csvFiles, setCsvFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  
  // Parsing State
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  
  // Import State
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, percentage: 0 });
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    fetchCsvFiles();
  }, []);

  const fetchCsvFiles = async () => {
    setLoadingFiles(true);
    try {
      const result = await pb.collection('csvFiles').getList(1, 50, {
        sort: '-created',
        $autoCancel: false
      });
      setCsvFiles(result.items);
    } catch (error) {
      toast.error('Failed to load CSV files');
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleSelectFile = async (fileRecord) => {
    setSelectedFile(fileRecord);
    setIsParsing(true);
    try {
      const fileUrl = pb.files.getUrl(fileRecord, fileRecord.file);
      const results = await parseCSVFile(fileUrl);
      setCsvHeaders(results.meta.fields || []);
      setParsedData(results);
      setStep('mapping');
    } catch (error) {
      console.error('Parse error:', error);
      toast.error('Failed to parse CSV file: ' + error.message);
      setSelectedFile(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleStartImport = async (mapping) => {
    setStep('importing');
    setImportProgress({ current: 0, total: parsedData.data.length, percentage: 0 });
    
    try {
      const result = await importCSVData(
        selectedFile, 
        parsedData, 
        mapping, 
        currentUser.id,
        (progress) => setImportProgress(progress)
      );
      
      setImportResult(result);
      setStep('complete');
    } catch (error) {
      toast.error('Import process failed');
      setStep('mapping');
    }
  };

  const resetFlow = () => {
    setStep('select');
    setSelectedFile(null);
    setParsedData(null);
    setImportResult(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground py-12">
      <Helmet>
        <title>Admin - CSV Parser | CardPop</title>
      </Helmet>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex items-center text-sm font-medium text-muted-foreground mb-6">
          <Link to="/admin/users" className="hover:text-primary transition-colors">Admin</Link>
          <ChevronRight className="w-4 h-4 mx-2" />
          <span className="text-foreground">CSV Parser</span>
        </nav>

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-primary" />
            CSV Parser & Importer
          </h1>
          <p className="text-muted-foreground">Map and import CSV data directly into the listings database.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-card border border-border p-1 rounded-xl mb-8 h-auto">
            <TabsTrigger value="parse" className="rounded-lg px-6 py-2.5 font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Parse & Import
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg px-6 py-2.5 font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
              <History className="w-4 h-4 mr-2" />
              Import History
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="parse" className="mt-0 outline-none">
            {step === 'select' && (
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm animate-in fade-in">
                <h3 className="text-lg font-bold mb-4">Select a CSV File to Parse</h3>
                {loadingFiles ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                ) : csvFiles.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No CSV files found. Please upload a file in CSV Management first.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {csvFiles.map(file => (
                      <div 
                        key={file.id} 
                        className="border border-border rounded-xl p-4 hover:border-primary hover:bg-primary/5 cursor-pointer transition-all"
                        onClick={() => handleSelectFile(file)}
                      >
                        <div className="flex items-start gap-3">
                          <FileSpreadsheet className="w-8 h-8 text-primary shrink-0" />
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate">{file.filename}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(file.created).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {isParsing && (
                  <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-card p-6 rounded-2xl shadow-lg flex flex-col items-center gap-4">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <p className="font-medium">Parsing CSV file...</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 'mapping' && parsedData && (
              <CSVMappingInterface 
                csvHeaders={csvHeaders}
                csvData={parsedData.data}
                onBack={() => setStep('select')}
                onImport={handleStartImport}
              />
            )}

            {step === 'importing' && (
              <div className="bg-card border border-border rounded-2xl p-12 shadow-sm text-center max-w-2xl mx-auto animate-in zoom-in-95">
                <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-6" />
                <h3 className="text-2xl font-bold mb-2">Importing Data...</h3>
                <p className="text-muted-foreground mb-8">Please do not close this window.</p>
                
                <Progress value={importProgress.percentage} className="h-3 mb-4" />
                <div className="flex justify-between text-sm font-medium">
                  <span>{importProgress.current} / {importProgress.total} records</span>
                  <span>{importProgress.percentage}%</span>
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="history" className="mt-0 outline-none">
            <ImportHistoryPanel />
          </TabsContent>
        </Tabs>

        {/* Completion Modal */}
        <Dialog open={step === 'complete'} onOpenChange={(open) => !open && resetFlow()}>
          <DialogContent className="sm:max-w-md text-center">
            <DialogHeader>
              <DialogTitle className="text-center text-2xl">Import Complete</DialogTitle>
            </DialogHeader>
            
            {importResult && (
              <div className="py-6 space-y-6">
                {importResult.importStatus === 'success' ? (
                  <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
                ) : (
                  <AlertCircle className="w-16 h-16 text-orange-500 mx-auto" />
                )}
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-muted">
                    <div className="text-2xl font-bold">{importResult.totalRecords}</div>
                    <div className="text-xs text-muted-foreground mt-1">Total</div>
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="text-2xl font-bold text-emerald-600">{importResult.successfulRecords}</div>
                    <div className="text-xs text-emerald-600/80 mt-1">Success</div>
                  </div>
                  <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                    <div className="text-2xl font-bold text-destructive">{importResult.failedRecords}</div>
                    <div className="text-xs text-destructive/80 mt-1">Failed</div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="sm:justify-center gap-3">
              <Button variant="outline" onClick={() => { resetFlow(); setActiveTab('history'); }}>
                View History
              </Button>
              <Button onClick={resetFlow}>
                Import Another File
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default CSVParserPage;