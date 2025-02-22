
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
    console.log('[PROGRESS] Received progress update:', {
      ...progress,
      currentState: transferProgress?.status,
    });

    // Always update with new progress data
    setTransferProgress(prevProgress => {
      if (!prevProgress) return progress;
      
      // For pause/resume status updates, preserve the existing progress values
      if (progress.status === 'paused' || progress.status === 'transferring') {
        return {
          ...prevProgress,
          status: progress.status
        };
      }
      
      // For progress updates, merge with existing state
      return {
        ...prevProgress,
        ...progress,
        // Ensure we always have the latest progress values
        loaded: progress.loaded ?? prevProgress.loaded,
        total: progress.total ?? prevProgress.total,
        currentChunk: progress.currentChunk ?? prevProgress.currentChunk,
        totalChunks: progress.totalChunks ?? prevProgress.totalChunks,
      };
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
  }, [toast, transferProgress]);

  const handleCancelReceiving = useCallback(() => {
    if (webrtc && transferProgress) {
      console.log('[PROGRESS] Canceling transfer:', transferProgress.filename);
      
      setTransferProgress(prev => prev ? {
        ...prev,
        status: 'canceled_by_receiver'
      } : null);
      
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
      
      // First send the pause command to ensure other side gets notified
      webrtc.pauseTransfer(transferProgress.filename);
      
      // Then update local state
      setTransferProgress(prev => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'paused'
        };
      });
    }
  }, [webrtc, transferProgress]);

  const handleResumeTransfer = useCallback(() => {
    if (webrtc && transferProgress) {
      console.log('[PROGRESS] Resuming transfer:', transferProgress.filename);
      
      // First send the resume command to ensure other side gets notified
      webrtc.resumeTransfer(transferProgress.filename);
      
      // Then update local state
      setTransferProgress(prev => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'transferring'
        };
      });
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
