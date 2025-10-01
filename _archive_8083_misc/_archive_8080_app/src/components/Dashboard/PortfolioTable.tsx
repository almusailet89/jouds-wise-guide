import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PortfolioHolding } from '@/hooks/useFinancialDashboard';

interface PortfolioTableProps {
  holdings: PortfolioHolding[];
}

export const PortfolioTable: React.FC<PortfolioTableProps> = ({ holdings }) => {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Asset</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Buy Price</TableHead>
            <TableHead>Current Price</TableHead>
            <TableHead>P/L</TableHead>
            <TableHead>Last Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {holdings.map((holding) => {
            const currentPrice = holding.current_price || holding.avg_price || 0;
            const buyPrice = holding.avg_price || 0;
            const quantity = holding.quantity || 1;
            const pnl = (currentPrice - buyPrice) * quantity;
            const pnlPercent = buyPrice > 0 ? ((currentPrice - buyPrice) / buyPrice) * 100 : 0;

            return (
              <TableRow key={holding.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{holding.symbol || holding.address}</div>
                    <div className="text-sm text-muted-foreground">{holding.property_type}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{holding.asset_type}</Badge>
                </TableCell>
                <TableCell>{quantity.toLocaleString()}</TableCell>
                <TableCell>{buyPrice.toLocaleString()} {holding.currency}</TableCell>
                <TableCell>{currentPrice.toLocaleString()} {holding.currency}</TableCell>
                <TableCell className={pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} ({pnlPercent.toFixed(1)}%)
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {holding.last_updated ? new Date(holding.last_updated).toLocaleDateString() : 'N/A'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};