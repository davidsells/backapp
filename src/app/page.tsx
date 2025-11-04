import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm">
        <h1 className="mb-8 text-center text-4xl font-bold">
          BackApp - Backup System
        </h1>

        <p className="mb-8 text-center text-lg text-muted-foreground">
          A comprehensive, user-friendly web application for managing backups to
          Amazon S3 or S3-compatible storage.
        </p>

        <div className="mb-12 grid gap-6 text-center lg:grid-cols-3 lg:text-left">
          <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 dark:hover:border-neutral-700 dark:hover:bg-neutral-800/30">
            <h2 className="mb-3 text-2xl font-semibold">Configure</h2>
            <p className="m-0 max-w-[30ch] text-sm opacity-50">
              Set up your backup sources and S3 destinations with an intuitive
              interface.
            </p>
          </div>

          <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 dark:hover:border-neutral-700 dark:hover:bg-neutral-800/30">
            <h2 className="mb-3 text-2xl font-semibold">Automate</h2>
            <p className="m-0 max-w-[30ch] text-sm opacity-50">
              Schedule automated backups with flexible cron expressions and
              manage multiple configurations.
            </p>
          </div>

          <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 dark:hover:border-neutral-700 dark:hover:bg-neutral-800/30">
            <h2 className="mb-3 text-2xl font-semibold">Monitor</h2>
            <p className="m-0 max-w-[30ch] text-sm opacity-50">
              Track backup progress, view logs, and receive alerts for any
              issues.
            </p>
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <Link
            href="/login"
            className="rounded-lg bg-primary px-6 py-3 text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Get Started
          </Link>
          <Link
            href="/register"
            className="rounded-lg border border-border px-6 py-3 transition-colors hover:bg-secondary"
          >
            Sign Up
          </Link>
        </div>

        <div className="mt-16 border-t border-border pt-8">
          <h3 className="mb-4 text-xl font-semibold">Key Features</h3>
          <ul className="grid gap-2 md:grid-cols-2">
            <li className="flex items-center gap-2">
              <span className="text-primary">✓</span> Multi-platform support
              (Ubuntu, Linux, macOS)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary">✓</span> Incremental & full backups
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary">✓</span> Compression & encryption
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary">✓</span> Real-time progress tracking
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary">✓</span> Detailed reporting &
              analytics
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary">✓</span> Email notifications & alerts
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
