import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-[420px] px-5 py-16">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          the wodge
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          scaffolding check
        </h1>
        <div className="tabular mt-6 text-[56px] font-semibold leading-none tracking-tight">
          £820,000
        </div>
      </div>
    </main>
  )
}
