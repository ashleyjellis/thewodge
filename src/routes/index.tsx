import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { getStore } from '@/lib/store'
import { starterHousehold } from '@/lib/sampleHousehold'
import { BenchmarkHook } from '@/components/landing/BenchmarkHook'
import { NotAdviceLine, Wordmark } from '@/components/brand'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const navigate = useNavigate()

  const onContinue = ({ age, invested }: { age: number; invested: number }) => {
    // seed the forecast from the landing inputs; financials stay local.
    getStore().saveHousehold(starterHousehold(age, invested))
    void navigate({ to: '/signup' })
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-[420px] px-5 pb-40 pt-10">
        <div className="flex items-center justify-between">
          <Wordmark />
        </div>

        <div className="mt-12">
          <h1 className="text-[34px] font-semibold leading-[1.1] tracking-tight">
            You’re doing better than you think.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            A confidence instrument for people who feel rich on paper and anxious
            in reality. No verdicts, no products — just the maths on your own
            numbers, and the one thing nobody gives you: a benchmark.
          </p>
        </div>

        <div className="mt-8">
          <BenchmarkHook onContinue={onContinue} />
        </div>

        <div className="mt-8">
          <NotAdviceLine />
        </div>
      </div>
    </main>
  )
}
