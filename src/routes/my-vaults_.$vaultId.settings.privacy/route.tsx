import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/my-vaults_/$vaultId/settings/privacy")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/vaults/$vaultId/settings/privacy",
      params: { vaultId: params.vaultId },
      replace: true,
    });
  },
  component: () => null,
});
