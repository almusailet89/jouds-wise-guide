import { useState, useEffect, useRef, createContext, useContext, ReactNode } from 'react';
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
  essential: {
    priceId: 'price_1ThaOCDlAGsKyGn8Yhngai7G',
    productId: 'prod_UgyKt4z60eYzOG',
    name: 'Jood Essential',
    nameAr: 'جود الأساسية',
    price: 'SAR 59',
    interval: 'month',
    features: [
      'Unlimited bilingual chat, Arabic and English',
      '20 Majlis voice minutes monthly',
      'Calendar, finance, mood, and habits',
      'Daily brief from Jood',
      'Export reports (PDF/CSV)',
    ],
    featuresAr: [
      'محادثة ذكية غير محدودة، عربي وإنجليزي',
      'عشرون دقيقة مجلس صوتي شهرياً',
      'التقويم والمالية والمزاج والعادات',
      'الموجز اليومي من جود',
      'تصدير التقارير',
    ]
  },
  signature: {
    priceId: 'price_1ThaODDlAGsKyGn8vSc0vlhI',
    productId: 'prod_UgyKkOjWK4BZpB',
    name: 'Jood Signature',
    nameAr: 'جود المميزة',
    price: 'SAR 89',
    interval: 'month',
    savings: 'Best value',
    features: [
      'Everything in Essential',
      '60 Majlis voice minutes monthly',
      'Premium intelligence for text chat',
      'Extended memory and enhanced privacy',
      'Priority support and early features',
    ],
    featuresAr: [
      'كل مزايا الأساسية',
      'ستون دقيقة مجلس صوتي شهرياً',
      'ذكاء متقدم للمحادثات النصية',
      'ذاكرة موسعة وخصوصية معززة',
      'أولوية في الدعم والمزايا الجديدة',
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

  // Check subscription on mount and when the logged-in user actually changes.
  // Depending on the raw `session` object here (instead of a stable primitive like
  // user?.id) caused this to re-fire on every benign session-object refresh from
  // Supabase's onAuthStateChange — hammering the check-subscription Stripe call
  // continuously for any user with the app open.
  useEffect(() => {
    checkSubscription();
  }, [user?.id]);

  // Keep a ref to the latest checkSubscription (closing over the current session)
  // so the long-lived interval below always uses a fresh access_token instead of
  // the one captured when the interval was first created.
  const checkSubscriptionRef = useRef(checkSubscription);
  checkSubscriptionRef.current = checkSubscription;

  // Auto-refresh subscription status every 5 minutes
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      checkSubscriptionRef.current();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [user?.id]);

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