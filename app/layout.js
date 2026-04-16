<<<<<<< HEAD
import './globals.css'
import 'driver.js/dist/driver.css'
import { Inter, Playfair_Display } from 'next/font/google'
import { LanguageProvider } from '@/contexts/LanguageContext'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-serif' })

export const metadata = {
  title: '拾音 / Pickup - Personal Music Library',
  description: 'A minimalist music library for collectors.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="bg-background text-primary antialiased min-h-screen">
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  )
}
=======
import './globals.css'
import { Inter, Playfair_Display } from 'next/font/google'
import { LanguageProvider } from '@/contexts/LanguageContext'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-serif' })

export const metadata = {
  title: '拾音 / Pickup - Personal Music Library',
  description: 'A minimalist music library for collectors.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="bg-background text-primary antialiased min-h-screen">
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  )
}
>>>>>>> 887dea10 (feat: 拾音/Pickup 准备上线)
