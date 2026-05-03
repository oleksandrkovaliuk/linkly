import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/my-vaults_/$vaultId/history")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/vaults/$vaultId/history",
      params: { vaultId: params.vaultId },
      replace: true,
    });
  },
  component: () => null,
});
