import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/my-vaults_/$vaultId/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/vaults/$vaultId",
      params: { vaultId: params.vaultId },
      replace: true,
    });
  },
  component: () => null,
});
