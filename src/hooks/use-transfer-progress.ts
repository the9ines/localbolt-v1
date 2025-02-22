
import { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { TransferProgress } from '@/services/webrtc/FileTransferService';
import type WebRTCService from '@/services/webrtc/WebRTCService';

export const useTransferProgress = (webrtc: WebRTCService | null) => {
  const [transferProgress, setTransferProgress] = useState<TransferProgress | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!transferProgress?.status) return;

    // Automatically clear progress for completed or canceled transfers
    if (transferProgress.status !== 'transferring' && 
        transferProgress.status !== 'paused') {
      setTransferProgress(null);
    }
  }, [transferProgress]);

  const handleProgress = useCallback((progress: TransferProgress) => {
    console.log('[PROGRESS] Received progress update:', progress);
    setTransferProgress(progress);
    
    if (!progress.status) return;

    switch (progress.status) {
      case 'canceled_by_sender':
        toast({
          title: "Transfer Canceled",
          description: "The sender has canceled the transfer",
        });
        setTransferProgress(null); // Immediately clear progress on cancel
        break;
      case 'canceled_by_receiver':
        toast({
          title: "Transfer Canceled",
          description: "You have canceled the transfer",
        });
        setTransferProgress(null); // Immediately clear progress on cancel
        break;
      case 'error':
        toast({
          title: "Transfer Error",
          description: "The transfer was terminated due to an error",
          variant: "destructive",
        });
        setTransferProgress(null); // Immediately clear progress on error
        break;
    }
  }, [toast]);

  const handleCancelReceiving = useCallback(() => {
    if (!webrtc || !transferProgress?.filename) return;

    console.log('[PROGRESS] Canceling transfer:', transferProgress.filename);
    webrtc.cancelTransfer(transferProgress.filename, true);
    setTransferProgress(null); // Immediately clear progress on cancel
    toast({
      title: "Transfer Canceled",
      description: "You have canceled the file transfer",
    });
  }, [webrtc, transferProgress, toast]);

  const handlePauseTransfer = useCallback(() => {
    if (!webrtc || !transferProgress?.filename) return;

    console.log('[PROGRESS] Pausing transfer:', transferProgress.filename);
    webrtc.pauseTransfer(transferProgress.filename);
  }, [webrtc, transferProgress]);

  const handleResumeTransfer = useCallback(() => {
    if (!webrtc || !transferProgress?.filename) return;

    console.log('[PROGRESS] Resuming transfer:', transferProgress.filename);
    webrtc.resumeTransfer(transferProgress.filename);
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
