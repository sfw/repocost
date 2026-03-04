import type { Metadata } from "next";
import RepoCostApp from "../../RepoCostApp";

interface Props {
  params: Promise<{ owner: string; repo: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_URL || "https://repocost.dev";

  return {
    title: `${owner}/${repo} — repocost`,
    description: `See how much it would cost to build ${owner}/${repo} with human developers. COCOMO II estimate.`,
    openGraph: {
      title: `What would ${owner}/${repo} cost to build?`,
      description: `COCOMO II estimate of the human effort and cost behind ${owner}/${repo}.`,
      type: "website",
      images: [`${baseUrl}/api/og/${owner}/${repo}`],
    },
    twitter: {
      card: "summary_large_image",
      title: `${owner}/${repo} — repocost`,
      description: `See what ${owner}/${repo} would cost to build with human devs.`,
      images: [`${baseUrl}/api/og/${owner}/${repo}`],
    },
  };
}

export default async function RepoPage({ params }: Props) {
  const { owner, repo } = await params;
  return <RepoCostApp initialOwner={owner} initialRepo={repo} />;
}
