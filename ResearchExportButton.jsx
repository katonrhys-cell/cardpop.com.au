
import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import Papa from 'papaparse';

const ResearchExportButton = ({ data, filename = 'market-research.csv', disabled = false }) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = () => {
    if (!data || data.length === 0) {
      toast.error('No data available to export');
      return;
    }

    setIsExporting(true);
    try {
      const csv = Papa.unparse(data);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Export completed successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      onClick={handleExport} 
      disabled={disabled || isExporting}
      className="rounded-xl shadow-sm"
    >
      {isExporting ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Download className="w-4 h-4 mr-2" />
      )}
      Export CSV
    </Button>
  );
};

export default ResearchExportButton;
