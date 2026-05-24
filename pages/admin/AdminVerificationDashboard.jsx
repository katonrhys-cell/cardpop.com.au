
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Search, CheckCircle, XCircle, Clock, Eye, AlertCircle } from 'lucide-react';

const AdminVerificationDashboard = () => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState(null);

  // Modals
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');

  const fetchSubmissions = async () => {
    try {
      const records = await pb.collection('user_verification').getFullList({
        sort: '-submitted_date',
        $autoCancel: false
      });
      setSubmissions(records);
    } catch (error) {
      console.error('Failed to fetch verification submissions:', error);
      toast.error('Failed to load verification data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const getPublicProfile = async (userId) => {
    try {
      return await pb.collection('public_profiles').getFirstListItem(`user_id="${userId}"`, { $autoCancel: false });
    } catch (e) {
      return null;
    }
  };

  const handleApprove = async (sub) => {
    setProcessingId(sub.id);
    try {
      // Update verification table
      await pb.collection('user_verification').update(sub.id, {
        verification_status: 'approved',
        approved_date: new Date().toISOString()
      }, { $autoCancel: false });
      
      // Update public profile
      const profile = await getPublicProfile(sub.user_id);
      if (profile) {
        await pb.collection('public_profiles').update(profile.id, { is_verified: 'true' }, { $autoCancel: false });
      }

      toast.success('Verification approved successfully.');
      fetchSubmissions();
    } catch (error) {
      toast.error('Failed to approve verification.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!selectedSub) return;
    setProcessingId(selectedSub.id);
    try {
      await pb.collection('user_verification').update(selectedSub.id, {
        verification_status: 'rejected',
        admin_notes: adminNotes
      }, { $autoCancel: false });
      
      const profile = await getPublicProfile(selectedSub.user_id);
      if (profile) {
        await pb.collection('public_profiles').update(profile.id, { is_verified: 'false' }, { $autoCancel: false });
      }

      toast.success('Verification rejected.');
      setRejectModalOpen(false);
      fetchSubmissions();
    } catch (error) {
      toast.error('Failed to reject verification.');
    } finally {
      setProcessingId(null);
      setSelectedSub(null);
      setAdminNotes('');
    }
  };

  const handleRevoke = async (sub) => {
    if (!window.confirm('Are you sure you want to revoke this verification?')) return;
    setProcessingId(sub.id);
    try {
      await pb.collection('user_verification').update(sub.id, {
        verification_status: 'pending',
        approved_date: null
      }, { $autoCancel: false });
      
      const profile = await getPublicProfile(sub.user_id);
      if (profile) {
        await pb.collection('public_profiles').update(profile.id, { is_verified: 'false' }, { $autoCancel: false });
      }

      toast.success('Verification revoked and set to pending.');
      fetchSubmissions();
    } catch (error) {
      toast.error('Failed to revoke verification.');
    } finally {
      setProcessingId(null);
    }
  };

  const openDetails = (sub) => {
    setSelectedSub(sub);
    setDetailsModalOpen(true);
  };

  const openReject = (sub) => {
    setSelectedSub(sub);
    setAdminNotes(sub.admin_notes || '');
    setRejectModalOpen(true);
  };

  const filteredSubmissions = submissions.filter(sub => 
    (sub.legal_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (sub.email?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (sub.verification_status?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-none font-bold"><CheckCircle className="w-3.5 h-3.5 mr-1.5"/> Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="font-bold border-none"><XCircle className="w-3.5 h-3.5 mr-1.5"/> Rejected</Badge>;
      case 'pending':
      default:
        return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-none font-bold"><Clock className="w-3.5 h-3.5 mr-1.5"/> Pending</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-[90rem] mx-auto space-y-8 font-sans animate-in fade-in duration-300">
      <Helmet><title>Identity Verification | Admin Dashboard</title></Helmet>
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Identity Verification</h1>
          <p className="text-muted-foreground mt-1">Review user KYC submissions and manage public verification badges.</p>
        </div>
        
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by legal name or email..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card border-border rounded-xl"
          />
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="font-semibold text-foreground px-6 py-4">Applicant</TableHead>
              <TableHead className="font-semibold text-foreground">ID Document</TableHead>
              <TableHead className="font-semibold text-foreground">Contact</TableHead>
              <TableHead className="font-semibold text-foreground">Date Submitted</TableHead>
              <TableHead className="font-semibold text-foreground">Status</TableHead>
              <TableHead className="text-right font-semibold text-foreground px-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary opacity-50" />
                </TableCell>
              </TableRow>
            ) : filteredSubmissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-20" />
                  No verification submissions found.
                </TableCell>
              </TableRow>
            ) : (
              filteredSubmissions.map((sub) => (
                <TableRow key={sub.id} className="group">
                  <TableCell className="px-6 py-4">
                    <div className="font-bold text-foreground">{sub.legal_name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{sub.email}</div>
                  </TableCell>
                  <TableCell>
                    {sub.id_photo ? (
                      <div className="w-16 h-10 rounded-lg overflow-hidden border border-border bg-muted relative">
                        <img 
                          src={pb.files.getUrl(sub, sub.id_photo, { thumb: '100x100' })} 
                          alt="ID Thumb" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">No Document</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs max-w-[200px] truncate" title={sub.address}>{sub.address}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{sub.phone_number}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(sub.submitted_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(sub.verification_status)}
                  </TableCell>
                  <TableCell className="text-right px-6">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openDetails(sub)} title="View Details">
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      
                      {sub.verification_status !== 'approved' && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 text-xs font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                          onClick={() => handleApprove(sub)}
                          disabled={processingId === sub.id}
                        >
                          Approve
                        </Button>
                      )}
                      
                      {sub.verification_status === 'pending' && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 text-xs font-bold border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                          onClick={() => openReject(sub)}
                          disabled={processingId === sub.id}
                        >
                          Reject
                        </Button>
                      )}

                      {sub.verification_status === 'approved' && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 text-xs font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/10 border-border"
                          onClick={() => handleRevoke(sub)}
                          disabled={processingId === sub.id}
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Details Modal */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="sm:max-w-[600px] rounded-2xl bg-background border-border">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Verification Details</DialogTitle>
            <DialogDescription>Full KYC application data for {selectedSub?.legal_name}</DialogDescription>
          </DialogHeader>
          
          {selectedSub && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground font-medium mb-1">Legal Name</p>
                  <p className="font-bold text-foreground">{selectedSub.legal_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium mb-1">Email</p>
                  <p className="font-bold text-foreground">{selectedSub.email}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground font-medium mb-1">Address</p>
                  <p className="font-bold text-foreground">{selectedSub.address}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium mb-1">Phone Number</p>
                  <p className="font-bold text-foreground">{selectedSub.phone_number}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium mb-1">Status</p>
                  <div>{getStatusBadge(selectedSub.verification_status)}</div>
                </div>
              </div>

              <div>
                <p className="text-muted-foreground font-medium mb-3 text-sm">ID Document</p>
                <div className="rounded-xl border border-border overflow-hidden bg-muted/30">
                  {selectedSub.id_photo ? (
                    <img 
                      src={pb.files.getUrl(selectedSub, selectedSub.id_photo)} 
                      alt="ID Document" 
                      className="w-full max-h-64 object-contain"
                    />
                  ) : (
                    <div className="h-32 flex items-center justify-center text-muted-foreground">No Document Provided</div>
                  )}
                </div>
              </div>

              {selectedSub.admin_notes && (
                <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
                  <p className="text-amber-700 font-bold text-xs uppercase mb-1">Admin Notes</p>
                  <p className="text-amber-900 text-sm">{selectedSub.admin_notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl bg-background border-border">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-destructive">Reject Verification</DialogTitle>
            <DialogDescription>Provide a reason for rejecting {selectedSub?.legal_name}'s application.</DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground">Rejection Reason / Notes</label>
              <Textarea 
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="e.g., ID document is blurry, name mismatch..."
                className="bg-background rounded-xl min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectModalOpen(false)} className="rounded-xl">Cancel</Button>
            <Button variant="destructive" onClick={handleRejectSubmit} disabled={processingId === selectedSub?.id || !adminNotes.trim()} className="rounded-xl font-bold">
              {processingId === selectedSub?.id ? 'Processing...' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminVerificationDashboard;
