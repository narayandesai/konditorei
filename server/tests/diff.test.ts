import { describe, it, expect } from 'vitest'
import { diffLines } from '../diff.js'

describe('diffLines', () => {
  it('returns unchanged lines when code is identical', () => {
    const result = diffLines('a\nb\nc', 'a\nb\nc')
    expect(result).toEqual([
      { type: 'unchanged', text: 'a' },
      { type: 'unchanged', text: 'b' },
      { type: 'unchanged', text: 'c' },
    ])
  })

  it('marks added lines', () => {
    const result = diffLines('a\nb', 'a\nb\nc')
    expect(result).toEqual([
      { type: 'unchanged', text: 'a' },
      { type: 'unchanged', text: 'b' },
      { type: 'added', text: 'c' },
    ])
  })

  it('marks removed lines', () => {
    const result = diffLines('a\nb\nc', 'a\nc')
    expect(result).toEqual([
      { type: 'unchanged', text: 'a' },
      { type: 'removed', text: 'b' },
      { type: 'unchanged', text: 'c' },
    ])
  })

  it('handles replaced lines', () => {
    const result = diffLines('a\nb', 'a\nz')
    expect(result).toEqual([
      { type: 'unchanged', text: 'a' },
      { type: 'removed', text: 'b' },
      { type: 'added', text: 'z' },
    ])
  })

  it('handles empty old string', () => {
    const result = diffLines('', 'a\nb')
    expect(result).toEqual([
      { type: 'added', text: 'a' },
      { type: 'added', text: 'b' },
    ])
  })
})
