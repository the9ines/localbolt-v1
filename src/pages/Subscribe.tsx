
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Shield } from "lucide-react";

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

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", session.user.id)
      .single();

    if (subscription) {
      setSubscriptionStatus(subscription.status);
    }
  };

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Call the Supabase Edge Function instead of direct API endpoint
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          userId: session.user.id,
          email: session.user.email,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error("No checkout URL received");

      // Redirect to Stripe Checkout
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
            You have an active subscription. Enjoy secure file sharing!
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
      
      <Card className="w-full max-w-md p-8 bg-dark-accent/50 backdrop-blur-lg border border-white/10 space-y-6 relative z-10">
        <div className="text-center space-y-2">
          <Shield className="w-12 h-12 text-neon mx-auto" />
          <h1 className="text-2xl font-bold">Upgrade to Pro</h1>
          <p className="text-gray-400">
            Get unlimited secure file sharing for just $25/year
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-neon" />
              <span>Unlimited file transfers</span>
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
            {loading ? "Loading..." : "Subscribe Now - $25/year"}
          </Button>
        </div>

        <p className="text-sm text-center text-gray-400">
          Secure payment powered by Stripe
        </p>
      </Card>
    </div>
  );
};

export default Subscribe;
