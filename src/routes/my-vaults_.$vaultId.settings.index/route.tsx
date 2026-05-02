import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/my-vaults_/$vaultId/settings/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/my-vaults/$vaultId/settings/appearance",
      params: { vaultId: params.vaultId },
    });
  },
  component: () => null,
});
