import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ChevronRight, Database, UploadCloud, FileSpreadsheet } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CSVUploadPage from '@/pages/CSVUploadPage.jsx';
import CSVFileManager from '@/components/CSVFileManager.jsx';

const CSVManagementPage = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState('manage');

  const handleUploadSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
    setActiveTab('manage');
  };

  return (
    <div className="min-h-screen bg-background text-foreground py-12">
      <Helmet>
        <title>Admin - CSV Management | CardPop</title>
      </Helmet>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumbs */}
        <nav className="flex items-center text-sm font-medium text-muted-foreground mb-6">
          <Link to="/admin/users" className="hover:text-primary transition-colors">Admin</Link>
          <ChevronRight className="w-4 h-4 mx-2" />
          <span className="text-foreground">CSV Management</span>
        </nav>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
              <Database className="w-8 h-8 text-primary" />
              Data Import & Management
            </h1>
            <p className="text-muted-foreground">Upload, preview, and manage CSV data files for site architecture mapping.</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-card border border-border p-1 rounded-xl mb-8 h-auto">
            <TabsTrigger value="manage" className="rounded-lg px-6 py-2.5 font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Manage Files
            </TabsTrigger>
            <TabsTrigger value="upload" className="rounded-lg px-6 py-2.5 font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
              <UploadCloud className="w-4 h-4 mr-2" />
              Upload CSV
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="manage" className="mt-0 outline-none">
            <CSVFileManager refreshTrigger={refreshTrigger} />
          </TabsContent>
          
          <TabsContent value="upload" className="mt-0 outline-none">
            <CSVUploadPage onUploadSuccess={handleUploadSuccess} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CSVManagementPage;