
import { WebRTCError, WebRTCErrorCode } from './types';
import { TransferService } from './transfer';

export class DataChannelService {
  private dataChannel: RTCDataChannel | null = null;

  constructor(
    private transferService: TransferService,
    private onError: (error: WebRTCError) => void
  ) {}

  setupDataChannel(dataChannel: RTCDataChannel) {
    this.dataChannel = dataChannel;
    console.log('[DATACHANNEL] Setting up data channel');

    this.dataChannel.onmessage = async (event) => {
      await this.transferService.handleReceivedMessage(this.dataChannel!, event);
    };

    this.dataChannel.onerror = (error) => {
      const webRTCError = new WebRTCError(
        'Data channel error',
        WebRTCErrorCode.NETWORK_ERROR,
        error
      );
      console.error('[DATACHANNEL] Error:', webRTCError);
      this.onError(webRTCError);
    };

    this.dataChannel.onclose = () => {
      console.log('[DATACHANNEL] Channel closed');
      const webRTCError = new WebRTCError(
        'Data channel closed unexpectedly',
        WebRTCErrorCode.PEER_DISCONNECTED
      );
      this.onError(webRTCError);
    };
  }

  getDataChannel(): RTCDataChannel | null {
    return this.dataChannel;
  }

  close() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
  }
}
