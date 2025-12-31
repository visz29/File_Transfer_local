"use client"

import { useState, useRef } from "react"
import { QRCodeSVG as QRCode } from "qrcode.react"
import jsQR from "jsqr"
import { Upload, Download, Share2, Send, Camera } from "lucide-react"

export default function Gemini() {
  const [phase, setPhase] = useState("connection") // connection or transfer
  const [mode, setMode] = useState("initiator") // initiator or joiner
  const [connectionId, setConnectionId] = useState("")
  const [connected, setConnected] = useState(false)
  const [peerId, setPeerId] = useState("")

  // File transfer state
  const [transferMode, setTransferMode] = useState("send") // send or receive
  const [selectedFile, setSelectedFile] = useState(null)
  const [qrCodeData, setQrCodeData] = useState("")
  const [fileHistory, setFileHistory] = useState([])

  // Camera/scanning state
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [isScanning, setIsScanning] = useState(false)

  // Generate connection ID
  const generateConnectionId = () => {
    const id = Math.random().toString(36).substring(2, 15)
    setConnectionId(id)
  }

  // Initiator starts connection
  const initiateConnection = () => {
    generateConnectionId()
  }

  // Joiner connects via QR
  const joinConnection = async () => {
    setIsScanning(true)
    startCamera()
  }

  // Start camera for scanning
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        scanQRCode()
      }
    } catch (err) {
      alert("Camera access denied")
      setIsScanning(false)
    }
  }

  // Scan QR code
  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    const video = videoRef.current

    const scanInterval = setInterval(() => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, canvas.width, canvas.height)

        if (code) {
          const scannedId = code.data
          setPeerId(scannedId)
          setConnectionId(scannedId)
          setConnected(true)
          setIsScanning(false)
          stopCamera()
          clearInterval(scanInterval)
          setPhase("transfer")
        }
      }
    }, 100)
  }

  // Stop camera
  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop())
    }
  }

  // Confirm connection as initiator
  const confirmConnection = () => {
    setConnected(true)
    setPhase("transfer")
  }

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  // Generate QR code for file
  const generateFileQR = () => {
    if (!selectedFile) {
      alert("Please select a file")
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target.result
      const fileData = {
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type,
        data: base64,
      }

      const qrData = JSON.stringify(fileData)
      setQrCodeData(qrData)
    }
    reader.readAsDataURL(selectedFile)
  }

  // Scan file QR code
  const scanFileQR = async () => {
    setIsScanning(true)
    startCamera()

    // Listen for file QR scan
    setTimeout(() => {
      if (videoRef.current?.srcObject) {
        const canvas = canvasRef.current
        const ctx = canvas.getContext("2d")
        const video = videoRef.current

        const scanInterval = setInterval(() => {
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            ctx.drawImage(video, 0, 0)

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const code = jsQR(imageData.data, canvas.width, canvas.height)

            if (code) {
              try {
                const fileData = JSON.parse(code.data)
                const link = document.createElement("a")
                link.href = fileData.data
                link.download = fileData.name
                link.click()

                setFileHistory([
                  ...fileHistory,
                  {
                    name: fileData.name,
                    size: fileData.size,
                    timestamp: new Date().toLocaleTimeString(),
                  },
                ])

                setIsScanning(false)
                stopCamera()
                clearInterval(scanInterval)
              } catch (err) {
                console.log("Not a file QR code")
              }
            }
          }
        }, 100)
      }
    }, 500)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-8">P2P File Transfer</h1>

        {/* Connection Phase */}
        {phase === "connection" && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold mb-6 text-gray-700">Establish Connection</h2>

            {!connected ? (
              <div className="space-y-6">
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setMode("initiator")
                      initiateConnection()
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition"
                  >
                    <Share2 size={20} />
                    Start Connection
                  </button>
                  <button
                    onClick={() => {
                      setMode("joiner")
                      joinConnection()
                    }}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition"
                  >
                    <Camera size={20} />
                    Scan QR Code
                  </button>
                </div>

                {/* Initiator QR Display */}
                {mode === "initiator" && connectionId && !connected && (
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-8 rounded-lg text-center">
                    <p className="text-gray-700 mb-4 font-semibold">Show this QR code to connect:</p>
                    <div className="flex justify-center mb-4">
                      <QRCode value={connectionId} size={256} level="H" includeMargin={true} />
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      Connection ID: <span className="font-mono font-bold">{connectionId}</span>
                    </p>
                    <button
                      onClick={confirmConnection}
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded transition"
                    >
                      Ready to Transfer
                    </button>
                  </div>
                )}

                {/* Joiner Camera */}
                {mode === "joiner" && isScanning && (
                  <div className="space-y-4">
                    <video ref={videoRef} autoPlay className="w-full rounded-lg border-4 border-blue-500" />
                    <canvas ref={canvasRef} className="hidden" />
                    <button
                      onClick={() => {
                        setIsScanning(false)
                        stopCamera()
                      }}
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded transition"
                    >
                      Cancel Scan
                    </button>
                  </div>
                )}

                {connected && (
                  <div className="bg-green-100 border-2 border-green-500 p-4 rounded-lg text-center">
                    <p className="text-green-700 font-semibold">✓ Connected! Peer ID: {peerId || connectionId}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center">
                <div className="bg-green-100 border-2 border-green-500 p-4 rounded-lg mb-4">
                  <p className="text-green-700 font-semibold">✓ Connection established!</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Transfer Phase */}
        {phase === "transfer" && connected && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex gap-4 mb-8">
              <button
                onClick={() => setTransferMode("send")}
                className={`flex-1 py-3 px-6 rounded-lg font-semibold flex items-center justify-center gap-2 transition ${
                  transferMode === "send" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                <Send size={20} />
                Send File
              </button>
              <button
                onClick={() => setTransferMode("receive")}
                className={`flex-1 py-3 px-6 rounded-lg font-semibold flex items-center justify-center gap-2 transition ${
                  transferMode === "receive"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                <Download size={20} />
                Receive File
              </button>
            </div>

            {/* Send Mode */}
            {transferMode === "send" && (
              <div className="space-y-6">
                <div className="border-2 border-dashed border-blue-300 rounded-lg p-6 text-center">
                  <input type="file" onChange={handleFileSelect} className="hidden" id="file-input" />
                  <label htmlFor="file-input" className="cursor-pointer flex flex-col items-center gap-2">
                    <Upload size={32} className="text-blue-600" />
                    <span className="text-blue-600 font-semibold">
                      {selectedFile ? selectedFile.name : "Click to select file"}
                    </span>
                    <span className="text-sm text-gray-500">
                      {selectedFile ? `${(selectedFile.size / 1024).toFixed(2)} KB` : "or drag and drop"}
                    </span>
                  </label>
                </div>

                {selectedFile && (
                  <>
                    <button
                      onClick={generateFileQR}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition"
                    >
                      Generate QR Code
                    </button>

                    {qrCodeData && (
                      <div className="bg-blue-50 p-6 rounded-lg text-center">
                        <p className="text-gray-700 mb-4 font-semibold">Scan this QR code to receive the file:</p>
                        <div className="flex justify-center">
                          <QRCode value={qrCodeData} size={256} level="H" includeMargin={true} />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Receive Mode */}
            {transferMode === "receive" && (
              <div className="space-y-6">
                <button
                  onClick={scanFileQR}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition"
                >
                  <Camera size={20} />
                  Scan QR Code to Receive
                </button>

                {isScanning && (
                  <div className="space-y-4">
                    <video ref={videoRef} autoPlay className="w-full rounded-lg border-4 border-indigo-500" />
                    <canvas ref={canvasRef} className="hidden" />
                    <button
                      onClick={() => {
                        setIsScanning(false)
                        stopCamera()
                      }}
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded transition"
                    >
                      Cancel Scan
                    </button>
                  </div>
                )}

                {fileHistory.length > 0 && (
                  <div className="bg-indigo-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-700 mb-3">Received Files</h3>
                    <div className="space-y-2">
                      {fileHistory.map((file, idx) => (
                        <div key={idx} className="bg-white p-3 rounded border border-indigo-200 text-sm">
                          <p className="font-semibold text-gray-700">{file.name}</p>
                          <p className="text-gray-500">
                            {(file.size / 1024).toFixed(2)} KB • {file.timestamp}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => {
                setPhase("connection")
                setConnected(false)
                setConnectionId("")
              }}
              className="w-full mt-8 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-6 rounded transition"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
