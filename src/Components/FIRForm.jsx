import { useState, useEffect } from "react";
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
