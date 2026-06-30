import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

export const useChatHistory = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const loadMessages = useCallback(async (userId: string) => {
    if (!userId) return;
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('Error loading chat history:', error);
        return;
      }

      if (data && data.length > 0) {
        setMessages(
          data.map((msg) => ({
            id: msg.id,
            type: msg.type as 'user' | 'bot',
            content: msg.content,
            timestamp: new Date(msg.timestamp),
          }))
        );
      } else {
        // Initialize with default greeting if empty
        setMessages([{
          id: crypto.randomUUID(),
          type: 'bot',
          content: "👋 Hi! I'm your coding assistant. Paste your code in the editor, and I'll help you understand, debug, or improve it. How can I help you today?",
          timestamp: new Date()
        }]);
      }
    } catch (err) {
      console.error('Failed to load chat history', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const saveMessage = async (userId: string, message: Message) => {
    // Optimistic update
    setMessages((prev) => {
      // Prevent duplicates in case of strict mode or re-renders
      if (prev.some(m => m.id === message.id)) return prev;
      return [...prev, message];
    });
    
    if (!userId) return;
    
    try {
      const { error } = await supabase.from('chat_messages').upsert([{
        id: message.id,
        user_id: userId,
        type: message.type,
        content: message.content,
        timestamp: message.timestamp.toISOString(),
      }], { onConflict: 'id' });

      if (error) {
        console.error('Error saving message:', error);
      }
    } catch (err) {
      console.error('Failed to save message', err);
    }
  };

  const updateBotMessage = async (userId: string, messageId: string, content: string) => {
    setMessages((prev) => 
      prev.map(msg => msg.id === messageId ? { ...msg, content } : msg)
    );
    
    // We only save to supabase once the message is complete to avoid excessive writes
    // The caller should call saveMessage() with the final message, or we can expose a dedicated save method.
    // For now, this just updates the local state while streaming.
  };

  const clearHistory = async (userId: string) => {
    const greetingMessage: Message = {
      id: crypto.randomUUID(),
      type: 'bot',
      content: "👋 Hi! I'm your coding assistant. Paste your code in the editor, and I'll help you understand, debug, or improve it. How can I help you today?",
      timestamp: new Date()
    };
    
    setMessages([greetingMessage]);
    
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Error clearing chat history:', error);
      } else {
        // Also save the greeting message back
        await supabase.from('chat_messages').insert([{
          id: greetingMessage.id,
          user_id: userId,
          type: greetingMessage.type,
          content: greetingMessage.content,
          timestamp: greetingMessage.timestamp.toISOString(),
        }]);
      }
    } catch (err) {
      console.error('Failed to clear chat history', err);
    }
  };

  return {
    messages,
    setMessages, // expose just in case
    isLoadingHistory,
    loadMessages,
    saveMessage,
    updateBotMessage,
    clearHistory
  };
};
