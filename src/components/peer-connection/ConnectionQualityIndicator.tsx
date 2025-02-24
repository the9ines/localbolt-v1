
import { useEffect, useState } from 'react';
import { SignalHigh, SignalMedium, SignalLow, SignalZero } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import WebRTCService from '@/services/webrtc/WebRTCService';
import { ConnectionQualityMetrics } from '@/services/webrtc/ConnectionQualityMonitor';
import { useToast } from "@/hooks/use-toast";

interface ConnectionQualityIndicatorProps {
  webrtc: WebRTCService | null;
  isLocal: boolean;
}

export const ConnectionQualityIndicator = ({ 
  webrtc,
  isLocal 
}: ConnectionQualityIndicatorProps) => {
  const [metrics, setMetrics] = useState<ConnectionQualityMetrics | null>(null);
  const { toast } = useToast();
  const [lastGoodQuality, setLastGoodQuality] = useState<ConnectionQualityMetrics['currentQuality']>('good');

  useEffect(() => {
    if (!webrtc) return;

    const handleQualityChange = (newMetrics: ConnectionQualityMetrics) => {
      setMetrics(newMetrics);

      // Show warning when quality degrades significantly
      if (newMetrics.currentQuality === 'poor' || newMetrics.currentQuality === 'critical') {
        if (lastGoodQuality === 'excellent' || lastGoodQuality === 'good') {
          toast({
            title: "Connection Quality Alert",
            description: `Connection quality has degraded to ${newMetrics.currentQuality}. Some transfers may be slower.`,
            variant: "destructive",
          });
        }
      } else {
        setLastGoodQuality(newMetrics.currentQuality);
      }
    };

    webrtc.startQualityMonitoring(handleQualityChange);

    return () => {
      webrtc.stopQualityMonitoring();
    };
  }, [webrtc, toast, lastGoodQuality]);

  if (!metrics) return null;

  const getQualityIcon = () => {
    switch (metrics.currentQuality) {
      case 'excellent':
        return <SignalHigh className="w-4 h-4 text-green-500" />;
      case 'good':
        return <SignalHigh className="w-4 h-4 text-green-400" />;
      case 'fair':
        return <SignalMedium className="w-4 h-4 text-yellow-500" />;
      case 'poor':
        return <SignalLow className="w-4 h-4 text-orange-500" />;
      case 'critical':
        return <SignalZero className="w-4 h-4 text-red-500" />;
      default:
        return <SignalZero className="w-4 h-4 text-gray-500" />;
    }
  };

  const getQualityText = () => {
    const quality = metrics.currentQuality;
    const rtt = metrics.rtt ? `${Math.round(metrics.rtt)}ms` : 'N/A';
    const packetLoss = metrics.packetLoss ? `${metrics.packetLoss.toFixed(1)}%` : 'N/A';
    
    return `Quality: ${quality} | Latency: ${rtt} | Packet Loss: ${packetLoss}`;
  };

  return (
    <Tooltip content={getQualityText()}>
      <Badge 
        variant="outline" 
        className={`
          flex items-center gap-2 py-1 px-2
          ${metrics.currentQuality === 'excellent' || metrics.currentQuality === 'good' 
            ? 'border-green-500/30 bg-green-500/10' 
            : metrics.currentQuality === 'fair'
            ? 'border-yellow-500/30 bg-yellow-500/10'
            : 'border-red-500/30 bg-red-500/10'
          }
        `}
      >
        {getQualityIcon()}
        <span className="text-xs font-medium">
          {isLocal ? 'LAN' : 'WAN'} {metrics.currentQuality}
        </span>
      </Badge>
    </Tooltip>
  );
};
