import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import PhoneVerification from "./PhoneVerification";

export default function VerifyWrapper() {
  const { loginWithRedirect } = useAuth0();

  const handleVerified = (fullPhone) => {
    // store preverified phone for later use
    localStorage.setItem("preverified_phone", fullPhone);
    // optional: store country code separately if PhoneVerification returns it
    try {
      const m = fullPhone.match(/^(\+\d+)(?:-(\w{2}))?(\d+)$/);
      if (m && m[2]) localStorage.setItem("preverified_country", m[2]);
    } catch (e) {
      // ignore
    }

    // Redirect to Auth0 signup to complete account creation
    loginWithRedirect({ screen_hint: "signup" });
  };

  return <PhoneVerification onVerified={handleVerified} />;
}
