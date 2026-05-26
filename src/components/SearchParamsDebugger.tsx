import { useCallback, useEffect, useMemo, useState } from 'react'
import * as qs from 'qs'
import type { IStringifyOptions } from 'qs'

// ── Presets ───────────────────────────────────────────────────────────────────

const presets: { label: string; json: unknown }[] = [
  {
    label: 'Simple',
    json: { name: 'John', age: 30 },
  },
  {
    label: 'Nested',
    json: { user: { name: 'Alice', email: 'alice@example.com' } },
  },
  {
    label: 'Arrays',
    json: { tags: ['js', 'ts'], ids: [1, 2, 3] },
  },
  {
    label: 'Complex',
    json: {
      filters: { category: ['books', 'movies'], price: { min: 10, max: 100 } },
      sort: 'asc',
    },
  },
]

// ── QS Option definitions ────────────────────────────────────────────────────

interface OptionDef {
  key: string
  label: string
  description: string
  type: 'select' | 'checkbox'
  choices?: { value: string; label: string }[]
}

const optionDefs: OptionDef[] = [
  {
    key: 'arrayFormat',
    label: 'Array Format',
    description: 'How arrays are serialized.',
    type: 'select',
    choices: [
      { value: 'indices', label: 'indices — a[0]=1&a[1]=2' },
      { value: 'brackets', label: 'brackets — a[]=1&a[]=2' },
      { value: 'repeat', label: 'repeat — a=1&a=2' },
      { value: 'comma', label: 'comma — a=1,2' },
    ],
  },
  {
    key: 'allowDots',
    label: 'Allow Dots',
    description: 'Use dot notation for nested objects (e.g. a.b=c).',
    type: 'checkbox',
  },
  {
    key: 'encode',
    label: 'Encode',
    description: 'URL-encode keys and values.',
    type: 'checkbox',
  },
  {
    key: 'encodeValuesOnly',
    label: 'Encode Values Only',
    description: 'Only encode values, leave keys as-is.',
    type: 'checkbox',
  },
  {
    key: 'charset',
    label: 'Charset',
    description: 'Character encoding used.',
    type: 'select',
    choices: [
      { value: 'utf-8', label: 'utf-8' },
      { value: 'iso-8859-1', label: 'iso-8859-1' },
    ],
  },
  {
    key: 'format',
    label: 'RFC Format',
    description: 'RFC1738 encodes spaces as "+", RFC3986 as "%20".',
    type: 'select',
    choices: [
      { value: 'RFC1738', label: 'RFC1738' },
      { value: 'RFC3986', label: 'RFC3986' },
    ],
  },
  {
    key: 'indices',
    label: 'Indices',
    description: 'Include array indices when using brackets format.',
    type: 'checkbox',
  },
  {
    key: 'strictNullHandling',
    label: 'Strict Null Handling',
    description: 'Distinguish null values from absent keys.',
    type: 'checkbox',
  },
  {
    key: 'allowEmptyArrays',
    label: 'Allow Empty Arrays',
    description: 'Allow [] to be serialized rather than skipped.',
    type: 'checkbox',
  },
  {
    key: 'addQueryPrefix',
    label: 'Add Query Prefix',
    description: 'Prepend "?" to the serialized string.',
    type: 'checkbox',
  },
  {
    key: 'commaRoundTrip',
    label: 'Comma Round Trip',
    description: 'Round-trip comma-separated array values.',
    type: 'checkbox',
  },
]

// ── Default option values ────────────────────────────────────────────────────

const defaultOptions: Record<string, unknown> = {
  arrayFormat: 'indices',
  allowDots: false,
  encode: true,
  encodeValuesOnly: false,
  charset: 'utf-8',
  format: 'RFC3986',
  indices: true,
  strictNullHandling: false,
  allowEmptyArrays: false,
  addQueryPrefix: false,
  commaRoundTrip: false,
}

// ── HTTP methods ─────────────────────────────────────────────────────────────

const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const

// ── Default headers ──────────────────────────────────────────────────────────

const defaultHeaders: { key: string; value: string }[] = [
  { key: 'Content-Type', value: 'application/json' },
]

// ── localStorage helpers ─────────────────────────────────────────────────────

const LS_OPTIONS_KEY = 'gaoling-searchparams-options'
const LS_METHOD_KEY = 'gaoling-searchparams-method'
const LS_HEADERS_KEY = 'gaoling-searchparams-headers'

function loadOptions(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(LS_OPTIONS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return { ...defaultOptions }
}

function saveOptions(opts: Record<string, unknown>) {
  localStorage.setItem(LS_OPTIONS_KEY, JSON.stringify(opts))
}

function loadMethod(): string {
  return localStorage.getItem(LS_METHOD_KEY) ?? 'GET'
}

function saveMethod(method: string) {
  localStorage.setItem(LS_METHOD_KEY, method)
}

function loadHeaders(): { key: string; value: string }[] {
  try {
    const raw = localStorage.getItem(LS_HEADERS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return [...defaultHeaders]
}

function saveHeaders(headers: { key: string; value: string }[]) {
  localStorage.setItem(LS_HEADERS_KEY, JSON.stringify(headers))
}

function buildQsOptions(raw: Record<string, unknown>): IStringifyOptions {
  const result: IStringifyOptions = {}
  for (const def of optionDefs) {
    const val = raw[def.key]
    if (val !== undefined && val !== null && val !== '') {
      if (def.type === 'select') {
        ;(result as Record<string, unknown>)[def.key] = val
      } else {
        ;(result as Record<string, unknown>)[def.key] = Boolean(val)
      }
    }
  }
  return result
}

// ── Request result type ──────────────────────────────────────────────────────

interface RequestResult {
  method: string
  url: string
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  duration: number
  error?: string
}

// ── Component ────────────────────────────────────────────────────────────────

export function SearchParamsDebugger() {
  const [jsonText, setJsonText] = useState(() =>
    JSON.stringify(presets[0].json, null, 2),
  )
  const [url, setUrl] = useState('')
  const [options, setOptions] =
    useState<Record<string, unknown>>(loadOptions)
  const [method, setMethod] = useState<string>(loadMethod)
  const [headers, setHeaders] =
    useState<{ key: string; value: string }[]>(loadHeaders)
  const [result, setResult] = useState<RequestResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [jsonError, setJsonError] = useState<string | null>(null)

  // Persist on change
  useEffect(() => {
    saveOptions(options)
  }, [options])

  useEffect(() => {
    saveMethod(method)
  }, [method])

  useEffect(() => {
    saveHeaders(headers)
  }, [headers])

  const parsedJson = useMemo(() => {
    try {
      return JSON.parse(jsonText) as unknown
    } catch {
      return null
    }
  }, [jsonText])

  const serialized = useMemo(() => {
    if (!parsedJson) return ''
    const qsOptions = buildQsOptions(options)
    return qs.stringify(parsedJson, qsOptions)
  }, [parsedJson, options])

  const handleJsonChange = useCallback(
    (value: string) => {
      setJsonText(value)
      try {
        JSON.parse(value)
        setJsonError(null)
      } catch (e) {
        setJsonError((e as Error).message)
      }
    },
    [],
  )

  const applyPreset = useCallback((preset: (typeof presets)[number]) => {
    setJsonText(JSON.stringify(preset.json, null, 2))
    setJsonError(null)
  }, [])

  const handleOptionChange = useCallback(
    (key: string, value: string | boolean) => {
      setOptions((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const sendRequest = useCallback(async () => {
    if (!parsedJson || !url) return
    setLoading(true)
    setResult(null)

    const qsOptions = buildQsOptions(options)
    const queryString = qs.stringify(parsedJson, qsOptions)
    const separator = url.includes('?') ? '&' : '?'
    const fullUrl = `${url}${separator}${queryString}`

    const fetchHeaders: Record<string, string> = {}
    for (const h of headers) {
      if (h.key.trim()) {
        fetchHeaders[h.key.trim()] = h.value
      }
    }

    const start = performance.now()
    try {
      const response = await fetch(fullUrl, {
        method,
        headers: fetchHeaders,
      })
      const duration = Math.round(performance.now() - start)
      const resHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        resHeaders[key] = value
      })
      const body = await response.text()
      setResult({
        method,
        url: fullUrl,
        status: response.status,
        statusText: response.statusText,
        headers: resHeaders,
        body,
        duration,
      })
    } catch (err) {
      const duration = Math.round(performance.now() - start)
      setResult({
        method,
        url: fullUrl,
        status: 0,
        statusText: 'Network Error',
        headers: {},
        body: '',
        duration,
        error: (err as Error).message,
      })
    } finally {
      setLoading(false)
    }
  }, [parsedJson, url, options, method, headers])

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* ── JSON Input + Options ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: JSON */}
        <section className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">JSON Payload</h2>
            <div className="flex gap-2">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="text-xs px-2.5 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={jsonText}
            onChange={(e) => handleJsonChange(e.target.value)}
            rows={12}
            className="w-full h-48 font-mono text-sm border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
            placeholder='{"key": "value"}'
          />
          {jsonError && (
            <p className="text-xs text-red-500">Invalid JSON: {jsonError}</p>
          )}
          <div className="bg-gray-50 rounded p-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Serialized Query String
            </p>
            <code className="text-sm text-gray-700 break-all block">
              {serialized || '—'}
            </code>
          </div>
          <div className="bg-gray-50 rounded p-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Human-Readable Query String
            </p>
            <code className="text-sm text-gray-700 break-all block">
              {decodeURIComponent(serialized) || '—'}
            </code>
          </div>
        </section>

        {/* Right: QS Options */}
        <section className="bg-white rounded-lg border border-gray-200 py-5 space-y-3">
          <div className="flex items-center px-5">
            <h2 className="font-semibold text-gray-800">QS Options</h2>
            <button
              type="button"
              onClick={() => {
                const qsOptions = buildQsOptions(options)
                navigator.clipboard.writeText(JSON.stringify(qsOptions))
              }}
              className="text-xs px-2.5 py-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors cursor-pointer ml-auto"
            >
              Export
            </button>
            <button
              type="button"
              onClick={() => {
                setOptions({ ...defaultOptions })
              }}
              className="text-xs px-2.5 py-1 rounded bg-red-100 text-gray-500 hover:bg-gray-200 transition-colors cursor-pointer ml-2"
            >
              Reset
            </button>
          </div>
          <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
            {optionDefs.map((def) => (
              <div key={def.key} className="flex items-start gap-3 px-5">
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor={`opt-${def.key}`}
                    className="text-sm font-medium text-gray-700"
                  >
                    {def.label}
                  </label>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {def.description}
                  </p>
                </div>
                <div className="shrink-0 mt-0.5">
                  {def.type === 'select' ? (
                    <select
                      id={`opt-${def.key}`}
                      value={String(options[def.key] ?? '')}
                      onChange={(e) =>
                        handleOptionChange(def.key, e.target.value)
                      }
                      className="text-sm border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {def.choices?.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`opt-${def.key}`}
                      type="checkbox"
                      checked={Boolean(options[def.key])}
                      onChange={(e) =>
                        handleOptionChange(def.key, e.target.checked)
                      }
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Request Config ─────────────────────────────────────────── */}
      <section className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">Request</h2>

        {/* Method + URL */}
        <div className="flex gap-3 items-start">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {httpMethods.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/api/search"
            className="flex-1 text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
          />
          <button
            type="button"
            disabled={!parsedJson || !url || loading}
            onClick={sendRequest}
            className="shrink-0 px-5 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {loading ? 'Sending...' : 'Send Request'}
          </button>
        </div>

        {/* Headers */}
        <details className="group">
          <summary className="text-xs text-gray-400 uppercase tracking-wide cursor-pointer select-none">
            Request Headers ({headers.filter((h) => h.key.trim()).length})
          </summary>
          <div className="mt-3 space-y-2">
            {headers.map((h, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={h.key}
                  onChange={(e) => {
                    const next = [...headers]
                    next[i] = { ...next[i], key: e.target.value }
                    setHeaders(next)
                  }}
                  placeholder="Header name"
                  className="w-48 text-sm font-mono border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={h.value}
                  onChange={(e) => {
                    const next = [...headers]
                    next[i] = { ...next[i], value: e.target.value }
                    setHeaders(next)
                  }}
                  placeholder="Value"
                  className="flex-1 text-sm font-mono border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setHeaders(headers.filter((_, j) => j !== i))}
                  className="shrink-0 text-xs px-2 py-1.5 rounded text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                  title="Remove header"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setHeaders([...headers, { key: '', value: '' }])}
              className="text-xs px-2.5 py-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors cursor-pointer"
            >
              + Add Header
            </button>
          </div>
        </details>
      </section>

      {/* ── Results ────────────────────────────────────────────────── */}
      {result && (
        <section className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Response</h2>

          {/* Meta */}
          <div className="flex flex-wrap gap-4 text-sm">
            <StatusBadge status={result.status} />
            <span className="text-gray-500">
              {result.duration}ms
            </span>
            {result.error && (
              <span className="text-red-500">{result.error}</span>
            )}
          </div>

          {/* Request URL */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Request
            </p>
            <code className="text-sm text-gray-700 break-all block bg-gray-50 rounded p-2">
              <span className="font-semibold text-blue-600">{result.method}</span>{' '}
              {result.url}
            </code>
          </div>

          {/* Response Headers */}
          <details>
            <summary className="text-xs text-gray-400 uppercase tracking-wide cursor-pointer select-none">
              Response Headers
            </summary>
            <pre className="mt-2 text-xs bg-gray-50 rounded p-3 overflow-x-auto">
              {JSON.stringify(result.headers, null, 2)}
            </pre>
          </details>

          {/* Response Body */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Response Body
            </p>
            <pre className="text-sm bg-gray-50 rounded p-3 overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap break-all">
              {formatBody(result.body, result.headers['content-type'])}
            </pre>
          </div>
        </section>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: number }) {
  const color =
    status >= 200 && status < 300
      ? 'bg-green-100 text-green-700'
      : status >= 400
        ? 'bg-red-100 text-red-700'
        : status === 0
          ? 'bg-red-100 text-red-700'
          : 'bg-yellow-100 text-yellow-700'

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {status || 'ERR'} {status ? statusText(status) : ''}
    </span>
  )
}

function statusText(code: number): string {
  const map: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    500: 'Internal Server Error',
  }
  return map[code] ?? ''
}

function formatBody(body: string, contentType: string | undefined): string {
  if (!body) return '(empty)'
  if (contentType?.includes('application/json')) {
    try {
      return JSON.stringify(JSON.parse(body), null, 2)
    } catch {
      return body
    }
  }
  return body
}
