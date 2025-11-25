"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UserMenuProps {
  userName?: string | null;
  userEmail?: string | null;
  onSignOut: () => void;
}

export function UserMenu({ userName, userEmail, onSignOut }: UserMenuProps) {
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        size="sm"
        className="flex items-center gap-1"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm text-muted-foreground">
          {userName || userEmail}
        </span>
        <ChevronDown className="h-4 w-4" />
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 rounded-md border bg-background shadow-lg z-50">
          <div className="p-2">
            <Link
              href="/settings/profile"
              className="flex items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors hover:bg-accent"
              onClick={() => setOpen(false)}
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </Link>
            <button
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors hover:bg-accent"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
