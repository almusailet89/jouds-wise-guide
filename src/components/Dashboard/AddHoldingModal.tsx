import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { PortfolioHolding } from '@/hooks/useFinancialDashboard';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';

interface AddHoldingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (holding: Omit<PortfolioHolding, 'id' | 'created_at'>) => Promise<PortfolioHolding | undefined>;
}

export const AddHoldingModal: React.FC<AddHoldingModalProps> = ({ open, onOpenChange, onAdd }) => {
  const { lang, dir } = useLanguage();
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    asset_type: '' as 'stock' | 'crypto' | 'real_estate',
    symbol: '',
    quantity: '',
    avg_price: '',
    currency: 'SAR',
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

      await onAdd(holdingData);
      
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
            <Label htmlFor="address">{L('العنوان أو الاسم', 'Address or name')} *</Label>
            <Input
              id="address"
              placeholder={L('مثال: فيلا حي النرجس', 'e.g., Al Narjis villa')}
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="property_type">{L('نوع العقار', 'Property type')}</Label>
              <Select
                value={formData.property_type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, property_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="residential">🏠 {L('سكني', 'Residential')}</SelectItem>
                  <SelectItem value="commercial">🏢 {L('تجاري', 'Commercial')}</SelectItem>
                  <SelectItem value="land">🌍 {L('أرض', 'Land')}</SelectItem>
                  <SelectItem value="apartment">🏠 {L('شقة', 'Apartment')}</SelectItem>
                  <SelectItem value="villa">🏰 {L('فيلا', 'Villa')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sqft">{L('المساحة (قدم²)', 'Area (sq ft)')}</Label>
              <Input
                id="sqft"
                type="number"
                min="0"
                placeholder={L('مثال: 2000', 'e.g., 2000')}
                value={formData.sqft}
                onChange={(e) => setFormData(prev => ({ ...prev, sqft: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="purchase_price">{L('سعر الشراء', 'Purchase price')} *</Label>
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
            <Label htmlFor="symbol">{L('الرمز', 'Symbol')} *</Label>
            <Input
              id="symbol"
              placeholder={formData.asset_type === 'crypto' ? L('مثال: BTC، ETH', 'e.g., BTC, ETH') : L('مثال: 2222 (أرامكو)، 1120 (الراجحي)', 'e.g., 2222 (Aramco), AAPL')}
              value={formData.symbol}
              onChange={(e) => setFormData(prev => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">{L('الكمية', 'Quantity')} *</Label>
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
              <Label htmlFor="avg_price">{L('سعر الشراء', 'Buy price')} *</Label>
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
      <DialogContent className="sm:max-w-md" dir={dir}>
        <DialogHeader>
          <DialogTitle className="text-xl font-bold font-arabic">{L('إضافة أصل للمحفظة', 'Add portfolio holding')}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 font-arabic">
          <div className="space-y-2">
            <Label htmlFor="asset_type">{L('نوع الأصل', 'Asset type')} *</Label>
            <Select
              value={formData.asset_type}
              onValueChange={(value: 'stock' | 'crypto' | 'real_estate') => 
                setFormData(prev => ({ 
                  ...prev, 
                  asset_type: value, 
                  symbol: '', 
                  address: '',
                  currency: value === 'crypto' ? 'USD' : 'SAR'
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={L('اختر نوع الأصل', 'Choose an asset type')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stock">📈 {L('سهم', 'Stock')}</SelectItem>
                <SelectItem value="crypto">₿ {L('عملة رقمية', 'Crypto')}</SelectItem>
                <SelectItem value="real_estate">🏠 {L('عقار', 'Real estate')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.asset_type && renderAssetTypeFields()}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency">{L('العملة', 'Currency')}</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SAR">🇸🇦 {L('ريال سعودي', 'SAR')}</SelectItem>
                  <SelectItem value="USD">🇺🇸 {L('دولار', 'USD')}</SelectItem>
                  <SelectItem value="EUR">🇪🇺 {L('يورو', 'EUR')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchase_date">{L('تاريخ الشراء', 'Purchase date')}</Label>
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
              {L('إلغاء', 'Cancel')}
            </Button>
            <Button
              type="submit"
              disabled={loading || !isFormValid()}
              className="luxury-button"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 me-2 animate-spin" />
                  {L('جارٍ الإضافة…', 'Adding…')}
                </>
              ) : (
                L('إضافة الأصل', 'Add holding')
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
