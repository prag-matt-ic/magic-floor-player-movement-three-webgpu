"use client";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import SplitText from "gsap/dist/SplitText";
import { ArrowLeft, Hand, Mouse, PlayIcon, VolumeOffIcon } from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import React, {
  type FC,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  SwitchTransition,
  Transition,
  TransitionStatus,
} from "react-transition-group";
import WebGPU from "three/examples/jsm/capabilities/WebGPU.js";

import githubIcon from "@/assets/socials/github.svg";
import instagramIcon from "@/assets/socials/instagram.svg";
import linkedinIcon from "@/assets/socials/linkedin.svg";
import mailIcon from "@/assets/socials/mail.svg";
import youtubeIcon from "@/assets/socials/youtube.svg";
import useAudio from "@/hooks/useAudio";
import { QualityMode, Stage, useGameStore } from "@/hooks/useGameStore";

// Register plugins
gsap.registerPlugin(useGSAP, SplitText);
gsap.ticker.fps(60); // Cap GSAP animations at 60fps

type Props = {
  isMobile: boolean;
};

const UI: FC<Props> = ({ isMobile }) => {
  const stage = useGameStore((s) => s.stage);
  const qualityMode = useGameStore((s) => s.qualityMode);
  const setQualityMode = useGameStore((s) => s.setQualityMode);
  const wrapper = useRef<HTMLDivElement>(null);

  const [isSupported, setIsSupported] = useState<boolean | null>(null);

  useLayoutEffect(() => {
    setIsSupported(WebGPU.isAvailable());
  }, []);

  const { playAudio: playBackgroundAudio } = useAudio({
    src: "/sounds/background.aac",
    loop: true,
    volume: 0.45,
  });

  const { playAudio: playTransitionAudio } = useAudio({
    src: "/sounds/transition.aac",
    loop: false,
    volume: 0.66,
  });

  const { playAudio: playCenterAudio, pauseAudio: pauseCenterAudio } = useAudio(
    {
      src: "/sounds/center.aac",
      loop: true,
      volume: 1,
    }
  );

  useEffect(() => {
    if (stage === Stage.LANDING) return;
    if (stage === Stage.INTRO) playBackgroundAudio();
  }, [stage, playBackgroundAudio]);

  useEffect(() => {
    if (stage === Stage.LANDING) return;
    if (stage === Stage.CENTER) playCenterAudio();
    else pauseCenterAudio();
  }, [pauseCenterAudio, playCenterAudio, stage]);

  useEffect(() => {
    if (stage === Stage.LANDING) return;
    playTransitionAudio();
  }, [stage, playTransitionAudio]);

  const isLanding = stage === Stage.LANDING;
  const isCenter = stage === Stage.CENTER;
  const switchKey = `${isLanding}-${isCenter}`;

  return (
    <>
      <SwitchTransition>
        <Transition
          key={switchKey}
          timeout={{ enter: 0, exit: 500 }}
          nodeRef={wrapper}
          appear={true}
        >
          {(transitionStatus) => {
            // Return an empty div
            if (!isLanding && !isCenter)
              return <div ref={wrapper} className="hidden" />;

            // Return UI for supported UI stage
            return (
              <div
                ref={wrapper}
                className="pointer-events-none fixed inset-0 flex items-center justify-center select-none z-50"
              >
                {isLanding && (
                  <Preferences
                    isSupported={isSupported}
                    isMobile={isMobile}
                    transitionStatus={transitionStatus}
                  />
                )}
                {isCenter && (
                  <CenterStage transitionStatus={transitionStatus} />
                )}
              </div>
            );
          }}
        </Transition>
      </SwitchTransition>

      <div className="p-4 fixed top-0 right-0 z-100 pointer-events-auto flex items-center gap-2">
        <label
          htmlFor="quality-select"
          className="text-xs text-white/50 uppercase font-medium"
        >
          Quality
        </label>
        <select
          id="quality-select"
          value={qualityMode}
          onChange={(e) => setQualityMode(e.target.value as QualityMode)}
          className="text-xs font-medium text-white/90 bg-black/30 border border-white/20 rounded-md px-2 py-1 backdrop-blur-sm hover:bg-black/40 focus:outline-none focus:ring-1 focus:ring-white/30"
        >
          {Object.values(QualityMode).map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </select>
      </div>
    </>
  );
};

export default UI;

type SectionProps = {
  transitionStatus: TransitionStatus;
};

type PreferencesProps = SectionProps & {
  isSupported: boolean | null;
  isMobile: boolean;
};

const Preferences: FC<PreferencesProps> = ({
  transitionStatus,
  isSupported,
  isMobile,
}) => {
  const setStage = useGameStore((s) => s.setStage);
  const setIsMuted = useGameStore((s) => s.setIsMuted);
  const container = useRef<HTMLDivElement>(null);

  const canPlay = isSupported && !isMobile;

  useGSAP(
    () => {
      if (transitionStatus === "entered") {
        gsap.fromTo(
          "button",
          {
            opacity: 0,
            scale: 1.1,
          },
          {
            opacity: 1,
            scale: 1,
            duration: 0.4,
            ease: "power1.out",
            stagger: 0.2,
            delay: 0.5,
          }
        );
      }
      if (transitionStatus === "exiting") {
        gsap.to(container.current, {
          opacity: 0,
          duration: 0.4,
          ease: "power1.out",
        });
      }
    },
    { dependencies: [transitionStatus], scope: container }
  );

  const onEnterClick = (isMuted: boolean) => {
    setIsMuted(isMuted);
    setStage(Stage.INTRO);
  };

  return (
    <section
      ref={container}
      className="absolute flex flex-col size-full bg-black/70 pointer-events-auto items-center justify-center gap-6"
    >
      {isMobile && (
        <p className="p-3 max-w-sm text-white text-center">
          This experience is not supported on mobile devices at this time.
        </p>
      )}

      {isSupported === false && (
        <p className="p-3 max-w-md text-white text-center">
          Your browser does not support WebGPU, which is required to run this
          experience. Please try again in a compatible browser such as Chrome or
          Edge (latest versions).
        </p>
      )}

      {canPlay && (
        <>
          <button
            className="opacity-0 flex items-center text-white backdrop-blur-sm gap-3 shadow-xl shadow-white/5 border border-white/20 bg-linear-90 from-white/5 to-white/15 rounded-full py-2.5 px-5 cursor-pointer text-xl font-medium hover:from-black/20 hover:to-black/5"
            onClick={() => onEnterClick(false)}
          >
            <PlayIcon className="size-6" strokeWidth={1.5} />
            Start experience
          </button>
          <button
            className="opacity-0 flex items-center gap-3 cursor-pointer text-white/60 hover:text-white"
            onClick={() => onEnterClick(true)}
          >
            <VolumeOffIcon className="size-5" />
            Start muted
          </button>
        </>
      )}
    </section>
  );
};

const CenterStage: FC<SectionProps> = ({ transitionStatus }) => {
  const container = useRef<HTMLDivElement>(null);
  const setStage = useGameStore((s) => s.setStage);

  useGSAP(
    () => {
      if (transitionStatus === "entered") {
        gsap.timeline().to(container.current, { opacity: 1 }).fromTo(
          ".center-fade-in",
          {
            opacity: 0,
            y: 24,
          },
          {
            opacity: 1,
            y: 0,
            duration: 0.4,
            ease: "power1.out",
            stagger: 0.06,
          }
        );
      }
      if (transitionStatus === "exiting") {
        gsap.to(container.current, {
          opacity: 0,
          duration: 0.3,
          ease: "power1.out",
        });
      }
    },
    { dependencies: [transitionStatus], scope: container }
  );

  return (
    <section
      ref={container}
      className="absolute grid grid-cols-[2fr_3fr_2fr] gap-3 grid-rows-1 px-8 py-4 bg-linear-0 from-[#191818]/40 content-center items-center to-[#191818]/0 inset-x-0 bottom-0 opacity-0"
    >
      {/* Social bar in bottom-left */}
      <div className="center-fade-in pointer-events-auto flex items-center gap-2">
        {SOCIALS.map((social, index) => (
          <a
            key={index}
            href={social.href}
            target="_blank"
            rel="noopener noreferrer"
            className="center-fade-in p-1.5"
          >
            <Image src={social.iconSrc} alt={social.alt} className="size-6" />
          </a>
        ))}
      </div>

      {/* Central control hints */}
      <div className="flex justify-center text-white gap-4 whitespace-nowrap">
        <div className="center-fade-in flex items-center gap-1.5 ">
          <Hand className="size-6" strokeWidth={1.5} />
          <span className="opacity-80">Click and Pan</span>
        </div>
        <div className="center-fade-in flex items-center gap-1.5">
          <Mouse className="size-6" strokeWidth={1.5} />
          <span className="opacity-80">Wheel and Zoom</span>
        </div>
      </div>

      {/* Exit button */}
      <div className="center-fade-in text-white flex justify-end gap-3">
        <button
          className="flex pointer-events-auto items-center py-2 px-5 text-white backdrop-blur-sm gap-3 border border-black/20 rounded-full bg-linear-70 from-black/5 to-black/15"
          onClick={() => setStage(Stage.INNER)}
        >
          <ArrowLeft className="size-5" strokeWidth={2} />
          Exit light
        </button>
      </div>
    </section>
  );
};

const SOCIALS: {
  iconSrc: StaticImageData;
  alt: string;
  href: string;
}[] = [
  {
    iconSrc: linkedinIcon,
    alt: "LinkedIn",
    href: "https://www.linkedin.com/in/matthewjfrawley/",
  },
  {
    iconSrc: youtubeIcon,
    alt: "YouTube",
    href: "https://www.youtube.com/@pragmattic-dev",
  },
  // {
  //   iconSrc: instagramIcon,
  //   alt: "Instagram",
  //   href: "https://www.instagram.com/prag.matt.ic/",
  // },
  { iconSrc: mailIcon, alt: "Email", href: "mailto:pragmattic.ltd@gmail.com" },
  {
    iconSrc: githubIcon,
    alt: "GitHub",
    href: "https://github.com/prag-matt-ic/magic-floor-player-movement-three-webgpu",
  },
] as const;
