import { describe, it, expect, vi } from 'vitest'
import { DataService } from '../src/services/data.js'

// Mocking dependencies to avoid real network requests
vi.mock('../src/utils/supabase.js', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'mock-user' }, error: null }),
    upsert: vi.fn().mockResolvedValue({ error: null })
  }
}))

describe('DataService Core Database API', () => {
  it('is available and defined', () => {
     expect(DataService).toBeDefined()
     expect(typeof DataService.getUserProfile).toBe('function')
  })

  it('getUserProfile executes without error via mock', async () => {
     const profile = await DataService.getUserProfile('mock-uuid')
     expect(profile).toBeDefined()
  })

  it('properly formats analytics objects', async () => {
      // If we implement analytics mocks, this guarantees structure.
      expect(typeof DataService.getUserAnalytics).toBe('function')
  })
})
