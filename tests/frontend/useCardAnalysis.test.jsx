import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const ai = vi.hoisted(() => ({ messages: [], isStreaming: false, sendMessage: vi.fn(), clearMessages: vi.fn() }));
vi.mock('@/hooks/use-integrated-ai.jsx', () => ({ useIntegratedAi: () => ai }));
const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: mockToast }));

import { useCardAnalysis } from '@/hooks/useCardAnalysis.js';

const file = () => new File([new Uint8Array([1])], 'c.jpg', { type: 'image/jpeg' });

beforeEach(() => {
  vi.clearAllMocks();
  ai.messages = [];
  ai.isStreaming = false;
  ai.sendMessage = vi.fn().mockResolvedValue(undefined);
  ai.clearMessages = vi.fn();
});

describe('useCardAnalysis', () => {
  it('warns and does nothing without an image', async () => {
    const { result } = renderHook(() => useCardAnalysis());
    await act(async () => { await result.current.analyzeCardImage(null); });
    expect(mockToast.error).toHaveBeenCalledWith('Please select an image first.');
    expect(ai.sendMessage).not.toHaveBeenCalled();
  });

  it('sends the analysis prompt with the image', async () => {
    const { result } = renderHook(() => useCardAnalysis());
    const img = file();
    await act(async () => { await result.current.analyzeCardImage(img); });
    expect(ai.clearMessages).toHaveBeenCalled();
    expect(ai.sendMessage).toHaveBeenCalledWith(expect.stringContaining('valid JSON'), [img]);
    expect(result.current.isAnalyzing).toBe(true);
  });

  it('parses the assistant JSON and maps condition/category', async () => {
    const { result, rerender } = renderHook(() => useCardAnalysis());
    await act(async () => { await result.current.analyzeCardImage(file()); });

    // Simulate the stream completing with an assistant JSON response.
    ai.isStreaming = false;
    ai.messages = [{ role: 'assistant', content: '{"name":"Charizard","category":"Pokemon","condition":"Near Mint","price":100}' }];
    rerender();

    await waitFor(() => expect(result.current.analysisResult).not.toBeNull());
    expect(result.current.analysisResult).toMatchObject({
      name: 'Charizard', mappedType: 'Pokemon', mappedCondition: 'Near Mint',
    });
    expect(result.current.isAnalyzing).toBe(false);
    expect(mockToast.success).toHaveBeenCalled();
  });

  it('errors when the assistant returns empty content', async () => {
    const { result, rerender } = renderHook(() => useCardAnalysis());
    await act(async () => { await result.current.analyzeCardImage(file()); });

    ai.messages = [{ role: 'assistant', content: '' }];
    rerender();
    await waitFor(() => expect(result.current.isAnalyzing).toBe(false));
    expect(mockToast.error).toHaveBeenCalledWith('AI returned an empty response.');
  });

  it('stops analyzing if the last message is not from the assistant', async () => {
    const { result, rerender } = renderHook(() => useCardAnalysis());
    await act(async () => { await result.current.analyzeCardImage(file()); });

    ai.messages = [{ role: 'user', content: 'hi' }];
    rerender();
    await waitFor(() => expect(result.current.isAnalyzing).toBe(false));
    expect(result.current.analysisResult).toBeNull();
  });
});
