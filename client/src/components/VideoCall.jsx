import React, { useEffect, useRef, useState } from 'react';
import { useConnectionQuality } from '../hooks/useConnectionQuality';
import './VideoCall.css';

const VIDEO_CONSTRAINTS = {
  low: { width: 320, height: 240, frameRate: 10 },
  medium: { width: 640, height: 480, frameRate: 20 },
  high: { width: 1280, height: 720, frameRate: 30 },
};

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

export default function VideoCall({ socket, targetSocketId, targetUsername, onClose, incomingCall }) {
  const { quality } = useConnectionQuality();
  const [callState, setCallState] = useState(incomingCall ? 'incoming' : 'idle');
  const [error, setError] = useState('');
  const [incomingFrom, setIncomingFrom] = useState(incomingCall?.socketId || null);
  const [incomingOffer, setIncomingOffer] = useState(incomingCall?.offer || null);
  const [connectionState, setConnectionState] = useState('idle');
  const [iceState, setIceState] = useState('new');
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  const connectionTimeoutRef = useRef(null);

  const getStream = async (q) => {
    return navigator.mediaDevices.getUserMedia({
      audio: true,
      video: VIDEO_CONSTRAINTS[q] || VIDEO_CONSTRAINTS.low,
    });
  };

  const createPeerConnection = (recipientId) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerRef.current = pc;

    pc.ontrack = (e) => {
      console.log('Received remote video track:', e.streams[0]);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
    };

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

    return pc;
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

      console.log('startCall: getting stream');
      setCallState('calling');
      const stream = await getStream(quality);
      console.log('startCall: stream obtained, tracks=', stream.getTracks().length);
      streamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        console.log('startCall: set local video');
      }

      console.log('startCall: creating peer connection');
      const pc = createPeerConnection(targetSocketId);
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
        console.log('startCall: added track', track.kind);
      });

      console.log('startCall: creating offer');
      const offer = await pc.createOffer();
      console.log('startCall: offer created, type=', offer.type);
      await pc.setLocalDescription(offer);
      console.log('startCall: local description set, iceGatheringState=', pc.iceGatheringState);

      // Wait a bit for initial ICE candidates to gather
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('startCall: emitting call_offer to', targetSocketId);
      console.log('[SOCKET] Emitting call_offer', { to: targetSocketId, offerType: offer.type, sdpLength: offer.sdp?.length, socketReady: socket?.connected });
      socket.emit('call_offer', { to: targetSocketId, offer: { type: offer.type, sdp: offer.sdp }, isVideo: true });
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
      const stream = await getStream(quality);
      console.log('acceptCall: stream obtained, tracks=', stream.getTracks().length);
      streamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = createPeerConnection(incomingFrom);
      console.log('acceptCall: peer connection created');
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
        console.log('acceptCall: added track', track.kind);
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

        // Don't set state to connected immediately - wait for ICE connection
        setCallState('calling');
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

  const endCall = () => {
    console.log('endCall: closing call, state=', callState);
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    peerRef.current?.close();
    peerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
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
      console.log('VideoCall unmounting');
      if (peerRef.current || streamRef.current) {
        endCall();
      }
    };
  }, []);

  return (
    <div className="video-call-container">
      <div className="video-area">
        <div className="video-remote">
          <video ref={remoteVideoRef} autoPlay playsInline className="video-element" />
          <div className="video-label">{targetUsername}</div>
        </div>
        <div className="video-local">
          <video ref={localVideoRef} autoPlay playsInline muted className="video-element" />
          <div className="quality-badge">{quality}</div>
        </div>
      </div>

      <div className="call-controls">
        {error && <div className="call-error">{error}</div>}
        {callState === 'idle' && (
          <button onClick={startCall} className="call-button start-call">
            📞 Start Call
          </button>
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
        {callState === 'incoming' && (
          <div>
            <div className="call-status">Incoming call from {incomingFrom}</div>
            <div className="button-group">
              <button onClick={acceptCall} className="call-button accept-call">
                ✓ Accept
              </button>
              <button onClick={declineCall} className="call-button decline-call">
                ✕ Decline
              </button>
            </div>
          </div>
        )}
        {callState === 'connected' && (
          <button onClick={endCall} className="call-button end-call">
            📵 End Call
          </button>
        )}
      </div>

      {callState === 'connected' && (
        <div className="connection-debug" style={{ fontSize: '12px', padding: '8px', background: 'rgba(0,0,0,0.6)', color: '#fff', textAlign: 'center' }}>
          Connection: <span style={{ color: connectionState === 'connected' ? '#0f0' : '#f80' }}>{connectionState}</span> |
          ICE: <span style={{ color: iceState === 'connected' ? '#0f0' : '#f80' }}>{iceState}</span>
        </div>
      )}

      <button onClick={onClose} className="close-button">
        ✕
      </button>
    </div>
  );
}
