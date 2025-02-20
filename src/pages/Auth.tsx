
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Shield } from "lucide-react";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        toast({
          title: "Check your email",
          description: "We've sent you a verification link",
        });
      }
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

  return (
    <div className="min-h-screen bg-dark text-white flex items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(57,255,20,0.1),rgba(0,0,0,0))]" />
      
      <Card className="w-full max-w-md p-8 bg-dark-accent/50 backdrop-blur-lg border border-white/10 space-y-6 relative z-10">
        <div className="text-center space-y-2">
          <Shield className="w-12 h-12 text-neon mx-auto" />
          <h1 className="text-2xl font-bold">
            {isLogin ? "Welcome Back" : "Create Account"}
          </h1>
          <p className="text-gray-400">
            {isLogin 
              ? "Sign in to access your secure file sharing" 
              : "Sign up for secure, private file sharing"}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-dark-accent/50 border-white/10 text-white"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-dark-accent/50 border-white/10 text-white"
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-neon hover:bg-neon/90 text-dark font-medium"
            disabled={loading}
          >
            {loading ? "Loading..." : (isLogin ? "Sign In" : "Sign Up")}
          </Button>
        </form>

        <div className="text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-gray-400 hover:text-neon"
          >
            {isLogin 
              ? "Don't have an account? Sign up" 
              : "Already have an account? Sign in"}
          </button>
        </div>
      </Card>
    </div>
  );
};

export default Auth;
