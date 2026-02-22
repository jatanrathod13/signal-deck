/**
 * Agent Orchestration Platform - Streaming Task Hook
 * React hook for streaming agent task execution
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { streamAgentExecution, StreamDoneData } from '../lib/api';

interface UseStreamingTaskOptions {
  agentId: string;
  prompt: string;
  taskId?: string;
  autoStart?: boolean;
}

interface UseStreamingTaskResult {
  output: string;
  isStreaming: boolean;
  error: Error | null;
  startStreaming: () => void;
  stopStreaming: () => void;
  metadata: StreamDoneData | null;
}

/**
 * Hook for streaming agent task execution
 * Manages the EventSource connection and provides real-time output
 */
export function useStreamingTask({
  agentId,
  prompt,
  taskId,
  autoStart = false
}: UseStreamingTaskOptions): UseStreamingTaskResult {
  const [output, setOutput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [metadata, setMetadata] = useState<StreamDoneData | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  const stopStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const startStreaming = useCallback(() => {
    // Clean up any existing connection
    stopStreaming();

    // Reset state
    setOutput('');
    setError(null);
    setMetadata(null);
    setIsStreaming(true);

    // Create new EventSource connection
    eventSourceRef.current = streamAgentExecution(
      agentId,
      prompt,
      {
        onToken: (token: string) => {
          setOutput((prev) => prev + token);
        },
        onDone: (data: StreamDoneData) => {
          setMetadata(data);
          setIsStreaming(false);
        },
        onError: (err: Error) => {
          setError(err);
          setIsStreaming(false);
        }
      },
      taskId
    );
  }, [agentId, prompt, taskId, stopStreaming]);

  // Auto-start streaming if enabled
  useEffect(() => {
    if (autoStart && agentId && prompt) {
      startStreaming();
    }

    return () => {
      stopStreaming();
    };
  }, [autoStart, agentId, prompt, startStreaming, stopStreaming]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, [stopStreaming]);

  return {
    output,
    isStreaming,
    error,
    startStreaming,
    stopStreaming,
    metadata
  };
}
