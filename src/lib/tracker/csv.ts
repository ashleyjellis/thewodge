/**
 * The series export, and the parser that reads it back.
 *
 * These two functions are written as a pair and tested as a pair, because the
 * export's whole promise is that it reproduces the series exactly. A published
 * record that cannot be checked against its own export is not much of a
 * record — anyone doubting a figure on the page should be able to download the
 * file, rebuild the series and get the same numbers.
 *
 * ## What round-trips, and what does not
 *
 * The columns mirror `series_cache` exactly: on_date, unit_price_micro,
 * units_micro, value_pence, is_forward_filled. Nothing is rounded on the way
 * out — the integers are the stored integers, so parsing gives back precisely
 * what was exported rather than something that agrees to a few decimal places.
 *
 * SeriesPoint's `isOpening` is deliberately absent, because `series_cache`
 * does not carry it either. The promise this file makes is to reproduce the
 * table; adding a field the table lacks would make that claim fuzzier for the
 * sake of one row.
 *
 * ## The demo marker
 *
 * While the tracker is showing fabricated data, that fact has to survive the
 * file leaving the site — a CSV gets opened in a spreadsheet, pasted into a
 * chat, mailed on. So it is stated twice, in two places that fail differently:
 * a `#` preamble line a person reads at the top of the sheet, and a
 * `demo_data` column on every row that survives someone stripping the
 * comments to make the file parse. Neither alone is enough; a preamble is
 * deleted and a column is not read.
 */

/** One row of the exported series — the shape `series_cache` stores. */
export type SeriesCsvRow = {
  onDate: string
  unitPriceMicro: number
  unitsMicro: number
  valuePence: number
  isForwardFilled: boolean
}

export type SeriesCsvMeta = {
  providerName: string
  providerSlug: string
  portfolioName: string
  portfolioSlug: string
  /** ISO instant the file was generated */
  generatedAt: string
  isDemo: boolean
}

const DATA_COLUMNS = [
  'on_date',
  'unit_price_micro',
  'units_micro',
  'value_pence',
  'is_forward_filled',
] as const

export const DEMO_COLUMN = 'demo_data'

export const DEMO_PREAMBLE =
  '# DEMO DATA: every figure in this file is fabricated. These firms do not exist, no money was invested, and nothing here describes a real product. Do not cite it.'

/**
 * Escapes one field for CSV.
 *
 * Provider and portfolio names are operator-entered and can contain commas
 * and em dashes ("Fully Managed — Balanced"), so the preamble needs this as
 * much as the data rows do.
 */
function escapeField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function toCsv(rows: SeriesCsvRow[], meta: SeriesCsvMeta): string {
  const columns = meta.isDemo ? [...DATA_COLUMNS, DEMO_COLUMN] : [...DATA_COLUMNS]

  const lines = [
    '# The Wodge — portfolio performance export',
    `# provider: ${meta.providerName} (${meta.providerSlug})`,
    `# portfolio: ${meta.portfolioName} (${meta.portfolioSlug})`,
    `# generated: ${meta.generatedAt}`,
    '# unit prices and unit counts are integers scaled by 1,000,000; values are whole pence',
  ]
  if (meta.isDemo) lines.push(DEMO_PREAMBLE)

  lines.push(columns.join(','))

  for (const row of rows) {
    const fields = [
      row.onDate,
      String(row.unitPriceMicro),
      String(row.unitsMicro),
      String(row.valuePence),
      row.isForwardFilled ? 'true' : 'false',
    ]
    if (meta.isDemo) fields.push('TRUE')
    lines.push(fields.map(escapeField).join(','))
  }

  // Trailing newline: a file without one is a nuisance to concatenate, and
  // some tools treat the last line as truncated.
  return lines.join('\n') + '\n'
}

/** Splits one CSV line, honouring quoted fields containing commas. */
function splitLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else inQuotes = false
      } else current += char
    } else if (char === '"') inQuotes = true
    else if (char === ',') {
      fields.push(current)
      current = ''
    } else current += char
  }
  fields.push(current)
  return fields
}

export type ParsedSeriesCsv = {
  rows: SeriesCsvRow[]
  /** true when the file declares itself fabricated, by preamble or column */
  isDemo: boolean
}

/**
 * Reads an exported series back.
 *
 * Columns are located by name rather than by position, so the demo column's
 * presence or absence does not shift the others, and a future column added to
 * the end does not break existing readers.
 *
 * Throws rather than skipping on a malformed row. This parser exists to
 * verify that an export is faithful, and a verifier that quietly drops the
 * rows it cannot read would report success on a file it had mostly ignored.
 */
export function parseSeriesCsv(text: string): ParsedSeriesCsv {
  const lines = text.split(/\r?\n/)
  const preambleDemo = lines.some((line) => line.startsWith('# DEMO DATA'))

  const headerIndex = lines.findIndex((line) => line.trim() !== '' && !line.startsWith('#'))
  if (headerIndex === -1) throw new Error('CSV has no header row')

  const header = splitLine(lines[headerIndex]!)
  const at = (name: string) => header.indexOf(name)
  for (const column of DATA_COLUMNS) {
    if (at(column) === -1) throw new Error(`CSV is missing the ${column} column`)
  }
  const demoIndex = at(DEMO_COLUMN)

  const rows: SeriesCsvRow[] = []
  let columnDemo = false

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i]!
    if (line.trim() === '' || line.startsWith('#')) continue
    const fields = splitLine(line)

    const number = (name: string) => {
      const raw = fields[at(name)]
      const parsed = Number(raw)
      if (raw === undefined || raw === '' || !Number.isFinite(parsed)) {
        throw new Error(`CSV row ${i + 1}: ${name} is not a number (got ${JSON.stringify(raw)})`)
      }
      return parsed
    }

    const onDate = fields[at('on_date')]
    if (!onDate) throw new Error(`CSV row ${i + 1}: on_date is empty`)

    rows.push({
      onDate,
      unitPriceMicro: number('unit_price_micro'),
      unitsMicro: number('units_micro'),
      valuePence: number('value_pence'),
      isForwardFilled: fields[at('is_forward_filled')]?.toLowerCase() === 'true',
    })

    if (demoIndex !== -1 && fields[demoIndex]?.toUpperCase() === 'TRUE') columnDemo = true
  }

  // Either marker is enough. They are separate defences, so treating the file
  // as real because only one survived would defeat the point of having two.
  return { rows, isDemo: preambleDemo || columnDemo }
}
