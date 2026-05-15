import React, { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { AuthContext } from '../context/AuthContext';
import VideoCall from './VideoCall';
import './ChatRoom.css';

const ROOMS = ['general', 'family', 'random'];
const MESSAGE_STORAGE_KEY = 'pendingMessages';

export default function ChatRoom() {
  const { token, username, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [socket, setSocket] = useState(null);
  const [currentRoom, setCurrentRoom] = useState('general');
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [isConnected, isConnectedRef] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [pendingMessages, setPendingMessages] = useState({});
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [callTarget, setCallTarget] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({ general: 0, family: 0, random: 0 });

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const scrollPositionRef = useRef(0);

  // Initialize socket connection
  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }

    const newSocket = io(import.meta.env.VITE_SERVER_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      transports: ['websocket', 'polling'],
    });

    // Connection events
    newSocket.on('connect', () => {
      setConnectionStatus('connected');
      isConnectedRef(true);

      // Load pending messages from localStorage
      const stored = localStorage.getItem(MESSAGE_STORAGE_KEY);
      if (stored) {
        const pending = JSON.parse(stored);
        pending.forEach((msg) => {
          newSocket.emit('send_message', {
            room: msg.room,
            message: msg.text,
          });
        });
        localStorage.removeItem(MESSAGE_STORAGE_KEY);
        setPendingMessages({});
      }

      // Join current room
      newSocket.emit('join_room', { room: currentRoom });
    });

    newSocket.on('disconnect', () => {
      setConnectionStatus('disconnected');
      isConnectedRef(false);
    });

    newSocket.on('reconnecting', () => {
      setConnectionStatus('reconnecting');
    });

    // Message events
    newSocket.on('message_history', (msgs) => {
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView(), 0);
    });

    newSocket.on('receive_message', (msg) => {
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView(), 0);
    });

    newSocket.on('message_ack', ({ id }) => {
      setPendingMessages((prev) => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
      setMessages((prev) =>
        prev.map((msg) => (msg.id === id ? { ...msg, pending: false } : msg))
      );
    });

    newSocket.on('older_messages', (msgs) => {
      if (msgs.length < 20) {
        setHasMore(false);
      }
      setMessages((prev) => [...msgs, ...prev]);
      setIsLoadingMore(false);
    });

    newSocket.on('user_joined', ({ username: joinedUser }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `joined-${Date.now()}`,
          author: 'system',
          message: `${joinedUser} joined the chat`,
          time: new Date(),
          isSystem: true,
        },
      ]);
    });

    newSocket.on('user_left', ({ username: leftUser }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `left-${Date.now()}`,
          author: 'system',
          message: `${leftUser} left the chat`,
          time: new Date(),
          isSystem: true,
        },
      ]);
    });

    newSocket.on('online_users', (users) => {
      setOnlineUsers(users);
    });

    newSocket.on('user_typing', (typingUsername) => {
      setTypingUsers((prev) => new Set([...prev, typingUsername]));
    });

    newSocket.on('user_stop_typing', (typingUsername) => {
      setTypingUsers((prev) => {
        const updated = new Set(prev);
        updated.delete(typingUsername);
        return updated;
      });
    });

    newSocket.on('room_has_message', ({ room }) => {
      // Increment unread count if not in current room
      if (room !== currentRoom) {
        setUnreadCounts((prev) => ({
          ...prev,
          [room]: (prev[room] || 0) + 1,
        }));
      }
    });

    newSocket.on('error', ({ message }) => {
      console.error('Socket error:', message);
    });

    newSocket.on('call_offer', ({ from, username: callerUsername, offer }) => {
      setIncomingCall({ socketId: from, username: callerUsername, offer });
      setCallTarget({ socketId: from, username: callerUsername, isIncoming: true, offer });
    });

    newSocket.on('call_ended', ({ targetUsername }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `call-ended-${Date.now()}`,
          author: 'system',
          message: `Call with ${targetUsername} ended`,
          time: new Date(),
          isSystem: true,
        },
      ]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.off('connect');
      newSocket.off('disconnect');
      newSocket.off('reconnecting');
      newSocket.off('message_history');
      newSocket.off('receive_message');
      newSocket.off('message_ack');
      newSocket.off('older_messages');
      newSocket.off('user_joined');
      newSocket.off('user_left');
      newSocket.off('online_users');
      newSocket.off('user_typing');
      newSocket.off('user_stop_typing');
      newSocket.off('room_has_message');
      newSocket.off('error');
      newSocket.off('call_offer');
      newSocket.off('call_ended');
      newSocket.disconnect();
    };
  }, [token, navigate]);

  // Handle room change
  useEffect(() => {
    if (socket && socket.connected) {
      socket.emit('join_room', { room: currentRoom });
      // Clear unread count for this room
      setUnreadCounts((prev) => ({
        ...prev,
        [currentRoom]: 0,
      }));
    }
  }, [currentRoom, socket]);

  // Handle typing indicator
  const handleMessageChange = (e) => {
    setMessageText(e.target.value);

    if (socket && socket.connected) {
      socket.emit('typing', { room: currentRoom });

      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stop_typing', { room: currentRoom });
      }, 3000);
    }
  };

  // Send message
  const handleSendMessage = (e) => {
    e.preventDefault();

    if (!messageText.trim()) return;

    if (!socket || !socket.connected) {
      // Save to localStorage for later
      const stored = localStorage.getItem(MESSAGE_STORAGE_KEY) || '[]';
      const pending = JSON.parse(stored);
      pending.push({ room: currentRoom, text: messageText.trim() });
      localStorage.setItem(MESSAGE_STORAGE_KEY, JSON.stringify(pending));

      setPendingMessages((prev) => ({
        ...prev,
        [Date.now()]: messageText.trim(),
      }));

      setMessages((prev) => [
        ...prev,
        {
          id: `pending-${Date.now()}`,
          author: username,
          message: messageText.trim(),
          time: new Date(),
          pending: true,
        },
      ]);

      setMessageText('');
      return;
    }

    socket.emit('send_message', {
      room: currentRoom,
      message: messageText.trim(),
    });

    setMessageText('');
    socket.emit('stop_typing', { room: currentRoom });
  };

  // Load more messages on scroll to top
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
      socket.emit('load_more', { room: currentRoom, before: oldestMessage.time });
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Format time
  const formatTime = (date) => {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {callTarget && (
        <VideoCall
          socket={socket}
          targetSocketId={callTarget.socketId}
          targetUsername={callTarget.username}
          onClose={() => setCallTarget(null)}
          incomingCall={callTarget.isIncoming ? { socketId: callTarget.socketId, username: callTarget.username, offer: callTarget.offer } : null}
        />
      )}
      <div className="chat-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div>
            <h2 className="sidebar-title">💬 FamilyChat</h2>
            <p className="user-status">👤 {username}</p>
          </div>
          <button onClick={handleLogout} className="logout-button" title="Logout (sign out)">
            ↑
          </button>
        </div>

        {/* Rooms */}
        <div className="rooms-section">
          <h3 className="section-title">Rooms</h3>
          {ROOMS.map((room) => (
            <div key={room} className="room-button-wrapper">
              <button
                onClick={() => setCurrentRoom(room)}
                className={`room-button ${currentRoom === room ? 'active' : ''}`}
              >
                # {room}
              </button>
              {unreadCounts[room] > 0 && (
                <span className="unread-badge">{unreadCounts[room]}</span>
              )}
            </div>
          ))}
        </div>

        {/* Online Users */}
        <div className="online-section">
          <h3 className="section-title">Online</h3>
          <div className="users-list">
            {onlineUsers.length === 0 ? (
              <p className="empty-text">No one online</p>
            ) : (
              onlineUsers.map((user) => (
                <div key={user.socketId} className="user-item-container">
                  <div className="user-item">
                    <span className="online-indicator"></span>
                    <span className="user-name">{user.username}</span>
                  </div>
                  <button
                    onClick={() => setCallTarget({ socketId: user.socketId, username: user.username })}
                    className="call-user-button"
                    title={`Call ${user.username}`}
                  >
                    📞
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="chat-main">
        {/* Header */}
        <div className="chat-header">
          <div className="header-left">
            <h2 className="room-name">#{currentRoom}</h2>
            <span
              className={`connection-status ${connectionStatus}`}
              title={connectionStatus}
            >
              {connectionStatus === 'connected' ? '●' : connectionStatus === 'reconnecting' ? '◐' : '○'}
              {connectionStatus}
            </span>
          </div>
          <div className="header-right">
            <button className="header-button" title="Call">
              📞
            </button>
            <button className="header-button" title="Video call">
              📹
            </button>
            <button className="header-button" title="Info">
              ℹ️
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="messages-container" ref={messagesContainerRef} onScroll={handleScroll}>
          {isLoadingMore && <div className="loading-indicator">Loading older messages...</div>}

          {messages.map((msg, index) => (
            <div
              key={msg.id || `msg-${index}`}
              className={`message-group ${msg.author === username ? 'own' : ''} ${
                msg.isSystem ? 'system' : ''
              }`}
            >
              {msg.isSystem ? (
                <div className="system-message">{msg.message}</div>
              ) : (
                <div className="message-bubble-wrapper">
                  <div className="message-bubble">
                    <div className="message-author">{msg.author}</div>
                    <div className="message-content">{msg.message}</div>
                    <div className="message-time">{formatTime(msg.time)}</div>
                  </div>
                  {msg.pending && <span className="pending-indicator">⏳</span>}
                </div>
              )}
            </div>
          ))}

          {/* Typing Indicator */}
          {typingUsers.size > 0 && (
            <div className="message-group">
              <div className="typing-indicator">
                <span className="typing-user">{Array.from(typingUsers).join(', ')}</span> is typing
                <span className="dot">.</span>
                <span className="dot">.</span>
                <span className="dot">.</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form className="input-container" onSubmit={handleSendMessage}>
          <button type="button" className="input-action" title="Emoji">
            😊
          </button>
          <button type="button" className="input-action" title="Attachment">
            📎
          </button>
          <input
            type="text"
            placeholder="Type something..."
            value={messageText}
            onChange={handleMessageChange}
            className="message-input"
            disabled={false}
          />
          <button type="submit" className="send-button" disabled={!messageText.trim()}>
            ➤
          </button>
        </form>
      </div>
    </div>
    </>
  );
}
