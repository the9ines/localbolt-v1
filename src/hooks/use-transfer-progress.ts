
import { useState, useCallback, useEffect, useRef } from 'react';
import type { TransferProgress } from '@/services/webrtc/FileTransferService';
import type WebRTCService from '@/services/webrtc/WebRTCService';

export const useTransferProgress = (webrtc: WebRTCService | null) => {
  const [transferProgress, setTransferProgress] = useState<TransferProgress | null>(null);
  const lastEventTime = useRef<{ [key: string]: number }>({});
  const lastProcessedProgress = useRef<TransferProgress | null>(null);
  const EVENT_COOLDOWN = 100; // Reduced to 100ms to show more frequent updates
  
  useEffect(() => {
    // Register the progress callback whenever webrtc changes
    if (webrtc) {
      console.log('[TRANSFER-PROGRESS] Setting up progress callback on WebRTC service');
      
      const handleProgressUpdate = (progress: TransferProgress) => {
        console.log('[TRANSFER-PROGRESS] Progress update received:', {
          filename: progress.filename,
          loaded: progress.loaded,
          total: progress.total,
          status: progress.status,
          currentChunk: progress.currentChunk,
          totalChunks: progress.totalChunks
        });
        
        // Force update the progress state directly
        setTransferProgress(progress);
      };
      
      // Register our callback
      webrtc.setProgressCallback(handleProgressUpdate);
      
      // Cleanup function
      return () => {
        console.log('[TRANSFER-PROGRESS] Cleaning up progress callback');
        webrtc.setProgressCallback(undefined);
      };
    }
  }, [webrtc]);
  
  useEffect(() => {
    if (!transferProgress?.status) return;
    
    console.log('[TRANSFER-PROGRESS] Progress state updated:', {
      filename: transferProgress.filename,
      loaded: transferProgress.loaded,
      total: transferProgress.total,
      status: transferProgress.status,
      percent: transferProgress.total > 0 ? 
        Math.round((transferProgress.loaded / transferProgress.total) * 100) : 0
    });

    // Store the last progress update for comparison
    lastProcessedProgress.current = transferProgress;

    // Only clear progress for completed or error states
    if (transferProgress.status === 'canceled_by_sender' || 
        transferProgress.status === 'canceled_by_receiver' ||
        transferProgress.status === 'error' ||
        (transferProgress.loaded === transferProgress.total && transferProgress.total > 0)) {
      
      console.log('[TRANSFER-PROGRESS] Clearing progress due to completion or error:', transferProgress.status);
      
      // Give the UI a chance to show 100% before clearing
      if (transferProgress.loaded === transferProgress.total && transferProgress.total > 0) {
        setTimeout(() => {
          setTransferProgress(null);
        }, 1000);
      } else {
        setTransferProgress(null);
      }
    }
  }, [transferProgress?.status, transferProgress?.loaded, transferProgress?.total]);

  const shouldProcessEvent = useCallback((eventType: string, filename: string) => {
    const now = Date.now();
    const lastTime = lastEventTime.current[`${eventType}-${filename}`] || 0;
    
    if (now - lastTime < EVENT_COOLDOWN) {
      return false;
    }
    
    lastEventTime.current[`${eventType}-${filename}`] = now;
    return true;
  }, []);

  const handleProgress = useCallback((progress: TransferProgress) => {
    console.log('[TRANSFER-PROGRESS] Handling external progress update:', progress);
    
    if (!progress?.filename || !progress?.status) {
      console.log('[TRANSFER-PROGRESS] Ignoring invalid progress update');
      return;
    }

    // Always process completion events regardless of cooldown
    const isCompletion = progress.loaded === progress.total && progress.total > 0;
    const isStatusChange = lastProcessedProgress.current?.status !== progress.status;
    
    if (!isCompletion && !isStatusChange && !shouldProcessEvent('progress', progress.filename)) {
      return;
    }

    setTransferProgress(progress);
  }, [shouldProcessEvent]);

  const handleCancelReceiving = useCallback(() => {
    if (!webrtc || !transferProgress?.filename) return;

    if (!shouldProcessEvent('cancel', transferProgress.filename)) {
      return;
    }

    console.log('[TRANSFER-PROGRESS] Canceling transfer:', transferProgress.filename);
    webrtc.cancelTransfer(transferProgress.filename, true);
    setTransferProgress(null);
  }, [webrtc, transferProgress, shouldProcessEvent]);

  const handlePauseTransfer = useCallback(() => {
    if (!webrtc || !transferProgress?.filename) return;

    if (!shouldProcessEvent('pause', transferProgress.filename)) {
      return;
    }

    console.log('[TRANSFER-PROGRESS] Pausing transfer:', transferProgress.filename);
    webrtc.pauseTransfer(transferProgress.filename);
    setTransferProgress(prev => prev ? { ...prev, status: 'paused' } : null);
  }, [webrtc, transferProgress, shouldProcessEvent]);

  const handleResumeTransfer = useCallback(() => {
    if (!webrtc || !transferProgress?.filename) return;

    if (!shouldProcessEvent('resume', transferProgress.filename)) {
      return;
    }

    console.log('[TRANSFER-PROGRESS] Resuming transfer:', transferProgress.filename);
    webrtc.resumeTransfer(transferProgress.filename);
    setTransferProgress(prev => prev ? { ...prev, status: 'transferring' } : null);
  }, [webrtc, transferProgress, shouldProcessEvent]);

  const clearProgress = useCallback(() => {
    console.log('[TRANSFER-PROGRESS] Manually clearing progress state');
    setTransferProgress(null);
    lastEventTime.current = {};
    lastProcessedProgress.current = null;
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
