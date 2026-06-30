import { useState, useEffect, useCallback, useRef } from 'react';
import { ChatGroq } from '@langchain/groq';
import { HumanMessage } from '@langchain/core/messages';

export const useLlmResponse = (query: string) => {
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const generateResponse = useCallback(async (
    text: string, 
    onChunk?: (chunk: string, fullText: string) => void,
    signal?: AbortSignal
  ) => {
    setIsLoading(true);
    setError(null);
    setResponse(''); // Clear previous response

    try {
      if (!import.meta.env.VITE_GROQ_API_KEY) {
        throw new Error('GROQ API key is not configured');
      }

      const llm = new ChatGroq({
        modelName: 'llama-3.3-70b-versatile',
        apiKey: import.meta.env.VITE_GROQ_API_KEY,
        temperature: 0.7,
      });

      const messages = [new HumanMessage(text)];

      const stream = await llm.stream(messages, { signal });

      let fullText = '';
      for await (const chunk of stream) {
        if (chunk && chunk.content) {
          const content = chunk.content.toString();
          // Filter out <think> tags if any are present (in case of deepseek models)
          const cleanedContent = content.replace(/<think>[\s\S]*?<\/think>/g, '');
          fullText += cleanedContent;
          setResponse(fullText);
          if (onChunk) {
            onChunk(cleanedContent, fullText);
          }
        }
      }
      setIsLoading(false);
      return fullText;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Request aborted');
        setIsLoading(false);
        return '';
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch response';
      setError(errorMessage);
      setIsLoading(false);
      console.error('LLM Stream Error:', err);
      throw err;
    }
  }, []);

  useEffect(() => {
    if (query) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      
      generateResponse(query, undefined, abortControllerRef.current.signal).catch(() => {});
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, retryCount, generateResponse]);

  const retry = () => setRetryCount((prev) => prev + 1);

  return {
    response,
    error,
    isLoading,
    retry,
    generateResponse
  };
};
