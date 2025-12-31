import React, { useRef, useState } from 'react'
import QRCode from "qrcode"
import jsQR from 'jsqr'
import pako from "pako"

function compressSDP(sdp) {
  const compressed = pako.deflate(sdp)
  return btoa(String.fromCharCode(...compressed))
}
function decompressSDP(shortText) {
  const binary = atob(shortText)
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
  return pako.inflate(bytes, { to: "string" })
}
function extractMinimal(desc) {
  const sdp = desc.sdp

  return {
    t: desc.type,
    i: {
      u: sdp.match(/a=ice-ufrag:(.+)/)?.[1],
      p: sdp.match(/a=ice-pwd:(.+)/)?.[1],
    },
    f: sdp.match(/a=fingerprint:.+/)?.[0],
    c: sdp.match(/a=candidate:.+/g),
    s: sdp.match(/a=sctp-port:\d+/)?.[0],
  }
}
function rebuildSDP(min) {
  return {
    type: min.t,
    sdp:
      `v=0\r\n` +
      `o=- 0 0 IN IP4 127.0.0.1\r\n` +
      `s=-\r\n` +
      `t=0 0\r\n` +
      `m=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n` +
      `c=IN IP4 0.0.0.0\r\n` +
      `a=ice-ufrag:${min.i.u}\r\n` +
      `a=ice-pwd:${min.i.p}\r\n` +
      min.f + `\r\n` +
      `a=setup:actpass\r\n` +
      min.s + `\r\n` +
      min.c.join("\r\n") +
      `\r\n`
  }
}



function Share() {
  let [offer, setOffer] = useState("")
  let [offer2, setOffer2] = useState("")
  let pcRef = useRef('')
  let channelRef = useRef('')
  let [img, setImg] = useState('')
  let videoRef = useRef(null)
  let canvasRef = useRef(null)

  // ✅ Step 1: Create Offer
  const createOffer = async () => {
    // 1. Create PeerConnection
    const pc = new RTCPeerConnection({
      iceServers: [],
    });
    pcRef.current = pc;

    // 2. Create Data Channel
    const channel = pc.createDataChannel("fileShare");
    channelRef.current = channel;

    // 3. Create Offer (SDP)
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // 4. Wait for ICE candidates to collect
    await new Promise((resolve) => {
      pc.onicecandidate = (e) => {
        if (!e.candidate) resolve(); // When ICE gathering finishes
      };
    });

    // 5. Save final offer to textarea
    // console.log(extractMinimal(pc.localDescription));
    let miniDis = extractMinimal(pc.localDescription)
    setOffer(JSON.stringify(extractMinimal(pc.localDescription)));
    let fullOffer = JSON.stringify(pc.localDescription)
    const shortText = compressSDP(JSON.stringify(miniDis))

    console.log(JSON.stringify(miniDis) == decompressSDP(shortText));
    console.log(JSON.stringify(miniDis).length, shortText.length);

    const makeQr = async () => {

      const qr = await QRCode.toDataURL(shortText, {
        width: 400,
        errorCorrectionLevel: "L",
      }).then(res => setImg(res))

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      })
    }
    makeQr()
  };

  async function scanQr() {
    
    // let [qrTetx, setQrText] = useState('');

    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
  })
  videoRef.current.srcObject = stream;
  videoRef.current.setAttribute("playsinline", true);
    await videoRef.current.play();
    
  }
  const scanFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;

      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, canvas.width, canvas.height);

      if (code) {
        setQrText(code.data);
      } else {
        requestAnimationFrame(scanFrame);
      }
      console.log(code.data);
      setOffer2(code.data)
    };
  


  // const originalSDP = JSON.parse(decompressSDP(shortText))
  // console.log(miniDis);
  // console.log(rebuildSDP(originalSDP));


  
  return (
    <>
      <h1>Share</h1>
      <div className='w-full bg-green-200'>
        <h3>Device A</h3>
        <button className='bg-cyan-300' onClick={createOffer}>Create Offer</button>
        <textarea className='w-full' value={offer} readOnly name="" id=""></textarea>
        <img src={img} alt="" />
      </div>
      <div className='w-full bg-green-200'>
        <h3>Device B</h3>
        <button className='bg-cyan-300' onClick={createOffer}>Create Offer</button>
        <textarea className='w-full' value={offer2} readOnly name="" id=""></textarea>
        <button onClick={scanQr}>SCAn QR</button>
        <video ref={videoRef} className="w-full max-w-md rounded-xl" />
      </div>
    </>
  )
}

export default Share