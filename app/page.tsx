"use client"

import { useState, useEffect, useCallback } from "react"
import TopNavbar from "@/components/top-navbar"
import GlobeViewer from "@/components/globe-viewer"
import CountrySidebar from "@/components/country-sidebar"
import CountryDetail from "@/components/country-detail"
import CategorySidebar from "@/components/CategorySidebar" 

export default function Home() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false) 
  const [searchQuery, setSearchQuery] = useState("")
  const [currentTime, setCurrentTime] = useState("")
  const [isMobile, setIsMobile] = useState(false)

  // 🔴 الحالات الخاصة بالقائمة الجديدة
  const [isCategorySidebarOpen, setIsCategorySidebarOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState("all-channels") 

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(isMobileDevice);
  }, []) 

  useEffect(() => {
    const updateTime = () =>
      setCurrentTime(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      )
    updateTime()
    const interval = setInterval(updateTime, 60000)
    return () => clearInterval(interval)
  }, [])

  if (!mounted) return null

  // 🎯 --- معالجات الأحداث ---

  // 🔴 (1) عند الضغط على دولة في الكرة الأرضية
  const handleGlobeCountryClick = (countryName: string) => {
    setSelectedChannel(null)
    setSelectedCountry(countryName)
    setActiveCategory("all-channels") // 👈 (مهم) لإلغاء الفلتر وعرض قنوات الدولة بالكامل
    if (isMobile) setMobileSidebarOpen(true)
  }

  // 🔴 (2) عند اختيار دولة من القائمة (إذا كانت القائمة تُعرض)
  const handleSelectCountry = (country: string | null) => {
    setSelectedChannel(null)
    setSelectedCountry(country)
    setActiveCategory("all-channels") // 👈 (مهم) لإلغاء الفلتر
    if (isMobile && !country) setMobileSidebarOpen(false) 
  }
  
  // 🔴 (3) عند اختيار فئة من القائمة اليسرى
  const handleCategorySelect = (category: string) => {
    setActiveCategory(category) // 👈 ضبط الفئة الجديدة (مثل "music")
    setSelectedCountry(null)    // 👈 (مهم) إلغاء اختيار الدولة (للتنقل إلى وضع البحث العام)
    setSelectedChannel(null)    // 👈 إلغاء اختيار القناة
    setIsCategorySidebarOpen(false) // 👈 إغلاق القائمة اليسرى
    
    // فتح القائمة الرئيسية (اليمنى/السفلية) لعرض النتائج
    if (isMobile && !mobileSidebarOpen) {
      setMobileSidebarOpen(true)
    }
  }

  // (الباقي كما هو)
  const handleSelectChannel = (channel: string) => setSelectedChannel(channel)
  const handleBackFromPlayer = () => setSelectedChannel(null)
  const toggleMobileSidebar = () => {
    if (isMobile) setMobileSidebarOpen((prev) => !prev)
  }
  const toggleCategorySidebar = () => {
    setIsCategorySidebarOpen((prev) => !prev)
  }


  return (
    <div className="flex flex-col h-screen w-full bg-transparent text-white overflow-hidden">
      <TopNavbar 
        onMenuClick={toggleCategorySidebar}
        isMenuOpen={isCategorySidebarOpen}
      />

      <div className="flex-1 overflow-hidden relative">
        
        {/* 🌍 الكرة الأرضية */}
        <div className="absolute inset-0 z-10 sm:right-[320px] lg:right-[340px]">
          <GlobeViewer
            selectedCountry={selectedCountry}
            onCountryClick={handleGlobeCountryClick}
            isMobile={isMobile}
          />
        </div>

        {/* 🎥 مشغل الفيديو (سطح المكتب فقط) */}
        {/* 💡 التعديل هنا: السماح بالعرض إذا تم اختيار قناة (selectedChannel) وكان هناك إما دولة مختارة أو فئة نشطة غير all-channels */}
        {!isMobile && selectedChannel && (selectedCountry || activeCategory !== "all-channels") && ( 
          <div
            className="absolute top-0 bottom-0 z-30 flex items-center justify-center p-4 sm:p-8 
                      left-0 right-0 sm:right-[320px] lg:right-[340px]"
          >
            <CountryDetail
              // إذا كانت الدولة فارغة، استخدم اسم الفئة (للعرض في العنوان)
              country={selectedCountry ?? activeCategory}
              channel={selectedChannel}
              onBack={handleBackFromPlayer}
              isMobile={isMobile}
              activeCategory={activeCategory} // 👈 الإضافة هنا
            />
          </div>
        )}

        {/* 🖥️ قائمة سطح المكتب (الخاصة بالدول - يمين) */}
        {!isMobile && (
          <div
            className="absolute right-0 top-16 bottom-0 w-[320px] lg:w-[340px] z-20 bg-gray-900/90 backdrop-blur-md"
            role="complementary"
          >
            {/* 🔴 (4) تمرير الفئة النشطة إلى القائمة اليمنى */}
            <CountrySidebar
              selectedCountry={selectedCountry}
              onSelectCountry={handleSelectCountry}
              onSelectChannel={handleSelectChannel}
              onClose={() => {}}
              externalSearch={searchQuery}
              currentTime={currentTime}
              isMobile={isMobile}
              activeCategory={activeCategory} // 👈 الإضافة هنا
            />
          </div>
        )}

        {/* 📱 🖥️  قائمة الفئات المنبثقة (لجميع الأحجام) */}
        <>
          <div
            className={`fixed top-16 left-0 bottom-0 z-40 w-64 bg-[#0B0D11] shadow-lg transform transition-transform duration-300 ease-in-out
              ${isCategorySidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
          >
            <CategorySidebar
              activeCategory={activeCategory}
              onCategorySelect={handleCategorySelect}
              onClose={toggleCategorySidebar}
            />
          </div>
          {isCategorySidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-30"
              onClick={toggleCategorySidebar}
            />
          )}
        </>


        {/* 📱 قائمة الهاتف (الخاصة بالقنوات) */}
        {isMobile && (
          <>
            <div
              className={`fixed left-0 right-0 z-20 bg-[#0B0D11] transition-transform duration-500 
                ${mobileSidebarOpen ? "translate-y-0" : "translate-y-full"} 
                top-16 bottom-0 flex flex-col`}
            >
              {/* 🔴 (5) إظهار المشغل إذا تم اختيار قناة (بغض النظر عن الدولة) */}
              {selectedChannel && (
                <div className="w-full flex-1 bg-black flex-shrink-0 relative">
                  <CountryDetail
                    // 🔴 إظهار اسم الفئة كعنوان إذا لم تكن هناك دولة
                    country={selectedCountry ?? activeCategory} 
                    channel={selectedChannel}
                    onBack={handleBackFromPlayer}
                    isMobile={isMobile}
                    activeCategory={activeCategory} // 👈 الإضافة هنا
                  />
                </div>
              )}
              <div
                onClick={toggleMobileSidebar}
                className="w-full flex items-center justify-center cursor-grab flex-shrink-0 pt-2.5 pb-2"
                aria-label="Toggle sidebar"
              >
                <span className="w-12 h-1.5 bg-gray-700 rounded-full" />
              </div>
              <div className={`${selectedChannel ? 'h-[60%]' : 'flex-1'} overflow-y-auto custom-scroll`}>
                {/* 🔴 (6) تمرير الفئة النشطة إلى قائمة الهاتف */}
                <CountrySidebar
                  selectedCountry={selectedCountry}
                  onSelectCountry={handleSelectCountry}
                  onSelectChannel={handleSelectChannel}
                  onClose={toggleMobileSidebar}
                  externalSearch={searchQuery}
                  currentTime={currentTime}
                  isMobile={isMobile} 
                  activeCategory={activeCategory} // 👈 الإضافة هنا
                />
              </div>
            </div>
            {mobileSidebarOpen && (
              <div
                className="fixed inset-0 bg-black/50 z-10"
                onClick={toggleMobileSidebar}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}