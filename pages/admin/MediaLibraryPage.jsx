import React, { useState, useEffect, useRef } from 'react';
import { Upload, Image as ImageIcon, Trash2, Copy, Check, AlertCircle, RefreshCcw } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';

const MediaLibraryPage = () => {
  const { currentUser } = useAuth();
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const fileInputRef = useRef(null);
  const fetchRef = useRef(null);

  const [uploadData, setUploadData] = useState({
    filename: '',
    description: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Revoke the object URL when it changes or the component unmounts to avoid leaks.
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.from('media_assets').select('*').order('created_at', { ascending: false }).limit(50);
        if (error) throw error;
        if (!cancelled) setMedia(data ?? []);
      } catch (err) {
        console.error("Error fetching media:", err);
        if (!cancelled) setError(err.message || "Failed to load media library.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRef.current = run;
    run();
    return () => { cancelled = true; };
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      if (!uploadData.filename) {
        setUploadData(prev => ({ ...prev, filename: file.name }));
      }
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("Please select a file to upload.");
      return;
    }
    if (!uploadData.filename.trim()) {
      toast.error("Filename is required.");
      return;
    }

    setIsUploading(true);
    try {
      const ext = selectedFile.name.split('.').pop();
      const path = `media/${Date.now()}-${uploadData.filename.trim().replace(/\s+/g, '_')}.${ext}`;
      const { error: upErr } = await supabase.storage.from('media').upload(path, selectedFile);
      if (upErr) throw upErr;
      const publicUrl = supabase.storage.from('media').getPublicUrl(path).data.publicUrl;

      const { data: record, error: insertErr } = await supabase.from('media_assets').insert({
        filename: uploadData.filename.trim(),
        description: uploadData.description.trim(),
        file_url: publicUrl,
        uploaded_by: currentUser?.id,
      }).select().single();
      if (insertErr) throw insertErr;

      toast.success("Media uploaded successfully.");
      setMedia([record, ...media]);
      setSelectedFile(null);
      setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
      setUploadData({ filename: '', description: '' });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(err.message || "Failed to upload media.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this image? This action cannot be undone.")) return;
    
    try {
      const { error } = await supabase.from('media_assets').delete().eq('id', id);
      if (error) throw error;
      toast.success("Media deleted successfully.");
      setMedia(media.filter(m => m.id !== id));
    } catch (err) {
      console.error("Delete error:", err);
      toast.error(err.message || "Failed to delete media.");
    }
  };

  const copyToClipboard = (url, id) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success("URL copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-8">
      <AdminPageHeader
        icon={ImageIcon}
        title="Media Library"
        subtitle="Manage images and assets for your articles and content."
      />

      {/* Upload Section */}
      <Card className="p-6 border-border shadow-sm bg-card">
        <h2 className="text-xl font-bold font-heading mb-4">Upload New Media</h2>
        <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-4">
            <div 
              className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-center h-full min-h-[200px] bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/jpeg,image/png,image/gif,image/webp" 
                className="hidden" 
              />
              {selectedFile ? (
                <div className="space-y-2">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={selectedFile.name}
                      className="max-h-32 w-auto mx-auto rounded-lg object-contain"
                    />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-primary mx-auto" />
                  )}
                  <p className="font-medium text-sm text-foreground truncate max-w-[200px]">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-10 h-10 text-muted-foreground mx-auto" />
                  <p className="font-medium text-sm text-foreground">Click to select image</p>
                  <p className="text-xs text-muted-foreground">JPEG, PNG, GIF, WebP up to 20MB</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="md:col-span-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="filename">Filename <span className="text-destructive">*</span></Label>
              <Input 
                id="filename" 
                value={uploadData.filename} 
                onChange={(e) => setUploadData({...uploadData, filename: e.target.value})} 
                placeholder="e.g., hero-banner-2026" 
                className="bg-background text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (Alt Text)</Label>
              <Input 
                id="description" 
                value={uploadData.description} 
                onChange={(e) => setUploadData({...uploadData, description: e.target.value})} 
                placeholder="Describe the image for accessibility..." 
                className="bg-background text-foreground"
              />
            </div>
            <Button type="submit" disabled={isUploading || !selectedFile} className="w-full md:w-auto font-bold transition-transform active:scale-[0.98]">
              {isUploading ? 'Uploading...' : 'Upload Media'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Media Grid */}
      <div>
        <h2 className="text-xl font-bold font-heading mb-4">Library</h2>
        
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12 bg-card rounded-xl border border-border">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
            <p className="font-medium text-foreground mb-4">{error}</p>
            <Button variant="outline" onClick={() => fetchRef.current?.()}><RefreshCcw className="w-4 h-4 mr-2" /> Retry</Button>
          </div>
        ) : media.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border border-dashed">
            <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="font-medium text-foreground">No media found</p>
            <p className="text-sm text-muted-foreground mt-1">Upload your first image above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {media.map((item) => {
              const imageUrl = item.file_url || item.url;
              
              return (
                <Card key={item.id} className="overflow-hidden group border-border shadow-sm hover:shadow-md transition-all">
                  <div className="aspect-square bg-muted relative overflow-hidden">
                    {imageUrl ? (
                      <img 
                        src={imageUrl} 
                        alt={item.description || item.filename} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-muted-foreground opacity-50" />
                      </div>
                    )}
                    
                    {/* Overlay Actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button 
                        size="icon" 
                        variant="secondary" 
                        className="h-8 w-8 rounded-full transition-transform active:scale-[0.98]"
                        onClick={() => copyToClipboard(imageUrl, item.id)}
                        title="Copy URL"
                      >
                        {copiedId === item.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                      <Button 
                        size="icon" 
                        variant="destructive" 
                        className="h-8 w-8 rounded-full transition-transform active:scale-[0.98]"
                        onClick={() => handleDelete(item.id)}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-foreground truncate" title={item.filename}>
                      {item.filename}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaLibraryPage;