"use client"

import { useEffect, useRef, useState } from "react"
import {
  Play,
  Pause,
  Volume1,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  Settings,
} from "lucide-react"
import YouTube from "react-youtube"
import Hls from "hls.js"

// 🔍 تحديد إذا كان الرابط من YouTube
function getYouTubeVideoId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|live\/)([^#&?]*).*/
  const match = url.match(regExp)
  return match && match[2].length === 11 ? match[2] : null
}

interface VideoPlayerProps {
  src: string
  poster?: string
  autoPlay?: boolean
  muted?: boolean
  isLive?: boolean
  fit?: "contain" | "cover" | "fill"
}

export default function VideoPlayer({
  src,
  poster,
  autoPlay = true, 
  muted = false,
  isLive = true,
  // 🔴🔴🔴 التعديل هنا: تغيير "contain" إلى "cover" 🔴🔴🔴
  fit = "cover", // (كان "contain")
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hlsRef = useRef<any>(null)
  const qualityMenuRef = useRef<HTMLDivElement | null>(null)

  const [playing, setPlaying] = useState(autoPlay)
  const [volume, setVolume] = useState(1)
  const [fullscreen, setFullscreen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [errorMessage, setErrorMessage] = useState("Stream Offline")
  const [quality, setQuality] = useState("Auto")
  const [availableQualities, setAvailableQualities] = useState<string[]>([])
  const [showQualityMenu, setShowQualityMenu] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  const youTubeVideoId = getYouTubeVideoId(src)

  // 🔊 تحميل إعدادات الصوت (فقط HLS)
  useEffect(() => {
    if (youTubeVideoId) return
    const savedVolume = localStorage.getItem("player-volume")
    const savedMuted = localStorage.getItem("player-muted")
    const initialMuted = savedMuted === "true" || muted
    if (initialMuted) {
      setVolume(0)
    } else {
      setVolume(savedVolume ? Number.parseFloat(savedVolume) : 1)
    }
  }, [muted, youTubeVideoId])

  // 🔊 حفظ الصوت
  useEffect(() => {
    if (youTubeVideoId) return
    localStorage.setItem("player-volume", volume.toString())
    localStorage.setItem("player-muted", (volume === 0).toString())
    if (videoRef.current) {
      videoRef.current.volume = volume
      videoRef.current.muted = volume === 0
    }
  }, [volume, youTubeVideoId])

  // 🎥 إعداد HLS
  useEffect(() => {
    const video = videoRef.current
    if (!video || !src || youTubeVideoId) {
      if (!youTubeVideoId && !src) {
        setErrorMessage("No stream source provided.")
        setError(true)
        setLoading(false)
      }
      return
    }

    setLoading(true)
    setLoaded(false)
    setError(false)
    setErrorMessage("Stream Offline")
    setPlaying(false) // البدء بحالة "متوقف"

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onPlaying = () => {
        setLoading(false);
        setLoaded(true);
        setPlaying(true); 
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('playing', onPlaying);


    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    const streamUrl = src.startsWith("/api/proxy")
      ? decodeURIComponent(src.split("url=")[1] || "")
      : src

    if (!streamUrl || (!streamUrl.startsWith("http://") && !streamUrl.startsWith("https://"))) {
      console.error("Invalid stream URL format:", streamUrl)
      setErrorMessage("Invalid stream URL format.")
      setError(true)
      setLoading(false)
      return
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        maxBufferLength: 8,
        liveSyncDuration: 3,
      })
      hlsRef.current = hls
      hls.loadSource(streamUrl)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        if (data?.levels?.length) {
          const qualities = data.levels.map((l: any) => `${l.height}p`)
          setAvailableQualities(["Auto", ...qualities])
          setQuality("Auto")
        }
        video.play().catch(() => {
          video.muted = true
          video.play().catch(() => setPlaying(false)) 
        })
      })

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        const level = hls.levels[data.level]
        if (level && level.height) setQuality(`${level.height}p`)
        else setQuality("Auto")
      })

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setErrorMessage("Network error. Retrying...")
              hls.startLoad()
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              setErrorMessage("Media error. Recovering...")
              hls.recoverMediaError()
              break
            default:
              setErrorMessage("Stream failed to load.")
              setError(true)
              setLoading(false)
              hls.destroy()
              break
          }
        }
      })
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl
      video.addEventListener("loadedmetadata", () => {
        video.play().then(() => setLoaded(true))
      })
    } else {
      setErrorMessage("HLS playback is not supported.")
      setError(true)
      setLoading(false)
    }

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('playing', onPlaying);

      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [src, retryCount, youTubeVideoId])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play()
    } else {
      video.pause()
    }
  }

  const toggleMute = () => setVolume(volume === 0 ? 1 : 0)
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => setVolume(parseFloat(e.target.value))

const toggleFullscreen = () => {
  const video = videoRef.current as any;
  const container = video?.parentElement as any;
  const doc = document as any;

  try {
    if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
      if (video?.requestFullscreen) {
        video.requestFullscreen();
      } else if (video?.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      } else if (container?.requestFullscreen) {
        container.requestFullscreen();
      } else if (container?.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      }
      setFullscreen(true);
    } else {
      if (doc.exitFullscreen) {
        doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      } else if (video?.webkitExitFullscreen) {
        video.webkitExitFullscreen();
      }
      setFullscreen(false);
    }
  } catch (err) {
    console.error("Fullscreen error:", err);
  }
};


  useEffect(() => {
    const handleExit = () => setFullscreen(false)
    document.addEventListener("fullscreenchange", handleExit)
    document.addEventListener("webkitfullscreenchange", handleExit)
    return () => {
      document.removeEventListener("fullscreenchange", handleExit)
      document.removeEventListener("webkitfullscreenchange", handleExit)
    }
  }, [])

  const retryStream = () => {
    setError(false)
    setLoading(true)
    setLoaded(false)
    setErrorMessage("Stream Offline")
    setRetryCount((count) => count + 1)
  }

  const handleQualityChange = (q: string) => {
    if (!hlsRef.current) return
    const hls = hlsRef.current
    if (q === "Auto") {
      hls.currentLevel = -1
      setQuality("Auto")
    } else {
      const index = hls.levels.findIndex((l: any) => `${l.height}p` === q)
      if (index !== -1) {
        hls.currentLevel = index
        setQuality(q)
      }
    }
    setShowQualityMenu(false)
  }

  const handleYouTubeError = (event: any) => {
    console.error("YouTube Error Code:", event.data)
    setErrorMessage("This YouTube video is unavailable.")
    setError(true)
    setLoading(false)
  }

  // 🎥 إذا كان YouTube
  if (youTubeVideoId) {
    return (
      <div className="relative w-full h-full bg-black overflow-hidden">
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-gray-300 z-20">
            <span className="text-lg font-semibold mb-4 text-red-500">{errorMessage}</span>
          </div>
        )}
        <YouTube
          videoId={youTubeVideoId}
          className="w-full h-full absolute top-0 left-0 z-10"
          opts={{
            width: "100%",
            height: "100%",
            playerVars: {
              autoplay: autoPlay ? 1 : 0,
              mute: muted ? 1 : 0,
              controls: 1,
              rel: 0,
              modestbranding: 1,
            },
          }}
          onReady={() => setLoading(false)}
          onError={handleYouTubeError}
        />
        {loading && (
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center bg-black text-gray-300 z-30 transition-opacity duration-700`}
          >
            <div className="w-10 h-10 border-2 border-t-transparent border-cyan-400 rounded-full animate-spin mb-3"></div>
            <span className="text-sm font-medium">Loading video...</span>
          </div>
        )}
      </div>
    )
  }

  // 🎬 مشغل HLS
  return (
    <div className="relative w-full h-full overflow-hidden group select-none bg-transparent">
      {/* 🎥 الفيديو */}
      <video
        ref={videoRef}
        onClick={togglePlay}
        poster={poster}
        playsInline
        webkit-playsinline="true"
        muted={volume === 0 || muted}
        // 🔴🔴🔴 التعديل هنا: object-${fit} ستستخدم الآن "cover" 🔴🔴🔴
        className={`absolute inset-0 w-full h-full object-${fit} object-center ${
          loaded ? "opacity-100" : "opacity-0"
        } transition-opacity duration-700`}
        controls={false}
      />

      {/* ⏳ شاشة التحميل */}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center bg-black text-gray-300 z-10 transition-opacity duration-700 ${
          loaded || error ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <div className="w-10 h-10 border-2 border-t-transparent border-cyan-400 rounded-full animate-spin mb-3"></div>
        <span className="text-sm font-medium">Loading stream...</span>
      </div>

      {/* ⚠️ شاشة الخطأ */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-gray-300 z-20">
          <span className="text-lg font-semibold mb-4 text-red-500">{errorMessage}</span>
          <button
            onClick={retryStream}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition"
          >
            <RotateCcw size={16} />
            Retry
          </button>
        </div>
      )}

      {/* 🎛 التحكمات */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-2 bg-gradient-to-t from-black/70 via-black/40 to-transparent backdrop-blur-sm text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-30">
        <div className="flex items-center gap-3">
          <button onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} className="hover:scale-110 transition-transform">
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>

          <div className="flex items-center gap-2 group/volume">
            <button onClick={toggleMute} className="hover:scale-110 transition-transform">
              {volume === 0 ? <VolumeX size={18} /> : volume < 0.5 ? <Volume1 size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={handleVolumeChange}
              className="w-0 opacity-0 group-hover/volume:w-16 group-hover/volume:opacity-100 transition-all duration-300 h-1 accent-cyan-400 cursor-pointer"
            />
          </div>

          {isLive && (
            <div className="flex items-center gap-1 ml-2">
              <span className="bg-red-600 rounded-full w-2 h-2 animate-pulse"></span>
              <span className="uppercase font-semibold text-xs tracking-widest">LIVE</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 relative">
          <button onClick={() => setShowQualityMenu((v) => !v)} className="hover:scale-110 transition-transform flex items-center gap-1">
            <Settings size={18} />
            <span className="text-xs">{quality}</span>
          </button>

          {showQualityMenu && (
            <div
              ref={qualityMenuRef}
              className="absolute bottom-10 right-0 bg-black/90 backdrop-blur-md text-white rounded-md shadow-md p-2 flex flex-col gap-1 text-xs"
            >
              {availableQualities.map((q) => (
                <button
                  key={q}
                  onClick={() => handleQualityChange(q)}
                  className={`px-3 py-1.5 rounded hover:bg-gray-700 w-full text-left ${
                    q === quality ? "text-cyan-400 font-semibold" : ""
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <button onClick={toggleFullscreen} className="hover:scale-110 transition-transform">
            {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </div>
    </div>
  )
}