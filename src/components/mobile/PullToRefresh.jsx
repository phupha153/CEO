import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";

/**
 * PullToRefresh: Mobile-friendly pull-to-refresh component
 * Usage:
 * <PullToRefresh onRefresh={handleRefresh}>
 *   <div>Your scrollable content</div>
 * </PullToRefresh>
 */
export default function PullToRefresh({ onRefresh, children }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const containerRef = useRef(null);

  const REFRESH_THRESHOLD = 100;

  const handleTouchStart = (e) => {
    if (containerRef.current?.scrollTop === 0) {
      startYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e) => {
    if (isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const distance = currentY - startYRef.current;

    if (distance > 0 && containerRef.current?.scrollTop === 0) {
      setPullDistance(Math.min(distance, REFRESH_THRESHOLD * 1.5));
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance >= REFRESH_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } catch (error) {
        console.error("Refresh error:", error);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: true });
    container.addEventListener("touchend", handleTouchEnd);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [pullDistance, isRefreshing]);

  const pullProgress = Math.min(pullDistance / REFRESH_THRESHOLD, 1);

  return (
    <div ref={containerRef} className="relative overflow-hidden h-full">
      <AnimatePresence>
        {pullDistance > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-0 left-0 right-0 h-20 flex items-center justify-center z-20 pointer-events-none"
            style={{ height: pullDistance }}
          >
            <motion.div
              animate={{ rotate: pullProgress * 180 }}
              className="text-blue-600"
            >
              <RefreshCw
                className="w-6 h-6"
                style={{ opacity: Math.min(pullProgress, 1) }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isRefreshing && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 pointer-events-none">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          >
            <RefreshCw className="w-6 h-6 text-blue-600" />
          </motion.div>
        </div>
      )}

      <div style={{ transform: `translateY(${pullDistance}px)` }}>
        {children}
      </div>
    </div>
  );
}