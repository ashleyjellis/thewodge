import { describe, expect, it } from 'vitest'
import { buildFinancialDiary } from './diary'

const empty = { snapshots: [], contributionChanges: [], plannedEvents: [], checkpoints: [] }

describe('buildFinancialDiary', () => {
  it('returns nothing when every source is empty', () => {
    expect(buildFinancialDiary(empty)).toEqual([])
  })

  it('drops entries with no note from every source', () => {
    const result = buildFinancialDiary({
      snapshots: [{ id: 's1', recordedAt: '2027-01-01T00:00:00Z', note: null, accountId: 'a1' }],
      contributionChanges: [
        { id: 'c1', createdAt: '2027-01-02T00:00:00Z', note: null, owner: 'person_a', potCategory: 'pension' },
      ],
      plannedEvents: [
        {
          id: 'e1',
          createdAt: '2027-01-03T00:00:00Z',
          note: null,
          owner: 'joint',
          potCategory: 'cash',
          name: 'thing',
        },
      ],
      checkpoints: [{ id: 'cp1', createdAt: '2027-01-04T00:00:00Z', note: null, type: 'checkpoint' }],
    })
    expect(result).toEqual([])
  })

  it('drops baseline/replan history entries even when they carry a note — only checkpoints count', () => {
    const result = buildFinancialDiary({
      ...empty,
      checkpoints: [
        { id: 'cp1', createdAt: '2027-01-01T00:00:00Z', note: 'original plan', type: 'baseline' },
        { id: 'cp2', createdAt: '2027-01-02T00:00:00Z', note: 'life changed', type: 'replan' },
      ],
    })
    expect(result).toEqual([])
  })

  it('includes a real checkpoint label', () => {
    const result = buildFinancialDiary({
      ...empty,
      checkpoints: [{ id: 'cp1', createdAt: '2027-01-01T00:00:00Z', note: 'just checking in', type: 'checkpoint' }],
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      kind: 'checkpoint',
      id: 'checkpoint-cp1',
      at: '2027-01-01T00:00:00Z',
      note: 'just checking in',
    })
  })

  it('merges all four sources and sorts newest first', () => {
    const result = buildFinancialDiary({
      snapshots: [{ id: 's1', recordedAt: '2027-01-01T00:00:00Z', note: 'balance note', accountId: 'a1' }],
      contributionChanges: [
        {
          id: 'c1',
          createdAt: '2027-03-01T00:00:00Z',
          note: 'contribution note',
          owner: 'person_a',
          potCategory: 'pension',
        },
      ],
      plannedEvents: [
        {
          id: 'e1',
          createdAt: '2027-02-01T00:00:00Z',
          note: 'event note',
          owner: 'joint',
          potCategory: 'cash',
          name: 'House move',
        },
      ],
      checkpoints: [{ id: 'cp1', createdAt: '2027-04-01T00:00:00Z', note: 'checkpoint note', type: 'checkpoint' }],
    })

    expect(result.map((e) => e.kind)).toEqual(['checkpoint', 'contribution_change', 'planned_event', 'balance_update'])
    expect(result.map((e) => e.note)).toEqual(['checkpoint note', 'contribution note', 'event note', 'balance note'])
  })

  it('preserves each source\'s own structured fields for the component to format', () => {
    const result = buildFinancialDiary({
      ...empty,
      plannedEvents: [
        {
          id: 'e1',
          createdAt: '2027-01-01T00:00:00Z',
          note: 'moving cost',
          owner: 'joint',
          potCategory: 'cash',
          name: 'House move',
        },
      ],
    })
    expect(result[0]).toMatchObject({ owner: 'joint', potCategory: 'cash', name: 'House move' })
  })

  it('namespaces ids by source so a snapshot and a contribution change with the same raw id never collide', () => {
    const result = buildFinancialDiary({
      snapshots: [{ id: 'x1', recordedAt: '2027-01-01T00:00:00Z', note: 'a', accountId: 'a1' }],
      contributionChanges: [
        { id: 'x1', createdAt: '2027-01-02T00:00:00Z', note: 'b', owner: 'person_a', potCategory: 'pension' },
      ],
      plannedEvents: [],
      checkpoints: [],
    })
    const ids = result.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
