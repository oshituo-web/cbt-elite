import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiService } from '../src/services/aiService';
import { DataService } from '../src/services/data';

// Mock the Supabase client
vi.mock('../src/utils/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn()
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null })
    })),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } })
    },
    rpc: vi.fn().mockResolvedValue({ data: [], error: null })
  }
}));

import { supabase } from '../src/utils/supabase';

describe('DataService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getExams should return data array', async () => {
    supabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValueOnce({ data: [{ id: 1, exam_name: 'JAMB' }], error: null })
    });

    const result = await DataService.getExams();
    expect(result.data).toHaveLength(1);
    expect(result.data[0].exam_name).toBe('JAMB');
    expect(result.error).toBeNull();
  });
});

describe('AiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getDeepExplanation should retry on 503 error and succeed', async () => {
    // Mock 503 error first, then success
    supabase.functions.invoke
      .mockResolvedValueOnce({ data: null, error: { message: '503 Service Unavailable' } })
      .mockResolvedValueOnce({ data: { text: 'Successful explanation' }, error: null });

    const question = {
      question_text: 'Test?',
      answers: [{ id: 'a', answer_text: 'A' }, { id: 'b', answer_text: 'B' }]
    };

    const result = await AiService.getDeepExplanation(question, 'a', 'b', null);
    
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(2);
    expect(result).toBe('Successful explanation');
  });

  it('getDeepExplanation should fail after max retries', async () => {
    // Always mock 429 error
    supabase.functions.invoke.mockResolvedValue({ data: null, error: { message: '429 Rate Limit' } });

    const question = {
      question_text: 'Test?',
      answers: [{ id: 'a', answer_text: 'A' }, { id: 'b', answer_text: 'B' }]
    };

    await expect(AiService.getDeepExplanation(question, 'a', 'b', null))
      .rejects.toThrow();
      
    // Default maxRetries is 4 in invokeWithRetry
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(4);
  });
});
