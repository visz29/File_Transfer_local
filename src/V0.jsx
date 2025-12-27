"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import QRCode from "qrcode"
import jsQR from "jsqr"

const setNetworkMode = (mode) => {
  // This function will be used to update the networkMode state
  // For now, it's a placeholder as the actual state update should be handled by React
  console.log("Setting network mode to:", mode)
}

// ----------------------
// PROGRESS BAR COMPONENT
// ----------------------
function ProgressBar({ progress, label, fileName }) {
  const isComplete = progress >= 100

  return (
    <div className="w-full max-w-md mt-4">
      {fileName && <p className="text-foreground/80 text-sm mb-1 truncate">{fileName}</p>}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${isComplete ? "bg-green-500" : "bg-blue-500"}`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <span className="text-foreground text-sm font-medium w-12 text-right">{Math.round(progress)}%</span>
      </div>
      {label && <p className="text-foreground/60 text-xs mt-1">{label}</p>}
    </div>
  )
}

// ----------------------
// CAMERA QR SCANNER - Fixed scanner with proper video loading and debugging
// ----------------------
function CameraScanner({ onScan, onClose }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const animationRef = useRef(null)
  const [scanStatus, setScanStatus] = useState("Initializing camera...")
  const [hasCamera, setHasCamera] = useState(true)

  useEffect(() => {
    let mounted = true
    let scanning = false

    const startCamera = async () => {
      try {
        // Request camera permission
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        })

        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream

          // Wait for video to be ready
          videoRef.current.onloadedmetadata = () => {
            if (!mounted) return
            videoRef.current
              .play()
              .then(() => {
                setScanStatus("Scanning for QR code...")
                scanning = true
                scanQR()
              })
              .catch((err) => {
                console.error("Video play error:", err)
                setScanStatus("Error playing video")
              })
          }
        }
      } catch (err) {
        console.error("Camera error:", err)
        setHasCamera(false)
        setScanStatus("Camera access denied or unavailable")
      }
    }

    const scanQR = () => {
      if (!mounted || !scanning) return

      const video = videoRef.current
      const canvas = canvasRef.current

      if (!video || !canvas) {
        animationRef.current = requestAnimationFrame(scanQR)
        return
      }

      const ctx = canvas.getContext("2d", { willReadFrequently: true })

      if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          })

          if (code && code.data) {
            setScanStatus("QR Code found!")
            scanning = false
            onScan(code.data)
            return
          }
        } catch (e) {
          console.error("Scan error:", e)
        }
      }

      animationRef.current = requestAnimationFrame(scanQR)
    }

    startCamera()

    return () => {
      mounted = false
      scanning = false
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [onScan])

  return (
    <div className="relative mt-6 flex flex-col items-center">
      {hasCamera ? (
        <>
          <video ref={videoRef} className="w-80 h-80 bg-black rounded-xl object-cover" playsInline muted autoPlay />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 border-2 border-white/50 rounded-lg">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-green-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-green-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-green-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-green-400 rounded-br-lg" />
            </div>
          </div>
        </>
      ) : (
        <div className="w-80 h-80 bg-muted rounded-xl flex items-center justify-center">
          <p className="text-foreground/60 text-center px-4">Camera not available. Please check permissions.</p>
        </div>
      )}

      <p className="text-foreground/80 text-sm mt-3">{scanStatus}</p>

      <button
        onClick={onClose}
        className="mt-3 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
      >
        Close Scanner
      </button>
    </div>
  )
}

// ===================================================
// MAIN APP
// ===================================================
export default function Page() {
  const [qrImage, setQrImage] = useState("")
  const [qrText, setQrText] = useState("")
  const [cameraMode, setCameraMode] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [sendProgress, setSendProgress] = useState(0)
  const [receiveProgress, setReceiveProgress] = useState(0)
  const [connectionStatus, setConnectionStatus] = useState("disconnected")
  const [receivingFile, setReceivingFile] = useState(null)
  const [sendingFile, setSendingFile] = useState(null)
  const [manualMode, setManualMode] = useState(false)
  const [manualInput, setManualInput] = useState("")
  const [networkMode, setNetworkMode] = useState("local")

  const pcRef = useRef(null)
  const channelRef = useRef(null)
  const receivedChunks = useRef([])
  const fileMetaRef = useRef(null)
  const receivedSizeRef = useRef(0)

  const getRTCConfig = useCallback(() => {
    if (networkMode === "local") {
      return { iceServers: [] }
    }
    return {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
    }
  }, [networkMode])

  const waitForICE = useCallback((pc) => {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === "complete") return resolve()
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === "complete") resolve()
      }
    })
  }, [])

  const receiveChunk = useCallback((data) => {
    if (typeof data === "string") {
      if (data.startsWith("META:")) {
        try {
          const meta = JSON.parse(data.slice(5))
          fileMetaRef.current = meta
          receivedChunks.current = []
          receivedSizeRef.current = 0
          setReceivingFile(meta.name)
          setReceiveProgress(0)
          return
        } catch (e) {
          console.error("Failed to parse metadata:", e)
        }
      }

      if (data === "EOF") {
        const meta = fileMetaRef.current || { name: "received_file", type: "application/octet-stream" }
        const blob = new Blob(receivedChunks.current, { type: meta.type })
        const url = URL.createObjectURL(blob)

        const a = document.createElement("a")
        a.href = url
        a.download = meta.name
        a.click()

        URL.revokeObjectURL(url)
        receivedChunks.current = []
        fileMetaRef.current = null
        receivedSizeRef.current = 0
        setReceiveProgress(100)

        setTimeout(() => {
          setReceivingFile(null)
          setReceiveProgress(0)
        }, 2000)
        return
      }
    }

    receivedChunks.current.push(data)

    if (fileMetaRef.current) {
      const chunkSize = data.byteLength || data.size || 0
      receivedSizeRef.current += chunkSize
      const progress = (receivedSizeRef.current / fileMetaRef.current.size) * 100
      setReceiveProgress(Math.min(progress, 99))
    }
  }, [])

  const createOfferQR = async () => {
    const pc = new RTCPeerConnection(getRTCConfig())
    pcRef.current = pc

    const channel = pc.createDataChannel("fileShare", {
      ordered: true,
      maxPacketLifeTime: 3000,
    })
    channelRef.current = channel
    channel.binaryType = "arraybuffer"

    channel.onopen = () => {
      setConnectionStatus("connected")
    }
    channel.onerror = (e) => console.error("Channel error:", e)
    channel.onmessage = (e) => receiveChunk(e.data)

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    await waitForICE(pc)

    const compressed = `o|${pc.localDescription.sdp}`
    setQrText(compressed)
    const qr = await QRCode.toDataURL(compressed, {
      width: 400,
      errorCorrectionLevel: "L",
    })
    setQrImage(qr)
    setConnectionStatus("waiting")
  }

  const handleOfferFromQr = async (data) => {
    try {
      if (!data || typeof data !== "string") {
        throw new Error("Invalid data format")
      }

      const parts = data.split("|")
      if (parts.length !== 2) {
        throw new Error("Invalid format - must contain exactly one | separator")
      }

      const [type, sdp] = parts

      if (type !== "o") {
        throw new Error("Expected offer (o|...) but got something else")
      }

      if (!sdp || sdp.length < 50) {
        throw new Error("SDP data too short or missing")
      }

      const offer = { type: "offer", sdp }

      const pc = new RTCPeerConnection(getRTCConfig())
      pcRef.current = pc

      pc.ondatachannel = (event) => {
        const channel = event.channel
        channelRef.current = channel
        channel.binaryType = "arraybuffer"

        channel.onopen = () => {
          setConnectionStatus("connected")
        }
        channel.onmessage = (e) => receiveChunk(e.data)
      }

      await pc.setRemoteDescription(offer)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await waitForICE(pc)

      const compressed = `a|${pc.localDescription.sdp}`
      setQrText(compressed)
      const qr = await QRCode.toDataURL(compressed, {
        width: 400,
        errorCorrectionLevel: "L",
      })

      setQrImage(qr)
      setCameraMode(false)
      setConnectionStatus("waiting")
    } catch (e) {
      console.error("Offer error:", e)
      alert(`Invalid OFFER: ${e.message}`)
    }
  }

  const handleAnswerFromQr = async (data) => {
    try {
      if (!data || typeof data !== "string") {
        throw new Error("Invalid data format")
      }

      const parts = data.split("|")
      if (parts.length !== 2) {
        throw new Error("Invalid format - must contain exactly one | separator")
      }

      const [type, sdp] = parts

      if (type !== "a") {
        throw new Error("Expected answer (a|...) but got something else")
      }

      if (!sdp || sdp.length < 50) {
        throw new Error("SDP data too short or missing")
      }

      const answer = { type: "answer", sdp }

      if (!pcRef.current) {
        throw new Error("No peer connection. Create an offer first!")
      }

      await pcRef.current.setRemoteDescription(answer)
      setConnectionStatus("connected")
      setCameraMode(false)
      setQrImage("")
      setQrText("")
    } catch (e) {
      console.error("Answer error:", e)
      alert(`Invalid ANSWER: ${e.message}`)
    }
  }

  const handleScan = (text) => {
    if (text.startsWith("o|")) {
      handleOfferFromQr(text)
    } else if (text.startsWith("a|")) {
      handleAnswerFromQr(text)
    } else {
      alert("Invalid QR code format. Must start with 'o|' or 'a|'")
    }
  }

  const sendLargeFile = async (file) => {
    const channel = channelRef.current

    if (!channel || channel.readyState !== "open") {
      alert("Connection not ready yet!")
      return
    }

    setSendingFile(file.name)
    setSendProgress(0)

    const metadata = JSON.stringify({
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
    })
    channel.send("META:" + metadata)

    const chunkSize = 64 * 1024
    const total = file.size
    let offset = 0

    const readChunk = (start, end) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target.result)
        reader.onerror = reject
        reader.readAsArrayBuffer(file.slice(start, end))
      })
    }

    while (offset < total) {
      while (channel.bufferedAmount > 2 * 1024 * 1024) {
        await new Promise((res) => setTimeout(res, 100))
      }

      const chunk = await readChunk(offset, Math.min(offset + chunkSize, total))
      channel.send(chunk)
      offset += chunk.byteLength

      const progress = (offset / total) * 100
      setSendProgress(Math.floor(progress))

      if (offset % (chunkSize * 10) === 0) {
        await new Promise((res) => setTimeout(res, 5))
      }
    }

    channel.send("EOF")
    setSendProgress(100)

    setTimeout(() => {
      setSendingFile(null)
      setSendProgress(0)
      setSelectedFile(null)
    }, 2000)
  }

  const handleManualSubmit = () => {
    const trimmed = manualInput.trim()

    if (!trimmed) {
      alert("Please paste the offer or answer text")
      return
    }

    if (!trimmed.includes("|")) {
      alert("Invalid format. Text must contain | separator (e.g., o|sdp... or a|sdp...)")
      return
    }

    const [type] = trimmed.split("|")
    if (type !== "o" && type !== "a") {
      alert("Invalid format. Text must start with 'o|' (offer) or 'a|' (answer)")
      return
    }

    handleScan(trimmed)
    setManualInput("")
    setManualMode(false)
  }

  const copyToClipboard = () => {
    if (!qrText) {
      alert("No QR text available to copy")
      return
    }

    navigator.clipboard
      .writeText(qrText)
      .then(() => {
        alert("Copied to clipboard!")
      })
      .catch(() => {
        alert("Failed to copy. Please try again.")
      })
  }

  return (
    <div className="w-full min-h-screen bg-background flex flex-col items-center p-6">
      <h1 className="text-foreground text-3xl font-bold mt-8">QR File Transfer</h1>
      <p className="text-foreground/60 mt-2">Peer-to-peer file sharing via WebRTC (up to 5GB)</p>

      <div className="mt-6 flex gap-2 bg-muted p-1 rounded-lg">
        <button
          onClick={() => setNetworkMode("local")}
          className={`px-6 py-2 rounded-md font-medium transition-colors ${
            networkMode === "local"
              ? "bg-background text-foreground shadow-sm"
              : "text-foreground/60 hover:text-foreground"
          }`}
        >
          Local Network
        </button>
        <button
          onClick={() => setNetworkMode("internet")}
          className={`px-6 py-2 rounded-md font-medium transition-colors ${
            networkMode === "internet"
              ? "bg-background text-foreground shadow-sm"
              : "text-foreground/60 hover:text-foreground"
          }`}
        >
          Internet
        </button>
      </div>

      <p className="text-foreground/50 text-xs mt-2 text-center max-w-md">
        {networkMode === "local"
          ? "Both devices must be on the same WiFi/LAN"
          : "Share files across different networks (uses STUN servers)"}
      </p>

      <div className="mt-4 flex items-center gap-2">
        <div
          className={`w-3 h-3 rounded-full ${
            connectionStatus === "connected"
              ? "bg-green-500"
              : connectionStatus === "waiting"
                ? "bg-yellow-500"
                : "bg-red-500"
          }`}
        />
        <span className="text-foreground/80 text-sm capitalize">{connectionStatus}</span>
      </div>

      <div className="flex gap-4 mt-6 flex-wrap justify-center">
        <button
          onClick={createOfferQR}
          disabled={connectionStatus === "connected"}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-xl text-white font-medium transition-colors"
        >
          Create Offer QR
        </button>

        <button
          onClick={() => setCameraMode(true)}
          disabled={connectionStatus === "connected"}
          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-xl text-white font-medium transition-colors"
        >
          Scan QR
        </button>

        <button
          onClick={() => setManualMode(!manualMode)}
          className="bg-orange-600 hover:bg-orange-700 px-6 py-3 rounded-xl text-white font-medium transition-colors"
        >
          {manualMode ? "Hide Manual" : "Manual Entry"}
        </button>
      </div>

      {cameraMode && (
        <CameraScanner
          onScan={(txt) => {
            handleScan(txt)
            setCameraMode(false)
          }}
          onClose={() => setCameraMode(false)}
        />
      )}

      {manualMode && (
        <div className="mt-6 w-full max-w-md bg-muted p-6 rounded-xl">
          <h3 className="text-foreground font-semibold text-lg mb-2">Manual Entry</h3>
          <p className="text-foreground/60 text-sm mb-4">Paste the offer or answer text below (starts with o| or a|)</p>
          <textarea
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Paste offer/answer text here..."
            className="w-full h-32 bg-background text-foreground border border-border rounded-lg p-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleManualSubmit}
              className="flex-1 bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-white font-medium transition-colors"
            >
              Connect
            </button>
            <button
              onClick={() => {
                setManualMode(false)
                setManualInput("")
              }}
              className="flex-1 bg-muted-foreground/20 hover:bg-muted-foreground/30 px-4 py-2 rounded-lg text-foreground font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {qrImage && (
        <div className="mt-6 flex flex-col items-center">
          <img src={qrImage || "/placeholder.svg"} alt="QR Code" className="w-72 bg-white p-4 rounded-xl shadow-lg" />
          <p className="text-foreground/60 text-sm text-center mt-3">
            {connectionStatus === "waiting" ? "Scan this QR with another device" : "QR Code Ready"}
          </p>
          <button
            onClick={copyToClipboard}
            className="mt-3 bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg text-white text-sm font-medium transition-colors"
          >
            Copy as Text
          </button>
        </div>
      )}

      {connectionStatus === "connected" && (
        <div className="mt-8 w-full max-w-md">
          <label className="block bg-muted rounded-xl p-6 cursor-pointer hover:bg-muted/80 transition-colors">
            <div className="flex flex-col items-center gap-2">
              <svg className="w-12 h-12 text-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className="text-foreground font-medium">Click to select file</span>
              <span className="text-foreground/60 text-sm">Up to 5GB supported</span>
            </div>
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  setSelectedFile(file)
                  sendLargeFile(file)
                }
              }}
            />
          </label>
        </div>
      )}

      {sendingFile && (
        <ProgressBar
          progress={sendProgress}
          fileName={sendingFile}
          label={sendProgress >= 100 ? "File sent successfully!" : "Sending..."}
        />
      )}

      {receivingFile && (
        <ProgressBar
          progress={receiveProgress}
          fileName={receivingFile}
          label={receiveProgress >= 100 ? "File received!" : "Receiving..."}
        />
      )}
    </div>
  )
}
