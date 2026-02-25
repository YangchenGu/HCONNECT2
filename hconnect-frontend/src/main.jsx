import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Auth0Provider } from "@auth0/auth0-react";
import App from "./App";
import "./styles.css";

const onRedirectCallback = (appState) => {
  window.history.replaceState(
    {},
    document.title,
    appState?.returnTo || window.location.pathname
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Auth0Provider
      domain="dev-djjtzi8ndryc2nbd.us.auth0.com"
      clientId="HBvwMALqe8ayNasvJCgdRCeQBqPLiCmQ"
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: "https://hconnect-api"
      }}
      onRedirectCallback={onRedirectCallback}
      cacheLocation="localstorage"
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Auth0Provider>
  </React.StrictMode>
);