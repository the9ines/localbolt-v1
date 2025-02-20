import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, File, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import WebRTCService from "@/services/webrtc/WebRTCService";

interface FileUploadProps {
  webrtc?: WebRTCService;
}

export const FileUpload = ({ webrtc }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
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

  const simulateUpload = async () => {
    if (!webrtc) {
      toast({
        title: "Connection error",
        description: "No peer connection available",
        variant: "destructive",
      });
      return;
    }

    setProgress(0);
    for (const file of files) {
      try {
        const fileSize = file.size;
        const updateInterval = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 100) {
              clearInterval(updateInterval);
              return 100;
            }
            return prev + 5;
          });
        }, 100);

        await webrtc.sendFile(file);
        clearInterval(updateInterval);
        setProgress(100);

        toast({
          title: "Transfer complete",
          description: `${file.name} has been sent successfully`,
        });
      } catch (error) {
        toast({
          title: "Transfer failed",
          description: `Failed to send ${file.name}`,
          variant: "destructive",
        });
      }
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
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                  className="text-white/50 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          {progress > 0 && progress < 100 && (
            <Progress value={progress} className="h-2 bg-dark-accent" />
          )}

          <Button
            onClick={simulateUpload}
            className="w-full bg-neon text-black hover:bg-neon/90"
            disabled={progress > 0 && progress < 100}
          >
            Start Transfer
          </Button>
        </div>
      )}
    </div>
  );
};
