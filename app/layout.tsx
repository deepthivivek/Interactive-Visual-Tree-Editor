import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Interactive Visual Tree Editor',
  description: 'Visual tree editor for hierarchical compliance policy templates and rules.',
  openGraph: {
    title: 'Interactive Visual Tree Editor',
    description: 'Visual tree editor for hierarchical compliance policy templates and rules.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Interactive Visual Tree Editor',
    description: 'Visual tree editor for hierarchical compliance policy templates and rules.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
