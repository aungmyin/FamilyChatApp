import React, { useEffect, useRef, useState } from 'react';
import './DirectMessage.css';

export default function DirectMessage({ socket, targetUserId, targetUsername, onClose, currentUserId, onVoiceCall, onVideoCall }) {
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const conversationId = [currentUserId, targetUserId].sort().join('_');

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView(), 0);
  };

  // Load initial message history
  useEffect(() => {
    if (!socket) return;
    socket.emit('load_dm_history', { conversationId });
  }, [socket, conversationId]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleDMHistory = (msgs) => {
      setMessages(msgs);
      scrollToBottom();
    };

    const handleReceiveDM = (data) => {
      console.log('Received DM:', data);
      console.log('Current conversationId:', conversationId);
      const { author, message, time, conversationId: convId } = data;
      if (convId === conversationId) {
        console.log('Message matches, adding to chat');
        setMessages((prev) => [...prev, { author, message, time, isPending: false }]);
        scrollToBottom();
      } else {
        console.log('ConvId mismatch:', convId, '!==', conversationId);
      }
    };

    const handleDMUserTyping = (typingUsername) => {
      if (typingUsername === targetUsername) {
        setTypingUsers((prev) => new Set([...prev, typingUsername]));
      }
    };

    const handleDMUserStopTyping = (typingUsername) => {
      if (typingUsername === targetUsername) {
        setTypingUsers((prev) => {
          const updated = new Set(prev);
          updated.delete(typingUsername);
          return updated;
        });
      }
    };

    const handleDMOlderMessages = (msgs) => {
      if (msgs.length < 20) {
        setHasMore(false);
      }
      setMessages((prev) => [...msgs, ...prev]);
      setIsLoadingMore(false);
    };

    socket.on('dm_history', handleDMHistory);
    socket.on('receive_dm', handleReceiveDM);
    socket.on('dm_user_typing', handleDMUserTyping);
    socket.on('dm_user_stop_typing', handleDMUserStopTyping);
    socket.on('dm_older_messages', handleDMOlderMessages);

    return () => {
      socket.off('dm_history', handleDMHistory);
      socket.off('receive_dm', handleReceiveDM);
      socket.off('dm_user_typing', handleDMUserTyping);
      socket.off('dm_user_stop_typing', handleDMUserStopTyping);
      socket.off('dm_older_messages', handleDMOlderMessages);
    };
  }, [socket, conversationId, targetUsername]);

  const handleScroll = () => {
    if (
      messagesContainerRef.current &&
      messagesContainerRef.current.scrollTop === 0 &&
      !isLoadingMore &&
      hasMore &&
      messages.length > 0
    ) {
      setIsLoadingMore(true);
      const oldestMessage = messages[0];
      socket.emit('load_more_dm', { conversationId, before: oldestMessage.time });
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageText.trim() || !socket) return;

    const clientMessageId = `dm_${Date.now()}`;
    const tempMessage = {
      author: 'You',
      message: messageText.trim(),
      time: new Date(),
      pending: true,
    };

    setMessages((prev) => [...prev, tempMessage]);
    socket.emit('send_dm', {
      recipientId: targetUserId,
      message: messageText.trim(),
      clientMessageId,
    });
    setMessageText('');
    socket.emit('dm_stop_typing', { recipientId: targetUserId });
    scrollToBottom();
  };

  const handleMessageChange = (e) => {
    setMessageText(e.target.value);

    if (socket) {
      socket.emit('dm_typing', { recipientId: targetUserId });
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('dm_stop_typing', { recipientId: targetUserId });
      }, 3000);
    }
  };

  const formatTime = (date) => {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="direct-message-panel">
      <div className="dm-header">
        <h3 className="dm-title">💬 {targetUsername}</h3>
        <div className="dm-header-actions">
          <button
            onClick={() => onVoiceCall && onVoiceCall(targetUserId)}
            className="dm-call-button"
            title="Voice call"
          >
            📞
          </button>
          <button
            onClick={() => onVideoCall && onVideoCall(targetUserId)}
            className="dm-call-button"
            title="Video call"
          >
            💻
          </button>
          <button onClick={onClose} className="dm-close-button">
            ✕
          </button>
        </div>
      </div>

      <div className="dm-messages" ref={messagesContainerRef} onScroll={handleScroll}>
        {isLoadingMore && <div className="dm-loading">Loading older messages...</div>}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`dm-message-group ${msg.author === 'You' ? 'own' : ''}`}
          >
            <div className="dm-bubble">
              <div className="dm-author">{msg.author}</div>
              <div className="dm-content">{msg.message}</div>
              <div className="dm-time">{formatTime(msg.time)}</div>
              {msg.pending && <span className="dm-pending">⏳</span>}
            </div>
          </div>
        ))}

        {typingUsers.size > 0 && (
          <div className="dm-message-group">
            <div className="dm-typing">
              <span>{targetUsername} is typing</span>
              <span className="dot">.</span>
              <span className="dot">.</span>
              <span className="dot">.</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="dm-input-area" onSubmit={handleSendMessage}>
        <input
          type="text"
          placeholder="Type a message..."
          value={messageText}
          onChange={handleMessageChange}
          className="dm-input"
        />
        <button type="submit" className="dm-send-button" disabled={!messageText.trim()}>
          ➤
        </button>
      </form>
    </div>
  );
}
