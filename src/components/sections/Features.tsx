
import { Card } from "@/components/ui/card";
import { Shield, Wifi, Laptop, Server, Lock, Zap, Globe, Clock, LucideIcon } from "lucide-react";

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
      title: "End-to-End Encryption",
      description: "Military-grade encryption ensures your files remain completely private during transfer, using WebCrypto API and modern cryptographic protocols."
    },
    {
      icon: Wifi,
      title: "WebRTC P2P Transfer",
      description: "Direct device-to-device file transfer using WebRTC technology, enabling faster speeds than traditional cloud uploads and downloads."
    },
    {
      icon: Server,
      title: "Zero Server Storage",
      description: "Unlike traditional file sharing services, files transfer directly between devices without ever touching a server, ensuring maximum privacy."
    },
    {
      icon: Laptop,
      title: "Universal Compatibility",
      description: "Works seamlessly across Windows, macOS, Linux, iOS, and Android - any device with a modern web browser."
    },
    {
      icon: Lock,
      title: "Privacy Focused",
      description: "No account required, no tracking, and no data collection. Your files and transfer history remain completely private."
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Direct peer connections enable transfer speeds limited only by your local network or internet connection."
    },
    {
      icon: Globe,
      title: "Cross Network Support",
      description: "Works across different networks with automatic NAT traversal and relay fallback for guaranteed connectivity."
    },
    {
      icon: Clock,
      title: "Real-time Transfer",
      description: "Instant file sharing with live progress tracking and transfer speed monitoring."
    }
  ];

  return (
    <section aria-label="Features" className="space-y-8">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <h2 className="text-3xl font-bold mb-4">Advanced P2P File Transfer Technology</h2>
        <p className="text-gray-400">
          LocalBolt leverages cutting-edge web technologies to provide the most secure and efficient file transfer experience. 
          Our WebRTC-based solution outperforms traditional cloud services while maintaining complete privacy.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-up">
        {features.map((feature) => (
          <FeatureCard key={feature.title} {...feature} />
        ))}
      </div>

      <div className="mt-12 text-center max-w-3xl mx-auto">
        <h3 className="text-xl font-semibold mb-4">Why Choose LocalBolt?</h3>
        <p className="text-gray-400 leading-relaxed">
          Unlike traditional file sharing services that store your files on servers, LocalBolt creates a direct, encrypted connection between devices. 
          This peer-to-peer approach, combined with WebRTC technology, enables faster transfers while ensuring complete privacy. 
          No file size limits, no compression, and no cloud storage - just secure, instant file sharing.
        </p>
      </div>
    </section>
  );
};
