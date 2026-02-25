import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Auth0Provider } from "@auth0/auth0-react";

const onRedirectCallback = (appState) => {

  window.history.replaceState(
    {},
    document.title,
    appState?.returnTo || window.location.pathname
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(
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
    <App />
  </Auth0Provider>
);