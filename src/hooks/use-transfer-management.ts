
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
  const cancelToastShown = useRef(false);
  const completionToastShown = useRef(false);
  const errorToastShown = useRef(false);

  const resetTransfer = useCallback(() => {
    setProgress(null);
    cancelToastShown.current = false;
    completionToastShown.current = false;
    errorToastShown.current = false;
  }, []);

  const handleProgress = useCallback((transferProgress: TransferProgress) => {
    console.log('[TRANSFER] Progress update in UI:', transferProgress);
    
    if (!transferProgress || !transferProgress.filename) {
      return;
    }

    // Handle completed transfer
    if (transferProgress.status === 'transferring' && 
        transferProgress.loaded === transferProgress.total && 
        transferProgress.total > 0 && 
        !completionToastShown.current) {
      completionToastShown.current = true;
      resetTransfer();
      toast({
        title: "Transfer complete",
        description: "File transferred successfully"
      });
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
    if ((transferProgress.status === 'canceled_by_sender' || 
         transferProgress.status === 'canceled_by_receiver') && 
        !cancelToastShown.current) {
      cancelToastShown.current = true;
      const cancelledBy = transferProgress.status === 'canceled_by_sender' ? 'sender' : 'receiver';
      toast({
        title: "Transfer cancelled",
        description: `The file transfer was cancelled by the ${cancelledBy}`
      });
      resetTransfer();
      return;
    }

    // Handle errors
    if (transferProgress.status === 'error' && !errorToastShown.current) {
      errorToastShown.current = true;
      toast({
        title: "Transfer error",
        description: "An error occurred during the transfer",
        variant: "destructive"
      });
      resetTransfer();
      return;
    }
  }, [toast, resetTransfer]);

  const handlePauseTransfer = useCallback(() => {
    if (webrtc && progress?.filename) {
      webrtc.pauseTransfer(progress.filename);
      setProgress(prev => prev ? { ...prev, status: 'paused' } : null);
      toast({
        title: "Transfer paused",
        description: "File transfer has been paused"
      });
    }
  }, [webrtc, progress, toast]);

  const handleResumeTransfer = useCallback(() => {
    if (webrtc && progress?.filename) {
      webrtc.resumeTransfer(progress.filename);
      setProgress(prev => prev ? { ...prev, status: 'transferring' } : null);
      toast({
        title: "Transfer resumed",
        description: "File transfer has been resumed"
      });
    }
  }, [webrtc, progress, toast]);

  const cancelTransfer = useCallback(() => {
    if (webrtc && progress?.filename) {
      webrtc.cancelTransfer(progress.filename);
      // Don't call resetTransfer() here - wait for the cancel event to come through handleProgress
      // This ensures both sides handle the cancellation consistently
    }
  }, [webrtc, progress]);

  const startTransfer = useCallback(async () => {
    if (!webrtc || !files.length) {
      return;
    }

    // If there's an active transfer, cancel it first
    if (progress) {
      await cancelTransfer();
      // Wait a bit for the cancellation to process
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      const file = files[0];
      console.log('[TRANSFER] Starting transfer for:', file.name);
      
      // Reset any existing progress and toast state
      resetTransfer();
      
      // Set up new transfer
      webrtc.setProgressCallback(handleProgress);
      await webrtc.sendFile(file);
      
      // Remove the sent file from the queue
      setFiles(files.filter((_, index) => index !== 0));
      
      console.log('[TRANSFER] Transfer completed for:', file.name);
    } catch (error) {
      console.error('[TRANSFER] Transfer error:', error);
      
      if (error.message === "Transfer cancelled by user") {
        // Let the cancel handler deal with the toast
        return;
      }
      
      resetTransfer();
      if (!errorToastShown.current) {
        errorToastShown.current = true;
        toast({
          title: "Transfer failed",
          description: "Failed to send file",
          variant: "destructive"
        });
      }
    }
  }, [webrtc, files, progress, cancelTransfer, handleProgress, resetTransfer, setFiles, toast]);

  return {
    progress,
    handlePauseTransfer,
    handleResumeTransfer,
    cancelTransfer,
    startTransfer
  };
};
