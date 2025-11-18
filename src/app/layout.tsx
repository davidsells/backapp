import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BackApp - Backup System Application',
  description:
    'A comprehensive backup system for managing backups to Amazon S3 or S3-compatible storage',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
