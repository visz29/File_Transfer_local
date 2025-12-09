import { useState, useRef, useEffect } from "react";
import QRCode from "qrcode";
import { Html5Qrcode } from "html5-qrcode";
import "./App.css";


// ----------------------
// CAMERA QR SCANNER
// ----------------------
function CameraScanner({ onScan }) {
  useEffect(() => {
    const qr = new Html5Qrcode("qr-reader");

    qr.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      (decodedText) => {
        onScan(decodedText);
        qr.stop().catch(() => {});
      },
      () => {}
    );

    return () => {
      try {
        qr.stop().catch(() => {});
      } catch {}
    };
  }, []);

  return <div id="qr-reader" className="w-80 h-80 bg-black rounded-xl"></div>;
}



// ===================================================
// MAIN APP
// ===================================================
function App() {
  const [qrImage, setQrImage] = useState("");
  const [cameraMode, setCameraMode] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [progress, setProgress] = useState(0);

  const pcRef = useRef(null);
  const channelRef = useRef(null);

  const receivedChunks = useRef([]);

  // ICE COMPLETE PROMISE (VERY IMPORTANT)
  function waitForICE(pc) {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === "complete") return resolve();

      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === "complete") resolve();
      };
    });
  }



  // -------------------------------------------------------
  // CREATE OFFER → QR
  // -------------------------------------------------------
  const createOfferQR = async () => {
    const pc = new RTCPeerConnection();
    pcRef.current = pc;

    const channel = pc.createDataChannel("fileShare");
    channelRef.current = channel;

    channel.onopen = () => console.log("DataChannel ready ✔");
    channel.onerror = (e) => console.log("Channel error:", e);

    channel.onmessage = (e) => receiveChunk(e.data);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // wait for ICE fully gathered
    await waitForICE(pc);

    const fullOffer = JSON.stringify(pc.localDescription);

    const qr = await QRCode.toDataURL(fullOffer, { width: 500 });
    setQrImage(qr);
  };



  // -------------------------------------------------------
  // SCANNED OFFER → GENERATE ANSWER
  // -------------------------------------------------------
  const handleOfferFromQr = async (data) => {
    try {
      const offer = JSON.parse(data);

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      pc.ondatachannel = (event) => {
        const channel = event.channel;
        channelRef.current = channel;

        channel.onopen = () => {
          console.log("DataChannel connected ✔");
        };

        channel.onmessage = (e) => receiveChunk(e.data);
      };

      await pc.setRemoteDescription(offer);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await waitForICE(pc);

      const fullAnswer = JSON.stringify(pc.localDescription);
      const qr = await QRCode.toDataURL(fullAnswer, { width: 500 });

      setQrImage(qr);
      setCameraMode(false);
    } catch {
      alert("Invalid OFFER QR");
    }
  };



  // -------------------------------------------------------
  // SCANNED ANSWER → FINISH CONNECTION
  // -------------------------------------------------------
  const handleAnswerFromQr = async (data) => {
    try {
      const answer = JSON.parse(data);
      await pcRef.current.setRemoteDescription(answer);

      console.log("WebRTC fully connected ✔");
      alert("Connection Ready! You can send files.");

      setCameraMode(false);
    } catch {
      alert("Invalid ANSWER QR");
    }
  };



  // -------------------------------------------------------
  // SCAN DECODER
  // -------------------------------------------------------
  const handleScan = (text) => {
    if (text.includes(`"type":"offer"`)) {
      handleOfferFromQr(text);
    } else if (text.includes(`"type":"answer"`)) {
      handleAnswerFromQr(text);
    }
  };



  // -------------------------------------------------------
  // SEND LARGE FILE (CHUNKS)
  // -------------------------------------------------------
  const sendLargeFile = async (file) => {
    const channel = channelRef.current;

    if (!channel || channel.readyState !== "open") {
      alert("Connection not ready yet!");
      return;
    }

    const chunkSize = 64 * 1024;
    const buffer = await file.arrayBuffer();
    const total = buffer.byteLength;
    let offset = 0;

    while (offset < total) {
      channel.send(buffer.slice(offset, offset + chunkSize));

      offset += chunkSize;

      setProgress(Math.floor((offset / total) * 100));

      await new Promise((res) => setTimeout(res, 1));
    }

    channel.send("EOF");
    alert("File Sent Successfully!");
  };



  // -------------------------------------------------------
  // RECEIVE CHUNKS + BUILD FILE
  // -------------------------------------------------------
  const receiveChunk = (data) => {
    if (data === "EOF") {
      const blob = new Blob(receivedChunks.current);
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "received_file";
      a.click();

      URL.revokeObjectURL(url);
      receivedChunks.current = [];
      return;
    }

    receivedChunks.current.push(data);
  };



  // -------------------------------------------------------
  // UI
  // -------------------------------------------------------
  return (
    <div className="w-full min-h-screen bg-blue-900/50 flex flex-col items-center">

      <h1 className="text-white text-3xl mt-8">🔥 QR ➜ WebRTC File Sharing</h1>

      <button
        onClick={createOfferQR}
        className="mt-6 bg-green-500 px-6 py-3 rounded-xl text-white"
      >
        Create Offer QR
      </button>

      <button
        onClick={() => setCameraMode(true)}
        className="mt-4 bg-purple-600 px-6 py-3 rounded-xl text-white"
      >
        Scan QR With Camera
      </button>

      {cameraMode && (
        <CameraScanner
          onScan={(txt) => {
            handleScan(txt);
            setCameraMode(false);
          }}
        />
      )}

      {qrImage && (
        <img src={qrImage} className="w-72 bg-white p-4 rounded-xl mt-6" />
      )}

      <input
        type="file"
        onChange={(e) => setSelectedFile(e.target.files[0])}
        className="mt-10 text-white"
      />

      {selectedFile && (
        <div className="text-white mt-3">
          <p>📄 {selectedFile.name}</p>
          <p>{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
        </div>
      )}

      {selectedFile && (
        <button
          onClick={() => sendLargeFile(selectedFile)}
          className="mt-4 bg-blue-600 px-6 py-3 rounded-xl text-white"
        >
          Send File
        </button>
      )}

      {progress > 0 && (
        <div className="w-80 bg-gray-300 rounded-full mt-4">
          <div
            className="bg-green-500 h-4 rounded-full"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      )}

    </div>
  );
}

export default App;
