import React from 'react';
import './IncomingCallAlert.css';

export default function IncomingCallAlert({ caller, isVideo, onAccept, onDecline }) {
  return (
    <div className="incoming-call-overlay">
      <div className="incoming-call-modal">
        <div className="incoming-call-icon">
          {isVideo ? '📹' : '📞'}
        </div>

        <h2 className="incoming-call-text">Incoming {isVideo ? 'Video' : 'Voice'} Call</h2>

        <p className="caller-name">{caller}</p>

        <div className="incoming-call-buttons">
          <button onClick={onAccept} className="call-button accept-large">
            ✓ Accept
          </button>
          <button onClick={onDecline} className="call-button decline-large">
            ✕ Decline
          </button>
        </div>
      </div>
    </div>
  );
}
