import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/my-vaults_/$vaultId/settings/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/vaults/$vaultId/settings",
      params: { vaultId: params.vaultId },
      replace: true,
    });
  },
  component: () => null,
});
