import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFinancialDashboard } from '@/hooks/useFinancialDashboard';
import { Loader2, Target } from 'lucide-react';

interface SetSavingsTargetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SetSavingsTargetModal: React.FC<SetSavingsTargetModalProps> = ({ open, onOpenChange }) => {
  const { savingsTarget, updateSavingsTarget } = useFinancialDashboard();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    target: '',
    targetDate: ''
  });

  useEffect(() => {
    if (savingsTarget && open) {
      setFormData({
        target: savingsTarget.monthly_savings_target.toString(),
        targetDate: savingsTarget.savings_target_date.split('T')[0]
      });
    } else if (open) {
      // Default to end of current month
      const now = new Date();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setFormData({
        target: '',
        targetDate: endOfMonth.toISOString().split('T')[0]
      });
    }
  }, [savingsTarget, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.target || parseFloat(formData.target) <= 0) return;

    setLoading(true);
    try {
      await updateSavingsTarget(
        parseFloat(formData.target),
        formData.targetDate ? new Date(formData.targetDate).toISOString() : undefined
      );
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating savings target:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Set Savings Target
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="target">Monthly Savings Target *</Label>
            <div className="relative">
              <Input
                id="target"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="8000.00"
                value={formData.target}
                onChange={(e) => setFormData(prev => ({ ...prev, target: e.target.value }))}
                className="pl-12"
                required
              />
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground font-medium">
                SAR
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Set your monthly savings goal to track progress
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetDate">Target Date</Label>
            <Input
              id="targetDate"
              type="date"
              value={formData.targetDate}
              onChange={(e) => setFormData(prev => ({ ...prev, targetDate: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Optional: Set a specific deadline for your savings goal
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
            <h4 className="font-medium text-foreground mb-2">💡 Savings Tips</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Aim for 20% of your monthly income</li>
              <li>• Start small and increase gradually</li>
              <li>• Automate transfers to savings accounts</li>
            </ul>
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
              disabled={loading || !formData.target || parseFloat(formData.target) <= 0}
              className="luxury-button"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Set Target'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};