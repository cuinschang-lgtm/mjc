'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import zhCN from '../locales/zh-CN.json'
import zhTW from '../locales/zh-TW.json'
import enUS from '../locales/en-US.json'
import jaJP from '../locales/ja-JP.json'

const LanguageContext = createContext()

const translations = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  'en-US': enUS,
  'ja-JP': jaJP
}

export const LanguageProvider = ({ children }) => {
  // Default to zh-CN if no preference found
  const [language, setLanguage] = useState('zh-CN')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // 1. Check Local Storage
    const storedLang = localStorage.getItem('app-language')
    if (storedLang && translations[storedLang]) {
      setLanguage(storedLang)
    } else {
      // 2. Check Browser Language
      const browserLang = navigator.language
      if (browserLang.startsWith('zh-TW') || browserLang.startsWith('zh-HK')) {
        setLanguage('zh-TW')
      } else if (browserLang.startsWith('zh')) {
        setLanguage('zh-CN')
      } else if (browserLang.startsWith('ja')) {
        setLanguage('ja-JP')
      } else if (browserLang.startsWith('en')) {
        setLanguage('en-US')
      }
      // Default fallback is already zh-CN
    }
    setIsLoading(false)
  }, [])

  const changeLanguage = (lang) => {
    if (translations[lang]) {
      setLanguage(lang)
      localStorage.setItem('app-language', lang)
    }
  }

  const t = (path) => {
    const keys = path.split('.')
    let current = translations[language]
    
    for (const key of keys) {
      if (current[key] === undefined) {
        // console.warn(`Missing translation for key: ${path} in language: ${language}`)
        return path // Fallback to key
      }
      current = current[key]
    }
    return current
  }

  // Prevent hydration mismatch by rendering nothing until mounted
  if (isLoading) {
    return <div className="min-h-screen bg-[#121212] text-white flex items-center justify-center">Loading...</div>
  }

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
