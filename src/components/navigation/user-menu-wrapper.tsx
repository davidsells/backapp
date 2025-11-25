"use client";

import { UserMenu } from "./user-menu";

interface UserMenuWrapperProps {
  userName?: string | null;
  userEmail?: string | null;
  signOutAction: () => Promise<void>;
}

export function UserMenuWrapper({ userName, userEmail, signOutAction }: UserMenuWrapperProps) {
  return (
    <UserMenu
      userName={userName}
      userEmail={userEmail}
      onSignOut={signOutAction}
    />
  );
}
