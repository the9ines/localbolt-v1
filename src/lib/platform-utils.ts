
interface DeviceInfo {
  isWindows: boolean;
  isMac: boolean;
  isLinux: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  isSteamDeck: boolean;
  isMobile: boolean;
  platform: string;
}

export const detectDevice = (): DeviceInfo => {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const platform = window.navigator.platform.toLowerCase();
  
  const isWindows = platform.includes('win');
  const isMac = platform.includes('mac');
  const isLinux = platform.includes('linux');
  const isAndroid = /android/.test(userAgent);
  const isIOS = /iphone|ipad|ipod/.test(userAgent);
  // Steam Deck uses Linux but has a specific user agent
  const isSteamDeck = isLinux && userAgent.includes('steam');
  const isMobile = isAndroid || isIOS;

  return {
    isWindows,
    isMac,
    isLinux: isLinux && !isSteamDeck, // Pure Linux
    isAndroid,
    isIOS,
    isSteamDeck,
    isMobile,
    platform: isSteamDeck ? 'steam-deck' : platform
  };
};

export const getMaxChunkSize = (): number => {
  const device = detectDevice();
  
  // Adjust chunk sizes based on platform capabilities
  if (device.isMobile) {
    return 8192; // 8KB for mobile devices
  } else if (device.isSteamDeck) {
    return 32768; // 32KB for Steam Deck
  } else {
    return 16384; // 16KB default for desktop
  }
};

export const getPlatformICEServers = (): RTCIceServer[] => {
  const device = detectDevice();
  
  const baseServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];

  // Add platform-specific STUN/TURN servers if needed
  if (device.isLinux || device.isSteamDeck) {
    baseServers.push({ urls: 'stun:stun.ekiga.net' });
  }

  return baseServers;
};
