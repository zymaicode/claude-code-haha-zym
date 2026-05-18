import { describe, expect, test } from 'bun:test'
import optimize from './optimize.js'

describe('/optimize command', () => {
  test('has correct metadata', () => {
    expect(optimize.name).toBe('optimize')
    expect(optimize.type).toBe('prompt')
    expect(optimize.source).toBe('builtin')
    expect(optimize.description).toBeTruthy()
    expect(optimize.progressMessage).toBeTruthy()
  })

  test('generates prompt for provided input', async () => {
    const result = await optimize.getPromptForCommand('add login feature')
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)

    const textBlock = result[0]!
    expect(textBlock.type).toBe('text')
    expect(typeof textBlock.text).toBe('string')
    expect(textBlock.text).toContain('add login feature')
    expect(textBlock.text).toContain('accomplish')
    expect(textBlock.text).toContain('Acceptance Criteria')
  })

  test('handles empty input gracefully', async () => {
    const result = await optimize.getPromptForCommand('')
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]!.type).toBe('text')
    expect(typeof result[0]!.text).toBe('string')
  })

  test('handles whitespace-only input', async () => {
    const result = await optimize.getPromptForCommand('   ')
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  test('outputs structured task breakdown', async () => {
    const result = await optimize.getPromptForCommand('fix the bug where login button does not work')
    const promptText = result[0]!.text as string
    expect(promptText).toContain('Requirements')
    expect(promptText).toContain('Technical Constraints')
    expect(promptText).toContain('login button')
  })
})
