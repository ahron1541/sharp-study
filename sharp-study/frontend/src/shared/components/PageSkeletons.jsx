const shimmer = 'sharp-skeleton-shimmer';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function SkeletonBlock({ className = '' }) {
  return <div className={cx(shimmer, className)} aria-hidden="true" />;
}

function SkeletonLine({ className = 'h-3 w-24 rounded-full' }) {
  return <SkeletonBlock className={className} />;
}

function SkeletonIcon({ className = 'h-12 w-12 rounded-2xl' }) {
  return <SkeletonBlock className={className} />;
}

function SkeletonButton({ className = 'h-12 w-36 rounded-2xl' }) {
  return <SkeletonBlock className={className} />;
}

export function RouteProgressBar() {
  return (
    <div className="h-1 overflow-hidden bg-[color:var(--color-surface-2)]" aria-hidden="true">
      <div className="sharp-route-progress h-full w-1/3 rounded-full bg-[color:var(--color-accent)]" />
    </div>
  );
}

function PageFrame({ children, className = 'max-w-7xl', label = 'Loading page' }) {
  return (
    <main className={cx('mx-auto w-full space-y-8 px-4 py-6 sm:px-6 lg:px-8', className)} aria-busy="true" aria-label={label}>
      {children}
    </main>
  );
}

function HeroSkeleton({ actions = true, compact = false }) {
  return (
    <section className="rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-6 shadow-card sm:px-8 sm:py-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-4">
          <SkeletonLine className="h-3 w-28 rounded-full" />
          <SkeletonLine className={cx('rounded-2xl', compact ? 'h-9 w-[min(28rem,80vw)]' : 'h-12 w-[min(34rem,80vw)]')} />
          <div className="space-y-2">
            <SkeletonLine className="h-4 w-[min(40rem,76vw)] rounded-full" />
            <SkeletonLine className="h-4 w-[min(28rem,60vw)] rounded-full" />
          </div>
        </div>
        {actions ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <SkeletonButton className="h-12 w-36 rounded-2xl" />
            <SkeletonButton className="h-12 w-32 rounded-2xl" />
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function LandingPageSkeleton() {
  return (
    <div className="min-h-screen bg-[color:var(--color-bg)]" aria-busy="true" aria-label="Loading landing page">
      <RouteProgressBar />
      <header className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]/95">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <SkeletonLine className="h-10 w-32 rounded-2xl" />
          <div className="flex items-center gap-3">
            <SkeletonIcon className="h-9 w-9 rounded-full" />
            <SkeletonButton className="h-9 w-24 rounded-full" />
            <SkeletonButton className="h-9 w-28 rounded-full" />
          </div>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100svh-4rem)] max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.9fr)] lg:px-8">
        <section className="space-y-7">
          <SkeletonLine className="h-10 w-[min(30rem,80vw)] rounded-full" />
          <div className="space-y-4">
            <SkeletonLine className="h-16 w-[min(36rem,84vw)] rounded-2xl" />
            <SkeletonLine className="h-16 w-[min(28rem,72vw)] rounded-2xl" />
            <SkeletonLine className="h-16 w-[min(20rem,64vw)] rounded-2xl" />
          </div>
          <div className="space-y-3">
            <SkeletonLine className="h-4 w-[min(36rem,82vw)] rounded-full" />
            <SkeletonLine className="h-4 w-[min(30rem,72vw)] rounded-full" />
            <SkeletonLine className="h-4 w-[min(24rem,64vw)] rounded-full" />
          </div>
          <SkeletonButton className="h-[3.25rem] w-44 rounded-full" />
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2].map((item) => <SkeletonLine key={item} className="h-10 w-28 rounded-full" />)}
          </div>
        </section>

        <section className="relative mx-auto h-[min(22rem,62vw)] w-full max-w-xl">
          <SkeletonLine className="absolute right-0 top-8 h-64 w-[86%] rounded-[1.5rem]" />
          <SkeletonLine className="absolute left-0 top-0 h-64 w-[86%] rounded-[1.5rem]" />
        </section>
      </main>
    </div>
  );
}

export function AuthPageSkeleton({ label = 'Loading account page' }) {
  return (
    <div className="min-h-screen bg-[color:var(--color-bg)]" aria-busy="true" aria-label={label}>
      <RouteProgressBar />
      <main className="grid min-h-[calc(100svh-0.25rem)] place-items-center px-4 py-6">
        <section className="grid w-full max-w-6xl overflow-hidden rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-card lg:grid-cols-[1.08fr_0.92fr]">
          <div className="hidden min-h-[34rem] bg-[color:var(--color-surface-2)] p-8 lg:block">
            <SkeletonLine className="h-full w-full rounded-[1.25rem]" />
          </div>
          <div className="flex min-h-[34rem] flex-col p-6 sm:p-8 lg:p-12">
            <SkeletonIcon className="h-10 w-10 rounded-xl" />
            <div className="mx-auto mt-auto w-full max-w-md space-y-5 pb-4 pt-8">
              <div className="mx-auto flex justify-center gap-3">
                <SkeletonButton className="h-11 w-28 rounded-full" />
                <SkeletonButton className="h-11 w-28 rounded-full" />
              </div>
              <div className="space-y-3 text-center">
                <SkeletonLine className="mx-auto h-8 w-48 rounded-2xl" />
                <SkeletonLine className="mx-auto h-4 w-64 rounded-full" />
              </div>
              <div className="space-y-4">
                <SkeletonLine className="h-12 w-full rounded-full" />
                <SkeletonLine className="h-12 w-full rounded-full" />
                <SkeletonLine className="h-4 w-2/3 rounded-full" />
                <SkeletonButton className="ml-auto h-12 w-40 rounded-full" />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export function LegalPageSkeleton() {
  return (
    <div className="min-h-screen bg-[color:var(--color-bg)]" aria-busy="true" aria-label="Loading policy page">
      <RouteProgressBar />
      <header className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <SkeletonLine className="h-10 w-32 rounded-2xl" />
          <SkeletonButton className="h-9 w-28 rounded-full" />
        </div>
      </header>
      <PageFrame className="max-w-4xl" label="Loading policy content">
        <section className="space-y-4">
          <SkeletonLine className="h-12 w-72 rounded-2xl" />
          <SkeletonLine className="h-4 w-40 rounded-full" />
          <SkeletonLine className="h-4 w-full rounded-full" />
          <SkeletonLine className="h-4 w-4/5 rounded-full" />
        </section>
        {[0, 1, 2, 3].map((section) => (
          <section key={section} className="rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-card">
            <SkeletonLine className="h-7 w-48 rounded-2xl" />
            <div className="mt-5 space-y-3">
              <SkeletonLine className="h-4 w-full rounded-full" />
              <SkeletonLine className="h-4 w-11/12 rounded-full" />
              <SkeletonLine className="h-4 w-5/6 rounded-full" />
            </div>
          </section>
        ))}
      </PageFrame>
    </div>
  );
}

function MaterialTileSkeleton({ compact = false }) {
  return (
    <article className="rounded-[1.8rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-5">
      <div className="flex items-start justify-between gap-3">
        <SkeletonIcon className="h-11 w-11 rounded-2xl" />
        <div className="flex gap-2">
          <SkeletonIcon className="h-8 w-8 rounded-xl" />
          <SkeletonIcon className="h-8 w-8 rounded-xl" />
        </div>
      </div>
      <div className="mt-5 space-y-3">
        <SkeletonLine className="h-3 w-28 rounded-full" />
        <SkeletonLine className="h-5 w-4/5 rounded-full" />
        {!compact ? <SkeletonLine className="h-5 w-2/3 rounded-full" /> : null}
      </div>
      <div className="mt-5 flex items-center justify-between gap-4">
        <SkeletonLine className="h-3 w-24 rounded-full" />
        <SkeletonLine className="h-3 w-14 rounded-full" />
      </div>
    </article>
  );
}

function MaterialTypeTabsSkeleton() {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-[1.8rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-5">
          <div className="flex items-center gap-4">
            <SkeletonIcon className="h-12 w-12 rounded-2xl" />
            <div className="space-y-2">
              <SkeletonLine className="h-7 w-10 rounded-full" />
              <SkeletonLine className="h-4 w-24 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

export function DashboardSkeleton() {
  return (
    <PageFrame label="Loading dashboard">
      <HeroSkeleton />

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.9fr)]">
        <div className="rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-card">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-3">
              <SkeletonLine className="h-3 w-28 rounded-full" />
              <SkeletonLine className="h-8 w-64 rounded-2xl" />
            </div>
            <SkeletonLine className="h-4 w-16 rounded-full" />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[0, 1].map((item) => (
              <div key={item} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-[1.8rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-5">
                <SkeletonIcon className="h-14 w-14 rounded-2xl" />
                <div className="space-y-3">
                  <SkeletonLine className="h-5 w-32 rounded-full" />
                  <SkeletonLine className="h-4 w-44 rounded-full" />
                  <SkeletonLine className="h-4 w-28 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-3">
              <SkeletonLine className="h-3 w-28 rounded-full" />
              <div className="flex items-end gap-2">
                <SkeletonLine className="h-12 w-16 rounded-2xl" />
                <SkeletonLine className="h-4 w-12 rounded-full" />
              </div>
            </div>
            <SkeletonIcon className="h-14 w-14 rounded-3xl" />
          </div>
          <div className="mt-5 space-y-3">
            <SkeletonLine className="h-4 w-full rounded-full" />
            <SkeletonLine className="h-4 w-4/5 rounded-full" />
            <div className="flex gap-2 pt-2">
              {[0, 1, 2, 3, 4, 5, 6].map((item) => (
                <SkeletonLine key={item} className="h-2 flex-1 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </section>

      {[0, 1, 2].map((section) => (
        <section key={section} className="rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-card sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <SkeletonIcon className="h-11 w-11 rounded-2xl" />
              <div className="space-y-2">
                <SkeletonLine className="h-6 w-36 rounded-full" />
                <SkeletonLine className="h-4 w-24 rounded-full" />
              </div>
            </div>
            <SkeletonLine className="h-4 w-14 rounded-full" />
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((item) => <MaterialTileSkeleton key={item} compact />)}
          </div>
        </section>
      ))}
    </PageFrame>
  );
}

export function MaterialCollectionSkeleton({ archive = false }) {
  return (
    <PageFrame label={archive ? 'Loading archive' : 'Loading library'}>
      <HeroSkeleton actions={!archive} />
      <MaterialTypeTabsSkeleton />
      <section className="rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <SkeletonLine className="h-3 w-24 rounded-full" />
            <SkeletonLine className="h-8 w-44 rounded-2xl" />
            <SkeletonLine className="h-4 w-[min(34rem,70vw)] rounded-full" />
          </div>
          <SkeletonButton className="h-12 w-full max-w-md rounded-2xl" />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => <MaterialTileSkeleton key={index} />)}
        </div>
      </section>
    </PageFrame>
  );
}

export function StudyGuidePageSkeleton() {
  return (
    <PageFrame label="Loading study guide">
      <HeroSkeleton actions={false} compact />
      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <SkeletonLine className="h-4 w-24 rounded-full" />
            <SkeletonIcon className="h-9 w-9 rounded-xl" />
          </div>
          <div className="mt-5 space-y-3">
            {[0, 1, 2, 3, 4].map((item) => (
              <div key={item} className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3">
                <SkeletonLine className="h-4 w-4/5 rounded-full" />
                <SkeletonLine className="mt-2 h-3 w-1/2 rounded-full" />
              </div>
            ))}
          </div>
        </aside>

        <article className="rounded-[2.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-card sm:p-8">
          <SkeletonLine className="h-11 w-2/3 rounded-2xl" />
          <div className="mt-8 space-y-4">
            <SkeletonLine className="h-8 w-44 rounded-2xl" />
            {[0, 1, 2].map((item) => (
              <SkeletonLine key={item} className="h-4 w-full rounded-full" />
            ))}
            <SkeletonLine className="h-4 w-4/5 rounded-full" />
          </div>
          <div className="mt-10 space-y-4">
            <SkeletonLine className="h-8 w-56 rounded-2xl" />
            {[0, 1, 2, 3].map((item) => (
              <SkeletonLine key={item} className="h-4 w-full rounded-full" />
            ))}
          </div>
        </article>
      </div>
    </PageFrame>
  );
}

export function StudyGuideEditorSkeleton() {
  return (
    <PageFrame className="max-w-6xl" label="Loading study guide editor">
      <HeroSkeleton actions={false} compact />
      <section className="rounded-[2.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-card sm:p-5">
        <div className="space-y-3">
          <SkeletonLine className="h-9 w-64 rounded-2xl" />
          <SkeletonLine className="h-4 w-[min(42rem,75vw)] rounded-full" />
        </div>
        <div className="mt-6 rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
          <div className="border-b border-[color:var(--color-border)] p-4">
            <div className="flex flex-wrap items-center gap-3">
              <SkeletonButton className="h-10 w-36 rounded-2xl" />
              <SkeletonButton className="h-10 w-40 rounded-2xl" />
              <SkeletonButton className="h-10 w-32 rounded-2xl" />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {Array.from({ length: 10 }).map((_, index) => <SkeletonIcon key={index} className="h-10 w-10 rounded-2xl" />)}
            </div>
          </div>
          <div className="p-5 sm:p-8">
            <div className="rounded-[2rem] border border-[color:var(--color-border)] p-6">
              <SkeletonLine className="h-8 w-2/3 rounded-2xl" />
              <div className="mt-8 space-y-4">
                {[0, 1, 2, 3, 4, 5].map((item) => <SkeletonLine key={item} className="h-4 w-full rounded-full" />)}
              </div>
              <SkeletonLine className="mt-10 h-8 w-52 rounded-2xl" />
              <div className="mt-6 space-y-4">
                {[0, 1, 2].map((item) => <SkeletonLine key={item} className="h-4 w-full rounded-full" />)}
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageFrame>
  );
}

export function FlashcardsPageSkeleton() {
  return (
    <PageFrame label="Loading flashcards">
      <HeroSkeleton actions={false} compact />
      <section className="rounded-[2.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <SkeletonLine className="h-3 w-28 rounded-full" />
            <SkeletonLine className="h-9 w-[min(34rem,74vw)] rounded-2xl" />
            <SkeletonLine className="h-4 w-[min(30rem,66vw)] rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((item) => (
              <div key={item} className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3">
                <SkeletonLine className="h-6 w-12 rounded-full" />
                <SkeletonLine className="mt-2 h-3 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-h-[34rem] rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-card">
          <div className="flex items-center justify-between gap-4">
            <SkeletonLine className="h-5 w-36 rounded-full" />
            <SkeletonButton className="h-10 w-28 rounded-2xl" />
          </div>
          <div className="mx-auto mt-20 max-w-2xl rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-8">
            <SkeletonLine className="h-6 w-3/4 rounded-2xl" />
            <div className="mt-8 space-y-4">
              <SkeletonLine className="h-4 w-full rounded-full" />
              <SkeletonLine className="h-4 w-5/6 rounded-full" />
            </div>
          </div>
        </div>
        <aside className="rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-card">
          <SkeletonLine className="h-5 w-32 rounded-full" />
          <div className="mt-5 space-y-3">
            {[0, 1, 2].map((item) => <SkeletonLine key={item} className="h-16 w-full rounded-2xl" />)}
          </div>
        </aside>
      </section>
    </PageFrame>
  );
}

export function FlashcardsBuilderSkeleton() {
  return (
    <PageFrame label="Loading flashcard editor">
      <HeroSkeleton actions={false} compact />
      <section className="rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-card sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-4">
            <SkeletonLine className="h-12 w-full rounded-2xl" />
            <SkeletonLine className="h-28 w-full rounded-2xl" />
          </div>
          <div className="space-y-3">
            <SkeletonButton className="h-12 w-full rounded-2xl" />
            <SkeletonButton className="h-12 w-full rounded-2xl" />
          </div>
        </div>
      </section>
      <section className="grid gap-4">
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-card">
            <div className="flex items-start gap-4">
              <SkeletonIcon className="h-10 w-10 rounded-2xl" />
              <div className="min-w-0 flex-1 space-y-3">
                <SkeletonLine className="h-5 w-4/5 rounded-full" />
                <SkeletonLine className="h-4 w-full rounded-full" />
                <SkeletonLine className="h-4 w-2/3 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </section>
    </PageFrame>
  );
}

export function QuizPageSkeleton() {
  return (
    <PageFrame label="Loading quiz">
      <HeroSkeleton actions={false} compact />
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.6fr)]">
        <div className="space-y-5">
          <section className="rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-card">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <SkeletonIcon className="h-9 w-9 rounded-2xl" />
                <SkeletonLine className="h-8 w-32 rounded-2xl" />
              </div>
              <SkeletonIcon className="h-12 w-12 rounded-3xl" />
            </div>
            <div className="mt-6 rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4">
              <SkeletonLine className="h-5 w-24 rounded-full" />
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[0, 1, 2, 3].map((item) => <SkeletonLine key={item} className="h-20 rounded-2xl" />)}
              </div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <SkeletonLine className="h-36 rounded-[1.5rem]" />
              <SkeletonLine className="h-36 rounded-[1.5rem]" />
              <SkeletonLine className="h-32 rounded-[1.5rem]" />
            </div>
          </section>
        </div>
        <aside className="space-y-5">
          <section className="rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-card">
            <SkeletonLine className="h-8 w-44 rounded-2xl" />
            <div className="mt-5 space-y-3">
              <SkeletonLine className="h-4 w-full rounded-full" />
              <SkeletonLine className="h-4 w-4/5 rounded-full" />
            </div>
            <SkeletonButton className="mt-7 h-14 w-full rounded-2xl" />
          </section>
          <section className="rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <SkeletonLine className="h-8 w-52 rounded-2xl" />
              <SkeletonLine className="h-7 w-16 rounded-full" />
            </div>
            <div className="mt-5 rounded-[1.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="space-y-3">
                  <SkeletonLine className="h-5 w-48 rounded-full" />
                  <SkeletonLine className="h-4 w-32 rounded-full" />
                  <SkeletonLine className="h-7 w-14 rounded-full" />
                </div>
                <SkeletonLine className="h-14 w-20 rounded-2xl" />
              </div>
            </div>
          </section>
        </aside>
      </section>
    </PageFrame>
  );
}

export function QuizBuilderSkeleton() {
  return (
    <PageFrame className="max-w-6xl" label="Loading quiz builder">
      <HeroSkeleton actions={false} compact />
      <section className="rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1 space-y-3">
            <SkeletonLine className="h-10 w-32 rounded-2xl" />
            <SkeletonLine className="h-8 w-64 rounded-2xl" />
            <SkeletonLine className="h-4 w-[min(40rem,70vw)] rounded-full" />
          </div>
          <SkeletonButton className="h-12 w-40 rounded-2xl" />
        </div>
      </section>
      <section className="grid gap-4">
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-card">
            <div className="flex items-start gap-4">
              <SkeletonIcon className="h-10 w-10 rounded-2xl" />
              <div className="min-w-0 flex-1 space-y-4">
                <SkeletonLine className="h-12 w-full rounded-2xl" />
                <div className="grid gap-3 md:grid-cols-2">
                  {[0, 1, 2, 3].map((choice) => <SkeletonLine key={choice} className="h-11 rounded-xl" />)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>
    </PageFrame>
  );
}

export function SettingsSkeleton() {
  return (
    <PageFrame label="Loading settings">
      <section className="space-y-4">
        <SkeletonLine className="h-12 w-56 rounded-2xl" />
        <SkeletonLine className="h-4 w-[min(34rem,72vw)] rounded-full" />
      </section>

      <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-8">
          <div className="flex flex-wrap gap-4">
            {[0, 1].map((item) => (
              <div key={item} className="flex min-w-56 items-center gap-3 rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-4">
                <SkeletonIcon className="h-10 w-10 rounded-2xl" />
                <div className="space-y-2">
                  <SkeletonLine className="h-4 w-32 rounded-full" />
                  <SkeletonLine className="h-3 w-24 rounded-full" />
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-[2.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-card sm:p-8">
            <div className="space-y-4">
              <SkeletonLine className="h-8 w-52 rounded-2xl" />
              <SkeletonLine className="h-4 w-[min(40rem,76vw)] rounded-full" />
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {[0, 1, 2, 3].map((item) => (
                <SkeletonLine key={item} className="h-24 rounded-[1.5rem]" />
              ))}
            </div>
            <div className="mt-8 space-y-4">
              <SkeletonLine className="h-5 w-36 rounded-full" />
              <SkeletonLine className="h-12 w-full rounded-2xl" />
              <SkeletonLine className="h-12 w-full rounded-2xl" />
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-[2.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-5">
            <div className="rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
              <SkeletonLine className="h-7 w-36 rounded-2xl" />
              <div className="mt-5 space-y-3">
                <SkeletonLine className="h-4 w-full rounded-full" />
                <SkeletonLine className="h-4 w-4/5 rounded-full" />
              </div>
              <SkeletonButton className="mt-6 h-11 w-full rounded-2xl" />
            </div>
          </div>
          <SkeletonLine className="h-36 rounded-[2rem]" />
        </aside>
      </section>
    </PageFrame>
  );
}

function routeVariantFromPath(pathname = '') {
  if (pathname === '/') return 'landing';
  if (pathname.startsWith('/login')) return 'auth';
  if (pathname.startsWith('/register')) return 'auth';
  if (pathname.startsWith('/forgot-password')) return 'auth';
  if (pathname.startsWith('/privacy')) return 'legal';
  if (pathname.startsWith('/terms')) return 'legal';
  if (pathname.startsWith('/library')) return 'library';
  if (pathname.startsWith('/archive')) return 'archive';
  if (pathname.startsWith('/settings')) return 'settings';
  if (pathname.startsWith('/study-guide/new')) return 'study-guide-editor';
  if (pathname.startsWith('/study-guide/')) return 'study-guide';
  if (pathname.startsWith('/flashcards/new') || (pathname.includes('/flashcards/') && pathname.endsWith('/edit'))) return 'flashcards-builder';
  if (pathname.startsWith('/flashcards/')) return 'flashcards';
  if (pathname.startsWith('/quiz/new') || (pathname.includes('/quiz/') && pathname.endsWith('/edit'))) return 'quiz-builder';
  if (pathname.startsWith('/quiz/')) return 'quiz';
  return 'dashboard';
}

export function SkeletonForRoute({ pathname = '', variant }) {
  const resolved = variant || routeVariantFromPath(pathname);
  if (resolved === 'landing') return <LandingPageSkeleton />;
  if (resolved === 'auth') return <AuthPageSkeleton />;
  if (resolved === 'legal') return <LegalPageSkeleton />;
  if (resolved === 'library') return <MaterialCollectionSkeleton />;
  if (resolved === 'archive') return <MaterialCollectionSkeleton archive />;
  if (resolved === 'settings') return <SettingsSkeleton />;
  if (resolved === 'study-guide') return <StudyGuidePageSkeleton />;
  if (resolved === 'study-guide-editor') return <StudyGuideEditorSkeleton />;
  if (resolved === 'flashcards') return <FlashcardsPageSkeleton />;
  if (resolved === 'flashcards-builder') return <FlashcardsBuilderSkeleton />;
  if (resolved === 'quiz') return <QuizPageSkeleton />;
  if (resolved === 'quiz-builder') return <QuizBuilderSkeleton />;
  return <DashboardSkeleton />;
}

export function RouteTransitionSkeleton({ pathname = '', label = 'Opening page' }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-y-auto bg-[color:var(--color-bg)]/88 backdrop-blur-sm">
      <div className="sticky top-0 z-10">
        <RouteProgressBar />
      </div>
      <div className="mx-auto w-full max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
        <div className="mb-3 flex items-center gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/92 px-4 py-3 shadow-card">
          <SkeletonIcon className="h-10 w-10 rounded-2xl" />
          <div className="min-w-0">
            <p className="text-sm font-black text-[color:var(--color-text)]">{label}</p>
            <p className="text-xs font-semibold text-[color:var(--color-text-muted)]">Preparing the page layout and latest study data.</p>
          </div>
        </div>
      </div>
      <SkeletonForRoute pathname={pathname} />
    </div>
  );
}

export function FullPageShellSkeleton({ pathname = '/dashboard', label = 'Loading page' }) {
  return (
    <div className="min-h-screen bg-[color:var(--color-bg)]" aria-busy="true" aria-label={label}>
      <RouteProgressBar />
      <SkeletonForRoute pathname={pathname} />
    </div>
  );
}
