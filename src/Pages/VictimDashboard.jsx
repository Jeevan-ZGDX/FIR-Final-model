import React, { useState } from "react";
import { useToast } from "../Components/Toast.jsx";
import styled from "styled-components";
import Spinner from "../Components/Spinner.jsx";

const VictimDashboard = () => {
  const [imageFile, setImageFile] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [victimAddress, setVictimAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!imageFile || !audioFile || !victimAddress) {
      setError("Please provide image, audio and victim wallet address.");
      toast.show("Missing required fields", "warning");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("audio", audioFile);
      formData.append("victimAddress", victimAddress);

      const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
      const res = await fetch(`${base}/api/submitFIR`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setResult(data);
      toast.show("FIR submitted successfully", "success");
    } catch (err) {
      setError(err.message);
      toast.show(err.message || "Submission failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Wrapper>
      <h2>Victim Dashboard</h2>
      <Form onSubmit={handleSubmit}>
        <label>
          Victim Wallet Address
          <input
            type="text"
            placeholder="0x..."
            value={victimAddress}
            onChange={(e) => setVictimAddress(e.target.value)}
            required
          />
        </label>
        <label>
          Complaint Image (handwritten or scanned)
          <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} required />
        </label>
        <label>
          Voice Recording (statement)
          <input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files[0])} required />
        </label>
        <button type="submit" disabled={loading}>{loading ? <Spinner label="Submitting" /> : "Submit FIR"}</button>
      </Form>

      {error && <ErrorBox>{error}</ErrorBox>}

      {result && (
        <ResultBox>
          <h3>Submission Result</h3>
          <p><b>Verified:</b> {String(result.verified)}</p>
          <p><b>Similarity Score:</b> {result.similarityScore}</p>
          <p><b>CID:</b> {result.cid}</p>
          <p><b>Tx Hash:</b> {result.txHash}</p>
          <p><b>OCR Text:</b> {result.ocrText}</p>
          <p><b>STT Text:</b> {result.sttText}</p>
          {result.gatewayUrl && (
            <p><a href={result.gatewayUrl} target="_blank" rel="noreferrer">Open on IPFS</a></p>
          )}
        </ResultBox>
      )}
    </Wrapper>
  );
};

export default VictimDashboard;

const Wrapper = styled.div`
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;

  input[type="text"], input[type="file"] {
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 6px;
  }

  button {
    padding: 12px;
    background: #111;
    color: #fff;
    border: none;
    border-radius: 8px;
    cursor: pointer;
  }
`;

const ResultBox = styled.div`
  background: #fafafa;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 16px;
`;

const ErrorBox = styled.div`
  background: #ffe5e5;
  color: #b10000;
  border: 1px solid #ffcccc;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 12px;
`;


