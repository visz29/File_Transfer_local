"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import QRCode from "qrcode"
import jsQR from "jsqr"

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
  const [cameraMode, setCameraMode] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [sendProgress, setSendProgress] = useState(0)
  const [receiveProgress, setReceiveProgress] = useState(0)
  const [connectionStatus, setConnectionStatus] = useState("disconnected")
  const [receivingFile, setReceivingFile] = useState(null)
  const [sendingFile, setSendingFile] = useState(null)

  const pcRef = useRef(null)
  const channelRef = useRef(null)
  const receivedChunks = useRef([])
  const fileMetaRef = useRef(null)
  const receivedSizeRef = useRef(0)

  // ICE COMPLETE PROMISE
  const waitForICE = useCallback((pc) => {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === "complete") return resolve()
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === "complete") resolve()
      }
    })
  }, [])

  // -------------------------------------------------------
  // RECEIVE CHUNKS + BUILD FILE
  // -------------------------------------------------------
  const receiveChunk = useCallback((data) => {
    // Handle string messages (metadata or EOF)
    if (typeof data === "string") {
      // Check for metadata
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

      // Check for EOF
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

    // Handle binary data
    receivedChunks.current.push(data)

    if (fileMetaRef.current) {
      const chunkSize = data.byteLength || data.size || 0
      receivedSizeRef.current += chunkSize
      const progress = (receivedSizeRef.current / fileMetaRef.current.size) * 100
      setReceiveProgress(Math.min(progress, 99))
    }
  }, [])

  // -------------------------------------------------------
  // CREATE OFFER → QR
  // -------------------------------------------------------
  const createOfferQR = async () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    })
    pcRef.current = pc

    const channel = pc.createDataChannel("fileShare", {
      ordered: true,
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

    const fullOffer = JSON.stringify(pc.localDescription)
    const qr = await QRCode.toDataURL(fullOffer, { width: 400, errorCorrectionLevel: "L" })
    setQrImage(qr)
    setConnectionStatus("waiting")
  }

  // -------------------------------------------------------
  // SCANNED OFFER → GENERATE ANSWER
  // -------------------------------------------------------
  const handleOfferFromQr = async (data) => {
    try {
      const offer = JSON.parse(data)

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      })
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

      const fullAnswer = JSON.stringify(pc.localDescription)
      const qr = await QRCode.toDataURL(fullAnswer, { width: 400, errorCorrectionLevel: "L" })

      setQrImage(qr)
      setCameraMode(false)
      setConnectionStatus("waiting")
    } catch {
      alert("Invalid OFFER QR")
    }
  }

  // -------------------------------------------------------
  // SCANNED ANSWER → FINISH CONNECTION
  // -------------------------------------------------------
  const handleAnswerFromQr = async (data) => {
    try {
      const answer = JSON.parse(data)
      await pcRef.current.setRemoteDescription(answer)
      setConnectionStatus("connected")
      setCameraMode(false)
      setQrImage("")
    } catch {
      alert("Invalid ANSWER QR")
    }
  }

  // -------------------------------------------------------
  // SCAN DECODER
  // -------------------------------------------------------
  const handleScan = (text) => {
    if (text.includes('"type":"offer"')) {
      handleOfferFromQr(text)
    } else if (text.includes('"type":"answer"')) {
      handleAnswerFromQr(text)
    }
  }

  // -------------------------------------------------------
  // SEND LARGE FILE (CHUNKS)
  // -------------------------------------------------------
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

    const chunkSize = 16 * 1024 // 16KB chunks
    const buffer = await file.arrayBuffer()
    const total = buffer.byteLength
    let offset = 0

    while (offset < total) {
      while (channel.bufferedAmount > 1024 * 1024) {
        await new Promise((res) => setTimeout(res, 50))
      }

      const chunk = buffer.slice(offset, offset + chunkSize)
      channel.send(chunk)
      offset += chunkSize

      setSendProgress(Math.floor((offset / total) * 100))
      await new Promise((res) => setTimeout(res, 1))
    }

    channel.send("EOF")
    setSendProgress(100)

    setTimeout(() => {
      setSendingFile(null)
      setSendProgress(0)
    }, 2000)
  }

  // -------------------------------------------------------
  // UI
  // -------------------------------------------------------
  return (
    <div className="w-full min-h-screen bg-background flex flex-col items-center p-6">
      <h1 className="text-foreground text-3xl font-bold mt-8">QR File Transfer</h1>
      <p className="text-foreground/60 mt-2">Peer-to-peer file sharing via WebRTC</p>

      {/* Connection Status */}
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

      {/* Action Buttons */}
      <div className="flex gap-4 mt-6">
        <button
          onClick={createOfferQR}
          disabled={connectionStatus === "connected"}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 px-6 py-3 rounded-xl text-white font-medium transition-colors"
        >
          Create Offer QR
        </button>

        <button
          onClick={() => setCameraMode(true)}
          disabled={connectionStatus === "connected"}
          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-6 py-3 rounded-xl text-white font-medium transition-colors"
        >
          Scan QR
        </button>
      </div>

      {/* Camera Scanner */}
      {cameraMode && (
        <CameraScanner
          onScan={(txt) => {
            handleScan(txt)
            setCameraMode(false)
          }}
          onClose={() => setCameraMode(false)}
        />
      )}

      {/* QR Code Display */}
      {qrImage && (
        <div className="mt-6">
          <img src={qrImage || "/placeholder.svg"} alt="QR Code" className="w-72 bg-white p-4 rounded-xl" />
          <p className="text-foreground/60 text-sm text-center mt-2">
            {connectionStatus === "waiting" ? "Scan this QR with another device" : "QR Code Ready"}
          </p>
        </div>
      )}

      {/* File Selection */}
      {connectionStatus === "connected" && (
        <div className="mt-8 flex flex-col items-center">
          <label className="cursor-pointer bg-muted hover:bg-muted/80 px-6 py-3 rounded-xl text-foreground font-medium transition-colors">
            Select File
            <input type="file" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} className="hidden" />
          </label>

          {selectedFile && (
            <div className="mt-4 text-center">
              <p className="text-foreground font-medium">{selectedFile.name}</p>
              <p className="text-foreground/60 text-sm">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>

              <button
                onClick={() => sendLargeFile(selectedFile)}
                disabled={sendProgress > 0 && sendProgress < 100}
                className="mt-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-3 rounded-xl text-white font-medium transition-colors"
              >
                Send File
              </button>
            </div>
          )}
        </div>
      )}

      {/* Send Progress */}
      {sendingFile && (
        <ProgressBar
          progress={sendProgress}
          fileName={sendingFile}
          label={sendProgress >= 100 ? "File sent successfully!" : "Sending..."}
        />
      )}

      {/* Receive Progress */}
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
