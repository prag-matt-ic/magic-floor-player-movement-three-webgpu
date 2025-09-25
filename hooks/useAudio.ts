"use client";
import { useCallback, useEffect, useState } from "react";

import { useGameStore } from "@/hooks/useGameStore";

type Params = {
  src: string;
  autoPlay?: boolean;
  loop?: boolean;
  volume?: number;
};

const useAudio = ({
  src,
  autoPlay = false,
  loop = false,
  volume = 1,
}: Params) => {
  const isMuted = useGameStore((s) => s.isMuted);
  const [audio, setAudio] = useState<HTMLAudioElement>();

  useEffect(() => {
    if (!src) return;
    // Create audio element, set properties, and load
    const audioEl = new Audio(src);
    audioEl.loop = loop;
    audioEl.autoplay = autoPlay;
    audioEl.volume = volume;
    audioEl.addEventListener("error", (e) => console.error("audio error", e));
    audioEl.load();
    setAudio(audioEl);

    return () => {
      audioEl.remove();
      audioEl.pause();
    };
  }, [src, autoPlay, loop, volume]);

  useEffect(() => {
    if (!audio) return;
    audio.muted = isMuted;
  }, [audio, isMuted]);

  const playAudio = useCallback(() => {
    if (!audio) return;
    audio.currentTime = 0;
    audio.play();
  }, [audio]);

  const pauseAudio = useCallback(() => {
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }, [audio]);

  return { audio, playAudio, pauseAudio };
};

export default useAudio;
