import { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { TransferProgress } from '@/services/webrtc/FileTransferService';
import WebRTCService from '@/services/webrtc/WebRTCService';

export const useTransferProgress = (webrtc: WebRTCService | null) => {
  const [transferProgress, setTransferProgress] = useState<TransferProgress | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (transferProgress?.status && 
        transferProgress.status !== 'transferring' && 
        transferProgress.status !== 'paused') {
      const timer = setTimeout(() => {
        setTransferProgress(null);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [transferProgress]);

  const handleProgress = useCallback((progress: TransferProgress) => {
    console.log('[PROGRESS] Received progress update:', progress);
    
    setTransferProgress(prevProgress => {
      if (!prevProgress) return progress;
      
      const updatedProgress = {
        ...prevProgress,
        ...progress,
        // Always keep latest progress values if they exist
        loaded: progress.loaded ?? prevProgress.loaded,
        total: progress.total ?? prevProgress.total,
        currentChunk: progress.currentChunk ?? prevProgress.currentChunk,
        totalChunks: progress.totalChunks ?? prevProgress.totalChunks,
        // Keep the filename consistent
        filename: progress.filename || prevProgress.filename,
        // Update status if provided
        status: progress.status || prevProgress.status
      };
      
      console.log('[PROGRESS] Updated progress state:', updatedProgress);
      return updatedProgress;
    });
    
    if (progress.status) {
      switch (progress.status) {
        case 'canceled_by_sender':
          toast({
            title: "Transfer Canceled",
            description: "The sender has canceled the transfer",
          });
          break;
        case 'canceled_by_receiver':
          toast({
            title: "Transfer Canceled",
            description: "You have canceled the transfer",
          });
          break;
        case 'error':
          toast({
            title: "Transfer Error",
            description: "The transfer was terminated due to an error",
            variant: "destructive",
          });
          break;
      }
    }
  }, [toast]);

  const handleCancelReceiving = useCallback(() => {
    if (webrtc && transferProgress) {
      console.log('[PROGRESS] Canceling transfer:', transferProgress.filename);
      webrtc.cancelTransfer(transferProgress.filename, true);
      toast({
        title: "Transfer Canceled",
        description: "You have canceled the file transfer",
      });
    }
  }, [webrtc, transferProgress, toast]);

  const handlePauseTransfer = useCallback(() => {
    if (webrtc && transferProgress) {
      console.log('[PROGRESS] Pausing transfer:', transferProgress.filename);
      webrtc.pauseTransfer(transferProgress.filename);
    }
  }, [webrtc, transferProgress]);

  const handleResumeTransfer = useCallback(() => {
    if (webrtc && transferProgress) {
      console.log('[PROGRESS] Resuming transfer:', transferProgress.filename);
      webrtc.resumeTransfer(transferProgress.filename);
    }
  }, [webrtc, transferProgress]);

  const clearProgress = useCallback(() => {
    setTransferProgress(null);
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
