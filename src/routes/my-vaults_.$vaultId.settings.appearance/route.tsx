import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/my-vaults_/$vaultId/settings/appearance")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/vaults/$vaultId/settings/appearance",
      params: { vaultId: params.vaultId },
      replace: true,
    });
  },
  component: () => null,
});
