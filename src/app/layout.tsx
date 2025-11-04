import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Backup System',
  description: 'Cross-platform backup system for Ubuntu, Linux, and macOS',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
