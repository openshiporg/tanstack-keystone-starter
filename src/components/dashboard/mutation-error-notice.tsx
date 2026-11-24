export function MutationErrorNotice({
  error,
  variant = 'destructive',
}: {
  error: { message: string; details: string | null }
  variant?: 'destructive' | 'neutral'
}) {
  const classes =
    variant === 'destructive'
      ? {
          container:
            'rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive',
          details:
            'mt-2 overflow-auto whitespace-pre-wrap rounded bg-destructive/5 p-2 text-xs text-destructive',
        }
      : {
          container: 'rounded-md border bg-muted/30 p-3 text-sm',
          details:
            'mt-2 overflow-auto whitespace-pre-wrap rounded bg-muted/50 p-2 text-xs',
        }

  return (
    <div
      className={classes.container}
      role={variant === 'destructive' ? 'alert' : 'status'}
      aria-live={variant === 'destructive' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <p>{error.message}</p>
      {error.details ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium">
            Error details
          </summary>
          <pre className={classes.details}>{error.details}</pre>
        </details>
      ) : null}
    </div>
  )
}
