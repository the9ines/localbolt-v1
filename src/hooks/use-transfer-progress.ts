
import { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { TransferProgress } from '@/services/webrtc/FileTransferService';
import type WebRTCService from '@/services/webrtc/WebRTCService';

export const useTransferProgress = (webrtc: WebRTCService | null) => {
  const [transferProgress, setTransferProgress] = useState<TransferProgress | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!transferProgress?.status) return;

    // Immediately clear progress for completed, error, or canceled transfers
    if (transferProgress.status === 'canceled_by_sender' || 
        transferProgress.status === 'canceled_by_receiver' ||
        transferProgress.status === 'error') {
      setTransferProgress(null);
    }
  }, [transferProgress?.status]);

  const handleProgress = useCallback((progress: TransferProgress) => {
    console.log('[PROGRESS] Received progress update:', progress);
    
    if (progress.status === 'canceled_by_sender' || 
        progress.status === 'canceled_by_receiver' || 
        progress.status === 'error') {
      // Handle cancellation and error states immediately
      setTransferProgress(null);
      
      // Show appropriate toast message
      if (progress.status === 'canceled_by_sender') {
        toast({
          title: "Transfer Canceled",
          description: "The sender has canceled the transfer",
        });
      } else if (progress.status === 'canceled_by_receiver') {
        toast({
          title: "Transfer Canceled",
          description: "The receiver has canceled the transfer",
        });
      } else {
        toast({
          title: "Transfer Error",
          description: "The transfer was terminated due to an error",
          variant: "destructive",
        });
      }
      return;
    }

    // Update progress state for other status updates
    setTransferProgress(progress);
  }, [toast]);

  const handleCancelReceiving = useCallback(() => {
    if (!webrtc || !transferProgress?.filename) return;

    console.log('[PROGRESS] Canceling transfer:', transferProgress.filename);
    webrtc.cancelTransfer(transferProgress.filename, true);
    setTransferProgress(null); // Immediately clear progress
    
    toast({
      title: "Transfer Canceled",
      description: "You have canceled the file transfer",
    });
  }, [webrtc, transferProgress, toast]);

  const handlePauseTransfer = useCallback(() => {
    if (!webrtc || !transferProgress?.filename) return;

    console.log('[PROGRESS] Pausing transfer:', transferProgress.filename);
    webrtc.pauseTransfer(transferProgress.filename);
    
    // Update local state immediately for responsive UI
    setTransferProgress(prev => 
      prev ? { ...prev, status: 'paused' } : null
    );
  }, [webrtc, transferProgress]);

  const handleResumeTransfer = useCallback(() => {
    if (!webrtc || !transferProgress?.filename) return;

    console.log('[PROGRESS] Resuming transfer:', transferProgress.filename);
    webrtc.resumeTransfer(transferProgress.filename);
    
    // Update local state immediately for responsive UI
    setTransferProgress(prev => 
      prev ? { ...prev, status: 'transferring' } : null
    );
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
