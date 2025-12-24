// Utility to post a message to the parent window with custom URLSearchParams
export function postParentMessageWithParams(
  setParams: (params: URLSearchParams) => void,
) {
  // 只在嵌入到 HuggingFace 时发送消息（跳过本地开发环境）
  if (typeof window === 'undefined' || window.parent === window) {
    return; // 没有父窗口，跳过
  }
  
  try {
    const parentOrigin = "https://huggingface.co";
    const searchParams = new URLSearchParams();
    setParams(searchParams);
    window.parent.postMessage(
      { queryString: searchParams.toString() },
      parentOrigin,
    );
  } catch (error) {
    console.error("Error posting parent message:", error);
    // 在非 HuggingFace 环境中忽略错误
  }
}
