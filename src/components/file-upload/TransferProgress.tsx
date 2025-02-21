
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { X } from "lucide-react";
import type { TransferProgress as TransferProgressType } from "@/services/webrtc/FileTransferService";

interface TransferProgressProps {
  progress: TransferProgressType;
  onCancel: () => void;
}

export const TransferProgressBar = ({ progress, onCancel }: TransferProgressProps) => {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (seconds: number): string => {
    if (!seconds || seconds === Infinity || seconds < 0) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    switch (progress.status) {
      case 'canceled_by_sender':
        return 'Transfer canceled by sender';
      case 'canceled_by_receiver':
        return 'Transfer canceled by receiver';
      case 'error':
        return progress.error?.message || 'Transfer terminated due to an error';
      case 'completed':
        return 'Transfer completed';
      case 'paused':
        return 'Transfer paused';
      case 'transferring':
        return `${Math.round((progress.loaded / progress.total) * 100)}%`;
      case 'initializing':
        return 'Initializing transfer...';
      default:
        return 'Unknown status';
    }
  };

  const getProgressBarColor = () => {
    if (progress.status === 'error') return 'bg-red-500/20';
    if (progress.status?.includes('canceled')) return 'bg-neon/20';
    if (progress.status === 'completed') return 'bg-green-500';
    if (progress.status === 'paused') return 'bg-yellow-500';
    return 'bg-dark-accent';
  };

  const showCancelButton = progress.status === 'transferring' || progress.status === 'initializing';

  return (
    <div className="space-y-3 bg-dark-accent/20 p-4 rounded-lg border border-white/10">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h4 className="font-medium truncate">{progress.filename}</h4>
          <p className={`text-sm ${
            progress.status === 'error' ? 'text-red-500' : 
            progress.status?.includes('canceled') ? 'text-neon' : 
            'text-white/70'
          }`}>
            {getStatusText()}
          </p>
        </div>
        {showCancelButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            className="text-white/50 hover:text-neon transition-colors"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <Progress 
        value={(progress.currentChunk / progress.totalChunks) * 100}
        className={`h-2 ${getProgressBarColor()}`}
      />

      <div className="grid grid-cols-2 gap-4 text-sm text-white/70">
        <div>
          <p>Transferred: {formatBytes(progress.loaded)} / {formatBytes(progress.total)}</p>
          {progress.stats && (
            <>
              <p>Speed: {formatBytes(progress.stats.speed)}/s</p>
              <p>Time remaining: {formatTime(progress.stats.estimatedTimeRemaining)}</p>
            </>
          )}
        </div>
        <div className="text-right">
          {progress.stats && (
            <>
              <p>Elapsed: {formatTime(
                (Date.now() - progress.stats.startTime) / 1000
              )}</p>
              <p>Avg. Speed: {formatBytes(progress.stats.averageSpeed)}/s</p>
              {progress.stats.retryCount > 0 && (
                <p>Retries: {progress.stats.retryCount}</p>
              )}
            </>
          )}
        </div>
      </div>

      {progress.error && (
        <div className="mt-2 p-2 bg-red-500/10 rounded border border-red-500/20 text-red-400 text-sm">
          <p>Error: {progress.error.message}</p>
          {progress.error.code && <p className="text-xs">Code: {progress.error.code}</p>}
        </div>
      )}
    </div>
  );
};
