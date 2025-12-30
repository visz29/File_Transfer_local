"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import QRCode from "qrcode"
import jsQR from "jsqr"

function ProgressBar({ progress, label, fileName }) {
  const isComplete = progress >= 100

  return (
    <div className="w-full mt-4">
      {fileName && <p className="text-sm font-medium mb-2 truncate text-white">{fileName}</p>}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${isComplete ? "bg-green-500" : "bg-blue-500"}`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <span className="text-sm font-medium w-12 text-right text-white">{Math.round(progress)}%</span>
      </div>
      {label && <p className="text-xs mt-2 text-gray-300">{label}</p>}
    </div>
  )
}

function CameraScanner({ onScan, onClose }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [scanStatus, setScanStatus] = useState("Initializing camera...")
  const [hasCamera, setHasCamera] = useState(true)

  useEffect(() => {
    let mounted = true
    let scanning = false

    const startCamera = async () => {
      try {
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
        setScanStatus("Camera access denied")
      }
    }

    const scanQR = () => {
      if (!mounted || !scanning) return

      const canvas = canvasRef.current
      const video = videoRef.current

      if (canvas && video && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext("2d", { willReadFrequently: true })

        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height)

          if (code) {
            scanning = false
            onScan(code.data)
            return
          }
        }
      }

      if (mounted && scanning) {
        requestAnimationFrame(scanQR)
      }
    }

    startCamera()

    return () => {
      mounted = false
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [onScan])

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-slate-900 p-6 rounded-2xl max-w-md w-full mx-4">
        <h3 className="text-xl font-bold text-white mb-4">Scan QR Code</h3>

        {hasCamera ? (
          <>
            <div className="relative bg-black rounded-xl overflow-hidden mb-4">
              <video ref={videoRef} className="w-full aspect-video" />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 border-2 border-green-500 rounded-xl pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-8 h-8 border-t-2 border-l-2 border-green-500"></div>
                <div className="absolute top-1/4 right-1/4 w-8 h-8 border-t-2 border-r-2 border-green-500"></div>
                <div className="absolute bottom-1/4 left-1/4 w-8 h-8 border-b-2 border-l-2 border-green-500"></div>
                <div className="absolute bottom-1/4 right-1/4 w-8 h-8 border-b-2 border-r-2 border-green-500"></div>
              </div>
            </div>
            <p className="text-sm text-gray-300 text-center mb-4">{scanStatus}</p>
          </>
        ) : (
          <p className="text-red-400 text-center mb-4">{scanStatus}</p>
        )}

        <button
          onClick={onClose}
          className="w-full bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-white font-medium"
        >
          Close
        </button>
      </div>
    </div>
  )
}

function ImageScanner({ onScan, onClose }) {
  const fileInputRef = useRef(null)
  const canvasRef = useRef(null)
  const [scanError, setScanError] = useState("")

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const img = new Image()
        img.onload = () => {
          const canvas = canvasRef.current
          if (!canvas) return

          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext("2d")
          if (!ctx) return

          ctx.drawImage(img, 0, 0)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height)

          if (code) {
            setScanError("")
            onScan(code.data)
          } else {
            setScanError("No QR code found in image")
          }
        }
        img.src = event.target?.result
      } catch (error) {
        setScanError("Error processing image")
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-slate-900 p-6 rounded-2xl max-w-md w-full mx-4">
        <h3 className="text-xl font-bold text-white mb-4">Scan QR from Image</h3>
        <canvas ref={canvasRef} className="hidden" />

        <label className="block bg-gray-900 border-2 border-dashed border-gray-600 rounded-lg p-8 cursor-pointer hover:border-blue-500 transition-colors mb-4">
          <div className="flex flex-col items-center gap-2">
            <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="font-medium">Click to upload QR image</span>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </label>

        {scanError && <p className="text-red-400 text-center mb-4">{scanError}</p>}

        <button
          onClick={onClose}
          className="w-full bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-white font-medium"
        >
          Close
        </button>
      </div>
    </div>
  )
}

export default function Page() {
  const [qrImage, setQrImage] = useState("")
  const [qrText, setQrText] = useState("")
  const [cameraMode, setCameraMode] = useState(false)
  const [imageMode, setImageMode] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [sendProgress, setSendProgress] = useState({})
  const [receiveProgress, setReceiveProgress] = useState({})
  const [connectionStatus, setConnectionStatus] = useState("disconnected")
  const [receivingFiles, setReceivingFiles] = useState({})
  const [sendingFiles, setSendingFiles] = useState({})
  const [manualMode, setManualMode] = useState(false)
  const [manualInput, setManualInput] = useState("")
  const [networkMode, setNetworkMode] = useState("local")
  const [mode, setMode] = useState("idle")

  const pcRef = useRef(null)
  const channelRef = useRef(null)
  const receivedChunks = useRef({})
  const fileMetaRef = useRef({})
  const receivedSizeRef = useRef({})

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
    try {
      const str = typeof data === "string" ? data : new TextDecoder().decode(new Uint8Array(data.slice(0, 100)))

      if (typeof data === "string" && data.startsWith("META:")) {
        const metaStr = data.slice(5)
        const meta = JSON.parse(metaStr)
        fileMetaRef.current[meta.name] = meta
        receivedChunks.current[meta.name] = []
        receivedSizeRef.current[meta.name] = 0
        setReceivingFiles((prev) => ({ ...prev, [meta.name]: meta }))
        setReceiveProgress((prev) => ({ ...prev, [meta.name]: 0 }))
      } else {
        const fileName = Object.keys(fileMetaRef.current).find(
          (name) => !receivedChunks.current[name] || receivedChunks.current[name].length > 0,
        )
        if (fileName) {
          receivedChunks.current[fileName].push(new Uint8Array(data))
          receivedSizeRef.current[fileName] = (receivedSizeRef.current[fileName] || 0) + data.byteLength

          const meta = fileMetaRef.current[fileName]
          const progress = (receivedSizeRef.current[fileName] / meta.size) * 100
          setReceiveProgress((prev) => ({ ...prev, [fileName]: progress }))

          if (progress >= 100) {
            const blob = new Blob(receivedChunks.current[fileName], { type: meta.type })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = meta.name
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)

            setReceiveProgress((prev) => ({ ...prev, [fileName]: 100 }))
            setTimeout(() => {
              setReceivingFiles((prev) => {
                const newFiles = { ...prev }
                delete newFiles[fileName]
                return newFiles
              })
            }, 2000)
          }
        }
      }
    } catch (error) {
      console.error("Error receiving chunk:", error)
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
      setMode("sender")
    }
    channel.onerror = (e) => console.error("Channel error:", e)
    channel.onmessage = (e) => receiveChunk(e.data)

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    await waitForICE(pc)

    const compressed = `o|${btoa(pc.localDescription.sdp).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")}`
    setQrText(compressed)
    const qr = await QRCode.toDataURL(compressed, {
      width: 300,
      errorCorrectionLevel: "L",
    })
    setQrImage(qr)
    setConnectionStatus("waiting for scan")
  }

  const sendFiles = async () => {
    const channel = channelRef.current

    if (!channel || channel.readyState !== "open") {
      alert("Connection not ready!")
      return
    }

    for (const file of selectedFiles) {
      setSendingFiles((prev) => ({ ...prev, [file.name]: true }))
      setSendProgress((prev) => ({ ...prev, [file.name]: 0 }))

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
        const end = Math.min(offset + chunkSize, total)
        const chunk = await readChunk(offset, end)

        if (channel.bufferedAmount > 1024 * 1024) {
          await new Promise((resolve) => setTimeout(resolve, 10))
        }

        channel.send(chunk)
        offset = end

        const progress = (offset / total) * 100
        setSendProgress((prev) => ({ ...prev, [file.name]: progress }))
      }

      setTimeout(() => {
        setSendingFiles((prev) => {
          const newFiles = { ...prev }
          delete newFiles[file.name]
          return newFiles
        })
      }, 2000)
    }

    setSelectedFiles([])
  }

  const handleOfferFromQr = async (text) => {
    try {
      let sdp = text.slice(2)
      if (sdp.includes("|")) {
        sdp = sdp.split("|")[1]
      }
      sdp = atob(
        sdp
          .replace(/-/g, "+")
          .replace(/_/g, "/")
          .padEnd(sdp.length + ((4 - (sdp.length % 4)) % 4), "="),
      )

      const pc = new RTCPeerConnection(getRTCConfig())
      pcRef.current = pc

      pc.ondatachannel = (e) => {
        const channel = e.channel
        channelRef.current = channel
        channel.binaryType = "arraybuffer"
        channel.onopen = () => {
          setConnectionStatus("connected")
          setMode("receiver")
        }
        channel.onerror = (err) => console.error("Channel error:", err)
        channel.onmessage = (e) => receiveChunk(e.data)
      }

      const offer = new RTCSessionDescription({ type: "offer", sdp })
      await pc.setRemoteDescription(offer)

      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await waitForICE(pc)

      const compressed = `a|${btoa(pc.localDescription.sdp).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")}`
      setQrText(compressed)
      const qr = await QRCode.toDataURL(compressed, {
        width: 300,
        errorCorrectionLevel: "L",
      })
      setQrImage(qr)
      setConnectionStatus("Share this answer QR")
    } catch (error) {
      console.error("Offer error:", error)
      alert("Invalid offer. Make sure you copied the full text correctly.")
    }
  }

  const handleAnswerFromQr = async (text) => {
    try {
      let sdp = text.slice(2)
      if (sdp.includes("|")) {
        sdp = sdp.split("|")[1]
      }
      sdp = atob(
        sdp
          .replace(/-/g, "+")
          .replace(/_/g, "/")
          .padEnd(sdp.length + ((4 - (sdp.length % 4)) % 4), "="),
      )

      const pc = pcRef.current

      if (!pc) {
        alert("No offer created yet! Please create an offer first.")
        return
      }

      const answer = new RTCSessionDescription({ type: "answer", sdp })
      await pc.setRemoteDescription(answer)
      setConnectionStatus("connected")
    } catch (error) {
      console.error("Answer error:", error)
      alert("Invalid answer. Make sure you copied the full text correctly.")
    }
  }

  const handleScan = (text) => {
    if (text.startsWith("o|")) {
      handleOfferFromQr(text)
    } else if (text.startsWith("a|")) {
      handleAnswerFromQr(text)
    } else {
      alert("Invalid QR code format. Make sure it's a valid file transfer QR code.")
    }
  }

  const handleManualSubmit = () => {
    if (!manualInput.trim()) {
      alert("Please enter offer or answer text")
      return
    }
    const text = manualInput.trim()
    if (!text.startsWith("o|") && !text.startsWith("a|")) {
      alert("Text must start with 'o|' for offer or 'a|' for answer")
      return
    }
    handleScan(text)
    setManualInput("")
    setManualMode(false)
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(qrText)
    alert("Copied to clipboard!")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-slate-950 text-white p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">File Transfer</h1>
        <p className="text-gray-400 mb-8">Secure peer-to-peer file sharing via QR codes</p>

        <div className="mb-8 flex gap-4">
          <button
            onClick={() => setNetworkMode("local")}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
              networkMode === "local" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            Local Network
          </button>
          <button
            onClick={() => setNetworkMode("internet")}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
              networkMode === "internet" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            Internet
          </button>
        </div>

        <div className="mb-8 p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
          <p className="text-sm text-gray-400">Status</p>
          <p className="text-lg font-semibold capitalize">{connectionStatus}</p>
        </div>

        <div className="flex gap-3 mb-8 flex-wrap">
          <button
            onClick={createOfferQR}
            disabled={connectionStatus === "connected"}
            className="flex-1 min-w-fit bg-green-600 hover:bg-green-700 disabled:opacity-50 px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Send Files
          </button>
          <button
            onClick={() => setCameraMode(true)}
            disabled={connectionStatus === "connected"}
            className="flex-1 min-w-fit bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Scan QR
          </button>
          <button
            onClick={() => setImageMode(true)}
            disabled={connectionStatus === "connected"}
            className="flex-1 min-w-fit bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-6 py-3 rounded-lg font-medium transition-colors"
          >
            QR from Image
          </button>
          <button
            onClick={() => setManualMode(!manualMode)}
            className="flex-1 min-w-fit bg-orange-600 hover:bg-orange-700 px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Manual Entry
          </button>
        </div>

        {qrImage && (
          <div className="mb-8 p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Share QR Code</h3>
            <div className="flex flex-col items-center">
              <img src={qrImage || "/placeholder.svg"} alt="QR Code" className="w-48 bg-white p-4 rounded-lg" />
              <button
                onClick={copyToClipboard}
                className="mt-4 bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Copy as Text
              </button>
            </div>
          </div>
        )}

        {manualMode && (
          <div className="mb-8 p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">Manual Entry</h3>
            <textarea
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Paste offer (o|...) or answer (a|...) text here..."
              className="w-full h-32 bg-gray-900 text-white border border-gray-700 rounded-lg p-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
            />
            <div className="flex gap-3">
              <button
                onClick={handleManualSubmit}
                className="flex-1 bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Connect
              </button>
              <button
                onClick={() => {
                  setManualMode(false)
                  setManualInput("")
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {connectionStatus === "connected" && mode === "sender" && (
          <div className="mb-8 p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Select Files to Send</h3>
            <label className="block bg-gray-900 border-2 border-dashed border-gray-600 rounded-lg p-8 cursor-pointer hover:border-blue-500 transition-colors">
              <div className="flex flex-col items-center gap-2">
                <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="font-medium">Click or drag files here</span>
                <span className="text-sm text-gray-400">Up to 5GB per file</span>
              </div>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  setSelectedFiles(Array.from(e.target.files || []))
                }}
              />
            </label>

            {selectedFiles.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-3">Selected Files ({selectedFiles.length})</h4>
                <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-900 p-3 rounded">
                      <div>
                        <p className="font-medium text-sm">{file.name}</p>
                        <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <button
                        onClick={() => setSelectedFiles(selectedFiles.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:text-red-400"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={sendFiles}
                  className="w-full bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  Send {selectedFiles.length} File{selectedFiles.length !== 1 ? "s" : ""}
                </button>
              </div>
            )}
          </div>
        )}

        {Object.keys(sendingFiles).length > 0 && (
          <div className="mb-8 p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Sending Files</h3>
            {selectedFiles.map((file) => (
              <ProgressBar
                key={file.name}
                progress={sendProgress[file.name] || 0}
                fileName={file.name}
                label={`${(sendProgress[file.name] || 0).toFixed(1)}%`}
              />
            ))}
          </div>
        )}

        {Object.keys(receivingFiles).length > 0 && (
          <div className="mb-8 p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Receiving Files</h3>
            {Object.entries(receivingFiles).map(([name, meta]) => (
              <ProgressBar
                key={name}
                progress={receiveProgress[name] || 0}
                fileName={name}
                label={`${((((receiveProgress[name] || 0) / 100) * meta.size) / 1024 / 1024).toFixed(1)} MB / ${(meta.size / 1024 / 1024).toFixed(1)} MB`}
              />
            ))}
          </div>
        )}
      </div>

      {cameraMode && <CameraScanner onScan={handleScan} onClose={() => setCameraMode(false)} />}
      {imageMode && <ImageScanner onScan={handleScan} onClose={() => setImageMode(false)} />}
    </div>
  )
}
