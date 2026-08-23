import { describe, expect, it } from 'vitest'
import {
  divRound,
  formatBps,
  formatPence,
  formatReturn,
  formatUnitPrice,
  parsePence,
  unitPriceMicro,
  unitsForAmountMicro,
  valueFromUnits,
} from './money'

describe('divRound', () => {
  it('rounds half away from zero rather than truncating', () => {
    expect(divRound(5n, 2n)).toBe(3n)
    expect(divRound(-5n, 2n)).toBe(-3n)
    expect(divRound(4n, 2n)).toBe(2n)
    expect(divRound(1n, 3n)).toBe(0n)
    expect(divRound(2n, 3n)).toBe(1n)
  })

  it('refuses to divide by zero rather than returning Infinity', () => {
    expect(() => divRound(1n, 0n)).toThrow()
  })
})

describe('scale conversions', () => {
  it('opens at exactly 1.000000 when units equal opening pence', () => {
    expect(unitPriceMicro(50_000, 50_000 * 1_000_000)).toBe(1_000_000)
  })

  it('derives the brief’s worked example', () => {
    // £518.45 against a £500 opening
    expect(unitPriceMicro(51_845, 50_000_000_000)).toBe(1_036_900)
  })

  it('round-trips value -> price -> value', () => {
    const unitsMicro = 50_000_000_000
    const price = unitPriceMicro(51_845, unitsMicro)
    expect(valueFromUnits(unitsMicro, price)).toBe(51_845)
  })

  it('buys fewer units when the price has risen', () => {
    const atPar = unitsForAmountMicro(2_500, 1_000_000)
    const dearer = unitsForAmountMicro(2_500, 1_036_900)
    expect(atPar).toBe(2_500_000_000)
    expect(dearer).toBeLessThan(atPar)
  })

  it('handles a withdrawal as negative units', () => {
    expect(unitsForAmountMicro(-2_500, 1_000_000)).toBe(-2_500_000_000)
  })

  it('refuses to derive a price from zero units', () => {
    expect(() => unitPriceMicro(100, 0)).toThrow()
  })
})

describe('formatting', () => {
  it('formats pence as pounds', () => {
    expect(formatPence(51_845)).toBe('£518.45')
    expect(formatPence(0)).toBe('£0.00')
    expect(formatPence(-2_500)).toBe('-£25.00')
  })

  it('shows a unit price to six places, always', () => {
    expect(formatUnitPrice(1_000_000)).toBe('1.000000')
    expect(formatUnitPrice(1_036_900)).toBe('1.036900')
  })

  it('formats basis points as a percentage', () => {
    expect(formatBps(75)).toBe('0.75%')
    expect(formatBps(35)).toBe('0.35%')
  })

  it('signs a return, because direction is the point', () => {
    expect(formatReturn(0.0369)).toBe('+3.69%')
    expect(formatReturn(-0.12)).toBe('-12.00%')
  })
})

describe('parsePence', () => {
  it('accepts what a human actually types off a provider screen', () => {
    expect(parsePence('518.45')).toBe(51_845)
    expect(parsePence('£518.45')).toBe(51_845)
    expect(parsePence('  £1,234.56 ')).toBe(123_456)
    expect(parsePence('1 234.56')).toBe(123_456)
    expect(parsePence('500')).toBe(50_000)
    expect(parsePence('500.')).toBe(50_000)
  })

  it('returns null rather than guessing at nonsense', () => {
    // The admin grid has to tell "not filled in" apart from "zero"; reading
    // an unparseable entry as 0 would write a fabricated reading.
    expect(parsePence('')).toBeNull()
    expect(parsePence('   ')).toBeNull()
    expect(parsePence('abc')).toBeNull()
    expect(parsePence('12.34.56')).toBeNull()
    expect(parsePence('-')).toBeNull()
  })

  it('keeps zero distinct from absent', () => {
    expect(parsePence('0')).toBe(0)
    expect(parsePence('£0.00')).toBe(0)
  })

  it('accepts a negative, for a correction', () => {
    expect(parsePence('-25.00')).toBe(-2_500)
  })
})
