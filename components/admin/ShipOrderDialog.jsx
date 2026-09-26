import React, { useState } from 'react';
import { Truck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiServerClient as apiClient } from '@/lib/apiServerClient.js';
import { toast } from 'sonner';
import {
  CARRIERS, CARRIER_IDS, DEFAULT_CARRIER, isValidTrackingNumber, normalizeTrackingNumber, trackingUrl,
} from '@/utils/shipmentTracking.js';

// "Mark as Shipped" for the admin order table: records the carrier + tracking
// reference and (by default) emails the buyer their tracking link. The write
// goes through the admin backend, which also sends the email — the browser
// can't read a registered buyer's email address.
const ShipOrderDialog = ({ order, onClose, onShipped }) => {
  const [carrier, setCarrier] = useState(order.tracking_carrier || DEFAULT_CARRIER);
  const [trackingNumber, setTrackingNumber] = useState(order.tracking_number || '');
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);

  const alreadyShipped = order.status === 'shipped';
  const valid = isValidTrackingNumber(trackingNumber);
  const previewUrl = valid ? trackingUrl(carrier, trackingNumber) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!valid) { toast.error('Enter a valid tracking number'); return; }
    setSaving(true);
    try {
      const res = await apiClient.fetch(`/admin/orders/${order.id}/ship`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carrier, tracking_number: normalizeTrackingNumber(trackingNumber), notify }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to mark order shipped');

      if (!notify) toast.success('Tracking saved — customer not emailed');
      else if (body.emailed) toast.success('Marked shipped and tracking emailed to the customer');
      else toast.warning(`Marked shipped, but the email wasn't sent: ${body.emailError || 'unknown error'}`);

      onShipped(body.order);
      onClose();
    } catch (err) {
      toast.error(err.message);
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading font-bold flex items-center gap-2">
            <Truck className="w-5 h-5" /> {alreadyShipped ? 'Update Tracking' : 'Mark as Shipped'}
          </DialogTitle>
          <DialogDescription>Order {order.order_number || order.id.slice(0, 8).toUpperCase()}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          <div className="space-y-1.5">
            <Label className="font-semibold text-sm">Carrier</Label>
            <Select value={carrier} onValueChange={setCarrier}>
              <SelectTrigger className="rounded-xl bg-background border-border h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CARRIER_IDS.map(id => (
                  <SelectItem key={id} value={id}>{CARRIERS[id].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tracking-number" className="font-semibold text-sm">Tracking number</Label>
            <Input
              id="tracking-number"
              value={trackingNumber}
              onChange={e => setTrackingNumber(e.target.value)}
              placeholder="e.g. 33ABC1234567"
              autoComplete="off"
              autoFocus
              className="rounded-xl bg-background border-border h-10 font-mono uppercase"
            />
            {previewUrl && (
              <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline underline-offset-2">
                Check this tracking link
              </a>
            )}
          </div>

          <label className="flex items-start gap-2.5 text-sm cursor-pointer">
            <Checkbox checked={notify} onCheckedChange={v => setNotify(v === true)} className="mt-0.5" />
            <span>
              Email the customer their tracking details
              {alreadyShipped && order.shipping_notified_at && (
                <span className="block text-xs text-muted-foreground">They were already emailed once — this sends it again.</span>
              )}
            </span>
          </label>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="flex-1 rounded-xl font-bold">Cancel</Button>
            <Button type="submit" disabled={!valid || saving} className="flex-1 rounded-xl font-bold">
              {saving ? 'Saving…' : notify ? 'Save & Email' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ShipOrderDialog;
