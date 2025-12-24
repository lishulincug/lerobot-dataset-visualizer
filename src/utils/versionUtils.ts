/**
 * Utility functions for checking dataset version compatibility
 */
// 开发环境下跳过 SSL 证书验证（用于自定义 HTTPS 服务器）
if (process.env.NODE_ENV === 'development' && process.env.DATASET_URL) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const DATASET_URL = process.env.DATASET_URL || "https://huggingface.co/datasets";

/**
 * Dataset information structure from info.json
 */
interface DatasetInfo {
  codebase_version: string;
  robot_type: string | null;
  total_episodes: number;
  total_frames: number;
  total_tasks: number;
  chunks_size: number;
  data_files_size_in_mb: number;
  video_files_size_in_mb: number;
  fps: number;
  splits: Record<string, string>;
  data_path: string;
  video_path: string;
  features: Record<string, any>;
}

/**
 * Fetches dataset information from the main revision
 */
export async function getDatasetInfo(repoId: string): Promise<DatasetInfo> {
  try {
    // 自定义 DATASET_URL 使用简化路径，HuggingFace 需要 resolve/main
    const isCustomUrl = !!process.env.DATASET_URL;
    const testUrl = isCustomUrl 
      ? `${DATASET_URL}/${repoId}/meta/info.json`
      : `${DATASET_URL}/${repoId}/resolve/main/meta/info.json`;
    
    console.log(`[getDatasetInfo] Fetching: ${testUrl}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(testUrl, { 
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch dataset info from ${testUrl}: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Check if it has the required structure
    if (!data.features) {
      throw new Error("Dataset info.json does not have the expected features structure");
    }
    
    return data as DatasetInfo;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(
      `Dataset ${repoId} is not compatible with this visualizer. ` +
      "Failed to read dataset information from the main revision."
    );
  }
}


/**
 * Gets the dataset version by reading the codebase_version from the main revision's info.json
 */
export async function getDatasetVersion(repoId: string): Promise<string> {
  try {
    const datasetInfo = await getDatasetInfo(repoId);
    
    // Extract codebase_version
    const codebaseVersion = datasetInfo.codebase_version;
    if (!codebaseVersion) {
      throw new Error("Dataset info.json does not contain codebase_version");
    }
    
    // Validate that it's a supported version
    const supportedVersions = ["v3.0", "v2.1", "v2.0"];
    if (!supportedVersions.includes(codebaseVersion)) {
      throw new Error(
        `Dataset ${repoId} has codebase version ${codebaseVersion}, which is not supported. ` +
        "This tool only works with dataset versions 3.0, 2.1, or 2.0. " +
        "Please use a compatible dataset version."
      );
    }
    
    return codebaseVersion;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(
      `Dataset ${repoId} is not compatible with this visualizer. ` +
      "Failed to read dataset information from the main revision."
    );
  }
}

export function buildVersionedUrl(repoId: string, version: string, path: string): string {
  const isCustomUrl = !!process.env.DATASET_URL;
  if (isCustomUrl) {
    return `${DATASET_URL}/${repoId}/${path}`;    
  }
  return `${DATASET_URL}/${repoId}/resolve/main/${path}`;
}

