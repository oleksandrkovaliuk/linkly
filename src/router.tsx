import { createRouter } from "@tanstack/react-router";

import type { AuthContext } from "./hooks/use-auth";
import { routeTree } from "./routeTree.gen";

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
  context: {
    auth: {
      user: undefined,
      isLoading: false,
      authResolved: false,
      canQueryProtected: false,
      session: undefined,
      authenticated: false,
      _clerkUser: undefined,
    },
  },
});

type RouterContext = {
  auth: AuthContext | undefined;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export { router, type RouterContext };
