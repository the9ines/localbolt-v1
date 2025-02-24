
import { useState, useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { TransferProgress } from '@/services/webrtc/FileTransferService';
import type WebRTCService from '@/services/webrtc/WebRTCService';

export const useTransferProgress = (webrtc: WebRTCService | null) => {
  const [transferProgress, setTransferProgress] = useState<TransferProgress | null>(null);
  const { toast } = useToast();
  const lastEventTime = useRef<{ [key: string]: number }>({});
  const EVENT_COOLDOWN = 500; // 500ms cooldown between same events
  
  useEffect(() => {
    if (!transferProgress?.status) return;

    // Only clear progress for completed or error states
    if (transferProgress.status === 'canceled_by_sender' || 
        transferProgress.status === 'canceled_by_receiver' ||
        transferProgress.status === 'error') {
      setTransferProgress(null);
    }
  }, [transferProgress?.status]);

  const shouldProcessEvent = useCallback((eventType: string, filename: string) => {
    const now = Date.now();
    const lastTime = lastEventTime.current[`${eventType}-${filename}`] || 0;
    
    if (now - lastTime < EVENT_COOLDOWN) {
      console.log(`[PROGRESS] Skipping duplicate ${eventType} event for ${filename}`);
      return false;
    }
    
    lastEventTime.current[`${eventType}-${filename}`] = now;
    return true;
  }, []);

  const handleProgress = useCallback((progress: TransferProgress) => {
    console.log('[PROGRESS] Received progress update:', progress);
    
    if (!progress?.filename || !progress?.status) {
      console.log('[PROGRESS] Ignoring invalid progress update');
      return;
    }

    // Check for duplicate events
    if (!shouldProcessEvent(progress.status, progress.filename)) {
      return;
    }

    switch (progress.status) {
      case 'canceled_by_sender':
      case 'canceled_by_receiver':
        setTransferProgress(null);
        const cancelledBy = progress.status === 'canceled_by_sender' ? 'sender' : 'receiver';
        toast({
          title: "Transfer Canceled",
          description: `The transfer was canceled by the ${cancelledBy}`,
        });
        break;

      case 'error':
        setTransferProgress(null);
        toast({
          title: "Transfer Error",
          description: "The transfer was terminated due to an error",
          variant: "destructive",
        });
        break;

      case 'transferring':
      case 'paused':
        setTransferProgress(prev => {
          // Don't update if nothing changed
          if (prev?.status === progress.status &&
              prev?.loaded === progress.loaded &&
              prev?.total === progress.total) {
            return prev;
          }

          // For completed transfer
          if (progress.loaded === progress.total && progress.total > 0) {
            toast({
              title: "Transfer Complete",
              description: "File transferred successfully",
            });
            return null;
          }

          return progress;
        });
        break;

      default:
        console.log('[PROGRESS] Unhandled progress status:', progress.status);
        break;
    }
  }, [toast, shouldProcessEvent]);

  const handleCancelReceiving = useCallback(() => {
    if (!webrtc || !transferProgress?.filename) return;

    if (!shouldProcessEvent('cancel', transferProgress.filename)) {
      return;
    }

    console.log('[PROGRESS] Canceling transfer:', transferProgress.filename);
    webrtc.cancelTransfer(transferProgress.filename, true);
    setTransferProgress(null);
  }, [webrtc, transferProgress, shouldProcessEvent]);

  const handlePauseTransfer = useCallback(() => {
    if (!webrtc || !transferProgress?.filename) return;

    if (!shouldProcessEvent('pause', transferProgress.filename)) {
      return;
    }

    console.log('[PROGRESS] Pausing transfer:', transferProgress.filename);
    webrtc.pauseTransfer(transferProgress.filename);
    setTransferProgress(prev => prev ? { ...prev, status: 'paused' } : null);
  }, [webrtc, transferProgress, shouldProcessEvent]);

  const handleResumeTransfer = useCallback(() => {
    if (!webrtc || !transferProgress?.filename) return;

    if (!shouldProcessEvent('resume', transferProgress.filename)) {
      return;
    }

    console.log('[PROGRESS] Resuming transfer:', transferProgress.filename);
    webrtc.resumeTransfer(transferProgress.filename);
    setTransferProgress(prev => prev ? { ...prev, status: 'transferring' } : null);
  }, [webrtc, transferProgress, shouldProcessEvent]);

  const clearProgress = useCallback(() => {
    setTransferProgress(null);
    lastEventTime.current = {};
  }, []);

  return {
    transferProgress,
    handleProgress,
    handleCancelReceiving,
    handlePauseTransfer,
    handleResumeTransfer,
    clearProgress
  };
};
