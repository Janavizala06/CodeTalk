import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, Send, Loader2, MicOff, Code, Trash2 } from 'lucide-react';
import { useLlmResponse } from '@/hooks/useLlmResponse';
import { MarkDown } from '../MarkDown';
import { useAuth } from '@/hooks/useAuth';
import { useChatHistory, Message } from '@/hooks/useChatHistory';


const ClearChatButton = ({ messages, onClearChat }: { messages: Message[], onClearChat: () => void }) => {
  const [showClearConfirm, setShowClearConfirm] = React.useState(false);

  const handleClearClick = () => {
    if (messages.length <= 1) return; // 1 means only greeting is there
    
    if (!showClearConfirm) {
      setShowClearConfirm(true);
      setTimeout(() => setShowClearConfirm(false), 3000);
    } else {
      onClearChat();
      setShowClearConfirm(false);
    }
  };

  return (
    <button
      onClick={handleClearClick}
      disabled={messages.length <= 1}
      className={`group flex items-center gap-2 px-1 py-1.5 rounded-md transition-all duration-200
        ${showClearConfirm 
          ? 'bg-red-500 dark:bg-red-500/50 dark:hover:bg-red-600/30 text-red-200' 
          : 'bg-gray-800 dark:bg-gray-800/40 hover:bg-gray-700/50 disabled:opacity-40 disabled:cursor-not-allowed'
        } backdrop-blur-sm`}
    >
      <Trash2 className={`w-8 h-8 transition-all duration-200 
        ${showClearConfirm 
          ? 'text-red-200 group-hover:text-red-100' 
          : 'text-gray-400 group-hover:text-gray-300'}`} 
      />
      <span className="text-xs md:text-sm">
        {showClearConfirm ? 'Confirm?' : 'Clear Chat'}
      </span>
    </button>
  );
};

import { Copy } from 'lucide-react';

interface CodeSectionProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  name?: string;
  className?: string;
  onCodeChange?: (code: string) => void;
  title?: string;
}

export const CodeSection = ({ 
  name, 
  className = '',
  title='' ,
  onCodeChange,
  ...props 
}: CodeSectionProps) => {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    if (onCodeChange) {
      onCodeChange(newCode);
    }
    if (props.onChange) {
      props.onChange(e);
    }
  };

  const handleCopy = async () => {
    if (textareaRef.current) {
      await navigator.clipboard.writeText(textareaRef.current.value);
    }
  };
  const handleClear = () => {
    if (textareaRef.current) {
      textareaRef.current.value = '';
      if (onCodeChange) onCodeChange('');
    }
  };

  return (
    <div className="h-full rounded-lg overflow-hidden border border-gray-500 dark:border-gray-700 bg-gray-200/50 dark:bg-slate-900/70 backdrop-blur-3xl shadow-lg flex flex-col">
      <div className="relative flex items-center justify-end px-4 py-2 bg-transparent border-b border-gray-500/50 dark:border-gray-700 h-fit flex-shrink-0">
        <div className="absolute left-4 mx-auto flex items-center space-x-2 text-bold font-bold lg:max-w-[50%] text-blue-500">
          <Code className="w-4 h-4 mr-2" />{title}
        </div>
        <button
          onClick={handleCopy}
          className="p-1 hover:bg-gray-700 rounded transition-colors"
          title="Copy code"
        >
          <Copy className="w-4 h-4" />
        </button>
        <button
          onClick={handleClear}
          className="p-1 hover:bg-gray-700 rounded transition-colors"
          title="Clear"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <textarea
          ref={textareaRef}
          name={name}
          {...props}
          onChange={handleCodeChange}
          className={`w-full h-full ${className} overflow-auto text-black dark:text-white dark:bg-slate-800/70 border-b border-gray-500/50 dark:border-gray-700
             font-mono text-sm pl-4 pr-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent 
            outline-none resize-none`}
          spellCheck="false"
        />
      </div>
    </div>
  );
};

const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  const formatTimestamp = (date: Date): string => {
    // If it's not a valid date object yet, convert it
    const d = new Date(date);
    return new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(d);
  };

  return (
    <div className={`flex  ${message.type === 'user' ? 'justify-end' : 'justify-start'} `}>
      <div
        className={` p-4 rounded-lg overflow-hidden max-w-[80%] ${
          message.type === 'user'
            ? 'dark:bg-blue-600 bg-blue-300 bg-opacity-50 backdrop-blur-sm'
            : 'dark:bg-gray-700 bg-gray-300 bg-opacity-50 backdrop-blur-sm'
        }`}
      >
        <div className="flex flex-col gap-2 text-black dark:text-gray-200 ">
          <MarkDown>{message.content}</MarkDown>
          <span className="text-xs ">{formatTimestamp(message.timestamp)}</span>
        </div>
      </div>
    </div>
  );
};

const CodeWithAi: React.FC = () => {
  const { user } = useAuth();
  const { messages, setMessages, isLoadingHistory, loadMessages, saveMessage, updateBotMessage, clearHistory } = useChatHistory();
  const [code, setCode] = useState<string>('');
  const [inputText, setInputText] = useState<string>('');
  const [speechState, setSpeechState] = useState({
    isListening: false,
    speechSupported: false,
    error: '',
  });
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  
  const { generateResponse } = useLlmResponse('');
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollableRef = useRef<HTMLDivElement>(null);

  // Load chat history when user is available
  useEffect(() => {
    if (user?.uid) {
      loadMessages(user.uid);
    } else {
      // If no user, just load local greeting
      setMessages([{
        id: crypto.randomUUID(),
        type: 'bot',
        content: "👋 Hi! I'm your coding assistant. Paste your code in the editor, and I'll help you understand, debug, or improve it. How can I help you today?",
        timestamp: new Date()
      }]);
    }
  }, [user, loadMessages, setMessages]);

  const scrollToBottom = useCallback(() => {
    if (scrollableRef.current) {
      scrollableRef.current.scrollTo({
        top: scrollableRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, []);

  // Initial scroll to bottom when messages load
  useEffect(() => {
    if (!isLoadingHistory && messages.length > 0) {
      // Short delay to ensure rendering is complete
      setTimeout(scrollToBottom, 100);
    }
  }, [isLoadingHistory, messages.length, scrollToBottom]);

  const createQueryWithContext = useCallback((userMessage: string) => {
    if (code.trim()) {
      return `if there is greeting in latest message then just greet user and ask for help otherwise\n\nignore previous greetings and Answer in chatting manner and behave like coding assistent chatbot give response of latest message using Context - Current code in editor:\n\`\`\`\n${code}\n\`\`\`\n\nUser question: ${userMessage} `;
    }
    return userMessage;
  }, [code]);

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionAPI =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (SpeechRecognitionAPI) {
        try {
          const recognitionInstance = new SpeechRecognitionAPI();
          recognitionInstance.continuous = false;
          recognitionInstance.interimResults = true;

          recognitionInstance.onstart = () =>
            setSpeechState((prev) => ({ ...prev, isListening: true, error: '' }));

          recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) =>
            setSpeechState((prev) => ({
              ...prev,
              isListening: false,
              error: getErrorMessage(event.error),
            }));

          recognitionInstance.onend = () =>
            setSpeechState((prev) => ({ ...prev, isListening: false }));

          recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
            const transcript = Array.from(event.results)
              .map((result) => result[0].transcript)
              .join(' ');

            setInputText((prevText) => `${prevText} ${transcript.trim()}`.trim());
          };

          setRecognition(recognitionInstance);
          setSpeechState((prev) => ({ ...prev, speechSupported: true }));
        } catch {
          setSpeechState((prev) => ({
            ...prev,
            speechSupported: false,
            error: 'Speech recognition not supported in this browser',
          }));
        }
      } else {
        setSpeechState((prev) => ({
          ...prev,
          speechSupported: false,
          error: 'Speech recognition not supported in this browser',
        }));
      }
    }
  }, []);

  const getErrorMessage = (error: string): string => {
    const errorMessages: Record<string, string> = {
      'not-allowed': 'Microphone access denied. Please allow microphone access and try again.',
      'no-speech': 'No speech was detected. Please try again.',
      'network': 'Network error occurred. Please check your connection.',
    };
    return errorMessages[error] || 'Error occurred with speech recognition. Please try again.';
  };

  const toggleListening = useCallback(() => {
    if (!recognition || !speechState.speechSupported) return;

    if (speechState.isListening) {
      recognition.stop();
    } else {
      try {
        recognition.start();
      } catch (error: unknown) {
        setSpeechState((prev) => ({
          ...prev,
          error: 'Error starting speech recognition. Please try again.' + error,
        }));
      }
    }
  }, [recognition, speechState]);

  const handleSubmit = useCallback(async () => {
    if (!inputText.trim() || isGenerating) return;

    const userContent = inputText.trim();
    const userMessage: Message = {
      id: crypto.randomUUID(),
      type: 'user',
      content: userContent,
      timestamp: new Date(),
    };

    setInputText('');
    
    // Save user message
    if (user?.uid) {
      await saveMessage(user.uid, userMessage);
    } else {
      setMessages((prev) => [...prev, userMessage]);
    }
    
    scrollToBottom();

    // Prepare bot message
    const botMessageId = crypto.randomUUID();
    const botMessage: Message = {
      id: botMessageId,
      type: 'bot',
      content: '',
      timestamp: new Date(),
    };

    if (user?.uid) {
      await saveMessage(user.uid, botMessage);
    } else {
      setMessages((prev) => [...prev, botMessage]);
    }

    setIsGenerating(true);
    const query = createQueryWithContext(userContent);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const fullText = await generateResponse(
        query,
        (_chunk, currentFullText) => {
          updateBotMessage(user?.uid || '', botMessageId, currentFullText);
          scrollToBottom();
        },
        abortControllerRef.current.signal
      );

      // Final save to persist complete message in Supabase
      if (user?.uid && fullText) {
        await saveMessage(user.uid, {
          ...botMessage,
          content: fullText
        });
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        const errorText = 'Sorry, there was an error processing your request. Please try again.';
        updateBotMessage(user?.uid || '', botMessageId, errorText);
        if (user?.uid) {
          await saveMessage(user.uid, {
            ...botMessage,
            content: errorText
          });
        }
      }
    } finally {
      setIsGenerating(false);
      scrollToBottom();
    }

  }, [inputText, isGenerating, createQueryWithContext, user, saveMessage, updateBotMessage, generateResponse, scrollToBottom, setMessages]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleClearChat = async () => {
    if (user?.uid) {
      await clearHistory(user.uid);
    } else {
      setMessages([{
        id: crypto.randomUUID(),
        type: 'bot',
        content: "👋 Hi! I'm your coding assistant. Paste your code in the editor, and I'll help you understand, debug, or improve it. How can I help you today?",
        timestamp: new Date()
      }]);
    }
    setInputText('');
  };

  return (
    <div className="min-h-[85vh] w-full bg-transparent px-4 md:px-0 flex flex-col">
      <div className="mx-auto h-[75vh] w-full lg:w-[95vw] flex flex-col">
        <h1 className="text-3xl font-extrabold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-800 to-blue-500 dark:from-blue-400 dark:to-blue-300 flex-shrink-0">
          Programming with Ai
        </h1>
        <div className="grid grid-rows-[40%_60%] gap-y-5 lg:grid-rows-1 lg:grid-cols-[35vw_58vw] lg:gap-8 flex-1 overflow-hidden">
          {/* Code Section */}
          <div className="h-full w-full flex flex-col overflow-hidden bg-slate-200/50 dark:bg-slate-900/50 p-4 rounded-lg border-2 border-slate-900/30 dark:border-slate-300/30 shadow-md">
            <CodeSection
              name="code"
              value={code}
              title={'Code For Context'}
              className='flex-1 min-h-0'
              placeholder="Paste your code here..."
              onChange={(e) => setCode(e.target.value)}
              onCodeChange={handleCodeChange}
            />
          </div>

          {/* Chat Section */}
          <div className="h-full w-full flex flex-col bg-slate-200/50 dark:bg-gray-800/50 text-white rounded-lg shadow-md lg:mr-12 border-2 border-slate-900/30 dark:border-slate-300/30 overflow-hidden relative">
            <div 
              className="flex-1 overflow-y-auto p-4 space-y-4" 
              ref={scrollableRef}
            >
              {isLoadingHistory ? (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                  {isGenerating && (
                    <div className="flex justify-start">
                      <div className="bg-gray-700 bg-opacity-50 backdrop-blur-sm p-4 rounded-lg">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {speechState.error && (
              <div className="px-4 py-2 bg-red-500 bg-opacity-50 backdrop-blur-sm text-white text-sm shrink-0">
                {speechState.error}
              </div>
            )}

            <div className="backdrop-blur-xl bg-gray-300/50 dark:bg-gray-900/50 p-2 shrink-0">
              <div className="max-w-2xl flex items-center my-auto justify-center gap-2 w-full mx-auto">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={isGenerating ? undefined : handleKeyPress}
                  className="w-full flex p-3 mr-2 rounded-lg text-sm text-black dark:text-white dark:bg-gray-700 bg-gray-200/70 bg-opacity-50 backdrop-blur-sm border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                  placeholder="Type your message..."
                  rows={1}
                />
                <ClearChatButton messages={messages} onClearChat={handleClearChat} />
                <button
                  onClick={toggleListening}
                  className={`inline-flex p-3 rounded-full transition-colors ${
                    !speechState.speechSupported
                      ? 'bg-gray-600 cursor-not-allowed'
                      : speechState.isListening
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  title={
                    !speechState.speechSupported
                      ? 'Speech recognition not supported in this browser'
                      : speechState.isListening
                      ? 'Stop listening'
                      : 'Start listening'
                  }
                  disabled={!speechState.speechSupported}
                >
                  {speechState.speechSupported ? (
                    <Mic className={`w-6 h-6 ${speechState.isListening ? 'animate-pulse' : ''}`} />
                  ) : (
                    <MicOff className="w-3 h-3 lg:w-6 lg:h-6" />
                  )}
                </button>
                <button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={!inputText.trim() || isGenerating}
                  className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Send message"
                >
                  <Send className="w-3 h-3 lg:w-6 lg:h-6" />
                </button>
                
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeWithAi;
export { CodeWithAi };