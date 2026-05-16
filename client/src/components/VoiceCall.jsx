import React, { useEffect, useRef, useState } from 'react';
import './VoiceCall.css';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export default function VoiceCall({ socket, targetSocketId, targetUsername, onClose, incomingCall }) {
  const [callState, setCallState] = useState(incomingCall ? 'incoming' : 'idle');
  const [error, setError] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [incomingFrom, setIncomingFrom] = useState(incomingCall?.socketId || null);
  const [incomingOffer, setIncomingOffer] = useState(incomingCall?.offer || null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const callDurationRef = useRef(null);

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
      if (e.candidate && socket && recipientId) {
        socket.emit('ice_candidate', { to: recipientId, candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      console.log('Received remote audio track');
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
      console.log('startCall: offer created');

      socket.emit('call_offer', { to: targetSocketId, offer: { type: offer.type, sdp: offer.sdp }, isVideo: false });
      console.log('startCall: call_offer emitted');
    } catch (err) {
      console.error('startCall error:', err);
      setError(err.message || 'Error starting call');
      setCallState('idle');
    }
  };

  const acceptCall = async () => {
    try {
      const stream = await getStream();
      console.log('acceptCall: stream obtained, tracks:', stream.getTracks().length);
      stream.getTracks().forEach((t) => console.log('  Track:', t.kind, 'enabled:', t.enabled, 'readyState:', t.readyState));
      streamRef.current = stream;

      const pc = createPeerConnection(incomingFrom);
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
        console.log('acceptCall: added track', track.kind, 'enabled:', track.enabled);
      });

      if (incomingOffer) {
        await pc.setRemoteDescription(new RTCSessionDescription({
          type: incomingOffer.type || 'offer',
          sdp: incomingOffer.sdp
        }));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('call_answer', { to: incomingFrom, answer: { type: answer.type, sdp: answer.sdp } });
        setCallState('connected');
        startTimer();
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
    stopTimer();
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
      if (peerRef.current) {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription({
          type: answer.type || 'answer',
          sdp: answer.sdp
        }));
        setCallState('connected');
        startTimer();
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
            {callState === 'calling' && <div className="call-status">Calling...</div>}
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
          {(callState === 'calling' || callState === 'connected') && (
            <button onClick={endCall} className="call-button end-call">
              📵 End Call
            </button>
          )}
        </div>
      </div>

      <button onClick={onClose} className="close-button">
        ✕
      </button>
    </div>
  );
}
