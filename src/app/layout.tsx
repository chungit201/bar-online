import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bar Online - Quán Bar Trực Tuyến',
  description: 'Quán bar trực tuyến multiplayer - gặp gỡ bạn bè, nghe nhạc, nhảy và trò chuyện trong không gian 3D.',
  other: {
    'color-scheme': 'dark',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="dark">
      <body>{children}</body>
    </html>
  );
}
