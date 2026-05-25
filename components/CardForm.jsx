import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const CardForm = ({ onSuccess, onCancel, initialData }) => {
  const [name, setName] = useState(initialData?.name ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [price, setPrice] = useState(initialData?.price ?? '');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSuccess?.({ name, description, price });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label>Card Name</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Charizard Base Set" required />
      </div>
      <div className="space-y-1">
        <Label>Description</Label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Condition, notes…" rows={3} />
      </div>
      <div className="space-y-1">
        <Label>Price (AUD)</Label>
        <Input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save Card</Button>
      </div>
    </form>
  );
};

export default CardForm;
