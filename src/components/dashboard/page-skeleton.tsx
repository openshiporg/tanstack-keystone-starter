import { PageContainer } from './page-container'

function Bar({ className }: { className: string }) {
  return (
    <div
      className={`animate-pulse rounded-[6px] bg-[var(--ks-hover)] ${className}`}
    />
  )
}

const widths = [
  'w-2/5',
  'w-1/3',
  'w-1/2',
  'w-1/4',
  'w-2/5',
  'w-1/3',
  'w-1/2',
  'w-1/4',
]

/** PageSkeleton: list-shaped placeholder shown while an admin route's loader is pending. */
export function PageSkeleton() {
  return (
    <PageContainer title="Loading" breadcrumbs={[{ type: 'page', label: '' }]}>
      <div role="status" aria-label="Loading" className="flex flex-col">
        <div className="px-4 pt-5 pb-1 md:px-6 md:pt-6">
          <Bar className="h-6 w-40" />
        </div>
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 md:px-6">
          <Bar className="h-8 flex-1 md:max-w-[420px]" />
          <Bar className="ml-auto h-8 w-24 max-md:hidden" />
        </div>
        <div className="border-y border-[var(--ks-line)] md:mx-6 md:rounded-[12px] md:border md:bg-[var(--ks-surface)] md:shadow-[var(--ks-card-shadow)]">
          {widths.map((width, index) => (
            <div
              key={index}
              className="flex h-11 items-center gap-4 border-b border-[var(--ks-line)] px-4 last:border-b-0"
            >
              <Bar className="size-4" />
              <Bar className={`h-3 ${width}`} />
              <Bar className="ml-auto h-3 w-16 max-sm:hidden" />
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  )
}
