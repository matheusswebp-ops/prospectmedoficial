import { Stethoscope } from 'lucide-react'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground shadow-md">
          <Stethoscope className="w-6 h-6" />
        </div>
        <span className="text-2xl font-bold tracking-tight text-foreground">
          ProspectMed
        </span>
        <span className="text-sm text-muted-foreground">
          Prospecção médica automatizada
        </span>
      </div>

      {children}
    </div>
  )
}
