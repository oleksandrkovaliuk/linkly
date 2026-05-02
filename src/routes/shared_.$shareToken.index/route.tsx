import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/shared_/$shareToken/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/public/$token",
      params: { token: params.shareToken },
      replace: true,
    });
  },
  component: () => null,
});
