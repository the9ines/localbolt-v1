
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Pause, Play, X } from "lucide-react";
import type { TransferProgress as TransferProgressType } from "@/services/webrtc/FileTransferService";

interface TransferProgressProps {
  progress: TransferProgressType;
  onCancel: () => void;
  onPause?: () => void;
  onResume?: () => void;
}

const formatSpeed = (bytesPerSecond: number): string => {
  if (bytesPerSecond === 0) return '0 B/s';
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const exponent = Math.min(Math.floor(Math.log(bytesPerSecond) / Math.log(1024)), units.length - 1);
  return `${(bytesPerSecond / Math.pow(1024, exponent)).toFixed(2)} ${units[exponent]}`;
};

const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || seconds < 0) return 'calculating...';
  if (seconds === 0) return '0s';
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (hrs > 0) parts.push(`${hrs}h`);
  if (mins > 0) parts.push(`${mins}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
};

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, exponent)).toFixed(2)} ${units[exponent]}`;
};

export const TransferProgressBar = ({ progress, onCancel, onPause, onResume }: TransferProgressProps) => {
  const getStatusText = () => {
    switch (progress.status) {
      case 'canceled_by_sender':
        return 'Transfer canceled';
      case 'canceled_by_receiver':
        return 'Transfer canceled';
      case 'error':
        return 'Transfer terminated due to an error';
      case 'paused':
        return 'Transfer paused';
      default:
        return `${Math.round((progress.loaded / progress.total) * 100)}%`;
    }
  };

  const showControls = progress.status === 'transferring' || progress.status === 'paused';
  const isPaused = progress.status === 'paused';

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="truncate flex-1">{progress.filename}</span>
        <span>{getStatusText()}</span>
      </div>
      
      <div className="flex space-x-2">
        <Progress 
          value={(progress.currentChunk / progress.totalChunks) * 100}
          className="h-2 flex-1 bg-neon/20"
        />
        <div className="flex space-x-1">
          {showControls && onPause && onResume && (
            <Button
              variant="ghost"
              size="icon"
              onClick={isPaused ? onResume : onPause}
              className="text-white/50 hover:text-neon transition-colors touch-manipulation"
              aria-label={isPaused ? "Resume transfer" : "Pause transfer"}
            >
              {isPaused ? (
                <Play className="w-4 h-4" />
              ) : (
                <Pause className="w-4 h-4" />
              )}
            </Button>
          )}
          {showControls && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancel}
              className="text-white/50 hover:text-red-500 transition-colors touch-manipulation"
              aria-label="Cancel transfer"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {progress.stats && (
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
          <div>Speed: {formatSpeed(progress.stats.speed)}</div>
          <div>Avg: {formatSpeed(progress.stats.averageSpeed)}</div>
          <div>
            {formatSize(progress.loaded)} / {formatSize(progress.total)}
          </div>
          <div>
            {progress.stats.estimatedTimeRemaining > 0 
              ? `~${formatTime(progress.stats.estimatedTimeRemaining)} remaining` 
              : 'Calculating...'}
          </div>
          {progress.stats.retryCount > 0 && (
            <div className="col-span-2 text-yellow-500">
              Retries: {progress.stats.retryCount}/{progress.stats.maxRetries}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
