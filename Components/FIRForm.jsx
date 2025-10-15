import { useState, useEffect, useRef } from "react";
import { jsPDF } from "jspdf";
import axios from "axios";

const FIRForm = () => {
  const [account, setAccount] = useState(null);
  const [form, setForm] = useState({
    name: "",
    address: "",
    mobile: "",
    incidentDate: "",
    location: "",
    complaint: "",
  });
  const [pdfBlob, setPdfBlob] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [response, setResponse] = useState(null);
  // OCR / camera states
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [ocrText, setOcrText] = useState("");
  const [ocrRunning, setOcrRunning] = useState(false);
  const [tesseractAvailable, setTesseractAvailable] = useState(true);

  useEffect(() => {
    const connectWallet = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({
            method: "eth_requestAccounts",
          });
          setAccount(accounts[0]);
        } catch (err) {
          console.error("Wallet connection rejected:", err);
        }
      } else {
        alert("Please install MetaMask!");
      }
    };

    if (!account) {
      connectWallet();
    }
  }, [account]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // --- OCR camera controls ---
  const openCamera = async () => {
    setOcrText("");
    setCapturedImage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraOpen(true);
    } catch (err) {
      console.error("Camera open error:", err);
      alert("Unable to access camera. Please grant permission or use image upload.");
    }
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  const captureFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/png");
    setCapturedImage(dataUrl);
    // stop camera after capture
    closeCamera();
    return dataUrl;
  };

  const runOCRonImage = async (dataUrl) => {
    setOcrRunning(true);
    setOcrText("");
    try {
      // Lazy-load tesseract so project can still run without it installed
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker({ logger: m => { /* console.log(m); */ } });
      await worker.load();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      const { data } = await worker.recognize(dataUrl);
      setOcrText(data.text || "");
      await worker.terminate();
      // try to populate form fields
      const parsed = parseOCRText(data.text || "");
      if (parsed) {
        setForm((prev) => ({ ...prev, ...parsed }));
      }
    } catch (err) {
      console.error('OCR error', err);
      setTesseractAvailable(false);
      alert('OCR failed. Make sure tesseract.js is installed (npm install tesseract.js) or try uploading a clearer image.');
    } finally {
      setOcrRunning(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setCapturedImage(dataUrl);
      runOCRonImage(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // try simple heuristics to parse common fields from OCR text
  const parseOCRText = (text) => {
    if (!text) return null;
    const lines = text.split(/\n|\r/).map(l => l.trim()).filter(Boolean);
    const out = {};

    // name heuristics
    for (const l of lines) {
      const lower = l.toLowerCase();
      if (!out.name && (lower.startsWith('name') || lower.startsWith('complainant') || lower.includes('complainant name'))) {
        const parts = l.split(/:|-/);
        out.name = (parts[1] || parts.slice(1).join(' ')).trim();
        break;
      }
    }

    // mobile/phone
    if (!out.mobile) {
      const phoneMatch = text.match(/(\+?\d[\d \-().]{7,}\d)/);
      if (phoneMatch) out.mobile = phoneMatch[0].replace(/[^0-9+]/g, '');
    }

    // incident date (YYYY-MM-DD, DD/MM/YYYY, etc.)
    if (!out.incidentDate) {
      const dateMatch = text.match(/(\d{4}[-/]\d{2}[-/]\d{2})|(\d{2}[-/]\d{2}[-/]\d{4})/);
      if (dateMatch) out.incidentDate = dateMatch[0];
    }

    // location heuristics
    for (const l of lines) {
      const lower = l.toLowerCase();
      if (!out.location && (lower.startsWith('location') || lower.includes('location of incident') || lower.startsWith('place'))) {
        const parts = l.split(/:|-/);
        out.location = (parts[1] || parts.slice(1).join(' ')).trim();
        break;
      }
    }

    // complaint: take remaining text after known field lines
    const knownKeywords = ['name', 'address', 'mobile', 'phone', 'incident', 'location', 'complaint', 'victim', 'date'];
    const complaintLines = lines.filter(l => !knownKeywords.some(k => l.toLowerCase().includes(k)));
    if (complaintLines.length) out.complaint = complaintLines.join(' ');

    return out;
  };

  const handleGenerate = (e) => {
    e.preventDefault();
    if (!account) return alert("Wallet not connected!");

    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("First Information Report (FIR)", 20, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`Complainant Name: ${form.name}`, 20, 40);
    doc.text(`Address: ${form.address}`, 20, 50);
    doc.text(`Mobile: ${form.mobile}`, 20, 60);
    doc.text(`Incident Date: ${form.incidentDate}`, 20, 70);
    doc.text(`Location of Incident: ${form.location}`, 20, 80);
    doc.text(`Victim Wallet: ${account}`, 20, 90);

    const complaintText = doc.splitTextToSize(
      `Complaint: ${form.complaint}`,
      170
    );
    doc.text(complaintText, 20, 110);

    const blob = doc.output("blob");
    setPdfBlob(blob);
    setPdfUrl(URL.createObjectURL(blob));
  };

  const handleConfirm = async () => {
    if (!account) return alert("Wallet not connected!");
    if (!pdfBlob) return alert("Generate FIR PDF first!");

    const formData = new FormData();
    formData.append("file", pdfBlob, "FIR_Report.pdf");
    formData.append("victim", account);

    try {
      const res = await axios.post("http://localhost:5000/fir/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResponse(res.data);
      alert("FIR submitted successfully!");
    } catch (error) {
      console.error("Error uploading FIR:", error);
      alert("Upload failed");
    }
  };

  const handleReject = () => {
    setPdfBlob(null);
    setPdfUrl(null);
    alert("FIR submission cancelled.");
  };

  // 🎨 exact style from Uiverse.io
  const inputStyle = {
    maxWidth: "100%",
    padding: "0.875rem",
    fontSize: "1rem",
    border: "1.5px solid #000",
    borderRadius: "0.5rem",
    boxShadow: "2.5px 3px 0 #000",
    outline: "none",
    transition: "ease 0.25s",
  };

  return (
    <div style={{ width: "100%", maxWidth: "600px", margin: "0 auto" }}>
      <h2>Complaint Form</h2>
      <p>
        <b>Victim Wallet:</b> {account || "Connecting..."}
      </p>

      {/* OCR Controls: open camera, upload image, show OCR */}
      <div style={{ marginBottom: 16 }}>
        <strong>Scan Document (OCR)</strong>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <button onClick={openCamera} style={{ padding: 8 }}>Open Camera</button>
          <label style={{ display: 'inline-block', padding: 8, background: '#eee', borderRadius: 6, cursor: 'pointer' }}>
            Upload Image
            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
          </label>
        </div>

        {cameraOpen && (
          <div style={{ marginTop: 12 }}>
            <video ref={videoRef} autoPlay playsInline style={{ width: '100%', maxWidth: 600 }} />
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button onClick={() => { captureFrame(); }} style={{ padding: 8 }}>Capture</button>
              <button onClick={closeCamera} style={{ padding: 8 }}>Close Camera</button>
            </div>
          </div>
        )}

        {capturedImage && (
          <div style={{ marginTop: 12 }}>
            <h4>Captured Image</h4>
            <img src={capturedImage} alt="captured" style={{ width: '100%', maxWidth: 600 }} />
            <div style={{ marginTop: 8 }}>
              <button onClick={() => runOCRonImage(capturedImage)} disabled={ocrRunning} style={{ padding: 8 }}>
                {ocrRunning ? 'Running OCR...' : 'Run OCR'}
              </button>
            </div>
          </div>
        )}

        {!tesseractAvailable && (
          <div style={{ marginTop: 8, color: 'red' }}>
            Tesseract.js not available. Install with: <code>npm install tesseract.js</code>
          </div>
        )}

        {ocrText && (
          <div style={{ marginTop: 12, textAlign: 'left' }}>
            <h4>OCR Result</h4>
            <pre style={{ whiteSpace: 'pre-wrap', background: '#f9f9f9', padding: 8, borderRadius: 6 }}>{ocrText}</pre>
            <div style={{ marginTop: 8 }}>
              <button onClick={() => {
                const parsed = parseOCRText(ocrText);
                if (parsed) setForm(prev => ({ ...prev, ...parsed }));
              }} style={{ padding: 8 }}>Populate Form from OCR</button>
            </div>
          </div>
        )}
      </div>

      {!pdfUrl && (
        <form
          onSubmit={handleGenerate}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <input type="text" name="name" placeholder="Complainant Name" onChange={handleChange} required style={inputStyle} />
          <input type="text" name="address" placeholder="Address" onChange={handleChange} required style={inputStyle} />
          <input type="text" name="mobile" placeholder="Mobile Number" onChange={handleChange} required style={inputStyle} />
          <input type="date" name="incidentDate" onChange={handleChange} required style={inputStyle} />
          <input type="text" name="location" placeholder="Location of Incident" onChange={handleChange} required style={inputStyle} />
          <textarea name="complaint" placeholder="Complaint Details" onChange={handleChange} required style={{ ...inputStyle, minHeight: "100px" }} />
          <button
            type="submit"
            style={{
              padding: "12px",
              background: "#333",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Generate  PDF
          </button>
        </form>
      )}

      {pdfUrl && (
        <div className="preview">
          <h3>Preview </h3>
          <iframe src={pdfUrl} width="100%" height="400px" title="FIR Preview" />
          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button
              onClick={handleConfirm}
              style={{
                flex: 1,
                padding: "10px",
                background: "green",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
              }}
            >
              Yes, Submit
            </button>
            <button
              onClick={handleReject}
              style={{
                flex: 1,
                padding: "10px",
                background: "red",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
              }}
            >
              No, Cancel
            </button>
          </div>
        </div>
      )}

      {response && (
        <div className="mt-4">
          <h3>Complaint Submitted!</h3>
          <p><b>Complaint ID:</b> {response.firId}</p>
          <p><b>IPFS CID:</b> {response.cid}</p>
          <p><b>Tx Hash:</b> {response.txHash}</p>
        </div>
      )}
    </div>
  );
};

export default FIRForm;
