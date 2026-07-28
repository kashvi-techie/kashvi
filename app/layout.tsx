import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ORBIT - Your Semester Operating System',
  description: 'A private academic progress OS for a second-year B.Tech CSE AIML semester.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'ORBIT',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: '#0B0B0F',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
