
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";

export const Header = () => {
  const [session, setSession] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = () => {
    navigate("/auth");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <header className="bg-dark-accent/50 backdrop-blur-lg border-b border-white/10">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <a href="/" className="text-2xl font-bold text-white hover:text-neon transition-colors">
            SecureShare
          </a>
          <div className="flex items-center space-x-4">
            {session ? (
              <div className="flex items-center space-x-4">
                <Button 
                  variant="ghost" 
                  className="hover:text-neon"
                  onClick={() => navigate("/subscribe")}
                >
                  Upgrade to Pro
                </Button>
                <Button 
                  variant="ghost" 
                  className="hover:text-neon"
                  onClick={handleLogout}
                >
                  Logout
                </Button>
              </div>
            ) : (
              <Button 
                variant="ghost" 
                className="hover:text-neon"
                onClick={handleLogin}
              >
                Login
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
