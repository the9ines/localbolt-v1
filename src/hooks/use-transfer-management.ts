
import { useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import type { TransferProgress } from "@/services/webrtc/FileTransferService";
import WebRTCService from "@/services/webrtc/WebRTCService";

export const useTransferManagement = (
  webrtc: WebRTCService,
  files: File[],
  setFiles: (files: File[]) => void
) => {
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const { toast } = useToast();
  const lastToastTime = useRef<number>(0);
  const TOAST_COOLDOWN = 1000; // 1 second cooldown between toasts
  const lastStatus = useRef<string | null>(null);

  const showToast = useCallback((title: string, description: string, variant?: "default" | "destructive") => {
    const now = Date.now();
    if (now - lastToastTime.current > TOAST_COOLDOWN) {
      lastToastTime.current = now;
      toast({ title, description, variant });
    }
  }, [toast]);

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
      showToast("Transfer complete", "File transferred successfully");
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
      const cancelledBy = transferProgress.status === 'canceled_by_sender' ? 'sender' : 'receiver';
      resetTransfer();
      showToast("Transfer cancelled", `The file transfer was cancelled by the ${cancelledBy}`);
      return;
    }

    // Handle errors
    if (transferProgress.status === 'error') {
      resetTransfer();
      showToast("Transfer error", "An error occurred during the transfer", "destructive");
      return;
    }
  }, [resetTransfer, showToast]);

  const handlePauseTransfer = useCallback(() => {
    if (webrtc && progress?.filename) {
      webrtc.pauseTransfer(progress.filename);
      setProgress(prev => prev ? { ...prev, status: 'paused' } : null);
      showToast("Transfer paused", "File transfer has been paused");
    }
  }, [webrtc, progress, showToast]);

  const handleResumeTransfer = useCallback(() => {
    if (webrtc && progress?.filename) {
      webrtc.resumeTransfer(progress.filename);
      setProgress(prev => prev ? { ...prev, status: 'transferring' } : null);
      showToast("Transfer resumed", "File transfer has been resumed");
    }
  }, [webrtc, progress, showToast]);

  const cancelTransfer = useCallback(() => {
    if (webrtc && progress?.filename) {
      webrtc.cancelTransfer(progress.filename);
      // Don't call resetTransfer() here - wait for the cancel event
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
      showToast("Transfer failed", "Failed to send file", "destructive");
    }
  }, [webrtc, files, progress, cancelTransfer, handleProgress, resetTransfer, setFiles, showToast]);

  return {
    progress,
    handlePauseTransfer,
    handleResumeTransfer,
    cancelTransfer,
    startTransfer
  };
};
