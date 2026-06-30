import React, { useState, useEffect } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { ExternalLink, Copy, Edit, Trash, Plus, Store, Check } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const InsiderTradingPage = () => {
  const { isAuthenticated } = useAuth();
  const [retailers, setRetailers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  
  // Admin Form State
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    brand_name: '',
    description: '',
    logo_url: '',
    affiliate_link: '',
    category: '',
    is_active: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchRetailers();
  }, []);

  const fetchRetailers = async () => {
    try {
      setLoading(true);
      const { data: records, error: fetchError } = await supabase
        .from('business_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (fetchError) throw fetchError;
      setRetailers(records || []);
    } catch (error) {
      toast.error('Failed to load retailers.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (url, id) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success('Affiliate link copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const resetForm = () => {
    setFormData({
      brand_name: '',
      description: '',
      logo_url: '',
      affiliate_link: '',
      category: '',
      is_active: true
    });
    setIsEditing(false);
    setEditingId(null);
  };

  const handleEdit = (retailer) => {
    setFormData({
      brand_name: retailer.brand_name || '',
      description: retailer.description || '',
      logo_url: retailer.logo_url || '',
      affiliate_link: retailer.affiliate_link || '',
      category: retailer.category || '',
      is_active: retailer.is_active ?? true
    });
    setEditingId(retailer.id);
    setIsEditing(true);
    // admin-section only exists while authenticated; guard against a null element
    // (e.g. if auth state flips between render and click).
    const adminSection = document.getElementById('admin-section');
    if (adminSection) {
      window.scrollTo({ top: adminSection.offsetTop - 100, behavior: 'smooth' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this retailer?')) return;
    
    try {
      const { error: deleteError } = await supabase.from('business_profiles').delete().eq('id', id);
      if (deleteError) throw deleteError;
      toast.success('Retailer deleted successfully.');
      fetchRetailers();
    } catch (error) {
      toast.error('Failed to delete retailer.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.brand_name || !formData.affiliate_link) {
      toast.error('Brand Name and Affiliate Link are required.');
      return;
    }

    if (!isEditing && retailers.length >= 12) {
      toast.error('Maximum of 12 retailers allowed.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (isEditing) {
        const { error: updateError } = await supabase.from('business_profiles').update(formData).eq('id', editingId);
        if (updateError) throw updateError;
        toast.success('Retailer updated successfully.');
      } else {
        const { error: insertError } = await supabase.from('business_profiles').insert(formData);
        if (insertError) throw insertError;
        toast.success('Retailer added successfully.');
      }
      resetForm();
      fetchRetailers();
    } catch (error) {
      toast.error('Failed to save retailer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background font-sans">
      <SEOHead title="Insider Trading | CardPop" description="Get insider market intelligence and trading insights for Australian trading card collectors." />

      {/* Hero Section */}
      <div className="bg-secondary py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1593814681464-eef5af2b0628?auto=format&fit=crop&w=1920&q=80')] opacity-5 mix-blend-overlay bg-cover bg-center" />
        <div className="max-w-7xl mx-auto px-4 relative z-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm">
            <Store className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 tracking-tight">
            Insider Trading
          </h1>
          <p className="text-secondary-foreground/80 text-lg md:text-xl max-w-2xl text-balance">
            Support Card Pop Australia by shopping with our trusted affiliate partners. Get the best deals on premium trading cards and accessories.
          </p>
        </div>
      </div>

      {/* Retailers Grid */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="pb-4">
                  <Skeleton className="h-12 w-12 rounded-xl mb-4" />
                  <Skeleton className="h-6 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-10 w-full" />
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : retailers.length === 0 ? (
          <div className="text-center py-20 bg-muted/50 rounded-2xl border border-border">
            <Store className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-2xl font-bold text-foreground mb-2">No Partners Yet</h3>
            <p className="text-muted-foreground">Check back soon for exclusive insider deals.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {retailers.map((retailer, index) => (
              <motion.div
                key={retailer.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
              >
                <Card className="h-full flex flex-col group hover:border-primary hover:shadow-lg transition-all duration-300">
                  <CardHeader className="pb-4">
                    <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center mb-4 overflow-hidden border border-border group-hover:border-primary/30 transition-colors">
                      {retailer.logo_url ? (
                        <img src={retailer.logo_url} alt={retailer.brand_name} className="h-full w-full object-cover" />
                      ) : (
                        <Store className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <CardTitle className="text-xl group-hover:text-primary transition-colors">
                      {retailer.brand_name}
                    </CardTitle>
                    {retailer.category && (
                      <span className="inline-block px-2 py-1 bg-secondary/10 text-secondary text-xs font-medium rounded-md mt-2 w-fit">
                        {retailer.category}
                      </span>
                    )}
                  </CardHeader>
                  <CardContent className="flex-1">
                    <p className="text-muted-foreground text-sm line-clamp-3">
                      {retailer.description || 'Shop premium products with our trusted partner.'}
                    </p>
                  </CardContent>
                  <CardFooter className="flex flex-col gap-3 pt-4 border-t border-border/50">
                    <div className="flex w-full gap-2">
                      <Button 
                        className="flex-1 bg-secondary hover:bg-primary text-white transition-colors"
                        onClick={() => window.open(retailer.affiliate_link, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Shop Now
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => handleCopy(retailer.affiliate_link, retailer.id)}
                        className="shrink-0 hover:text-primary hover:border-primary"
                        title="Copy Link"
                      >
                        {copiedId === retailer.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    
                    {isAuthenticated && (
                      <div className="flex w-full gap-2 pt-2 mt-2 border-t border-border/50">
                        <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={() => handleEdit(retailer)}>
                          <Edit className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="flex-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(retailer.id)}>
                          <Trash className="h-3 w-3 mr-1" /> Delete
                        </Button>
                      </div>
                    )}
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Admin Section */}
      {isAuthenticated && (
        <section id="admin-section" className="py-16 bg-muted/30 border-t border-border">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Card className="border-border shadow-md">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  {isEditing ? <Edit className="h-6 w-6 text-primary" /> : <Plus className="h-6 w-6 text-primary" />}
                  {isEditing ? 'Edit Retailer' : 'Add New Retailer'}
                </CardTitle>
                <CardDescription>
                  Manage your affiliate partners. Maximum 12 retailers allowed. ({retailers.length}/12)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Brand Name *</label>
                      <Input
                        name="brand_name"
                        value={formData.brand_name}
                        onChange={handleInputChange}
                        placeholder="e.g. Amazon"
                        required
                        className="text-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Category</label>
                      <Input 
                        name="category" 
                        value={formData.category} 
                        onChange={handleInputChange} 
                        placeholder="e.g. Trading Cards, Supplies" 
                        className="text-foreground"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Affiliate Link *</label>
                    <Input
                      name="affiliate_link"
                      type="url"
                      value={formData.affiliate_link}
                      onChange={handleInputChange}
                      placeholder="https://..."
                      required
                      className="text-foreground"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Logo URL</label>
                    <Input
                      name="logo_url"
                      type="url"
                      value={formData.logo_url}
                      onChange={handleInputChange}
                      placeholder="https://.../logo.png"
                      className="text-foreground"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Description</label>
                    <Textarea 
                      name="description" 
                      value={formData.description} 
                      onChange={handleInputChange} 
                      placeholder="Brief description of the retailer..." 
                      rows={3}
                      className="text-foreground"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button 
                      type="submit" 
                      disabled={isSubmitting || (!isEditing && retailers.length >= 12)}
                      className="flex-1 bg-primary hover:brightness-110 text-primary-foreground"
                    >
                      {isSubmitting ? 'Saving...' : isEditing ? 'Update Retailer' : 'Add Retailer'}
                    </Button>
                    {isEditing && (
                      <Button type="button" variant="outline" onClick={resetForm} className="flex-1">
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>
      )}
    </div>
  );
};

export default InsiderTradingPage;