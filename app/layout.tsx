import './globals.css'

import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'

const poppins = Poppins({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'The Magic Floor - A WebGPU Three.js Experience by Matthew Frawley',
  description:
    "I set out to capture the essence of a shimmering, ethereal floor I'd seen (and loved) in the Split Fiction game - rippling footsteps, radial light, drifting particles.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} antialiased`}>{children}</body>
    </html>
  )
}
