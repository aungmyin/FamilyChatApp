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
];

export default function VideoCall({ socket, targetSocketId, targetUsername, onClose, incomingCall }) {
  const { quality } = useConnectionQuality();
  const [callState, setCallState] = useState(incomingCall ? 'incoming' : 'idle');
  const [error, setError] = useState('');
  const [incomingFrom, setIncomingFrom] = useState(incomingCall?.socketId || null);
  const [incomingOffer, setIncomingOffer] = useState(incomingCall?.offer || null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);

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
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && socket && recipientId) {
        socket.emit('ice_candidate', { to: recipientId, candidate: e.candidate });
      }
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
      console.log('startCall: local description set');

      console.log('startCall: emitting call_offer to', targetSocketId);
      socket.emit('call_offer', { to: targetSocketId, offer: { type: offer.type, sdp: offer.sdp } });
      console.log('startCall: call_offer emitted');
    } catch (err) {
      console.error('startCall error:', err);
      setError(err.message || 'Error starting call');
      setCallState('idle');
    }
  };

  const acceptCall = async () => {
    try {
      const stream = await getStream(quality);
      streamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = createPeerConnection(incomingFrom);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      if (incomingOffer) {
        await pc.setRemoteDescription(new RTCSessionDescription({
          type: incomingOffer.type || 'offer',
          sdp: incomingOffer.sdp
        }));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('call_answer', { to: incomingFrom, answer: { type: answer.type, sdp: answer.sdp } });
        setCallState('connected');
      }
    } catch (err) {
      console.error('acceptCall error:', err);
      setError(err.message);
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
    peerRef.current?.close();
    peerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    socket.emit('end_call', { to: targetSocketId || incomingFrom });
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
      if (peerRef.current) {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription({
          type: answer.type || 'answer',
          sdp: answer.sdp
        }));
        setCallState('connected');
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
      console.log('VideoCall unmounting, callState=', callState);
      if (callState !== 'idle') endCall();
    };
  }, [callState]);

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
        {callState === 'calling' && <div className="call-status">Calling...</div>}
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

      <button onClick={onClose} className="close-button">
        ✕
      </button>
    </div>
  );
}
