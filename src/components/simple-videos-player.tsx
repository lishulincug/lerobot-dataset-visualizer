"use client";

import React, { useEffect, useRef } from "react";
import { useTime } from "../context/time-context";
import { FaExpand, FaCompress, FaTimes, FaEye } from "react-icons/fa";

type VideoInfo = {
  filename: string;
  url: string;
  isSegmented?: boolean;
  segmentStart?: number;
  segmentEnd?: number;
  segmentDuration?: number;
};

type VideoPlayerProps = {
  videosInfo: VideoInfo[];
  onVideosReady?: () => void;
};

export const SimpleVideosPlayer = ({
  videosInfo,
  onVideosReady,
}: VideoPlayerProps) => {
  const { currentTime, setCurrentTime, isPlaying, setIsPlaying } = useTime();
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [hiddenVideos, setHiddenVideos] = React.useState<string[]>([]);
  const [enlargedVideo, setEnlargedVideo] = React.useState<string | null>(null);
  const [showHiddenMenu, setShowHiddenMenu] = React.useState(false);
  const [videosReady, setVideosReady] = React.useState(false);
  
  // 防止时间同步循环的标记
  const isSyncingRef = useRef(false);
  const lastTimeUpdateRef = useRef(0);
  
  const firstVisibleIdx = videosInfo.findIndex(
    (video) => !hiddenVideos.includes(video.filename)
  );

  // Initialize video refs array
  useEffect(() => {
    videoRefs.current = videoRefs.current.slice(0, videosInfo.length);
  }, [videosInfo.length]);

  // 使用 ref 追踪就绪状态和回调
  const readySetRef = useRef<Set<number>>(new Set());
  const hasCalledReadyRef = useRef(false);
  const onVideosReadyRef = useRef(onVideosReady);
  onVideosReadyRef.current = onVideosReady;
  
  // Handle videos ready - 只在 videosInfo 变化时重新设置
  useEffect(() => {
    // 只在首次加载时重置
    if (videosReady) return;
    
    readySetRef.current.clear();
    hasCalledReadyRef.current = false;
    
    const triggerReady = () => {
      if (hasCalledReadyRef.current) return;
      hasCalledReadyRef.current = true;
      setVideosReady(true);
      if (onVideosReadyRef.current) {
        onVideosReadyRef.current();
      }
      setIsPlaying(true);
    };
    
    const checkReady = (videoIndex: number) => {
      if (hasCalledReadyRef.current) return;
      
      readySetRef.current.add(videoIndex);
      
      if (readySetRef.current.size >= videosInfo.length) {
        triggerReady();
      }
    };

    // 延迟执行，确保 video refs 已填充
    const setupTimer = setTimeout(() => {
      videoRefs.current.forEach((video, index) => {
        if (!video) return;
        
        const info = videosInfo[index];
        
        // 如果视频已经准备好了，直接标记
        if (video.readyState >= 3) {
          if (info.isSegmented) {
            video.currentTime = info.segmentStart || 0;
          }
          checkReady(index);
          return;
        }
        
        // 创建就绪处理函数（防止重复调用）
        let hasMarkedReady = false;
        const markReady = () => {
          if (!hasMarkedReady) {
            hasMarkedReady = true;
            if (info.isSegmented) {
              video.currentTime = info.segmentStart || 0;
            }
            checkReady(index);
          }
        };
        
        video.addEventListener('loadeddata', markReady);
        video.addEventListener('canplaythrough', markReady);
        
        (video as any)._readyHandler = markReady;
      });
    }, 50);
    
    // 备用超时机制：5秒后如果还没全部就绪，强制就绪
    const fallbackTimer = setTimeout(() => {
      if (!hasCalledReadyRef.current && readySetRef.current.size > 0) {
        console.warn('[SimpleVideosPlayer] Fallback: forcing ready state');
        triggerReady();
      }
    }, 5000);

    return () => {
      clearTimeout(setupTimer);
      clearTimeout(fallbackTimer);
    };
  }, [videosInfo.length, setIsPlaying]); // 只依赖视频数量变化
  
  // 单独处理分段视频的边界检测和结束事件
  useEffect(() => {
    if (!videosReady) return;
    
    const cleanups: (() => void)[] = [];
    
    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      
      const info = videosInfo[index];
      
      if (info.isSegmented) {
        const handleTimeUpdate = () => {
          const segmentEnd = info.segmentEnd || video.duration;
          const segmentStart = info.segmentStart || 0;
          
          if (video.currentTime >= segmentEnd - 0.05) {
            video.currentTime = segmentStart;
            if (index === firstVisibleIdx) {
              setCurrentTime(0);
            }
          }
        };
        
        video.addEventListener('timeupdate', handleTimeUpdate);
        cleanups.push(() => video.removeEventListener('timeupdate', handleTimeUpdate));
      } else {
        const handleEnded = () => {
          video.currentTime = 0;
          if (index === firstVisibleIdx) {
            setCurrentTime(0);
          }
        };
        
        video.addEventListener('ended', handleEnded);
        cleanups.push(() => video.removeEventListener('ended', handleEnded));
      }
    });
    
    return () => {
      cleanups.forEach(cleanup => cleanup());
    };
  }, [videosReady, videosInfo, firstVisibleIdx, setCurrentTime]);

  // Handle play/pause - 暂停操作立即执行，不需要等待 videosReady
  useEffect(() => {
    videoRefs.current.forEach((video, idx) => {
      if (video && !hiddenVideos.includes(videosInfo[idx]?.filename)) {
        if (isPlaying) {
          // 播放需要等待视频就绪
          if (videosReady) {
            video.play().catch(e => {
              if (e.name !== 'AbortError') {
                console.error("Error playing video");
              }
            });
          }
        } else {
          // 暂停立即执行
          video.pause();
        }
      }
    });
  }, [isPlaying, videosReady, hiddenVideos, videosInfo]);

  // 追踪上一次的 currentTime，用于检测外部跳转
  const prevCurrentTimeRef = useRef(currentTime);
  
  // Sync video times - 当外部设置时间时同步所有视频
  useEffect(() => {
    if (!videosReady) return;
    
    // 检测是否是大幅跳转（外部设置，如重置按钮）
    const isExternalJump = Math.abs(currentTime - prevCurrentTimeRef.current) > 1;
    prevCurrentTimeRef.current = currentTime;
    
    videoRefs.current.forEach((video, index) => {
      if (video && !hiddenVideos.includes(videosInfo[index].filename)) {
        const info = videosInfo[index];
        let targetTime = currentTime;
        
        if (info.isSegmented) {
          targetTime = (info.segmentStart || 0) + currentTime;
        }
        
        // 主控视频：只在大幅跳转时同步
        // 非主控视频：在差异较大时同步
        const isMainVideo = index === firstVisibleIdx;
        const threshold = isMainVideo ? 1 : 0.5;
        
        if (Math.abs(video.currentTime - targetTime) > threshold || (isExternalJump && isMainVideo)) {
          video.currentTime = targetTime;
        }
      }
    });
  }, [currentTime, videosInfo, videosReady, hiddenVideos, firstVisibleIdx]);

  // Handle time update from first visible video - 添加节流
  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    // 如果正在同步，跳过
    if (isSyncingRef.current) return;
    
    // 节流：至少间隔 100ms
    const now = Date.now();
    if (now - lastTimeUpdateRef.current < 100) return;
    lastTimeUpdateRef.current = now;
    
    const video = e.target as HTMLVideoElement;
    const videoIndex = videoRefs.current.findIndex(ref => ref === video);
    const info = videosInfo[videoIndex];
    
    if (info) {
      let globalTime = video.currentTime;
      if (info.isSegmented) {
        globalTime = video.currentTime - (info.segmentStart || 0);
      }
      
      // 标记正在同步
      isSyncingRef.current = true;
      setCurrentTime(globalTime);
      
      // 下一帧解除标记
      requestAnimationFrame(() => {
        isSyncingRef.current = false;
      });
    }
  };

  // Handle play click for segmented videos
  const handlePlay = (video: HTMLVideoElement, info: VideoInfo) => {
    if (info.isSegmented) {
      const segmentStart = info.segmentStart || 0;
      const segmentEnd = info.segmentEnd || video.duration;
      
      if (video.currentTime < segmentStart || video.currentTime >= segmentEnd) {
        video.currentTime = segmentStart;
      }
    }
    video.play();
  };

  return (
    <>
      {/* Hidden videos menu */}
      {hiddenVideos.length > 0 && (
        <div className="relative mb-4">
          <button
            className="flex items-center gap-2 rounded bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700 border border-slate-500"
            onClick={() => setShowHiddenMenu(!showHiddenMenu)}
          >
            <FaEye /> Show Hidden Videos ({hiddenVideos.length})
          </button>
          {showHiddenMenu && (
            <div className="absolute left-0 mt-2 w-max rounded border border-slate-500 bg-slate-900 shadow-lg p-2 z-50">
              <div className="mb-2 text-xs text-slate-300">
                Restore hidden videos:
              </div>
              {hiddenVideos.map((filename) => (
                <button
                  key={filename}
                  className="block w-full text-left px-2 py-1 rounded hover:bg-slate-700 text-slate-100"
                  onClick={() => setHiddenVideos(prev => prev.filter(v => v !== filename))}
                >
                  {filename}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Videos */}
      <div className="flex flex-wrap gap-x-2 gap-y-6">
        {videosInfo.map((info, idx) => {
          if (hiddenVideos.includes(info.filename)) return null;
          
          const isEnlarged = enlargedVideo === info.filename;
          const isFirstVisible = idx === firstVisibleIdx;
          
          return (
            <div
              key={info.filename}
              className={`${
                isEnlarged
                  ? "z-40 fixed inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center"
                  : "max-w-90"
              }`}
            >
              <p className="truncate w-full rounded-t-xl bg-gray-800 px-2 text-sm text-gray-300 flex items-center justify-between">
                <span>{info.filename}</span>
                <span className="flex gap-1">
                  <button
                    title={isEnlarged ? "Minimize" : "Enlarge"}
                    className="ml-2 p-1 hover:bg-slate-700 rounded"
                    onClick={() => setEnlargedVideo(isEnlarged ? null : info.filename)}
                  >
                    {isEnlarged ? <FaCompress /> : <FaExpand />}
                  </button>
                  <button
                    title="Hide Video"
                    className="ml-1 p-1 hover:bg-slate-700 rounded"
                    onClick={() => setHiddenVideos(prev => [...prev, info.filename])}
                    disabled={videosInfo.filter(v => !hiddenVideos.includes(v.filename)).length === 1}
                  >
                    <FaTimes />
                  </button>
                </span>
              </p>
              <video
                ref={el => { videoRefs.current[idx] = el; }}
                className={`w-full object-contain ${
                  isEnlarged ? "max-h-[90vh] max-w-[90vw]" : ""
                }`}
                muted
                preload="auto"
                onPlay={(e) => handlePlay(e.currentTarget, info)}
                onTimeUpdate={isFirstVisible ? handleTimeUpdate : undefined}
              >
                <source src={info.url} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default SimpleVideosPlayer;
