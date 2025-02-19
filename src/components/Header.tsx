
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Zap, Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

export const Header = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="border-b border-white/10 bg-background/50 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-2">
            <Zap className="w-8 h-8 text-neon" />
            <span className="text-xl font-semibold text-foreground">LocalBolt</span>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-foreground"
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
            <Card className="glass flex items-center px-4 py-1.5 space-x-2">
              <div className="w-2 h-2 rounded-full bg-neon animate-pulse" />
              <span className="text-sm text-foreground/80">Network Active</span>
            </Card>
          </div>
        </div>
      </div>
    </header>
  );
};
