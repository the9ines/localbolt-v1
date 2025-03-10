import React, { useState, useEffect } from 'react';
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import WebRTCService from "@/services/webrtc/WebRTCService";
import { Separator } from "@/components/ui/separator";
import { Header } from '@/components/Header';

const defaultDocumentation = `# LocalBolt: Secure P2P File Sharing

LocalBolt is a secure, peer-to-peer file sharing web application that allows users to transfer files directly between browsers without relying on central servers. It emphasizes privacy, speed, and a modern user experience.

## Key Features

- **Peer-to-Peer Connection:**
  - Users connect directly using unique, randomly generated peer codes
  - Easy code sharing with one-click copy functionality
  - Real-time connection status updates

- **Secure File Transfer:**
  - End-to-end encryption using WebCrypto API
  - Support for any file type and size
  - Multiple file selection and queue management
  - Progress tracking with percentage and file details

- **Transfer Control:**
  - Pause, resume, and cancel transfers
  - Automatic download prompt upon completion
  - Error handling with user feedback

- **User Interface:**
  - Clean, minimal design with dark theme and neon green accents
  - Drag-and-drop file upload
  - Real-time transfer progress bars
  - Responsive design for all devices

## Technical Architecture

- **WebRTC Implementation:**
  - Modular service-based architecture
  - Signaling using Supabase Realtime channels
  - ICE candidate handling and connection negotiation
  - Data channels for file transfer

- **File Transfer Protocol:**
  - Chunked file transfer for reliability
  - Transfer state management (pause/resume/cancel)
  - Encryption/decryption of file chunks

- **State Management:**
  - Custom React hooks for WebRTC service integration
  - Proper connection and transfer state tracking
  - Clean disconnection and resource management

## Privacy & Security

- Zero server storage - files transfer directly between devices
- End-to-end encryption for all data
- No account creation required
- No tracking or analytics

## Project Structure

- **Services Layer:**
  - \`WebRTCService\`: Main entry point for WebRTC functionality
  - \`SignalingService\`: Handles peer discovery and signaling
  - \`FileOperationsManager\`: Manages file transfers
  - Various supporting classes for transfer control

- **UI Components:**
  - \`PeerConnection\`: Handles connection setup
  - \`FileUpload\`: Manages file selection and transfer
  - \`TransferControls\`: Provides transfer management UI

- **Hooks:**
  - \`usePeerConnection\`: Manages connection state
  - \`useFileManagement\`: Handles file selection and management
  - \`useTransferManagement\`: Controls transfer operations
  - \`useTransferProgress\`: Tracks transfer progress

## Design Elements

- **Color Palette:**
  - Primary: Neon Green (#14FF6A)
  - Background: Dark (#121212)
  - Accent: Dark Accent (#1A1A1A)

- **Visual Effects:**
  - Radial gradient pulse animation
  - Grid overlay with mask
  - Glass morphism cards with hover effects

## Getting Started

The application is accessible directly through the browser, with no installation required. Users simply:

1. Visit the LocalBolt website
2. Generate a peer code and share it
3. Connect with another user
4. Start transferring files securely

LocalBolt provides an elegant solution for secure file sharing without the limitations and privacy concerns of traditional cloud storage services.`;

const DocumentationPage: React.FC = () => {
  const [title, setTitle] = useState<string>("LocalBolt Documentation");
  const [content, setContent] = useState<string>(defaultDocumentation);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadDocumentation = async () => {
      try {
        setIsLoading(true);
        const doc = await WebRTCService.getDocumentation();
        if (doc) {
          setTitle(doc.title);
          setContent(doc.content);
        }
      } catch (error) {
        console.error("Error loading documentation:", error);
        toast({
          title: "Error",
          description: "Failed to load documentation",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadDocumentation();
  }, []);

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Title cannot be empty",
        variant: "destructive",
      });
      return;
    }

    if (!content.trim()) {
      toast({
        title: "Error",
        description: "Content cannot be empty",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      const result = await WebRTCService.saveDocumentation(title, content);
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Documentation saved successfully",
        });
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error saving documentation:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while saving",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Simple Markdown renderer
  const renderMarkdown = (md: string) => {
    // This is a very basic renderer
    // In a real app, you might want to use a library like react-markdown
    const html = md
      .replace(/^# (.*$)/gm, '<h1 class="text-3xl font-bold my-4">$1</h1>')
      .replace(/^## (.*$)/gm, '<h2 class="text-2xl font-semibold my-3">$1</h2>')
      .replace(/^### (.*$)/gm, '<h3 class="text-xl font-semibold my-2">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/- (.*$)/gm, '<li class="ml-4">$1</li>')
      .replace(/\n\n/g, '<br/>');
    
    return { __html: html };
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">LocalBolt Documentation</h1>
            <p className="text-muted-foreground">
              View and update the project documentation
            </p>
          </div>

          <Separator />

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="title">
                Documentation Title
              </label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full"
                placeholder="Enter documentation title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="content">
                Markdown Content
              </label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full min-h-[400px] font-mono text-sm"
                placeholder="Enter markdown content"
              />
            </div>

            <div className="flex justify-end">
              <Button 
                onClick={handleSave} 
                disabled={isSaving || isLoading}
                className="bg-[#14FF6A] hover:bg-[#0ee063] text-black font-medium"
              >
                {isSaving ? "Saving..." : "Save Documentation"}
              </Button>
            </div>
          </div>

          <Separator />

          <div>
            <h2 className="text-xl font-semibold mb-4">Preview</h2>
            <div className="prose prose-invert max-w-none">
              {isLoading ? (
                <p>Loading documentation...</p>
              ) : (
                <div dangerouslySetInnerHTML={renderMarkdown(content)} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentationPage;
