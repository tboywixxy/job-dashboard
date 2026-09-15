export function Skeleton({ className = "h-4 w-24", label = "Loading" }: { className?: string; label?: string }) {
  return <span role="status" aria-label={label} className={`skeleton ${className}`}><span className="sr-only">{label}</span></span>;
}

export function WorkspaceSkeleton() {
  return <main className="login-screen"><div className="surface w-full max-w-md space-y-6 p-8" aria-busy="true"><Skeleton label="Loading workspace" className="h-8 w-48" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-11 w-full" /></div></main>;
}
