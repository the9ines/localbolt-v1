
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NetworkDetector, type NetworkInfo } from '../NetworkDetector';

describe('NetworkDetector', () => {
  let networkDetector: NetworkDetector;
  let mockConnection: any;

  beforeEach(() => {
    // Mock navigator.connection
    mockConnection = {
      type: 'wifi',
      effectiveType: '4g',
      downlink: 10,
      rtt: 50,
      addEventListener: vi.fn()
    };

    // Mock navigator and performance APIs
    global.navigator = {
      ...global.navigator,
      connection: mockConnection,
      userAgent: 'Mozilla/5.0 Test UserAgent'
    } as any;

    global.performance = {
      getEntriesByType: vi.fn().mockReturnValue([{
        responseStart: 100,
        requestStart: 50,
        transferSize: 1000,
        responseEnd: 200
      }])
    } as any;

    networkDetector = new NetworkDetector();
  });

  it('should detect network type correctly', () => {
    const info = networkDetector.getNetworkInfo();
    expect(info.type).toBe('wifi');
    expect(info.effectiveType).toBe('4g');
    expect(info.speed).toBe('fast');
  });

  it('should calculate speed based on connection type', () => {
    mockConnection.effectiveType = '3g';
    mockConnection.downlink = 3;
    const info = networkDetector.getNetworkInfo();
    expect(info.speed).toBe('medium');
  });

  it('should use fallback detection when connection API is not available', () => {
    global.navigator.connection = undefined;
    const info = networkDetector.getNetworkInfo();
    expect(info.type).toBe('unknown');
    expect(info.speed).toBe('medium');
  });

  it('should notify on network changes', () => {
    const mockCallback = vi.fn();
    networkDetector = new NetworkDetector(mockCallback);

    // Simulate network change
    const changeListener = mockConnection.addEventListener.mock.calls[0][1];
    changeListener();

    expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
      type: 'wifi',
      speed: 'fast'
    }));
  });
});
