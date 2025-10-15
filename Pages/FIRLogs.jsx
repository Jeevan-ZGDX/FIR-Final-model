import React, { useEffect, useState } from "react";
import axios from "axios";
import styled, { createGlobalStyle } from "styled-components";

// ✅ Global fix: make whole body white
const GlobalStyle = createGlobalStyle`
  html, body, #root {
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 0;
    background: #fff;  /* Full white background */
  }
`;

const FIRLogs = () => {
  const [firs, setFIRs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFIRs = async () => {
      try {
        const response = await axios.get("http://localhost:5000/api/firs");

        if (Array.isArray(response.data)) {
          setFIRs(response.data);
        } else if (response.data && Array.isArray(response.data.firs)) {
          setFIRs(response.data.firs);
        } else {
          setFIRs([]);
        }
      } catch (err) {
        console.error("Error fetching FIRs:", err);
        setFIRs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFIRs();
  }, []);

  return (
    <>
      <GlobalStyle />
      <Wrapper>
        <div className="content">
          {loading ? (
            <p>Loading FIR logs...</p>
          ) : firs.length === 0 ? (
            <>
              <h2>FIR Logs</h2>
              <p>No FIRs found.</p>
            </>
          ) : (
            <>
              <h2>FIR Logs</h2>
              <Table>
                <thead>
                  <tr>
                    <th>FIR ID</th>
                    <th>View</th>
                  </tr>
                </thead>
                <tbody>
                  {firs.map((fir, index) => (
                    <tr key={index}>
                      <td>{fir.firId}</td>
                      <td>
                        <a
                          href={fir.gatewayUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open in IPFS
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          )}
        </div>
      </Wrapper>
    </>
  );
};

export default FIRLogs;

// ✅ Styles
const Wrapper = styled.div`
  min-height: 100vh;
  width: 100%;
  background: #fff;
  color: #111;
  display: flex;
  justify-content: center;  /* centers content horizontally */
  align-items: flex-start;  /* keeps content at top */
  padding: 40px 20px;

  .content {
    width: 100%;
    max-width: 900px;   /* ✅ restricts content width */
    margin: 0 auto;
    padding: 20px;
    text-align: center;
  }

  h2 {
    margin-bottom: 20px;
    font-size: 28px;
    font-weight: bold;
    color: #222;
  }

  p {
    font-size: 16px;
    color: #666;
  }
`;

const Table = styled.table`
  width: 100%;
  max-width: 800px;   /* ✅ makes table medium-sized */
  margin: 0 auto;     /* ✅ centers table */
  border-collapse: collapse;
  background: #fff;
  box-shadow: 0px 4px 12px rgba(0,0,0,0.1);
  border-radius: 10px;
  overflow: hidden;

  th,
  td {
    padding: 12px 16px;
    border-bottom: 1px solid #ddd;
    text-align: left;
  }

  th {
    background: #111;
    color: #fff;
    font-weight: bold;
  }

  tr:hover {
    background: #f9f9f9;
  }

  a {
    color: #007bff;
    font-weight: bold;
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }
`;