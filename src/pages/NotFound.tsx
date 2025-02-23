
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div className="min-h-screen bg-dark flex flex-col items-center justify-center text-white p-4">
      <div className="text-center space-y-6 max-w-md">
        <h1 className="text-4xl font-bold text-neon">404 - Page Not Found</h1>
        <p className="text-gray-400">The page you're looking for doesn't exist or has been moved.</p>
        <Button asChild className="bg-neon text-black hover:bg-neon/90">
          <Link to="/">Return to Home</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
