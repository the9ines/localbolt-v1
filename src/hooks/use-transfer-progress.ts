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

    // Preserve existing values when updating state
    setTransferProgress(prev => {
      if (!prev) return progress;
      return {
        ...prev,
        ...progress,
        // Keep the existing loaded/total values if the new ones aren't provided
        loaded: progress.loaded ?? prev.loaded,
        total: progress.total ?? prev.total,
        currentChunk: progress.currentChunk ?? prev.currentChunk,
        totalChunks: progress.totalChunks ?? prev.totalChunks,
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
      
      // Update local state first
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
      
      // Update local state first, preserving all existing values
      setTransferProgress(prev => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'paused',
        };
      });
      
      // Then send the pause command
      webrtc.pauseTransfer(transferProgress.filename);
    }
  }, [webrtc, transferProgress]);

  const handleResumeTransfer = useCallback(() => {
    if (webrtc && transferProgress) {
      console.log('[PROGRESS] Resuming transfer:', transferProgress.filename);
      
      // Update local state first, preserving all existing values
      setTransferProgress(prev => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'transferring',
        };
      });
      
      // Then send the resume command
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
