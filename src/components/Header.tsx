
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Zap, Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export const Header = () => {
  const { theme, setTheme } = useTheme();

  return (
    <header className="border-b border-border bg-background/50 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-2">
            <Zap className="w-8 h-8 text-primary" />
            <span className="text-xl font-semibold">LocalBolt</span>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            >
              {theme === "light" ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </Button>
            
            <Card className="glass flex items-center px-4 py-1.5 space-x-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm text-foreground/80">Network Active</span>
            </Card>
          </div>
        </div>
      </div>
    </header>
  );
};
