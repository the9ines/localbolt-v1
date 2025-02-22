
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useRef } from "react";

interface DragDropAreaProps {
  isDragging: boolean;
  onDragIn: (e: React.DragEvent) => void;
  onDragOut: (e: React.DragEvent) => void;
  onDrag: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const DragDropArea = ({
  isDragging,
  onDragIn,
  onDragOut,
  onDrag,
  onDrop,
  onFileSelect,
}: DragDropAreaProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  return (
    <button
      type="button"
      role="button"
      aria-label="Drop files or click to select"
      className={`w-full border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-neon focus:ring-offset-2 focus:ring-offset-dark ${
        isDragging ? "border-neon bg-neon/5" : "border-white/10 hover:border-white/20"
      }`}
      onDragEnter={onDragIn}
      onDragLeave={onDragOut}
      onDragOver={onDrag}
      onDrop={onDrop}
      onClick={() => fileInputRef.current?.click()}
      onKeyDown={handleKeyDown}
    >
      <input
        type="file"
        multiple
        className="hidden"
        ref={fileInputRef}
        onChange={onFileSelect}
        aria-hidden="true"
      />
      
      <div className="space-y-4">
        <Upload className="w-12 h-12 mx-auto text-white/50" />
        <div>
          <p className="text-lg font-medium">Drop files here</p>
          <p className="text-sm text-white/50">or click to select files</p>
        </div>
        <Button
          variant="outline"
          className="bg-dark-accent"
          tabIndex={-1}
          aria-hidden="true"
        >
          Select Files
        </Button>
      </div>
    </button>
  );
};
