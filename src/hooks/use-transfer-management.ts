
import { useState, useCallback } from "react";
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

  const resetTransfer = useCallback(() => {
    setProgress(null);
  }, []);

  const handleProgress = useCallback((transferProgress: TransferProgress) => {
    console.log('[TRANSFER] Progress update in UI:', transferProgress);
    
    if (!transferProgress || !transferProgress.filename) {
      return;
    }

    // Handle completed transfer
    if (transferProgress.status === 'transferring' && 
        transferProgress.loaded === transferProgress.total && 
        transferProgress.total > 0) {
      resetTransfer();
      toast({
        title: "Transfer complete",
        description: "File transferred successfully"
      });
      return;
    }

    // Update progress for active transfer
    if (transferProgress.status === 'transferring' || transferProgress.status === 'paused') {
      setProgress(transferProgress);
      return;
    }

    // Handle cancellation
    if (transferProgress.status === 'canceled_by_sender' || 
        transferProgress.status === 'canceled_by_receiver') {
      resetTransfer();
      toast({
        title: "Transfer cancelled",
        description: "The file transfer was cancelled"
      });
      return;
    }

    // Handle errors
    if (transferProgress.status === 'error') {
      resetTransfer();
      toast({
        title: "Transfer error",
        description: "An error occurred during the transfer",
        variant: "destructive"
      });
      return;
    }
  }, [toast, resetTransfer]);

  const handlePauseTransfer = useCallback(() => {
    if (webrtc && progress?.filename) {
      webrtc.pauseTransfer(progress.filename);
    }
  }, [webrtc, progress]);

  const handleResumeTransfer = useCallback(() => {
    if (webrtc && progress?.filename) {
      webrtc.resumeTransfer(progress.filename);
    }
  }, [webrtc, progress]);

  const cancelTransfer = useCallback(() => {
    if (webrtc && progress?.filename) {
      webrtc.cancelTransfer(progress.filename);
      resetTransfer();
    }
  }, [webrtc, progress, resetTransfer]);

  const startTransfer = useCallback(async () => {
    if (!webrtc || !files.length) {
      return;
    }

    // If there's an active transfer, cancel it first
    if (progress) {
      await cancelTransfer();
    }

    try {
      const file = files[0];
      console.log('[TRANSFER] Starting transfer for:', file.name);
      
      // Reset any existing progress
      resetTransfer();
      
      // Set up new transfer
      webrtc.setProgressCallback(handleProgress);
      await webrtc.sendFile(file);
      
      // Remove the sent file from the queue
      setFiles(files.filter((_, index) => index !== 0));
      
      console.log('[TRANSFER] Transfer completed for:', file.name);
      
      toast({
        title: "Transfer complete",
        description: `${file.name} has been sent successfully`
      });
    } catch (error) {
      console.error('[TRANSFER] Transfer error:', error);
      resetTransfer();
      
      if (error.message !== "Transfer cancelled by user") {
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
