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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=localStorage.getItem('interactive_tree_editor_v1_store');if(d){var p=JSON.parse(d);var t=p&&p.settings&&p.settings.theme;if(t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}}catch(e){}})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
