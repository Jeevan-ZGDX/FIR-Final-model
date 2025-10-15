import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { useToast } from "../Components/Toast.jsx";

const GovDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState([]);
  const [actioningId, setActioningId] = useState(null);
  const toast = useToast();

  const loadPending = async () => {
    setLoading(true);
    setError(null);
    try {
      const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
      const res = await fetch(`${base}/api/firs?verified=false&limit=25&offset=0`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load FIRs");
      setPending(data.firs || []);
      toast.show("Pending FIRs loaded", "success", 2000);
    } catch (err) {
      setError(err.message);
      toast.show(err.message || "Failed to load FIRs", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const takeAction = async (id, verified) => {
    setActioningId(id);
    setError(null);
    try {
      const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
      const res = await fetch(`${base}/api/firs/${id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verified })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      await loadPending();
      toast.show(verified ? "FIR verified" : "FIR rejected", "success");
    } catch (err) {
      setError(err.message);
      toast.show(err.message || "Action failed", "error");
    } finally {
      setActioningId(null);
    }
  };

  return (
    <Wrapper>
      <h2>Government Dashboard</h2>
      {error && <ErrorBox>{error}</ErrorBox>}
      {loading ? (
        <p><span style={{marginRight:8}}></span>Loading pending FIRs...</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Victim</th>
              <th>Similarity</th>
              <th>IPFS</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((fir) => (
              <tr key={fir.id}>
                <td>{fir.id}</td>
                <td>{fir.victim}</td>
                <td>{fir.similarityScore}</td>
                <td>
                  <a href={fir.gatewayUrl} target="_blank" rel="noreferrer">Open</a>
                </td>
                <td>
                  <button disabled={actioningId===fir.id} onClick={() => takeAction(fir.id, true)}>Verify</button>
                  <button disabled={actioningId===fir.id} onClick={() => takeAction(fir.id, false)}>Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Wrapper>
  );
};

export default GovDashboard;

const Wrapper = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  th, td { padding: 10px; border-bottom: 1px solid #eee; text-align: left; }
  th { background: #111; color: #fff; }
  button { margin-right: 8px; padding: 6px 10px; }
`;

const ErrorBox = styled.div`
  background: #ffe5e5;
  color: #b10000;
  border: 1px solid #ffcccc;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 12px;
`;

import React, { useEffect, useState } from "react";
import styled from "styled-components";

const GovDashboard = () => {
  const [firs, setFirs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("pending");

  const fetchFIRs = async () => {
    try {
      setLoading(true);
      setError(null);
      const verifiedParam = filter === "pending" ? "false" : filter === "verified" ? "true" : undefined;
      const url = verifiedParam ? `http://localhost:5000/api/firs?verified=${verifiedParam}` : `http://localhost:5000/api/firs`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load FIRs");
      setFirs(Array.isArray(data.firs) ? data.firs : data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFIRs();
  }, [filter]);

  const verifyFIR = async (id, verified) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`http://localhost:5000/api/firs/${id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verified })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      await fetchFIRs();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Wrapper>
      <Header>
        <h2>Government Dashboard</h2>
        <Filters>
          <button onClick={() => setFilter("pending")} className={filter === "pending" ? "active" : ""}>Pending</button>
          <button onClick={() => setFilter("verified")} className={filter === "verified" ? "active" : ""}>Verified</button>
          <button onClick={() => setFilter("all")} className={filter === "all" ? "active" : ""}>All</button>
        </Filters>
      </Header>

      {error && <ErrorBox>{error}</ErrorBox>}
      {loading && <p>Loading...</p>}

      <Table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Victim</th>
            <th>Similarity</th>
            <th>Verified</th>
            <th>IPFS</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {firs.map((fir, idx) => (
            <tr key={idx}>
              <td>{fir.id || fir.firId}</td>
              <td>{fir.victim}</td>
              <td>{fir.similarityScore}</td>
              <td>{String(fir.verified)}</td>
              <td>{fir.gatewayUrl ? <a href={fir.gatewayUrl} target="_blank" rel="noreferrer">Open</a> : '-'}</td>
              <td>
                {!fir.verified && (
                  <>
                    <button onClick={() => verifyFIR(fir.id || fir.firId, true)}>Approve</button>
                    <button onClick={() => verifyFIR(fir.id || fir.firId, false)}>Reject</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Wrapper>
  );
};

export default GovDashboard;

const Wrapper = styled.div`
  max-width: 1100px;
  margin: 0 auto;
  padding: 20px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`;

const Filters = styled.div`
  display: flex;
  gap: 8px;
  button {
    padding: 8px 12px;
    border: 1px solid #ddd;
    background: #fff;
    border-radius: 6px;
    cursor: pointer;
  }
  .active {
    background: #111;
    color: #fff;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  th, td {
    padding: 10px;
    border-bottom: 1px solid #eee;
    text-align: left;
  }
  th {
    background: #f7f7f7;
  }
  button {
    margin-right: 8px;
    padding: 6px 10px;
    border: none;
    background: #0a7;
    color: #fff;
    border-radius: 6px;
    cursor: pointer;
  }
  button:last-child {
    background: #a00;
  }
`;

const ErrorBox = styled.div`
  background: #ffe5e5;
  color: #b10000;
  border: 1px solid #ffcccc;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 12px;
`;


