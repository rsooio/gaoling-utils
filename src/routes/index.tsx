import { createFileRoute } from '@tanstack/react-router'
import { SearchParamsDebugger } from '#/components/SearchParamsDebugger'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Gaoling Utils</h1>
          <span className="text-sm text-gray-500">Search Params Debugger</span>
        </div>
      </header>
      <main>
        <SearchParamsDebugger />
      </main>
    </div>
  )
}
