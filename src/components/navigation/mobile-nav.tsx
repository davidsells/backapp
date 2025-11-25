"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileNavProps {
  isAdmin?: boolean;
}

export function MobileNav({ isAdmin }: MobileNavProps) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [open]);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="md:hidden"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </Button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/80"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-[280px] bg-background p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Navigation</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" />
                <span className="sr-only">Close menu</span>
              </Button>
            </div>
            <nav className="flex flex-col space-y-4">
              <Link
                href="/dashboard"
                className="text-sm font-medium transition-colors hover:text-primary"
                onClick={() => setOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                href="/configs"
                className="text-sm font-medium transition-colors hover:text-primary"
                onClick={() => setOpen(false)}
              >
                Configurations
              </Link>
              <Link
                href="/backups"
                className="text-sm font-medium transition-colors hover:text-primary"
                onClick={() => setOpen(false)}
              >
                Backups
              </Link>
              <Link
                href="/agents"
                className="text-sm font-medium transition-colors hover:text-primary"
                onClick={() => setOpen(false)}
              >
                Agents
              </Link>
              <Link
                href="/storage"
                className="text-sm font-medium transition-colors hover:text-primary"
                onClick={() => setOpen(false)}
              >
                Storage
              </Link>
              <Link
                href="/reports"
                className="text-sm font-medium transition-colors hover:text-primary"
                onClick={() => setOpen(false)}
              >
                Reports
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="text-sm font-medium transition-colors hover:text-primary"
                  onClick={() => setOpen(false)}
                >
                  Admin
                </Link>
              )}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
