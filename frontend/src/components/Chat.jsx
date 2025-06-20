import React, { useState, useEffect, useRef } from 'react';

const ChatToggle = ({ name, role, socket, isVisible = true }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('Chat');
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [participants, setParticipants] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [typingUsers, setTypingUsers] = useState([]);
    const [errors, setErrors] = useState([]);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // Auto scroll to bottom when new messages arrive
    useEffect(() => {
        if (isOpen && activeTab === 'Chat') {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isOpen, activeTab]);

    // Focus input when chat opens
    useEffect(() => {
        if (isOpen && activeTab === 'Chat' && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen, activeTab]);

    // Clear errors after 5 seconds
    useEffect(() => {
        if (errors.length > 0) {
            const timer = setTimeout(() => {
                setErrors([]);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [errors]);

    // Socket event listeners
    useEffect(() => {
        if (!socket) return;

        // Join chat when component mounts
        socket.emit('chat-join');

        // Receive chat history
        const handleChatHistory = (msgs) => {
            setMessages(
                (msgs || []).map(msg => ({
                    ...msg,
                    id: msg.sentAt || Date.now() + Math.random(),
                    isMe: msg.sender === name,
                }))
            );
        };

        // Receive new chat message
        const handleChatMessage = (msg) => {
            setMessages(prev => [
                ...prev,
                {
                    ...msg,
                    id: msg.sentAt || Date.now() + Math.random(),
                    isMe: msg.sender === name,
                }
            ]);
        };

        // Receive participants
        const handleParticipants = (list) => {
            setParticipants(list || []);
        };

        // Handle kicked
        const handleKicked = ({ reason }) => {
            alert(reason || "You have been kicked out.");
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        };

        // Handle chat errors
        const handleChatError = ({ message }) => {
            setErrors(prev => [...prev, { id: Date.now(), message }]);
        };

        // Handle kick success (for teachers)
        const handleKickSuccess = ({ message }) => {
            setErrors(prev => [...prev, { id: Date.now(), message, type: 'success' }]);
        };

        // Handle typing indicators
        const handleUserTyping = ({ name: typingName, isTyping: typing, socketId }) => {
            setTypingUsers(prev => {
                if (typing) {
                    // Add user to typing list if not already there
                    if (!prev.find(user => user.socketId === socketId)) {
                        return [...prev, { name: typingName, socketId }];
                    }
                } else {
                    // Remove user from typing list
                    return prev.filter(user => user.socketId !== socketId);
                }
                return prev;
            });

            // Auto-remove typing indicator after 3 seconds of no activity
            if (typing) {
                setTimeout(() => {
                    setTypingUsers(prev => prev.filter(user => user.socketId !== socketId));
                }, 3000);
            }
        };

        socket.on('chat-history', handleChatHistory);
        socket.on('chat-message', handleChatMessage);
        socket.on('participants-update', handleParticipants);
        socket.on('kicked', handleKicked);
        socket.on('chat-error', handleChatError);
        socket.on('kick-success', handleKickSuccess);
        socket.on('user-typing', handleUserTyping);

        return () => {
            socket.off('chat-history', handleChatHistory);
            socket.off('chat-message', handleChatMessage);
            socket.off('participants-update', handleParticipants);
            socket.off('kicked', handleKicked);
            socket.off('chat-error', handleChatError);
            socket.off('kick-success', handleKickSuccess);
            socket.off('user-typing', handleUserTyping);
        };
    }, [socket, name]);

    // Handle typing indicator
    const handleInputChange = (e) => {
        setMessage(e.target.value);

        if (!socket) return;

        // Start typing
        if (!isTyping) {
            setIsTyping(true);
            socket.emit('typing', { isTyping: true });
        }

        // Clear previous timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Stop typing after 1 second of no activity
        typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
            socket.emit('typing', { isTyping: false });
        }, 1000);
    };

    const sendMessage = (e) => {
        e.preventDefault();
        if (!message.trim() || !socket) return;

        // Stop typing when sending message
        if (isTyping) {
            setIsTyping(false);
            socket.emit('typing', { isTyping: false });
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        }

        socket.emit('chat-message', { text: message.trim() });
        setMessage('');
    };

    const kickParticipant = (socketId, participantName) => {
        if (!socket || role !== 'teacher') return;
        socket.emit('kick-student', { socketId });
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const renderSystemMessage = (msg) => (
        <div className="text-center my-[8px]">
            <div className="inline-block px-[12px] py-[4px] bg-[#FFF3CD] text-[#856404] rounded-[12px] text-[11px] border border-[#FFEAA7]">
                {msg.text}
            </div>
            <div className="text-[9px] text-[#6E6E6E] mt-[2px]">
                {formatTime(msg.sentAt)}
            </div>
        </div>
    );

    const getParticipantStatusColor = (status) => {
        switch (status) {
            case 'online': return 'text-[#27AE60]';
            case 'connected': return 'text-[#3498DB]';
            case 'waiting': return 'text-[#F39C12]';
            default: return 'text-[#6E6E6E]';
        }
    };

    const getParticipantStatusText = (status) => {
        switch (status) {
            case 'online': return 'Online';
            case 'connected': return 'Connected';
            case 'waiting': return 'Waiting';
            default: return '';
        }
    };

    if (!isVisible) return null;

    return (
        <div className={`fixed bottom-[20px] right-[20px] ${isOpen ? 'z-50' : 'z-40'}`}>
            {/* Error Messages */}
            {errors.length > 0 && (
                <div className="mb-[10px] space-y-[4px]">
                    {errors.map((error) => (
                        <div
                            key={error.id}
                            className={`px-[12px] py-[8px] rounded-[8px] text-[11px] font-medium max-w-[320px] ${error.type === 'success'
                                    ? 'bg-[#D4EDDA] text-[#155724] border border-[#C3E6CB]'
                                    : 'bg-[#F8D7DA] text-[#721C24] border border-[#F5C6CB]'
                                }`}
                        >
                            {error.message}
                        </div>
                    ))}
                </div>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div
                    className="mb-[10px] w-[320px] h-[450px] bg-[#ffffff] rounded-[12px] shadow-2xl flex flex-col border border-[#E5E5E5]"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex border-b border-[#F0F0F0]">
                        <button
                            onClick={() => setActiveTab('Chat')}
                            className={`border-[0px] flex-1 px-[16px] py-[12px] text-[14px] font-medium rounded-tl-[12px] transition-colors ${activeTab === 'Chat'
                                    ? 'text-[#8F64E1] bg-[#F8F6FF]'
                                    : 'text-[#6E6E6E] hover:text-[#8F64E1] hover:bg-[#FAFAFA]'
                                }`}
                        >
                            Chat
                            {messages.length > 0 && (
                                <span className="ml-[4px] text-[10px] bg-[#8F64E1] text-white rounded-full px-[6px] py-[1px]">
                                    {messages.length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('Participants')}
                            className={`border-[0px] flex-1 px-[16px] py-[12px] text-[14px] font-medium rounded-tr-[12px] transition-colors ${activeTab === 'Participants'
                                    ? 'text-[#8F64E1] bg-[#F8F6FF]'
                                    : 'text-[#6E6E6E] hover:text-[#8F64E1] hover:bg-[#FAFAFA]'
                                }`}
                        >
                            Participants
                            {participants.length > 0 && (
                                <span className="ml-[4px] text-[10px] bg-[#8F64E1] text-white rounded-full px-[6px] py-[1px]">
                                    {participants.length}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex flex-col">
                        {activeTab === 'Chat' ? (
                            <>
                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto px-[16px] py-[12px] space-y-[8px] scrollbar-thin scrollbar-thumb-[#E0E0E0] scrollbar-track-transparent">
                                    {messages.length === 0 ? (
                                        <div className="text-center text-[#6E6E6E] text-[12px] mt-[20px]">
                                            <div className="mb-[8px]">💬</div>
                                            No messages yet. Start the conversation!
                                        </div>
                                    ) : (
                                        messages.map((msg) => (
                                            msg.role === 'system' ? renderSystemMessage(msg) : (
                                                <div
                                                    key={msg.id}
                                                    className={`max-w-[250px] ${msg.isMe ? 'ml-auto' : 'mr-auto'}`}
                                                >
                                                    {!msg.isMe && (
                                                        <div className={`text-[10px] font-medium mb-[2px] ${msg.role === 'teacher' ? 'text-[#E74C3C]' : 'text-[#8F64E1]'
                                                            }`}>
                                                            {msg.sender}
                                                            {msg.role === 'teacher' && (
                                                                <span className="ml-[4px] text-[8px] bg-[#E74C3C] text-white rounded-[4px] px-[4px] py-[1px]">
                                                                    TEACHER
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div
                                                        className={`px-[12px] py-[8px] rounded-[16px] text-[12px] shadow-sm ${msg.isMe
                                                                ? 'bg-[#8F64E1] text-white rounded-br-[4px]'
                                                                : msg.role === 'teacher'
                                                                    ? 'bg-[#FFF5F5] text-[#000000] border border-[#FFCCCC] rounded-bl-[4px]'
                                                                    : 'bg-[#F2F2F2] text-[#000000] rounded-bl-[4px]'
                                                            }`}
                                                    >
                                                        {msg.text}
                                                    </div>
                                                    <div className={`text-[9px] text-[#6E6E6E] mt-[2px] ${msg.isMe ? 'text-right' : 'text-left'}`}>
                                                        {formatTime(msg.sentAt)}
                                                    </div>
                                                </div>
                                            )
                                        ))
                                    )}

                                    {/* Typing Indicators */}
                                    {typingUsers.length > 0 && (
                                        <div className="text-[10px] text-[#6E6E6E] italic">
                                            {typingUsers.map(user => user.name).join(', ')}
                                            {typingUsers.length === 1 ? ' is' : ' are'} typing...
                                        </div>
                                    )}

                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Input */}
                                <div className="p-[16px] border-t border-[#F0F0F0] bg-[#FAFAFA]">
                                    <form className="flex gap-[8px]" onSubmit={sendMessage}>
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={message}
                                            onChange={handleInputChange}
                                            placeholder="Type a message..."
                                            maxLength={1000}
                                            className="flex-1 px-[12px] py-[8px] border border-[#E0E0E0] rounded-[20px] text-[12px] focus:outline-none focus:border-[#8F64E1] focus:ring-1 focus:ring-[#8F64E1] transition-colors bg-white"
                                        />
                                        <button
                                            type="submit"
                                            disabled={!message.trim()}
                                            className="px-[16px] py-[8px] bg-[#8F64E1] text-[#ffffff] rounded-[20px] text-[12px] font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#7B55D6] transition-colors border-[0px] shadow-sm"
                                        >
                                            Send
                                        </button>
                                    </form>
                                    <div className="text-[9px] text-[#6E6E6E] mt-[4px] text-right">
                                        {message.length}/1000
                                    </div>
                                </div>
                            </>
                        ) : (
                            /* Participants */
                            <div className="flex-1 overflow-y-auto">
                                <div className="px-[16px] py-[12px]">
                                    <div className="flex justify-between items-center mb-[12px] pb-[8px] border-b border-[#F0F0F0]">
                                        <div className="text-[12px] font-medium text-[#6E6E6E]">
                                            Participants ({participants.length})
                                        </div>
                                        {role === 'teacher' && (
                                            <div className="text-[12px] font-medium text-[#6E6E6E]">Action</div>
                                        )}
                                    </div>
                                    {participants.length === 0 ? (
                                        <div className="text-center text-[#6E6E6E] text-[12px] mt-[20px]">
                                            <div className="mb-[8px]">👥</div>
                                            No participants found
                                        </div>
                                    ) : (
                                        <div className="space-y-[8px]">
                                            {participants.map((participant, index) => (
                                                <div
                                                    key={participant.socketId || index}
                                                    className="flex justify-between items-center py-[8px] px-[8px] rounded-[8px] hover:bg-[#F8F8F8] transition-colors"
                                                >
                                                    <div className="flex-1">
                                                        <div className="text-[13px] text-[#000000] font-medium">
                                                            {participant.name}
                                                            {participant.name === name && (
                                                                <span className="text-[10px] text-[#8F64E1] ml-[4px] font-normal">(You)</span>
                                                            )}
                                                            {participant.role === 'teacher' && participant.name !== name && (
                                                                <span className="text-[8px] bg-[#E74C3C] text-white rounded-[4px] px-[4px] py-[1px] ml-[4px]">
                                                                    TEACHER
                                                                </span>
                                                            )}
                                                        </div>
                                                        {participant.status && (
                                                            <div className={`text-[10px] mt-[2px] ${getParticipantStatusColor(participant.status)}`}>
                                                                ● {getParticipantStatusText(participant.status)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {role === 'teacher' && participant.role !== 'teacher' && participant.name !== name && (
                                                        <button
                                                            onClick={() => kickParticipant(participant.socketId, participant.name)}
                                                            className="text-[11px] text-[#E74C3C] hover:text-[#C0392B] hover:bg-[#FFF5F5] px-[8px] py-[4px] rounded-[4px] transition-colors border border-transparent hover:border-[#FFCCCC]"
                                                        >
                                                            Kick out
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-[56px] h-[56px] bg-gradient-to-r from-[#8F64E1] to-[#1D68BD] text-[#ffffff] rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center border-[0px] relative"
            >
                {/* Notification Badge */}
                {!isOpen && messages.length > 0 && (
                    <div className="absolute -top-[4px] -right-[4px] bg-[#E74C3C] text-white text-[10px] rounded-full w-[20px] h-[20px] flex items-center justify-center font-bold">
                        {messages.length > 99 ? '99+' : messages.length}
                    </div>
                )}

                {isOpen ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )}
            </button>
        </div>
    );
};

export default ChatToggle;