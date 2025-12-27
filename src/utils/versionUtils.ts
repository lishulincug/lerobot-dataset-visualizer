/**
 * Utility functions for checking dataset version compatibility
 */
// 自定义DATASET_URL需要跳过 SSL 证书验证（用于自定义 HTTPS 服务器）
if (process.env.DATASET_URL) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const DEFAULT_DATASET_URL = "https://huggingface.co/datasets";

// 当前请求的 datasetUrl（用于服务端渲染时传递）
let currentDatasetUrl: string | undefined = undefined;

/**
 * 设置当前请求的 dataset_url
 * 在页面组件的最顶层调用，用于设置当前请求的数据集地址
 */
export function setCurrentDatasetUrl(url: string | undefined | null): void {
  currentDatasetUrl = url || undefined;
  if (url) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }
}

/**
 * 清除当前请求的 dataset_url
 */
export function clearCurrentDatasetUrl(): void {
  currentDatasetUrl = undefined;
}

/**
 * 获取 DATASET_URL，优先级：
 * 1. 当前请求设置的 dataset_url（通过 setCurrentDatasetUrl 设置）
 * 2. 环境变量 process.env.DATASET_URL
 * 3. 默认值 "https://huggingface.co/datasets"
 */
export function getDatasetUrl(): string {
  return currentDatasetUrl || process.env.DATASET_URL || DEFAULT_DATASET_URL;
}

/**
 * 判断是否为自定义 URL（非 HuggingFace 默认地址）
 */
export function isCustomDatasetUrl(): boolean {
  const url = getDatasetUrl();
  return url !== DEFAULT_DATASET_URL;
}

/**
 * 在指定的 datasetUrl 上下文中执行异步函数
 * @param datasetUrl - 自定义数据集地址
 * @param fn - 要执行的异步函数
 */
export async function withDatasetUrl<T>(
  datasetUrl: string | undefined | null,
  fn: () => Promise<T>
): Promise<T> {
  const previousUrl = currentDatasetUrl;
  try {
    setCurrentDatasetUrl(datasetUrl);
    return await fn();
  } finally {
    currentDatasetUrl = previousUrl;
  }
}

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
 * @param repoId - 数据集仓库 ID
 */
export async function getDatasetInfo(repoId: string): Promise<DatasetInfo> {
  try {
    const baseUrl = getDatasetUrl();
    const isCustom = isCustomDatasetUrl();
    
    // 自定义 DATASET_URL 使用简化路径，HuggingFace 需要 resolve/main
    const testUrl = isCustom 
      ? `${baseUrl}/${repoId}/meta/info.json`
      : `${baseUrl}/${repoId}/resolve/main/meta/info.json`;
    
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
 * @param repoId - 数据集仓库 ID
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

/**
 * 构建版本化的 URL
 * @param repoId - 数据集仓库 ID
 * @param version - 数据集版本
 * @param path - 资源路径
 */
export function buildVersionedUrl(repoId: string, version: string, path: string): string {
  const baseUrl = getDatasetUrl();
  const isCustom = isCustomDatasetUrl();
  
  if (isCustom) {
    return `${baseUrl}/${repoId}/${path}`;    
  }
  return `${baseUrl}/${repoId}/resolve/main/${path}`;
}
