
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { FileText, Upload, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { sanitizeFilename } from "@/utils/sanitizer";
import WebRTCService from "@/services/webrtc";

interface FileUploadProps {
  webrtc: WebRTCService;
}

const FileUpload = ({ webrtc }: FileUploadProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const sanitizedFile = new File([file], sanitizeFilename(file.name), {
        type: file.type,
      });
      setSelectedFile(sanitizedFile);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const sanitizedFile = new File([file], sanitizeFilename(file.name), {
        type: file.type,
      });
      setSelectedFile(sanitizedFile);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert("Please select a file to upload.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      await webrtc.sendFile(selectedFile);
      alert("File sent successfully!");
    } catch (error) {
      console.error("File transfer failed:", error);
      alert("File transfer failed. Please try again.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setSelectedFile(null);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer ${
          isDragActive ? "border-neon bg-dark-accent/50" : "border-gray-500/50 bg-dark-accent/30"
        }`}
        role="button"
        aria-label="Drop zone for file upload"
      >
        <input {...getInputProps()} onChange={handleFileSelect} />
        {selectedFile ? (
          <div className="flex items-center justify-center space-x-2">
            <FileText className="w-4 h-4 text-gray-400" aria-hidden="true" />
            <p className="text-sm text-gray-400">{selectedFile.name}</p>
          </div>
        ) : (
          <p className="text-gray-400">
            {isDragActive ? "Drop the file here..." : "Drag 'n' drop a file here, or click to select a file"}
          </p>
        )}
      </div>

      {selectedFile && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
          </p>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleCancel}
            aria-label="Cancel file selection"
          >
            <X className="w-4 h-4 mr-2" aria-hidden="true" />
            Cancel
          </Button>
        </div>
      )}

      {selectedFile && (
        <Button
          className="w-full bg-neon hover:bg-neon/90 text-dark font-medium"
          onClick={handleUpload}
          disabled={isUploading}
          aria-label={isUploading ? "Sending file" : "Send file"}
        >
          {isUploading ? (
            <>
              Sending...
              {uploadProgress > 0 && (
                <Progress 
                  value={uploadProgress} 
                  className="mt-2" 
                  aria-label={`Upload progress: ${uploadProgress}%`}
                />
              )}
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" aria-hidden="true" />
              Send File
            </>
          )}
        </Button>
      )}
    </div>
  );
};

export default FileUpload;
