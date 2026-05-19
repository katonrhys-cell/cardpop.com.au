import React, { useState } from 'react';
import { X, User, MapPin, Mail, Calendar, ShieldCheck, ShieldAlert, Lock, Unlock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import pb from '@/lib/pocketbaseClient.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const UserDetailModal = ({ user, isOpen, onClose, onUserUpdate }) => {
  const [isUpdating, setIsUpdating] = useState(false);

  if (!user) return null;

  const isLocked = user.accountLockedUntil && new Date(user.accountLockedUntil) > new Date();

  const handleAction = async (actionType) => {
    setIsUpdating(true);
    try {
      let data = {};
      
      switch (actionType) {
        case 'verify':
          data = { verified: true, emailVerified: true };
          break;
        case 'unverify':
          data = { verified: false, emailVerified: false };
          break;
        case 'disable':
          // Lock account for 100 years
          const futureDate = new Date();
          futureDate.setFullYear(futureDate.getFullYear() + 100);
          data = { accountLockedUntil: futureDate.toISOString() };
          break;
        case 'enable':
          data = { accountLockedUntil: '' };
          break;
        default:
          return;
      }

      await pb.collection('users').update(user.id, data, { $autoCancel: false });
      toast.success(`User successfully ${actionType}d.`);
      if (onUserUpdate) onUserUpdate();
    } catch (error) {
      console.error(`Error performing ${actionType} on user:`, error);
      toast.error(error.message || `Failed to ${actionType} user.`);
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Intl.DateTimeFormat('en-AU', { 
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(new Date(dateString));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-card border-border">
        <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-muted/20 relative">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            User Profile
          </DialogTitle>
          <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </DialogHeader>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {/* Header Info */}
          <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center mb-6">
            <div className="relative shrink-0">
              {user.avatar ? (
                <img 
                  src={pb.files.getUrl(user, user.avatar)} 
                  alt={user.name || user.email} 
                  className="w-24 h-24 rounded-2xl object-cover shadow-sm border border-border" 
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-muted border border-border flex items-center justify-center shadow-sm">
                  <User className="w-10 h-10 text-muted-foreground" />
                </div>
              )}
              {isLocked && (
                <div className="absolute -bottom-2 -right-2 bg-destructive text-destructive-foreground p-1.5 rounded-full shadow-md" title="Account Locked">
                  <Lock className="w-4 h-4" />
                </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h3 className="text-2xl font-bold truncate">{user.name || 'Anonymous User'}</h3>
                {user.verified ? (
                  <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 font-semibold gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground font-semibold gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Unverified
                  </Badge>
                )}
                {isLocked && (
                  <Badge variant="destructive" className="font-semibold gap-1">
                    <Lock className="w-3.5 h-3.5" /> Locked
                  </Badge>
                )}
              </div>
              
              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </div>
                {user.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span className="truncate">{user.location}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Member Since</span>
              </div>
              <p className="font-medium">{formatDate(user.created)}</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Last Login</span>
              </div>
              <p className="font-medium">{formatDate(user.lastLoginAt)}</p>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Additional Info */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Bio</h4>
              <p className="text-sm leading-relaxed bg-muted/20 p-4 rounded-lg border border-border/50">
                {user.bio || <span className="italic text-muted-foreground">No bio provided.</span>}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">MFA Enabled</span>
                <span className="font-medium">{user.mfaEnabled ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Role</span>
                <span className="font-medium capitalize">{user.role || 'User'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Failed Logins</span>
                <span className="font-medium">{user.failedLoginAttempts || 0}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">User ID</span>
                <span className="font-medium font-mono text-xs">{user.id}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Actions Footer */}
        <div className="p-6 pt-4 border-t border-border bg-muted/10 flex flex-wrap gap-3 justify-end">
          {user.verified ? (
            <Button 
              variant="outline" 
              onClick={() => handleAction('unverify')} 
              disabled={isUpdating}
              className="gap-2 border-border"
            >
              <XCircle className="w-4 h-4" /> Unverify User
            </Button>
          ) : (
            <Button 
              variant="outline" 
              onClick={() => handleAction('verify')} 
              disabled={isUpdating}
              className="gap-2 border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <CheckCircle2 className="w-4 h-4" /> Verify User
            </Button>
          )}

          {isLocked ? (
            <Button 
              variant="outline" 
              onClick={() => handleAction('enable')} 
              disabled={isUpdating}
              className="gap-2 border-emerald-500/20 text-emerald-600 hover:bg-emerald-600 hover:text-white"
            >
              <Unlock className="w-4 h-4" /> Enable Account
            </Button>
          ) : (
            <Button 
              variant="destructive" 
              onClick={() => handleAction('disable')} 
              disabled={isUpdating}
              className="gap-2"
            >
              <Lock className="w-4 h-4" /> Disable Account
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserDetailModal;