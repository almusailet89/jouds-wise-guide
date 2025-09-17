import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useFinancialDashboard } from '@/hooks/useFinancialDashboard';
import { Loader2 } from 'lucide-react';

interface AddHoldingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddHoldingModal: React.FC<AddHoldingModalProps> = ({ open, onOpenChange }) => {
  const { addPortfolioHolding } = useFinancialDashboard();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    asset_type: '' as 'stock' | 'crypto' | 'real_estate',
    symbol: '',
    quantity: '',
    avg_price: '',
    currency: 'USD',
    purchase_date: new Date().toISOString().split('T')[0],
    // Real estate specific fields
    address: '',
    property_type: 'residential',
    sqft: '',
    purchase_price: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.asset_type) return;

    setLoading(true);
    try {
      const holdingData: any = {
        asset_type: formData.asset_type,
        currency: formData.currency,
        purchase_date: new Date(formData.purchase_date).toISOString()
      };

      if (formData.asset_type === 'real_estate') {
        holdingData.address = formData.address;
        holdingData.property_type = formData.property_type;
        if (formData.sqft) holdingData.sqft = parseFloat(formData.sqft);
        holdingData.purchase_price = parseFloat(formData.purchase_price);
      } else {
        holdingData.symbol = formData.symbol.toUpperCase();
        holdingData.quantity = parseFloat(formData.quantity);
        holdingData.avg_price = parseFloat(formData.avg_price);
      }

      await addPortfolioHolding(holdingData);
      
      // Reset form
      setFormData({
        asset_type: '' as 'stock' | 'crypto' | 'real_estate',
        symbol: '',
        quantity: '',
        avg_price: '',
        currency: 'USD',
        purchase_date: new Date().toISOString().split('T')[0],
        address: '',
        property_type: 'residential',
        sqft: '',
        purchase_price: ''
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding holding:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderAssetTypeFields = () => {
    if (formData.asset_type === 'real_estate') {
      return (
        <>
          <div className="space-y-2">
            <Label htmlFor="address">Address/Name *</Label>
            <Input
              id="address"
              placeholder="Property location or name"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="property_type">Property Type</Label>
              <Select
                value={formData.property_type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, property_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="residential">🏠 Residential</SelectItem>
                  <SelectItem value="commercial">🏢 Commercial</SelectItem>
                  <SelectItem value="land">🌍 Land</SelectItem>
                  <SelectItem value="apartment">🏠 Apartment</SelectItem>
                  <SelectItem value="villa">🏰 Villa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sqft">Square Feet</Label>
              <Input
                id="sqft"
                type="number"
                min="0"
                placeholder="e.g., 2000"
                value={formData.sqft}
                onChange={(e) => setFormData(prev => ({ ...prev, sqft: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="purchase_price">Purchase Price *</Label>
            <Input
              id="purchase_price"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={formData.purchase_price}
              onChange={(e) => setFormData(prev => ({ ...prev, purchase_price: e.target.value }))}
              required
            />
          </div>
        </>
      );
    } else {
      return (
        <>
          <div className="space-y-2">
            <Label htmlFor="symbol">Symbol *</Label>
            <Input
              id="symbol"
              placeholder={formData.asset_type === 'crypto' ? 'e.g., BTC, ETH' : 'e.g., AAPL, MSFT'}
              value={formData.symbol}
              onChange={(e) => setFormData(prev => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                step={formData.asset_type === 'crypto' ? '0.00000001' : '0.001'}
                min="0.000001"
                placeholder="0"
                value={formData.quantity}
                onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="avg_price">Buy Price *</Label>
              <Input
                id="avg_price"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={formData.avg_price}
                onChange={(e) => setFormData(prev => ({ ...prev, avg_price: e.target.value }))}
                required
              />
            </div>
          </div>
        </>
      );
    }
  };

  const isFormValid = () => {
    if (!formData.asset_type) return false;
    
    if (formData.asset_type === 'real_estate') {
      return formData.address && formData.purchase_price && parseFloat(formData.purchase_price) > 0;
    } else {
      return formData.symbol && formData.quantity && formData.avg_price && 
             parseFloat(formData.quantity) > 0 && parseFloat(formData.avg_price) > 0;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Add Portfolio Holding</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="asset_type">Asset Type *</Label>
            <Select
              value={formData.asset_type}
              onValueChange={(value: 'stock' | 'crypto' | 'real_estate') => 
                setFormData(prev => ({ 
                  ...prev, 
                  asset_type: value, 
                  symbol: '', 
                  address: '',
                  currency: value === 'real_estate' ? 'SAR' : 'USD'
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select asset type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stock">📈 Stock</SelectItem>
                <SelectItem value="crypto">₿ Cryptocurrency</SelectItem>
                <SelectItem value="real_estate">🏠 Real Estate</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.asset_type && renderAssetTypeFields()}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">🇺🇸 USD</SelectItem>
                  <SelectItem value="SAR">🇸🇦 SAR</SelectItem>
                  <SelectItem value="EUR">🇪🇺 EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchase_date">Purchase Date</Label>
              <Input
                id="purchase_date"
                type="date"
                value={formData.purchase_date}
                onChange={(e) => setFormData(prev => ({ ...prev, purchase_date: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !isFormValid()}
              className="luxury-button"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Holding'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};