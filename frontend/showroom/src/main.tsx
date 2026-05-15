import { createRoot } from "react-dom/client";
import { setAuthTokenGetter } from "api-client-react";
import App from "./App";
import { getAuthToken } from "./lib/auth";
import "./index.css";

setAuthTokenGetter(getAuthToken);

createRoot(document.getElementById("root")!).render(<App />);
