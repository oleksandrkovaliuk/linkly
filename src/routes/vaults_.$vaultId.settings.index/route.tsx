import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/vaults_/$vaultId/settings/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/vaults/$vaultId/settings/appearance",
      params: { vaultId: params.vaultId },
    });
  },
  component: () => null,
});
