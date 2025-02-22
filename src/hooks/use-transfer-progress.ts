
import { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { TransferProgress } from '@/services/webrtc/FileTransferService';
import WebRTCService from '@/services/webrtc/WebRTCService';

export const useTransferProgress = (webrtc: WebRTCService | null) => {
  const [transferProgress, setTransferProgress] = useState<TransferProgress | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Clear progress after a delay when transfer is complete or canceled
    if (transferProgress?.status && transferProgress.status !== 'transferring') {
      const timer = setTimeout(() => {
        setTransferProgress(null);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [transferProgress]);

  const handleProgress = useCallback((progress: TransferProgress) => {
    setTransferProgress(progress);
    
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
      webrtc.cancelTransfer(transferProgress.filename, true);
      toast({
        title: "Transfer Canceled",
        description: "You have canceled the file transfer",
      });
    }
  }, [webrtc, transferProgress, toast]);

  return {
    transferProgress,
    handleProgress,
    handleCancelReceiving
  };
};
