import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./app/App";
import { AppErrorBoundary } from "./app/AppErrorBoundary";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <AppErrorBoundary>
        <App />
    </AppErrorBoundary>,
);
