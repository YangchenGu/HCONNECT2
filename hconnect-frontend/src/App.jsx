import { useAuth0 } from "@auth0/auth0-react";
import { useState, useEffect } from "react";

function App() {
  const {
    loginWithRedirect,
    logout,
    isAuthenticated,
    user,
    getAccessTokenSilently
  } = useAuth0();

  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [smsSent, setSmsSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState("");

  // 当user加载后，读取localStorage中保存的已验证手机号
  useEffect(() => {
    if (user?.sub) {
      const saved = localStorage.getItem(`verified_phone_${user.sub}`);
      if (saved) {
        setVerifiedPhone(saved);
      }
    }
  }, [user?.sub]);

  const sendVerificationEmail = async () => {
    setLoading(true);
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch("http://localhost:3000/api/send-verification-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setMessage("Verification email sent successfully!");
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Failed to send verification email:", error);
      setMessage("Failed to send verification email");
    }
    setLoading(false);
  };

  const sendSMS = async () => {
    if (!phoneNumber) {
      setMessage("Please enter a phone number");
      return;
    }
    
    setLoading(true);
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch("http://localhost:3000/api/send-sms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ phoneNumber })
      });
      const data = await response.json();
      if (response.ok) {
        setSmsSent(true);
        setMessage("Verification code sent to your phone!");
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Failed to send SMS:", error);
      setMessage("Failed to send SMS");
    }
    setLoading(false);
  };

  const verifySMS = async () => {
    if (!verificationCode) {
      setMessage("Please enter the verification code");
      return;
    }

    setLoading(true);
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch("http://localhost:3000/api/verify-sms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ phoneNumber, code: verificationCode })
      });
      const data = await response.json();
      if (response.ok) {
        // 保存已验证的手机号到本地存储
        localStorage.setItem(`verified_phone_${user?.sub}`, phoneNumber);
        setVerifiedPhone(phoneNumber);
        setMessage("Phone number verified successfully!");
        setSmsSent(false);
        setPhoneNumber("");
        setVerificationCode("");
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Failed to verify SMS:", error);
      setMessage("Failed to verify phone number");
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 40, fontFamily: "Arial, sans-serif" }}>
      <h1>hconnect</h1>

      {!isAuthenticated && (
        <button 
          onClick={() => loginWithRedirect()}
          style={{ padding: "10px 20px", fontSize: 16 }}
        >
          Login
        </button>
      )}

      {isAuthenticated && (
        <>
          <p><strong>Email:</strong> {user.email}</p>
          
          <div style={{ marginTop: 20, padding: 15, border: "1px solid #ccc", borderRadius: 5 }}>
            <h3>Verification Status</h3>
            <p>
              Email:
              <span style={{ 
                color: user.email_verified ? "green" : "red",
                marginLeft: 10,
                fontWeight: "bold"
              }}>
                {user.email_verified ? "✓ Verified" : "✗ Unverified"}
              </span>
            </p>
            
            <p>
              Phone:
              <span style={{ 
                color: verifiedPhone ? "green" : "red",
                marginLeft: 10,
                fontWeight: "bold"
              }}>
                {verifiedPhone ? `✓ Verified (${verifiedPhone.slice(-4)})` : "✗ Unverified"}
              </span>
            </p>
          </div>

          {/* Email Verification Section */}
          {!user.email_verified && (
            <div style={{ marginTop: 20 }}>
              <button 
                onClick={sendVerificationEmail}
                disabled={loading}
                style={{ 
                  padding: "8px 16px",
                  backgroundColor: loading ? "#ccc" : "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: loading ? "not-allowed" : "pointer"
                }}
              >
                {loading ? "Sending..." : "Resend Email Verification"}
              </button>
            </div>
          )}

          {/* SMS Verification Section */}
          {!verifiedPhone && (
            <div style={{ marginTop: 20, padding: 15, backgroundColor: "#f0f0f0", borderRadius: 5 }}>
              <h4>Verify Phone Number with SMS</h4>
              
              {!smsSent ? (
                <>
                  <input
                    type="tel"
                    placeholder="Enter phone number (e.g., +1xxxxxxxxxx)"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    style={{
                      padding: "8px",
                      marginRight: 10,
                      borderRadius: 4,
                      border: "1px solid #ddd",
                      width: 250
                    }}
                  />
                  <button
                    onClick={sendSMS}
                    disabled={loading}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: loading ? "#ccc" : "#28a745",
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      cursor: loading ? "not-allowed" : "pointer"
                    }}
                  >
                    {loading ? "Sending..." : "Send Code"}
                  </button>
                </>
              ) : (
                <>
                  <p style={{ fontWeight: "bold" }}>Verification code sent to {phoneNumber}</p>
                  <input
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    maxLength="6"
                    style={{
                      padding: "8px",
                      marginRight: 10,
                      borderRadius: 4,
                      border: "1px solid #ddd",
                      width: 150
                    }}
                  />
                  <button
                    onClick={verifySMS}
                    disabled={loading}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: loading ? "#ccc" : "#007bff",
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      cursor: loading ? "not-allowed" : "pointer",
                      marginRight: 10
                    }}
                  >
                    {loading ? "Verifying..." : "Verify Code"}
                  </button>
                  <button
                    onClick={() => {
                      setSmsSent(false);
                      setVerificationCode("");
                    }}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#6c757d",
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer"
                    }}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}

          {/* Message Display */}
          {message && (
            <div style={{
              marginTop: 15,
              padding: 10,
              backgroundColor: message.includes("Error") ? "#f8d7da" : "#d4edda",
              color: message.includes("Error") ? "#721c24" : "#155724",
              borderRadius: 4,
              border: `1px solid ${message.includes("Error") ? "#f5c6cb" : "#c3e6cb"}`
            }}>
              {message}
            </div>
          )}

          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 15,
              padding: "8px 16px",
              backgroundColor: "#17a2b8",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer"
            }}
          >
            Refresh Page
          </button>

          <button
            onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
            style={{
              marginTop: 20,
              padding: "8px 16px",
              backgroundColor: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer"
            }}
          >
            Logout
          </button>
        </>
      )}
    </div>
  );
}

export default App;