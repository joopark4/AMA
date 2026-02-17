import { useState, useCallback } from 'react';
import { screenCapture } from '../services/tauri/screenCapture';
import { screenAnalyzer } from '../services/ai/screenAnalyzer';

interface UseScreenCaptureReturn {
  isCapturing: boolean;
  isAnalyzing: boolean;
  error: string | null;
  capture: () => Promise<string | null>;
  analyzeScreen: (prompt: string) => Promise<string | null>;
  describeScreen: () => Promise<string | null>;
}

export function useScreenCapture(): UseScreenCaptureReturn {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capture = useCallback(async (): Promise<string | null> => {
    setIsCapturing(true);
    setError(null);

    try {
      const dataUrl = await screenCapture.captureAsDataUrl();
      return dataUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to capture screen';
      setError(message);
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, []);

  const analyzeScreen = useCallback(async (prompt: string): Promise<string | null> => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await screenAnalyzer.analyzeScreen(prompt);
      return response.content;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to analyze screen';
      setError(message);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const describeScreen = useCallback(async (): Promise<string | null> => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const description = await screenAnalyzer.describeScreen();
      return description;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to describe screen';
      setError(message);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  return {
    isCapturing,
    isAnalyzing,
    error,
    capture,
    analyzeScreen,
    describeScreen,
  };
}

export default useScreenCapture;
