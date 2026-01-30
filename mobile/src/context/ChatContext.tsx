import React, { createContext, useContext, useState, useEffect } from 'react';

interface Message {
  id: string;
  senderId: string;
  content?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
}

interface ChatContextValue {
  activeSession: string | null;
  messages: Message[];
  currentStage: number;
  timeRemaining: number;
  setActiveSession: (sessionId: string | null) => void;
  addMessage: (message: Message) => void;
  updateStage: (newStage: number) => void;
  startTimer: (duration: number) => void;
  clearChat: () => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentStage, setCurrentStage] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(10 * 60);

  useEffect(() => {
    if (timeRemaining <= 0) return;
    const interval = setInterval(() => {
      setTimeRemaining((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeRemaining]);

  const addMessage = (message: Message) => {
    setMessages((prev) => [...prev, message]);
  };

  const updateStage = (newStage: number) => {
    setCurrentStage(newStage);
    setTimeRemaining(10 * 60);
  };

  const startTimer = (duration: number) => {
    setTimeRemaining(duration);
  };

  const clearChat = () => {
    setMessages([]);
    setCurrentStage(1);
    setTimeRemaining(10 * 60);
    setActiveSession(null);
  };

  return (
    <ChatContext.Provider
      value={{
        activeSession,
        messages,
        currentStage,
        timeRemaining,
        setActiveSession,
        addMessage,
        updateStage,
        startTimer,
        clearChat,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
};
