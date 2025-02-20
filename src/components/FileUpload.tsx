import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, File, X, StopCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import WebRTCService from "@/services/webrtc/WebRTCService";
import { TransferProgress } from "@/services/webrtc/FileTransferService";

interface FileUploadProps {
  webrtc?: WebRTCService;
}

export const FileUpload = ({ webrtc }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragIn = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOut = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    handleFiles(selectedFiles);
  };

  const handleFiles = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
    toast({
      title: "Files added",
      description: `${newFiles.length} file(s) ready to transfer`,
    });
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const cancelTransfer = () => {
    if (webrtc && progress) {
      console.log('Cancelling transfer for:', progress.filename);
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
      // Only transfer one file at a time
      const file = files[0];
      if (!file) return;

      console.log('Starting transfer for:', file.name);
      
      // Set initial progress
      setProgress({
        filename: file.name,
        currentChunk: 0,
        totalChunks: 1, // Will be updated by the WebRTC service
        loaded: 0,
        total: file.size
      });

      // Start the transfer
      await webrtc.sendFile(file);
      console.log('Transfer completed for:', file.name);

      toast({
        title: "Transfer complete",
        description: `${file.name} has been sent successfully`,
      });

      // Remove the transferred file from the queue
      setFiles(prevFiles => prevFiles.slice(1));
    } catch (error: any) {
      console.error('Transfer error:', error);
      if (error.message === "Transfer cancelled by user") {
        // Already handled by cancelTransfer
      } else {
        toast({
          title: "Transfer failed",
          description: `Failed to send file`,
          variant: "destructive",
        });
      }
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
          isDragging ? "border-neon bg-neon/5" : "border-white/10 hover:border-white/20"
        }`}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          multiple
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileInput}
        />
        
        <div className="space-y-4">
          <Upload className="w-12 h-12 mx-auto text-white/50" />
          <div>
            <p className="text-lg font-medium">Drop files here</p>
            <p className="text-sm text-white/50">or click to select files</p>
          </div>
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="bg-dark-accent"
          >
            Select Files
          </Button>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-4 animate-fade-up">
          <div className="space-y-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-dark-accent rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <File className="w-5 h-5 text-white/50" />
                  <span className="text-sm truncate">{file.name}</span>
                </div>
                {!progress && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(index)}
                    className="text-white/50 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {progress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="truncate">{progress.filename}</span>
                <span>{Math.round((progress.loaded / progress.total) * 100)}%</span>
              </div>
              <div className="flex space-x-2">
                <Progress 
                  value={(progress.currentChunk / progress.totalChunks) * 100}
                  className="h-2 bg-dark-accent flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={cancelTransfer}
                  className="text-white/50 hover:text-white shrink-0"
                >
                  <StopCircle className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          <Button
            onClick={startTransfer}
            className="w-full bg-neon text-black hover:bg-neon/90"
            disabled={progress !== null}
          >
            Start Transfer
          </Button>
        </div>
      )}
    </div>
  );
};
