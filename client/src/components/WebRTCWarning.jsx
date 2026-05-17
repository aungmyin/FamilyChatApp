import React from 'react';

export default function WebRTCWarning() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        background: '#fff',
        padding: '30px',
        borderRadius: '12px',
        textAlign: 'center',
        maxWidth: '400px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>

        <h2 style={{ color: '#333', marginBottom: '10px' }}>
          Browser Not Supported
        </h2>

        <p style={{ color: '#666', marginBottom: '20px', lineHeight: '1.6' }}>
          Your device or browser doesn't support video and voice calls.
        </p>

        <div style={{
          background: '#f5f5f5',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px',
          textAlign: 'left',
          fontSize: '14px',
          color: '#555'
        }}>
          <p><strong>To fix this:</strong></p>
          <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
            <li>Update your browser to the latest version</li>
            <li>Update your Android/iOS to the latest version</li>
            <li>Try a different browser (Chrome recommended)</li>
            <li>Use a newer device if possible</li>
          </ul>
        </div>

        <p style={{ color: '#999', fontSize: '12px' }}>
          ℹ️ You can still use chat and direct messages normally.
        </p>
      </div>
    </div>
  );
}
