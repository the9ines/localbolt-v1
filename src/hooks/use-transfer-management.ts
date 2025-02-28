
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
      return;
    }

    // Prevent duplicate status notifications
    if (lastStatus.current === transferProgress.status) {
      return;
    }

    lastStatus.current = transferProgress.status;

    // Handle completed transfer
    if (transferProgress.status === 'transferring' && 
        transferProgress.loaded === transferProgress.total && 
        transferProgress.total > 0) {
      resetTransfer();
      return;
    }

    // Update progress for active transfer
    if (transferProgress.status === 'transferring' || transferProgress.status === 'paused') {
      setProgress(prevProgress => {
        // Preserve pause state when receiving new progress
        if (prevProgress?.status === 'paused' && transferProgress.status === 'transferring') {
          return { ...transferProgress, status: 'paused' };
        }
        return transferProgress;
      });
      return;
    }

    // Handle cancellation
    if (transferProgress.status === 'canceled_by_sender' || 
        transferProgress.status === 'canceled_by_receiver') {
      resetTransfer();
      return;
    }

    // Handle errors
    if (transferProgress.status === 'error') {
      resetTransfer();
      return;
    }
  }, [resetTransfer]);

  const handlePauseTransfer = useCallback(() => {
    if (webrtc && progress?.filename) {
      webrtc.pauseTransfer(progress.filename);
      setProgress(prev => prev ? { ...prev, status: 'paused' } : null);
    }
  }, [webrtc, progress]);

  const handleResumeTransfer = useCallback(() => {
    if (webrtc && progress?.filename) {
      webrtc.resumeTransfer(progress.filename);
      setProgress(prev => prev ? { ...prev, status: 'transferring' } : null);
    }
  }, [webrtc, progress]);

  const cancelTransfer = useCallback(() => {
    if (webrtc && progress?.filename) {
      webrtc.cancelTransfer(progress.filename);
    }
  }, [webrtc, progress]);

  const startTransfer = useCallback(async () => {
    if (!webrtc || !files.length) {
      return;
    }

    if (progress) {
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
