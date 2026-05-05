import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useAuth } from './useAuth';
import { useRoles } from './useRoles';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

interface SubscriptionData {
  subscribed: boolean;
  inTrial: boolean;
  /** true when Stripe status is "past_due" — payment failed, grace period active */
  paymentIssue?: boolean;
  plan: 'monthly' | 'annual' | null;
  subscriptionEnd: string | null;
  trialEnd?: string | null;
}

interface SubscriptionContextType {
  subscription: SubscriptionData | null;
  loading: boolean;
  checkSubscription: () => Promise<void>;
  createCheckout: (priceId: string) => Promise<string>;
  openCustomerPortal: () => Promise<void>;
  isSubscribed: boolean;
  /** true when subscribed but payment has failed — show "update payment" banner */
  hasPaymentIssue: boolean;
  canAccessFeature: (feature: string) => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

// Subscription plans configuration
export const SUBSCRIPTION_PLANS = {
  monthly: {
    priceId: 'price_1S8Q78DlAGsKyGn8RSlTXQqf',
    productId: 'prod_T4ZFUH0E3zOUQt',
    name: 'Monthly Plan',
    price: '$5',
    interval: 'month',
    features: [
      'Personal financial dashboard',
      'Smart alerts on stocks & crypto',
      'Task & schedule planner',
      'Lifestyle tracking',
      'AI-powered insights',
      'Export reports (PDF/CSV)',
    ]
  },
  annual: {
    priceId: 'price_1S8Q7ZDlAGsKyGn8w97rsZ5B',
    productId: 'prod_T4ZGrCpawATPr7',
    name: 'Annual Plan',
    price: '$49',
    interval: 'year',
    savings: 'Save 20%',
    features: [
      'All Monthly Plan features',
      'Priority feature updates',
      'Early access to new features',
      'Premium support',
      'TikTok export functionality',
    ]
  }
};

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider = ({ children }: SubscriptionProviderProps) => {
  const { user, session } = useAuth();
  const { isAdmin } = useRoles();
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSubscription = async () => {
    if (!user || !session) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Error checking subscription:', error);
        toast({
          title: "Error checking subscription",
          description: "Please try again later.",
          variant: "destructive",
        });
        return;
      }

      setSubscription(data);
    } catch (error) {
      console.error('Error checking subscription:', error);
      toast({
        title: "Error checking subscription",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createCheckout = async (priceId: string): Promise<string> => {
    if (!user || !session) {
      throw new Error('User must be logged in to create checkout');
    }

    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { priceId, trialDays: 7 },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      console.error('Error creating checkout:', error);
      throw new Error('Failed to create checkout session');
    }

    return data.url;
  };

  const openCustomerPortal = async () => {
    if (!user || !session) {
      throw new Error('User must be logged in to access customer portal');
    }

    const { data, error } = await supabase.functions.invoke('customer-portal', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      console.error('Error opening customer portal:', error);
      throw new Error('Failed to open customer portal');
    }

    window.open(data.url, '_blank');
  };

  const canAccessFeature = (feature: string): boolean => {
    // Admins have access to all features
    if (isAdmin()) return true;
    
    if (!subscription) return false;
    
    // During trial or with active subscription, allow access to all features
    if (subscription.subscribed || subscription.inTrial) {
      return true;
    }
    
    // Free tier restrictions
    const freeFeatures = ['basic-chat', 'basic-tasks', 'basic-mood'];
    return freeFeatures.includes(feature);
  };

  // Check subscription on mount and when user changes
  useEffect(() => {
    checkSubscription();
  }, [user, session]);

  // Auto-refresh subscription status every 5 minutes
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      checkSubscription();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [user]);

  const isSubscribed = isAdmin() || subscription?.subscribed || subscription?.inTrial || false;
  const hasPaymentIssue = !isAdmin() && (subscription?.paymentIssue ?? false);

  const value = {
    subscription,
    loading,
    checkSubscription,
    createCheckout,
    openCustomerPortal,
    isSubscribed,
    hasPaymentIssue,
    canAccessFeature,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};