
import { describe, it, expect, beforeEach } from 'vitest';
import { BandwidthAdapter } from '../BandwidthAdapter';
import type { NetworkInfo } from '../../network/NetworkDetector';
import type { ConnectionQuality, ConnectionQualityMetrics } from '../../types/connection-quality';

describe('BandwidthAdapter', () => {
  let adapter: BandwidthAdapter;

  beforeEach(() => {
    adapter = new BandwidthAdapter();
  });

  it('should initialize with base chunk size', () => {
    expect(adapter.getCurrentChunkSize()).toBe(16384); // 16KB
  });

  it('should adjust chunk size based on network info', () => {
    const fastNetwork: NetworkInfo = {
      type: 'wifi',
      speed: 'fast',
      effectiveType: '4g',
      downlink: 10,
      rtt: 50
    };

    adapter.updateNetworkInfo(fastNetwork);
    expect(adapter.getCurrentChunkSize()).toBe(32768); // 32KB (doubled for fast network)

    const slowNetwork: NetworkInfo = {
      type: 'cellular',
      speed: 'slow',
      effectiveType: '3g',
      downlink: 1,
      rtt: 300
    };

    adapter.updateNetworkInfo(slowNetwork);
    expect(adapter.getCurrentChunkSize()).toBe(8192); // 8KB (minimum for slow network)
  });

  it('should adjust chunk size based on connection quality', () => {
    const metrics: ConnectionQualityMetrics = {
      rtt: 100,
      packetLoss: 0,
      bandwidth: 1000000,
      timestamp: Date.now()
    };

    adapter.updateQuality('excellent', metrics);
    const excellentSize = adapter.getCurrentChunkSize();
    expect(excellentSize).toBeGreaterThan(16384);

    adapter.updateQuality('poor', metrics);
    const poorSize = adapter.getCurrentChunkSize();
    expect(poorSize).toBeLessThan(excellentSize);
  });

  it('should handle packet loss adjustments', () => {
    const highLossMetrics: ConnectionQualityMetrics = {
      rtt: 100,
      packetLoss: 0.02,
      bandwidth: 1000000,
      timestamp: Date.now()
    };

    const initialSize = adapter.getCurrentChunkSize();
    adapter.updateQuality('good', highLossMetrics);
    expect(adapter.getCurrentChunkSize()).toBeLessThan(initialSize);
  });

  it('should respect minimum and maximum chunk sizes', () => {
    const poorMetrics: ConnectionQualityMetrics = {
      rtt: 500,
      packetLoss: 0.1,
      bandwidth: 100000,
      timestamp: Date.now()
    };

    adapter.updateQuality('poor', poorMetrics);
    expect(adapter.getCurrentChunkSize()).toBeGreaterThanOrEqual(8192);

    const excellentMetrics: ConnectionQualityMetrics = {
      rtt: 20,
      packetLoss: 0,
      bandwidth: 10000000,
      timestamp: Date.now()
    };

    adapter.updateQuality('excellent', excellentMetrics);
    expect(adapter.getCurrentChunkSize()).toBeLessThanOrEqual(65536);
  });

  it('should calculate transfer rate correctly', () => {
    const metrics: ConnectionQualityMetrics = {
      rtt: 100,
      packetLoss: 0,
      bandwidth: 1000000,
      timestamp: Date.now()
    };
    
    adapter.updateQuality('good', metrics);
    const rate = adapter.getTransferRate();
    expect(rate).toBeGreaterThan(0);
    expect(Number.isFinite(rate)).toBe(true);
  });

  it('should reset to base chunk size', () => {
    adapter.updateQuality('excellent', {
      rtt: 20,
      packetLoss: 0,
      bandwidth: 10000000,
      timestamp: Date.now()
    });
    
    adapter.reset();
    expect(adapter.getCurrentChunkSize()).toBe(16384);
  });
});
