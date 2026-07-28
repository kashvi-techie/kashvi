import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ORBIT - Your Semester Operating System',
  description: 'A private academic progress OS for a second-year B.Tech CSE AIML semester.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
