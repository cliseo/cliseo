import React from 'react';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Intentionally missing OpenGraph and other meta tags */}
      </head>
      <body>{children}</body>
    </html>
  )
} 