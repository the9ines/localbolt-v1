
import { useState, useCallback, useRef } from "react";
import type { TransferProgress } from "@/services/webrtc/FileTransferService";
import WebRTCService from "@/services/webrtc/WebRTCService";

export const useTransferManagement = (
  webrtc: WebRTCService,
  files: File[],
  setFiles: (files: File[]) => void
) => {
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const lastStatus = useRef<string | null>(null);

  const resetTransfer = useCallback(() => {
    setProgress(null);
    lastStatus.current = null;
  }, []);

  const handleProgress = useCallback((transferProgress: TransferProgress) => {
    console.log('[TRANSFER] Progress update in UI:', transferProgress);
    
    if (!transferProgress || !transferProgress.filename) {
      console.log('[TRANSFER] Ignoring invalid progress update');
      return;
    }

    // For completion states, always process
    if (transferProgress.status === 'transferring' && 
        transferProgress.loaded === transferProgress.total && 
        transferProgress.total > 0) {
      console.log('[TRANSFER] Transfer complete, resetting state');
      resetTransfer();
      return;
    }

    // For cancel states, reset immediately
    if (transferProgress.status === 'canceled_by_sender' || 
        transferProgress.status === 'canceled_by_receiver') {
      console.log('[TRANSFER] Transfer canceled, resetting state');
      resetTransfer();
      return;
    }

    // For error states, reset
    if (transferProgress.status === 'error') {
      console.log('[TRANSFER] Transfer error, resetting state');
      resetTransfer();
      return;
    }

    // For normal progress updates, update the state
    console.log('[TRANSFER] Updating progress state:', transferProgress);
    setProgress(prevProgress => {
      // If status was paused and we're getting a transferring update,
      // preserve the pause state (this happens when we receive progress from the peer)
      if (prevProgress?.status === 'paused' && transferProgress.status === 'transferring') {
        return { ...transferProgress, status: 'paused' };
      }
      
      // Normal update
      return transferProgress;
    });
    
    // Update last status for tracking
    lastStatus.current = transferProgress.status;
  }, [resetTransfer]);

  const handlePauseTransfer = useCallback(() => {
    if (webrtc && progress?.filename) {
      console.log('[TRANSFER] Pausing transfer:', progress.filename);
      webrtc.pauseTransfer(progress.filename);
      setProgress(prev => prev ? { ...prev, status: 'paused' } : null);
    }
  }, [webrtc, progress]);

  const handleResumeTransfer = useCallback(() => {
    if (webrtc && progress?.filename) {
      console.log('[TRANSFER] Resuming transfer:', progress.filename);
      webrtc.resumeTransfer(progress.filename);
      setProgress(prev => prev ? { ...prev, status: 'transferring' } : null);
    }
  }, [webrtc, progress]);

  const cancelTransfer = useCallback(() => {
    if (webrtc && progress?.filename) {
      console.log('[TRANSFER] Canceling transfer:', progress.filename);
      webrtc.cancelTransfer(progress.filename);
      resetTransfer();
    }
  }, [webrtc, progress, resetTransfer]);

  const startTransfer = useCallback(async () => {
    if (!webrtc || !files.length) {
      console.log('[TRANSFER] Cannot start transfer - no WebRTC or files');
      return;
    }

    if (progress) {
      console.log('[TRANSFER] Canceling current transfer before starting new one');
      await cancelTransfer();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      const file = files[0];
      console.log('[TRANSFER] Starting transfer for:', file.name);
      
      resetTransfer();
      
      webrtc.setProgressCallback(handleProgress);
      await webrtc.sendFile(file);
      
      setFiles(files.filter((_, index) => index !== 0));
      
      console.log('[TRANSFER] Transfer completed for:', file.name);
    } catch (error) {
      console.error('[TRANSFER] Transfer error:', error);
      
      if (error.message === "Transfer cancelled by user") {
        return;
      }
      
      resetTransfer();
    }
  }, [webrtc, files, progress, cancelTransfer, handleProgress, resetTransfer, setFiles]);

  return {
    progress,
    handlePauseTransfer,
    handleResumeTransfer,
    cancelTransfer,
    startTransfer
  };
};
