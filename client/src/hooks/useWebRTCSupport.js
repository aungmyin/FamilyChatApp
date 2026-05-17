export const useWebRTCSupport = () => {
  const checkWebRTCSupport = () => {
    const hasGetUserMedia =
      navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    const hasRTCPeerConnection =
      window.RTCPeerConnection ||
      window.webkitRTCPeerConnection ||
      window.mozRTCPeerConnection;

    return {
      supported: !!(hasGetUserMedia && hasRTCPeerConnection),
      hasGetUserMedia: !!hasGetUserMedia,
      hasRTCPeerConnection: !!hasRTCPeerConnection,
    };
  };

  return checkWebRTCSupport();
};
