import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createSavingsContribution, SavingsContribution } from '@/hooks/useDatabase';
import { GoalSummary } from '@/hooks/useFinancialDashboard';

export interface QuickSavingsProps {
  walletBalanceSar: number | null;
  goals: GoalSummary[];
  egressSaver: boolean;
  offline: boolean;
  onCommitted?: (contribution: SavingsContribution, walletBalanceSar: number | null) => void;
}

const currency = 'SAR';

export const QuickSavings: React.FC<QuickSavingsProps> = ({ walletBalanceSar, goals, egressSaver, offline, onCommitted }) => {
  const { toast } = useToast();
  const [amount, setAmount] = useState<string>('');
  const [goalId, setGoalId] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  const canSubmit = useMemo(() => {
    const val = Number(amount);
    return !offline && !submitting && Number.isFinite(val) && val > 0;
  }, [amount, submitting, offline]);

  const handleSubmit = async () => {
    setError('');
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a positive amount');
      return;
    }
    if (walletBalanceSar != null && walletBalanceSar < amt) {
      setError('Insufficient funds. Add funds or lower amount.');
      return;
    }
    if (offline) {
      setError('Offline. Try again when online.');
      return;
    }

    try {
      setSubmitting(true);
      const { contribution, walletBalanceSar: newBal } = await createSavingsContribution({ amountSar: amt, goalId: goalId || undefined, note: note || undefined });
      toast({ title: 'Saved', description: `Saved ${currency} ${amt.toLocaleString()}${goalId ? ' toward your goal' : ''}.` });
      onCommitted?.(contribution, newBal);
      setAmount('');
      setGoalId('');
      setNote('');
    } catch (e: any) {
      if (e?.code === 'INSUFFICIENT_FUNDS') {
        setError('Insufficient funds. Add funds or lower amount.');
      } else {
        setError(e?.message || 'Failed to save');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-3 border-t border-border/40 pt-3">
      <div className="text-xs font-semibold mb-2">Quick savings</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="decimal"
            placeholder={`Amount (${currency})`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <Select value={goalId} onValueChange={setGoalId}>
            <SelectTrigger>
              <SelectValue placeholder="Optional goal" />
            </SelectTrigger>
            <SelectContent>
              {goals.map(g => (
                <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button disabled={!canSubmit} onClick={handleSubmit}>
            Save now
          </Button>
        </div>
      </div>
      {offline && (
        <p className="text-xs text-muted-foreground mt-2">Offline. Try again when online.</p>
      )}
      {!!error && (
        <p className="text-xs text-destructive mt-2">{error}</p>
      )}
      {walletBalanceSar != null && (
        <p className="text-xs text-muted-foreground mt-2">Wallet: {currency} {walletBalanceSar.toLocaleString()}</p>
      )}
    </div>
  );
};

export default QuickSavings;
