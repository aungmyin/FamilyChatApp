import React, { useEffect, useRef, useState } from 'react';
import './VoiceCall.css';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stunserver.stunprotocol.org:3478' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export default function VoiceCall({ socket, targetSocketId, targetUsername, onClose, incomingCall }) {
  const [callState, setCallState] = useState(incomingCall ? 'incoming' : 'idle');
  const [error, setError] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [incomingFrom, setIncomingFrom] = useState(incomingCall?.socketId || null);
  const [incomingOffer, setIncomingOffer] = useState(incomingCall?.offer || null);
  const [connectionState, setConnectionState] = useState('idle');
  const [iceState, setIceState] = useState('new');
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const callDurationRef = useRef(null);
  const connectionTimeoutRef = useRef(null);

  const getStream = async () => {
    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  };

  const createPeerConnection = (recipientId) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        console.log('ICE candidate:', e.candidate.candidate.substring(0, 50));
        if (socket && recipientId) {
          socket.emit('ice_candidate', { to: recipientId, candidate: e.candidate });
        }
      } else {
        console.log('ICE candidate gathering complete');
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
      setIceState(pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        console.error('ICE connection failed - no valid candidate pair found');
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Peer connection state:', pc.connectionState);
      setConnectionState(pc.connectionState);
      if (pc.connectionState === 'failed') {
        console.error('Peer connection failed');
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log('ICE gathering state:', pc.iceGatheringState);
    };

    pc.ontrack = (e) => {
      console.log('Received remote audio track:', e.streams[0]);
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = e.streams[0];
      }
    };

    return pc;
  };

  const startTimer = () => {
    setCallDuration(0);
    callDurationRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (callDurationRef.current) {
      clearInterval(callDurationRef.current);
      callDurationRef.current = null;
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startCall = async () => {
    try {
      console.log('startCall: socket=', !!socket, 'targetSocketId=', targetSocketId);
      if (!socket || !targetSocketId) {
        const msg = 'Socket or target not ready';
        console.error(msg, { socket: !!socket, targetSocketId });
        setError(msg);
        return;
      }

      setCallState('calling');
      const stream = await getStream();
      console.log('startCall: stream obtained, tracks:', stream.getTracks().length);
      stream.getTracks().forEach((t) => console.log('  Track:', t.kind, 'enabled:', t.enabled, 'readyState:', t.readyState));
      streamRef.current = stream;

      const pc = createPeerConnection(targetSocketId);
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
        console.log('startCall: added track', track.kind, 'enabled:', track.enabled);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log('startCall: offer created, iceGatheringState=', pc.iceGatheringState);

      // Wait for initial ICE candidates to gather
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('[SOCKET] Emitting call_offer', { to: targetSocketId, offerType: offer.type, sdpLength: offer.sdp?.length, socketReady: socket?.connected });
      socket.emit('call_offer', { to: targetSocketId, offer: { type: offer.type, sdp: offer.sdp }, isVideo: false });
      console.log('startCall: call_offer emitted');

      setCallState('calling');

      // Set timeout if no answer received
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = setTimeout(() => {
        if (callState === 'calling' && connectionState === 'idle') {
          console.error('No answer received after 30 seconds');
          setError('Connection timeout - other user not responding');
          setCallState('idle');
        }
      }, 30000);
    } catch (err) {
      console.error('startCall error:', err);
      setError(err.message || 'Error starting call');
      setCallState('idle');
    }
  };

  const acceptCall = async () => {
    try {
      console.log('acceptCall: starting');
      const stream = await getStream();
      console.log('acceptCall: stream obtained, tracks:', stream.getTracks().length);
      stream.getTracks().forEach((t) => console.log('  Track:', t.kind, 'enabled:', t.enabled, 'readyState:', t.readyState));
      streamRef.current = stream;

      const pc = createPeerConnection(incomingFrom);
      console.log('acceptCall: peer connection created');
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
        console.log('acceptCall: added track', track.kind, 'enabled:', track.enabled);
      });

      if (incomingOffer) {
        console.log('acceptCall: setting remote description');
        await pc.setRemoteDescription(new RTCSessionDescription({
          type: incomingOffer.type || 'offer',
          sdp: incomingOffer.sdp
        }));
        console.log('acceptCall: remote description set, iceConnectionState=', pc.iceConnectionState);

        const answer = await pc.createAnswer();
        console.log('acceptCall: answer created');
        await pc.setLocalDescription(answer);
        console.log('acceptCall: local description set');

        console.log('[SOCKET] Emitting call_answer', { to: incomingFrom, answerType: answer.type, sdpLength: answer.sdp?.length });
        socket.emit('call_answer', { to: incomingFrom, answer: { type: answer.type, sdp: answer.sdp } });
        console.log('acceptCall: answer emitted');

        setCallState('calling');
        startTimer();
      } else {
        setError('No incoming offer');
      }
    } catch (err) {
      console.error('acceptCall error:', err);
      setError(err.message || 'Error accepting call');
    }
  };

  const declineCall = () => {
    socket.emit('call_decline', { to: incomingFrom });
    setIncomingFrom(null);
    setIncomingOffer(null);
    setCallState('idle');
    onClose?.();
  };

  const toggleSpeaker = () => {
    const newMutedState = !isSpeakerMuted;
    setIsSpeakerMuted(newMutedState);

    // Mute/unmute audio tracks from remote peer
    if (remoteAudioRef.current && remoteAudioRef.current.srcObject) {
      const tracks = remoteAudioRef.current.srcObject.getAudioTracks();
      tracks.forEach(track => {
        track.enabled = !newMutedState;
      });
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);

    // Apply volume to remote audio element
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = newVolume / 100;
    }
  };

  const endCall = () => {
    console.log('endCall: closing call, state=', callState);
    stopTimer();
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    peerRef.current?.close();
    peerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    socket.emit('end_call', { to: targetSocketId || incomingFrom });
    socket.emit('call_ended', { targetUsername });
    setCallState('idle');
    onClose?.();
  };

  useEffect(() => {
    if (!socket) return;

    const handleCallOffer = async ({ from, offer }) => {
      setIncomingFrom(from);
      setIncomingOffer(offer);
      setCallState('incoming');
    };

    const handleCallAnswer = async ({ answer }) => {
      console.log('handleCallAnswer: received answer');
      if (peerRef.current) {
        try {
          console.log('handleCallAnswer: setting remote description');
          await peerRef.current.setRemoteDescription(new RTCSessionDescription({
            type: answer.type || 'answer',
            sdp: answer.sdp
          }));
          console.log('handleCallAnswer: remote description set, iceConnectionState=', peerRef.current.iceConnectionState);
          startTimer();
        } catch (err) {
          console.error('handleCallAnswer error setting remote description:', err);
          setError('Failed to set remote description: ' + err.message);
        }
      } else {
        console.error('handleCallAnswer: peerRef.current is null');
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      if (peerRef.current && candidate) {
        try {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      }
    };

    const handleEndCall = () => {
      endCall();
    };

    socket.on('call_offer', handleCallOffer);
    socket.on('call_answer', handleCallAnswer);
    socket.on('ice_candidate', handleIceCandidate);
    socket.on('end_call', handleEndCall);

    return () => {
      socket.off('call_offer', handleCallOffer);
      socket.off('call_answer', handleCallAnswer);
      socket.off('ice_candidate', handleIceCandidate);
      socket.off('end_call', handleEndCall);
    };
  }, [socket]);

  useEffect(() => {
    return () => {
      console.log('VoiceCall unmounting');
      stopTimer();
      if (peerRef.current || streamRef.current) {
        endCall();
      }
    };
  }, []);

  return (
    <div className="voice-call-container">
      <audio ref={remoteAudioRef} autoPlay />
      <div className="voice-call-content">
        <div className="caller-info">
          <div className="caller-avatar">🎤</div>
          <div className="caller-details">
            <h2 className="caller-name">{targetUsername || incomingFrom}</h2>
            {callState === 'connected' && (
              <div className="call-duration">{formatDuration(callDuration)}</div>
            )}
            {callState === 'calling' && (
              <div>
                <div className="call-status">Calling...</div>
                {error && (
                  <button onClick={startCall} className="call-button start-call" style={{ marginTop: '10px' }}>
                    🔄 Retry
                  </button>
                )}
              </div>
            )}
            {callState === 'incoming' && <div className="call-status">Incoming call</div>}
          </div>
        </div>

        <div className="call-controls">
          {error && <div className="call-error">{error}</div>}
          {callState === 'idle' && (
            <button onClick={startCall} className="call-button start-call">
              📞 Start Call
            </button>
          )}
          {callState === 'incoming' && (
            <div className="button-group">
              <button onClick={acceptCall} className="call-button accept-call">
                ✓ Accept
              </button>
              <button onClick={declineCall} className="call-button decline-call">
                ✕ Decline
              </button>
            </div>
          )}
          {callState === 'connected' && (
            <div>
              <div className="button-group">
                <button onClick={toggleSpeaker} className="call-button" style={{ background: isSpeakerMuted ? '#ff6b6b' : '#4CAF50' }}>
                  {isSpeakerMuted ? '🔇 Speaker Off' : '🔊 Speaker On'}
                </button>
                <button onClick={endCall} className="call-button end-call">
                  📵 End Call
                </button>
              </div>
              <div style={{ padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', marginTop: '10px' }}>
                <div style={{ color: '#fff', fontSize: '12px', marginBottom: '5px' }}>🔉 Volume: {volume}%</div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={handleVolumeChange}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>
            </div>
          )}
          {callState === 'calling' && (
            <button onClick={endCall} className="call-button end-call">
              📵 End Call
            </button>
          )}
        </div>
      </div>

      <div className="connection-debug" style={{
        position: 'fixed',
        bottom: '120px',
        left: '10px',
        right: '10px',
        padding: '12px',
        background: 'rgba(0,0,0,0.8)',
        color: '#fff',
        textAlign: 'center',
        fontSize: '14px',
        fontWeight: 'bold',
        borderRadius: '8px',
        zIndex: 100,
        border: '2px solid #666'
      }}>
        <div>State: {callState}</div>
        <div>Connection: <span style={{ color: connectionState === 'connected' ? '#0f0' : '#f80', fontSize: '16px' }}>{connectionState}</span></div>
        <div>ICE: <span style={{ color: iceState === 'connected' ? '#0f0' : '#f80', fontSize: '16px' }}>{iceState}</span></div>
        {error && <div style={{ color: '#ff6b6b', marginTop: '5px' }}>❌ {error}</div>}
      </div>

      <button onClick={onClose} className="close-button">
        ✕
      </button>
    </div>
  );
}
