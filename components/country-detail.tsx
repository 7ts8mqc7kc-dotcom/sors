"use client"

import { useState, useEffect } from "react"
import { AlertCircle, X, Star } from "lucide-react"
// 💡 تم تحديث الاستيراد: يجب التأكد من وجود الدالة getChannelsByCategory في ملف iptv-channels
import { getChannelsByCountry, getChannelsByCategory } from "@/lib/iptv-channels" 
import VideoPlayer from "@/components/video-player"

// 💡 نفترض شكل واجهة القناة بناءً على استخدامها
interface Channel {
  name: string;
  url: string;
}

interface CountryDetailProps {
  country: string
  channel: string
  onBack: () => void
  isMobile: boolean // تمت إضافتها لتتوافق مع app/page.tsx
  activeCategory: string // 👈 تمت إضافة الخاصية الجديدة
}

// 💡 تحديث props لاستقبال الخصائص الجديدة
export default function CountryDetail({ country, channel, onBack, isMobile, activeCategory }: CountryDetailProps) {
  const [streamUrl, setStreamUrl] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [isFavorited, setIsFavorited] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!isMounted) return
    try {
      const favorites = JSON.parse(localStorage.getItem("favorites") || "[]")
      // نستخدم activeCategory هنا بدلاً من country إذا لم تكن هناك دولة مختارة بشكل صريح
      const keyCountry = activeCategory !== "all-channels" && !country.startsWith('all-channels') ? activeCategory : country;
      const favoriteKey = `${keyCountry}:${channel}`
      setIsFavorited(favorites.includes(favoriteKey))
    } catch (error) {
      console.error("Error loading favorites:", error)
    }
  }, [country, channel, isMounted, activeCategory])

  const toggleFavorite = () => {
    if (!isMounted) return
    try {
      // نستخدم activeCategory هنا بدلاً من country إذا لم تكن هناك دولة مختارة بشكل صريح
      const keyCountry = activeCategory !== "all-channels" && !country.startsWith('all-channels') ? activeCategory : country;
      const favoriteKey = `${keyCountry}:${channel}`
      const favorites = JSON.parse(localStorage.getItem("favorites") || "[]")
      if (favorites.includes(favoriteKey)) {
        const updated = favorites.filter((fav: string) => fav !== favoriteKey)
        localStorage.setItem("favorites", JSON.stringify(updated))
        setIsFavorited(false)
      } else {
        favorites.push(favoriteKey)
        localStorage.setItem("favorites", JSON.stringify(favorites))
        setIsFavorited(true)
      }
    } catch (error) {
      console.error("Error toggling favorite:", error)
    }
  }

  useEffect(() => {
    setLoading(true)
    setError("")
    setStreamUrl("") // مسح الرابط القديم
    
    const fetchChannels = async () => {
      try {
        let channels: Channel[] = []
        let channelSource: string = country // لرسائل الخطأ

        // 💡 منطق جلب القنوات المُحدَّث:
        // إذا كانت activeCategory هي "all-channels" (وضع الدولة العادي)
        // أو إذا تم اختيار دولة (حيث country تحتوي على اسم دولة صريح)
        if (activeCategory === "all-channels" || (activeCategory !== country)) {
            channels = await getChannelsByCountry(country)
            channelSource = country
        } 
        // إذا كانت activeCategory ليست "all-channels" و country هي نفسها activeCategory 
        // (وهذا يحدث عندما نختار فئة من القائمة اليسرى)
        else {
            // ملاحظة: country هنا تحمل قيمة activeCategory المُمررة إليها من page.tsx
            channels = await getChannelsByCategory(activeCategory)
            channelSource = activeCategory
        }


        const selectedChannel = channels.find((c) => c.name === channel)
        if (selectedChannel && selectedChannel.url) {
          const url = selectedChannel.url.trim()
          if (url.startsWith("http://") || url.startsWith("https://")) {
            if (url.includes("youtube.com") || url.includes("youtube-nocookie.com")) {
              setStreamUrl(url)
            } else {
              // 💡 تمرير الرابط عبر البروكسي
              setStreamUrl(`/api/proxy?url=${encodeURIComponent(url)}`)
            }
          } else {
            setError("Invalid stream URL format. Only HTTP/HTTPS streams are supported.")
          }
        } else {
          setError(`Stream not found in database for ${channel} in ${channelSource}`)
        }
      } catch (err) {
        setError("Failed to load stream list or channels: " + (err as Error).message)
        console.error("Error loading stream list:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchChannels()
  }, [country, channel, activeCategory]) // 👈 يجب تضمين activeCategory هنا

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-transparent">
      <div className="relative w-[90%] sm:w-[85%] lg:w-[82%] max-w-6xl aspect-video rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center w-full h-full bg-black text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mb-4" />
            <div className="text-slate-400">Loading stream...</div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center w-full h-full bg-black text-white">
            <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
            <div className="text-red-400 mb-2 font-medium">Stream Error</div>
            <p className="text-sm text-slate-500 max-w-xs text-center">{error}</p>
          </div>
        ) : streamUrl ? (
          <VideoPlayer
            src={streamUrl}
            autoPlay
            isLive
            fit="cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full bg-black text-white">
            <AlertCircle className="w-12 h-12 text-slate-500 mb-4" />
            <div className="text-slate-400 mb-2 font-medium">Stream Unavailable</div>
            <p className="text-sm text-slate-600 max-w-xs">
              This channel is not currently available.
            </p>
          </div>
        )}

        {/* ⭐ أزرار المفضلة والإغلاق */}
        <div className="absolute top-3 right-3 flex items-center gap-2 z-40"> {/* زِدنا z-index هنا */}
          <button
            onClick={toggleFavorite}
            className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
            aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
          >
            <Star
              className={`w-5 h-5 transition-all ${
                isFavorited ? "fill-yellow-400 text-yellow-400" : "text-white"
              }`}
            />
          </button>
          <button
            onClick={onBack}
            className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
            aria-label="Close player"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}