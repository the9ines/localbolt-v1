
import { supabase } from "@/integrations/supabase/client";
import { SignalingError } from "@/types/webrtc-errors";

export interface SignalData {
  type: 'offer' | 'answer' | 'ice-candidate';
  data: any;
  from: string;
  to: string;
}

export type SignalHandler = (signal: SignalData) => void;

export class SignalingService {
  private initialized: boolean = false;
  private channel: any = null;
  
  constructor(
    private localPeerId: string,
    private onSignal: SignalHandler
  ) {
    console.log('[SIGNALING] Creating signaling service for peer:', localPeerId);
  }

  /**
   * Initializes the signaling service and sets up the channel
   * This must be called before sending any signals
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[SIGNALING] Signaling service already initialized');
      return;
    }
    
    await this.setupChannel();
    this.initialized = true;
  }

  private async setupChannel() {
    console.log('[SIGNALING] Setting up signaling channel');
    try {
      this.channel = supabase.channel('signals')
        .on('broadcast', { event: 'signal' }, ({ payload }) => {
          console.log('[SIGNALING] Received signal:', payload.type);
          this.onSignal(payload as SignalData);
        })
        .subscribe();
    } catch (error) {
      throw new SignalingError("Failed to setup signaling channel", error);
    }
  }

  async sendSignal(type: SignalData['type'], data: any, remotePeerId: string) {
    // Ensure initialization before sending signals
    if (!this.initialized) {
      await this.initialize();
    }
    
    console.log('[SIGNALING] Sending signal:', type, 'to:', remotePeerId);
    try {
      await supabase.channel('signals').send({
        type: 'broadcast',
        event: 'signal',
        payload: {
          type,
          data,
          from: this.localPeerId,
          to: remotePeerId,
        },
      });
    } catch (error) {
      throw new SignalingError(`Failed to send ${type} signal`, error);
    }
  }

  /**
   * Saves documentation to the database
   * @param title Title of the documentation
   * @param content Markdown content to save
   * @returns Object with success status and message
   */
  static async saveDocumentation(title: string, content: string): Promise<{ success: boolean; message: string; id?: string }> {
    try {
      console.log('[DOCUMENTATION] Saving documentation:', title);
      const { data, error } = await supabase
        .from('documentation')
        .insert([{ title, content }])
        .select('id')
        .single();
      
      if (error) {
        console.error('[DOCUMENTATION] Error saving documentation:', error);
        return { success: false, message: `Failed to save documentation: ${error.message}` };
      }
      
      console.log('[DOCUMENTATION] Documentation saved successfully:', data.id);
      return { success: true, message: 'Documentation saved successfully', id: data.id };
    } catch (error) {
      console.error('[DOCUMENTATION] Unexpected error:', error);
      return { success: false, message: `Unexpected error: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Retrieves documentation from the database
   * @param id Optional ID of the documentation to retrieve, if omitted returns the latest
   * @returns The documentation or null if not found
   */
  static async getDocumentation(id?: string): Promise<{ title: string; content: string } | null> {
    try {
      let query = supabase.from('documentation').select('title, content');
      
      if (id) {
        query = query.eq('id', id);
      } else {
        query = query.order('created_at', { ascending: false }).limit(1);
      }
      
      const { data, error } = await query.single();
      
      if (error) {
        console.error('[DOCUMENTATION] Error retrieving documentation:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('[DOCUMENTATION] Unexpected error retrieving documentation:', error);
      return null;
    }
  }
}
