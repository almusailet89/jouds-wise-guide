import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription, SUBSCRIPTION_PLANS } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Star, Crown, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscription, createCheckout, isSubscribed } = useSubscription();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (priceId: string, planName: string) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      setLoading(priceId);
      const checkoutUrl = await createCheckout(priceId);
      window.open(checkoutUrl, '_blank');
      
      toast({
        title: "Redirecting to checkout",
        description: `Setting up your ${planName} subscription...`,
      });
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: "Checkout Error",
        description: "Failed to create checkout session. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const isCurrentPlan = (planKey: string) => {
    return subscription?.plan === planKey && isSubscribed;
  };

  return (
    <div className="min-h-screen bg-gradient-primary">
      {/* Header */}
      <header className="border-b border-white/10 bg-card/10 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-elegant flex items-center justify-center">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Joud AI</h1>
                <p className="text-white/70 text-sm">Your Elegant Financial Secretary</p>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              onClick={() => navigate('/dashboard')}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white mb-6">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">✨ Unlock the Full Power of Joud AI ✨</span>
          </div>
          
          <h1 className="text-5xl font-bold text-white mb-6">
            Choose Your Plan
          </h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto mb-8">
            Transform your financial life with AI-powered insights, personalized guidance, and elegant simplicity.
          </p>

          {/* Free Trial Banner */}
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-elegant text-white mb-8">
            <Star className="w-5 h-5" />
            <span className="font-semibold">7-day free trial for all new users</span>
            <Star className="w-5 h-5" />
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
          {/* Monthly Plan */}
          <Card className={`relative overflow-hidden transition-all duration-300 ${
            isCurrentPlan('monthly') 
              ? 'bg-gradient-elegant border-white/30 shadow-elegant' 
              : 'bg-card/80 backdrop-blur border-white/10 hover:border-white/20'
          }`}>
            {isCurrentPlan('monthly') && (
              <div className="absolute top-4 right-4">
                <Badge className="bg-white text-primary">Current Plan</Badge>
              </div>
            )}
            
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl font-bold text-foreground">
                {SUBSCRIPTION_PLANS.monthly.name}
              </CardTitle>
              <div className="flex items-center justify-center gap-2 mt-4">
                <span className="text-4xl font-bold text-primary">$5</span>
                <span className="text-muted-foreground">/ month</span>
              </div>
              <CardDescription className="mt-2">
                Cancel anytime • Full access to all features
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <ul className="space-y-3">
                {SUBSCRIPTION_PLANS.monthly.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Button
                onClick={() => handleSubscribe(SUBSCRIPTION_PLANS.monthly.priceId, SUBSCRIPTION_PLANS.monthly.name)}
                disabled={loading === SUBSCRIPTION_PLANS.monthly.priceId || isCurrentPlan('monthly')}
                className="w-full bg-primary hover:bg-primary/90 text-white"
                size="lg"
              >
                {loading === SUBSCRIPTION_PLANS.monthly.priceId ? (
                  "Processing..."
                ) : isCurrentPlan('monthly') ? (
                  "Current Plan"
                ) : (
                  "Start Free Trial"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Annual Plan */}
          <Card className={`relative overflow-hidden transition-all duration-300 ${
            isCurrentPlan('annual') 
              ? 'bg-gradient-elegant border-white/30 shadow-elegant' 
              : 'bg-card/80 backdrop-blur border-white/10 hover:border-white/20'
          }`}>
            <div className="absolute -top-2 -right-2">
              <div className="bg-gradient-elegant text-white px-4 py-2 rounded-bl-lg text-sm font-semibold">
                Save 20%
              </div>
            </div>
            
            {isCurrentPlan('annual') && (
              <div className="absolute top-4 left-4">
                <Badge className="bg-white text-primary">Current Plan</Badge>
              </div>
            )}
            
            <CardHeader className="text-center pb-4 mt-4">
              <CardTitle className="text-2xl font-bold text-foreground">
                {SUBSCRIPTION_PLANS.annual.name}
              </CardTitle>
              <div className="flex items-center justify-center gap-2 mt-4">
                <span className="text-4xl font-bold text-primary">$49</span>
                <span className="text-muted-foreground">/ year</span>
              </div>
              <CardDescription className="mt-2">
                Priority feature updates & early access
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <ul className="space-y-3">
                {SUBSCRIPTION_PLANS.annual.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Button
                onClick={() => handleSubscribe(SUBSCRIPTION_PLANS.annual.priceId, SUBSCRIPTION_PLANS.annual.name)}
                disabled={loading === SUBSCRIPTION_PLANS.annual.priceId || isCurrentPlan('annual')}
                className="w-full bg-gradient-elegant hover:bg-gradient-elegant/90 text-white shadow-elegant"
                size="lg"
              >
                {loading === SUBSCRIPTION_PLANS.annual.priceId ? (
                  "Processing..."
                ) : isCurrentPlan('annual') ? (
                  "Current Plan"
                ) : (
                  "👉 Subscribe Now — Start Free Trial"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Benefits Section */}
        <Card className="bg-card/80 backdrop-blur border-white/10 max-w-4xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-foreground mb-4">
              What You Get with Joud AI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-foreground">Personal Financial Dashboard</h4>
                    <p className="text-muted-foreground text-sm">Track income, expenses, savings, and investments in one elegant interface</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-foreground">Smart Alerts on Stocks & Crypto</h4>
                    <p className="text-muted-foreground text-sm">Get notified about important market movements and opportunities</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-foreground">Task & Schedule Planner</h4>
                    <p className="text-muted-foreground text-sm">AI-powered task management with intelligent reminders</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-foreground">Lifestyle Tracking</h4>
                    <p className="text-muted-foreground text-sm">Monitor hobbies, wellness, and personal goals</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-foreground">AI-Powered Insights</h4>
                    <p className="text-muted-foreground text-sm">Joud speaks like ChatGPT with personalized financial wisdom</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-foreground">Export & Share</h4>
                    <p className="text-muted-foreground text-sm">Export reports (PDF/CSV) and create TikTok content</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA Section */}
        <div className="text-center mt-16">
          <p className="text-white/80 mb-6">
            No risk — cancel anytime before trial ends
          </p>
          
          {!user && (
            <Button
              onClick={() => navigate('/auth')}
              size="lg"
              className="bg-gradient-elegant hover:bg-gradient-elegant/90 text-white shadow-elegant"
            >
              Get Started — Sign Up Now
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}