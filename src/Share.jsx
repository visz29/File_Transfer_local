import React, { useRef, useState } from 'react'

function Share() {
    let [offer,setOffer] = useState("")
    let pcRef = useRef('')
    let channelRef = useRef('')

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
    console.log(pc);
    setOffer(JSON.stringify(pc.localDescription));

    console.log("Offer created!");
  };
  return (
    <>
    <h1>Share</h1>
    <div className='w-full bg-green-200'>
        <h3>Device A</h3>
        <button className='bg-cyan-300' onClick={createOffer}>Create Offer</button>
        <textarea className='w-full' value={offer} readOnly name="" id=""></textarea>
    </div>
    <div className='w-full bg-green-200'>
        <h3>Device B</h3>
        <button className='bg-cyan-300' onClick={createOffer}>Create Offer</button>
        <textarea className='w-full' value={offer} readOnly name="" id=""></textarea>
    </div>
    </>
  )
}

export default Share