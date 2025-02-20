
import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { TransferProgress } from '@/services/webrtc/FileTransferService';
import WebRTCService from '@/services/webrtc/WebRTCService';

export const useTransferProgress = (webrtc: WebRTCService | null) => {
  const [transferProgress, setTransferProgress] = useState<TransferProgress | null>(null);
  const { toast } = useToast();

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

    if (progress.status && progress.status !== 'transferring') {
      setTimeout(() => setTransferProgress(null), 3000);
    }
  }, [toast]);

  const handleCancelReceiving = useCallback(() => {
    if (webrtc && transferProgress) {
      webrtc.cancelTransfer(transferProgress.filename);
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
