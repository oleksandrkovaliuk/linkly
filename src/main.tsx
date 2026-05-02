import ReactDOM from "react-dom/client";

import { Entry } from "./entry";

const rootElement = document.getElementById("root")!;

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<Entry />);
}
