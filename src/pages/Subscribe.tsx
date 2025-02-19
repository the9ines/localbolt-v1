
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Shield, ArrowRight } from "lucide-react";

const Subscribe = () => {
  const [loading, setLoading] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error) {
      console.error("Error checking subscription:", error);
      return;
    }

    if (subscription) {
      setSubscriptionStatus(subscription.status);
    }
  };

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          userId: session.user.id,
          email: session.user.email,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error("No checkout URL received");

      window.location.href = data.url;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (subscriptionStatus === "active") {
    return (
      <div className="min-h-screen bg-dark text-white flex items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(57,255,20,0.1),rgba(0,0,0,0))]" />
        
        <Card className="w-full max-w-md p-8 bg-dark-accent/50 backdrop-blur-lg border border-white/10 space-y-6 relative z-10 text-center">
          <Shield className="w-12 h-12 text-neon mx-auto" />
          <h1 className="text-2xl font-bold">You're Subscribed!</h1>
          <p className="text-gray-400">
            You have an active subscription. Enjoy unlimited secure file sharing!
          </p>
          <Button
            onClick={() => navigate("/")}
            className="bg-neon hover:bg-neon/90 text-dark font-medium"
          >
            Go to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark text-white flex items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(57,255,20,0.1),rgba(0,0,0,0))]" />
      
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto p-8">
        <Card className="p-8 bg-dark-accent/50 backdrop-blur-lg border border-white/10 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold">Free Plan</h2>
            <p className="text-gray-400">
              Basic secure file sharing
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-white/50" />
                <span>Up to 500MB file size</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-white/50" />
                <span>End-to-end encryption</span>
              </div>
            </div>

            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="w-full"
            >
              Continue with Free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </Card>

        <Card className="p-8 bg-dark-accent/50 backdrop-blur-lg border border-neon/20 space-y-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-neon/5" />
          
          <div className="relative z-10">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">Pro Plan</h2>
              <p className="text-gray-400">
                Unlimited secure file sharing
              </p>
              <p className="text-2xl font-bold text-neon">$25/year</p>
            </div>

            <div className="space-y-4 mt-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-neon" />
                  <span>Unlimited file size</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-neon" />
                  <span>End-to-end encryption</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-neon" />
                  <span>Priority support</span>
                </div>
              </div>

              <Button
                onClick={handleSubscribe}
                className="w-full bg-neon hover:bg-neon/90 text-dark font-medium"
                disabled={loading}
              >
                {loading ? "Loading..." : "Upgrade to Pro"}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <p className="absolute bottom-4 text-sm text-center text-gray-400">
        Secure payment powered by Stripe
      </p>
    </div>
  );
};

export default Subscribe;
