import type { Alert } from '@/lib/rules'

const styles: Record<string, string> = {
  red: 'bg-red-500/10 border-red-500/30 text-red-300',
  amber: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  green: 'bg-green-500/10 border-green-500/30 text-green-300',
  phase: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
}
const icons: Record<string, string> = { red: '🔴', amber: '🟠', green: '🟢', phase: '⏰' }

export default function AlertBanner({ alert }: { alert: Alert }) {
  return (
    <div className={`border rounded-xl px-4 py-3 text-sm flex items-start gap-2 ${styles[alert.severity] ?? styles.amber}`}>
      <span>{icons[alert.severity]}</span>
      <span>{alert.message}</span>
    </div>
  )
}
