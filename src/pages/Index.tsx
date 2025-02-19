
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-dark text-white flex items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(57,255,20,0.1),rgba(0,0,0,0))]" />
      
      <div className="max-w-3xl mx-auto p-8 text-center space-y-8 relative z-10">
        <h1 className="text-4xl font-bold tracking-tight">
          Secure File Sharing Made Simple
        </h1>
        <p className="text-xl text-gray-400">
          Share files securely with end-to-end encryption
        </p>

        <div className="flex items-center justify-center gap-4">
          <Button
            onClick={() => navigate("/auth")}
            className="bg-neon hover:bg-neon/90 text-dark font-medium"
          >
            <LogIn className="mr-2" />
            Get Started
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
