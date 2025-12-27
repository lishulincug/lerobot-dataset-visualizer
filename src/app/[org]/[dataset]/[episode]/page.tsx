import EpisodeViewer from "./episode-viewer";
import { getEpisodeDataSafe } from "./fetch-data";
import { withDatasetUrl } from "@/utils/versionUtils";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ org: string; dataset: string; episode: string }>;
}) {
  const { org, dataset, episode } = await params;
  return {
    title: `${org}/${dataset} | episode ${episode}`,
  };
}

export default async function EpisodePage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; dataset: string; episode: string }>;
  searchParams: Promise<{ dataset_url?: string }>;
}) {
  // episode is like 'episode_1'
  const { org, dataset, episode } = await params;
  const { dataset_url } = await searchParams;
  
  // fetchData should be updated if needed to support this path pattern
  const episodeNumber = Number(episode.replace(/^episode_/, ""));
  
  // 使用 withDatasetUrl 设置请求上下文中的 dataset_url
  const { data, error } = await withDatasetUrl(dataset_url, () => 
    getEpisodeDataSafe(org, dataset, episodeNumber)
  );
  
  return (
    <Suspense fallback={null}>
      <EpisodeViewer data={data} error={error} />
    </Suspense>
  );
}
