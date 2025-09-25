'use client'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import SplitText from 'gsap/dist/SplitText'
import { ArrowRightToLineIcon, Hand, Mouse, PlayIcon, VolumeOffIcon } from 'lucide-react'
import Image, { type StaticImageData } from 'next/image'
import React, { type FC, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SwitchTransition, Transition, TransitionStatus } from 'react-transition-group'
import WebGPU from 'three/examples/jsm/capabilities/WebGPU.js'

import githubIcon from '@/assets/socials/github.svg'
import linkedinIcon from '@/assets/socials/linkedin.svg'
import mailIcon from '@/assets/socials/mail.svg'
import youtubeIcon from '@/assets/socials/youtube.svg'
import useAudio from '@/hooks/useAudio'
import { QualityMode, Stage, useGameStore } from '@/hooks/useGameStore'

// Register plugins
gsap.registerPlugin(useGSAP, SplitText)
gsap.ticker.fps(60) // Cap GSAP animations at 60fps

type Props = {
  isMobile: boolean
}

const UI: FC<Props> = ({ isMobile }) => {
  const stage = useGameStore((s) => s.stage)
  const wrapper = useRef<HTMLDivElement>(null)

  const [isSupported, setIsSupported] = useState<boolean | null>(null)

  useLayoutEffect(() => {
    setIsSupported(WebGPU.isAvailable())
  }, [])

  const { playAudio: playBackgroundAudio } = useAudio({
    src: '/sounds/background.aac',
    loop: true,
    volume: 0.45,
  })

  const { playAudio: playTransitionAudio } = useAudio({
    src: '/sounds/transition.aac',
    loop: false,
    volume: 0.66,
  })

  const { playAudio: playCenterAudio, pauseAudio: pauseCenterAudio } = useAudio({
    src: '/sounds/center.aac',
    loop: true,
    volume: 1,
  })

  useEffect(() => {
    if (stage === Stage.LANDING) return
    if (stage === Stage.INTRO) playBackgroundAudio()
  }, [stage, playBackgroundAudio])

  useEffect(() => {
    if (stage === Stage.LANDING) return
    if (stage === Stage.CENTER) playCenterAudio()
    else pauseCenterAudio()
  }, [pauseCenterAudio, playCenterAudio, stage])

  useEffect(() => {
    if (stage === Stage.LANDING) return
    playTransitionAudio()
  }, [stage, playTransitionAudio])

  const isLanding = stage === Stage.LANDING
  const isCenter = stage === Stage.CENTER
  const switchKey = `${isLanding}-${isCenter}`

  return (
    <SwitchTransition>
      <Transition
        key={switchKey}
        timeout={{ enter: 0, exit: 500 }}
        nodeRef={wrapper}
        appear={true}>
        {(transitionStatus) => {
          // Return an empty div
          if (!isLanding && !isCenter) return <div ref={wrapper} className="hidden" />

          // Return UI for supported UI stage
          return (
            <div
              ref={wrapper}
              className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center select-none">
              {isLanding && (
                <Preferences
                  isSupported={isSupported}
                  isMobile={isMobile}
                  transitionStatus={transitionStatus}
                />
              )}
              {isCenter && <CenterStage transitionStatus={transitionStatus} />}
            </div>
          )
        }}
      </Transition>
    </SwitchTransition>
  )
}

export default UI

type SectionProps = {
  transitionStatus: TransitionStatus
}

type PreferencesProps = SectionProps & {
  isSupported: boolean | null
  isMobile: boolean
}

const Preferences: FC<PreferencesProps> = ({ transitionStatus, isSupported, isMobile }) => {
  const qualityMode = useGameStore((s) => s.qualityMode)
  const setQualityMode = useGameStore((s) => s.setQualityMode)
  const setStage = useGameStore((s) => s.setStage)
  const setIsMuted = useGameStore((s) => s.setIsMuted)
  const container = useRef<HTMLDivElement>(null)

  const canPlay = isSupported && !isMobile

  useGSAP(
    () => {
      if (transitionStatus === 'entered') {
        gsap.fromTo(
          '.preference-fade-in',
          {
            opacity: 0,
            scale: 1.2,
          },
          {
            opacity: 1,
            scale: 1,
            duration: 0.5,
            ease: 'power1.out',
            stagger: 0.08,
            delay: 0.5,
          },
        )
      }
      if (transitionStatus === 'exiting') {
        gsap.to(container.current, {
          opacity: 0,
          duration: 0.4,
          ease: 'power1.out',
        })
      }
    },
    { dependencies: [transitionStatus], scope: container },
  )

  const onEnterClick = (isMuted: boolean) => {
    setIsMuted(isMuted)
    setStage(Stage.INTRO)
  }

  return (
    <section
      ref={container}
      className="pointer-events-auto absolute flex size-full flex-col items-center justify-center gap-6 bg-black/70">
      {isMobile && (
        <p className="preference-fade-in max-w-sm p-3 text-center text-white">
          This experience is not supported on mobile devices at this time.
        </p>
      )}

      {isSupported === false && (
        <p className="preference-fade-in max-w-md p-3 text-center text-white">
          Your browser does not support WebGPU, which is required to run this experience. Please
          try again in a compatible browser such as Chrome or Edge (latest versions).
        </p>
      )}

      {/* Quality settings */}
      <div className="preference-fade-in flex items-center gap-3 opacity-0">
        <label htmlFor="quality-select" className="text-base font-medium text-white">
          Settings
        </label>
        <select
          id="quality-select"
          value={qualityMode}
          onChange={(e) => setQualityMode(e.target.value as QualityMode)}
          className="rounded-md bg-black/30 px-3 py-2 pr-8 text-base font-medium text-white hover:bg-black/40 focus:ring-1 focus:ring-white/30 focus:outline-none">
          {Object.values(QualityMode).map((mode) => (
            <option key={mode} value={mode} className="">
              {mode}
            </option>
          ))}
        </select>
      </div>

      {canPlay && (
        <>
          <button
            className="preference-fade-in flex cursor-pointer items-center gap-3 rounded-full border border-white/20 bg-linear-90 from-white/5 to-white/15 px-5 py-2.5 text-xl font-medium text-white opacity-0 shadow-xl shadow-white/5 backdrop-blur-sm hover:from-black/20 hover:to-black/5"
            onClick={() => onEnterClick(false)}>
            <PlayIcon className="size-6" strokeWidth={1.5} />
            Start experience
          </button>
          <button
            className="preference-fade-in flex cursor-pointer items-center gap-3 text-white/60 opacity-0 hover:text-white"
            onClick={() => onEnterClick(true)}>
            <VolumeOffIcon className="size-5" />
            Start muted
          </button>
        </>
      )}
    </section>
  )
}

const CenterStage: FC<SectionProps> = ({ transitionStatus }) => {
  const container = useRef<HTMLDivElement>(null)
  const setStage = useGameStore((s) => s.setStage)

  useGSAP(
    () => {
      if (transitionStatus === 'entered') {
        gsap.timeline().to(container.current, { opacity: 1 }).fromTo(
          '.center-fade-in',
          {
            opacity: 0,
            y: 24,
          },
          {
            opacity: 1,
            y: 0,
            duration: 0.4,
            ease: 'power1.out',
            stagger: 0.06,
          },
        )
      }
      if (transitionStatus === 'exiting') {
        gsap.to(container.current, {
          opacity: 0,
          duration: 0.3,
          ease: 'power1.out',
        })
      }
    },
    { dependencies: [transitionStatus], scope: container },
  )

  return (
    <section
      ref={container}
      className="absolute inset-x-0 bottom-0 grid grid-cols-2 grid-rows-1 content-center items-center gap-3 bg-linear-0 from-[#191818]/50 to-[#191818]/0 px-8 pt-10 pb-4 opacity-0">
      {/* Social bar in bottom-left */}
      <div className="center-fade-in pointer-events-auto flex items-center gap-2">
        {SOCIALS.map((social, index) => (
          <a
            key={index}
            href={social.href}
            target="_blank"
            rel="noopener noreferrer"
            className="center-fade-in group p-1.5">
            <Image
              src={social.iconSrc}
              alt={social.alt}
              className="size-6 group-hover:scale-110"
            />
          </a>
        ))}
      </div>

      {/* Central control hints */}
      <div className="flex justify-end gap-5 text-lg whitespace-nowrap text-white">
        <div className="center-fade-in flex items-center gap-2">
          <Hand className="size-6" strokeWidth={1.5} />
          <span>Click and Pan</span>
        </div>
        <div className="center-fade-in flex items-center gap-2">
          <Mouse className="size-6" strokeWidth={1.5} />
          <span>Wheel and Zoom</span>
        </div>
        <button
          className="center-fade-in pointer-events-auto flex items-center gap-2 rounded-full border border-white/20 bg-linear-70 from-black/10 to-black/20 px-5 py-2 font-bold text-white shadow-sm shadow-black/10 backdrop-blur-sm hover:from-black/20 hover:to-black/40"
          onClick={() => setStage(Stage.INNER)}>
          Exit light
          <ArrowRightToLineIcon className="size-5" strokeWidth={2} />
        </button>
      </div>
    </section>
  )
}

const SOCIALS: {
  iconSrc: StaticImageData
  alt: string
  href: string
}[] = [
  {
    iconSrc: linkedinIcon,
    alt: 'LinkedIn',
    href: 'https://www.linkedin.com/in/matthewjfrawley/',
  },
  {
    iconSrc: youtubeIcon,
    alt: 'YouTube',
    href: 'https://www.youtube.com/@pragmattic-dev',
  },
  // {
  //   iconSrc: instagramIcon,
  //   alt: "Instagram",
  //   href: "https://www.instagram.com/prag.matt.ic/",
  // },
  { iconSrc: mailIcon, alt: 'Email', href: 'mailto:pragmattic.ltd@gmail.com' },
  {
    iconSrc: githubIcon,
    alt: 'GitHub',
    href: 'https://github.com/prag-matt-ic/magic-floor-player-movement-three-webgpu',
  },
] as const
