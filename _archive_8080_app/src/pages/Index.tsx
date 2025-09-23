import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, MessageSquare, TrendingUp, Calendar, Heart, Mic } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();
  const features = [
    {
      icon: MessageSquare,
      title: "AI Chat Assistant",
      description: "Intelligent conversations powered by advanced AI"
    },
    {
      icon: TrendingUp,
      title: "Financial Advisor",
      description: "Smart financial planning and investment guidance"
    },
    {
      icon: Calendar,
      title: "Smart Planner",
      description: "Intelligent task planning and scheduling"
    },
    {
      icon: Heart,
      title: "Mood Tracker",
      description: "Track and analyze your emotional wellbeing"
    },
    {
      icon: Mic,
      title: "Voice Interface",
      description: "Natural voice interactions and commands"
    },
    {
      icon: Brain,
      title: "Smart Suggestions",
      description: "Personalized recommendations and insights"
    }
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
            <Brain className="w-4 h-4" />
            <span className="text-sm font-medium">AI-Powered Assistant</span>
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent mb-6">
            Jood AI
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Your intelligent personal assistant for chat, financial planning, mood tracking, and smart suggestions.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" className="bg-primary hover:bg-primary/90" onClick={() => navigate('/pricing')}>
              Launch Joud AI
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate('/auth')}>
              Sign In
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {features.map((feature, index) => (
            <Card key={index} className="border-border/50 hover:border-primary/20 transition-colors hover:shadow-lg">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Integration Status */}
        <Card className="max-w-2xl mx-auto border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span>Supabase Connection</span>
                <span className="text-green-600 font-medium">Connected</span>
              </div>
              <div className="flex justify-between items-center">
                <span>AI Services</span>
                <span className="text-amber-600 font-medium">Ready to Configure</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Data Migration</span>
                <span className="text-blue-600 font-medium">Available</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default Index;
