
import { Smartphone, Laptop, Computer, Gamepad } from "lucide-react";

interface DeviceStatusIndicatorProps {
  deviceType: "phone" | "laptop" | "pc" | "steamdeck";
  isConnected: boolean;
}

export const DeviceStatusIndicator = ({ deviceType, isConnected }: DeviceStatusIndicatorProps) => {
  if (!isConnected) return null;

  const iconProps = {
    size: 20,
    className: "text-neon animate-fade-in",
  };

  switch (deviceType) {
    case "phone":
      return <Smartphone {...iconProps} />;
    case "laptop":
      return <Laptop {...iconProps} />;
    case "steamdeck":
      return <Gamepad {...iconProps} />;
    default:
      return <Computer {...iconProps} />;
  }
};
