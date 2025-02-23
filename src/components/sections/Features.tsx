
import { Card } from "@/components/ui/card";
import { Shield, Wifi, Laptop, Zap, LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

const FeatureCard = ({ icon: Icon, title, description }: FeatureCardProps) => (
  <Card className="group relative overflow-hidden p-6 bg-dark-accent/50 backdrop-blur-lg border border-white/10 transition-all duration-500 hover:border-neon/50 hover:shadow-[0_8px_30px_rgba(20,255,106,0.15)]">
    <div className="absolute inset-0 bg-gradient-to-br from-neon/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    <div className="flex flex-col items-center text-center">
      <Icon className="w-8 h-8 text-neon mb-4 relative z-10 transition-transform duration-500 group-hover:scale-110" aria-hidden="true" />
      <h2 className="text-lg font-semibold mb-2 relative z-10">{title}</h2>
      <p className="text-sm text-gray-400 relative z-10">{description}</p>
    </div>
  </Card>
);

export const Features = () => {
  const features = [
    {
      icon: Shield,
      title: "End-to-End Encrypted",
      description: "Secure device-to-device file sharing with end-to-end encryption for maximum privacy"
    },
    {
      icon: Wifi,
      title: "Direct P2P Transfer",
      description: "Lightning fast peer-to-peer file transfers without server intermediaries"
    },
    {
      icon: Wifi,
      title: "No Server Storage",
      description: "Your files transfer directly between devices - no cloud storage, no servers storing your data"
    },
    {
      icon: Laptop,
      title: "Cross Platform",
      description: "Compatible with all modern devices and web browsers for seamless file sharing"
    }
  ];

  return (
    <section aria-label="Features" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-up">
      {features.map((feature) => (
        <FeatureCard key={feature.title} {...feature} />
      ))}
    </section>
  );
};
