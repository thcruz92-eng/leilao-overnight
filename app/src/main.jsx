/* Ponto de entrada. */
import * as ReactDOMClient from "react-dom/client";
import "./nuvem.js";
import { App } from "./App.jsx";

ReactDOMClient.createRoot(document.getElementById("root")).render(<App />);
