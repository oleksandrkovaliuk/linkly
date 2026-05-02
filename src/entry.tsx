import { RouterProvider } from "@tanstack/react-router";

import { router } from "./router";

import "./index.css";

import { Providers } from "./components/providers";
import { useAuth } from "./hooks/use-auth";

function InnerEntry() {
  const auth = useAuth();

  return <RouterProvider router={router} context={{ auth }} />;
}

export function Entry() {
  return (
    <Providers>
      <InnerEntry />
    </Providers>
  );
}
