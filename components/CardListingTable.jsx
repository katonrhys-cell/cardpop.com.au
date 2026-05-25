import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export const CardListingTable = ({ data = [] }) => {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No listings found.</p>;
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Card</TableHead>
            <TableHead>Condition</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Seller</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow key={row.id ?? i}>
              <TableCell className="font-medium">{row.name ?? row.card_name ?? '—'}</TableCell>
              <TableCell>
                {row.condition && <Badge variant="outline">{row.condition}</Badge>}
              </TableCell>
              <TableCell>{row.price != null ? `$${Number(row.price).toFixed(2)}` : '—'}</TableCell>
              <TableCell>{row.seller ?? row.seller_name ?? '—'}</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {row.date ? new Date(row.date).toLocaleDateString('en-AU') : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default CardListingTable;
