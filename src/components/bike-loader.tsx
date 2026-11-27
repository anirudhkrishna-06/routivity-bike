"use client";

import { useEffect, useRef } from "react";
import type { AnimationItem } from "lottie-web";

let animationDataPromise: Promise<unknown> | undefined;

function getAnimationData() {
  animationDataPromise ??= fetch("/Bike.json", { cache: "force-cache" }).then((response) => {
    if (!response.ok) throw new Error("Unable to load the bike animation");
    return response.json();
  });
  return animationDataPromise;
}

export function preloadBikeLoader() {
  void getAnimationData().catch(() => undefined);
}

export function BikeLoader({ className = "" }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<AnimationItem | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      import("lottie-web"),
      getAnimationData(),
    ]).then(([{ default: lottie }, animationData]) => {
      if (cancelled || !containerRef.current) return;

      animationRef.current = lottie.loadAnimation({
        container: containerRef.current,
        renderer: "svg",
        loop: true,
        autoplay: true,
        animationData,
      });
    }).catch(() => undefined);

    return () => {
      cancelled = true;
      animationRef.current?.destroy();
      animationRef.current = undefined;
    };
  }, []);

  return <div ref={containerRef} className={`bike-loader ${className}`} aria-hidden="true" />;
}
