
import { Button } from "@/components/ui/button";
import type { TransferProgress } from "@/services/webrtc/FileTransferService";
import WebRTCService from "@/services/webrtc/WebRTCService";
import { useToast } from "@/hooks/use-toast";

interface TransferControlsProps {
  webrtc?: WebRTCService;
  progress: TransferProgress | null;
  files: File[];
  setFiles: (files: File[]) => void;
  setProgress: (progress: TransferProgress | null) => void;
  onProgressUpdate: (progress: TransferProgress) => void;
}

export const TransferControls = ({
  webrtc,
  progress,
  files,
  setFiles,
  setProgress,
  onProgressUpdate
}: TransferControlsProps) => {
  const { toast } = useToast();

  const handlePauseTransfer = () => {
    if (webrtc && progress) {
      webrtc.pauseTransfer(progress.filename);
    }
  };

  const handleResumeTransfer = () => {
    if (webrtc && progress) {
      webrtc.resumeTransfer(progress.filename);
    }
  };

  const cancelTransfer = () => {
    if (webrtc && progress) {
      webrtc.cancelTransfer(progress.filename);
      setProgress(null);
      toast({
        title: "Transfer cancelled",
        description: `Cancelled transfer of ${progress.filename}`,
      });
    }
  };

  const startTransfer = async () => {
    if (!webrtc) {
      toast({
        title: "Connection error",
        description: "No peer connection available",
        variant: "destructive",
      });
      return;
    }

    try {
      const file = files[0];
      if (!file) return;

      console.log('Starting transfer for:', file.name);
      
      const CHUNK_SIZE = 16384;
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      
      setProgress({
        filename: file.name,
        currentChunk: 0,
        totalChunks,
        loaded: 0,
        total: file.size,
        status: 'transferring'
      });

      webrtc.setProgressCallback(onProgressUpdate);
      await webrtc.sendFile(file);
      
      console.log('Transfer completed for:', file.name);

      toast({
        title: "Transfer complete",
        description: `${file.name} has been sent successfully`,
      });

      setFiles(files.slice(1));
    } catch (error) {
      console.error('Transfer error:', error);
      if (error.message !== "Transfer cancelled by user") {
        toast({
          title: "Transfer failed",
          description: `Failed to send file`,
          variant: "destructive",
        });
      }
    } finally {
      if (!webrtc) {
        setProgress(null);
      }
    }
  };

  return {
    handlePauseTransfer,
    handleResumeTransfer,
    cancelTransfer,
    startTransfer
  };
};
