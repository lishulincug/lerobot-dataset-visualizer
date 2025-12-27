import { redirect } from "next/navigation";

export default async function DatasetRootPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; dataset: string }>;
  searchParams: Promise<{ dataset_url?: string }>;
}) {
  const { org, dataset } = await params;
  const { dataset_url } = await searchParams;
  const episodeN = process.env.EPISODES
    ?.split(/\s+/)
    .map((x) => parseInt(x.trim(), 10))
    .filter((x) => !isNaN(x))[0] ?? 0;

  // 保留 dataset_url 查询参数
  const queryString = dataset_url ? `?dataset_url=${encodeURIComponent(dataset_url)}` : '';
  redirect(`/${org}/${dataset}/episode_${episodeN}${queryString}`);
}
