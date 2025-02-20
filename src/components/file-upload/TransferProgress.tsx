
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { X } from "lucide-react";
import type { TransferProgress as TransferProgressType } from "@/services/webrtc/FileTransferService";

interface TransferProgressProps {
  progress: TransferProgressType;
  onCancel: () => void;
}

export const TransferProgressBar = ({ progress, onCancel }: TransferProgressProps) => {
  const getStatusText = () => {
    switch (progress.status) {
      case 'canceled_by_sender':
        return 'Transfer canceled by sender';
      case 'canceled_by_receiver':
        return 'Transfer canceled by receiver';
      case 'error':
        return 'Transfer terminated due to an error';
      default:
        return `${Math.round((progress.loaded / progress.total) * 100)}%`;
    }
  };

  const getProgressBarColor = () => {
    if (progress.status === 'error') return 'bg-red-500/20';
    if (progress.status?.includes('canceled')) return 'bg-yellow-500/20';
    return 'bg-dark-accent';
  };

  const showCancelButton = progress.status === 'transferring';

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="truncate">{progress.filename}</span>
        <span className={
          progress.status === 'error' ? 'text-red-500' : 
          progress.status?.includes('canceled') ? 'text-yellow-500' : ''
        }>
          {getStatusText()}
        </span>
      </div>
      <div className="flex space-x-2">
        <Progress 
          value={(progress.currentChunk / progress.totalChunks) * 100}
          className={`h-2 flex-1 ${getProgressBarColor()}`}
        />
        {showCancelButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            className="text-white/50 hover:text-red-500"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
