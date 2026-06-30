import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const ACTION_LABELS = {
  suspend: { title: 'Suspend Account', description: 'This deactivates the account (hides their public store and listings) until reactivated.', variant: 'destructive' },
  unsuspend: { title: 'Reactivate Account', description: 'This restores the account to active.', variant: 'default' },
  reset_password: { title: 'Reset Password', description: 'Send a password reset email to the user.', variant: 'default' },
};

const UserActionsModal = ({ isOpen, onClose, actionType, user, onConfirm }) => {
  const action = ACTION_LABELS[actionType] ?? { title: 'Confirm Action', description: 'Are you sure?', variant: 'default' };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {action.title}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {action.description}
          {(user?.display_name || user?.username) && <> User: <strong>{user.display_name || user.username}</strong></>}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant={action.variant} onClick={() => { onConfirm?.(); onClose?.(); }}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserActionsModal;
