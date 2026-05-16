'use client';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, CheckCircle, ArrowRight, ChevronLeft, ChevronRight, GraduationCap, Users, BarChart3 } from 'lucide-react';
import { markIntroCarouselAsSeen } from '@/lib/intro-carousel';
import { StatusBarColor } from '@/components/ui/StatusBarColor';
import Image from 'next/image';

interface AppIntroCarouselProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export function AppIntroCarousel({ onComplete, onSkip }: AppIntroCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const currentSlideRef = useRef(currentSlide);
  const isAnimatingRef = useRef(isAnimating);

  useEffect(() => {
    currentSlideRef.current = currentSlide;
  }, [currentSlide]);

  useEffect(() => {
    isAnimatingRef.current = isAnimating;
  }, [isAnimating]);

  const slides = [
    {
      title: "Welcome to Samhitha",
      subtitle: "College Admissions Made Simple",
      description: "The smart admissions tracking platform designed for colleges. Manage leads, track PROs, and convert more enrollments with confidence and clarity.",
      icon: GraduationCap,
      buttonText: "Continue",
      accentColor: "from-emerald-500 to-teal-600",
      glowColor: "shadow-emerald-500/30"
    },
    {
      title: "Powerful Tracking",
      subtitle: "Leads, Teams & Areas",
      description: "Track every lead from first contact to enrollment. Assign PROs, manage teams, set reminders, and get real-time status updates with GPS validation.",
      icon: Users,
      buttonText: "Explore",
      accentColor: "from-teal-500 to-cyan-600",
      glowColor: "shadow-teal-500/30"
    },
    {
      title: "Smart Analytics",
      subtitle: "Data-Driven Admissions",
      description: "Get actionable insights with conversion funnels, PRO performance metrics, and daily trends. Make informed decisions and boost your enrollment rates.",
      icon: BarChart3,
      buttonText: "Get Started",
      accentColor: "from-amber-500 to-orange-600",
      glowColor: "shadow-amber-500/30",
      isLastSlide: true
    }
  ];

  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX);
  const handleTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
  const handleTouchEnd = () => {
    if (touchStart - touchEnd > 75) nextSlide();
    else if (touchEnd - touchStart > 75) prevSlide();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnimatingRef.current) return;
      if (e.key === 'ArrowLeft' && currentSlideRef.current > 0) {
        setCurrentSlide(currentSlideRef.current - 1);
      } else if (e.key === 'ArrowRight' && currentSlideRef.current < slides.length - 1) {
        setCurrentSlide(currentSlideRef.current + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const nextSlide = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      handleComplete();
    }
    setTimeout(() => setIsAnimating(false), 1200);
  };

  const prevSlide = () => {
    if (isAnimating || currentSlide === 0) return;
    setIsAnimating(true);
    setCurrentSlide(currentSlide - 1);
    setTimeout(() => setIsAnimating(false), 1200);
  };

  const handleSkip = () => {
    markIntroCarouselAsSeen();
    if (onSkip) onSkip();
    else onComplete();
  };

  const handleComplete = () => {
    markIntroCarouselAsSeen();
    onComplete();
  };

  const goToSlide = (index: number) => {
    if (isAnimating || index === currentSlide) return;
    setIsAnimating(true);
    setCurrentSlide(index);
    setTimeout(() => setIsAnimating(false), 1200);
  };

  return (
    <>
      <StatusBarColor theme="black" />

      <div
        ref={carouselRef}
        className="fixed inset-0 overflow-hidden bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-700 font-[var(--font-dm-sans),var(--font-geist-sans),sans-serif]"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Decorative background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-400/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-teal-400/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-400/5 rounded-full blur-3xl" />
        </div>

        {/* Logo */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-30">
          <div className="flex items-center space-x-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full px-6 py-3">
            <Image src="/logoMain.png" alt="Samhitha Logo" width={32} height={32} className="rounded-lg" />
            <span className="text-white font-semibold text-lg tracking-wide">Samhitha</span>
          </div>
        </div>

        {/* Skip */}
        <div className="absolute top-6 right-6 z-30">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="text-white/90 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 rounded-full px-4 py-2"
          >
            <X className="w-4 h-4 mr-1" /> Skip
          </Button>
        </div>

        {/* Slide Content */}
        <div className="relative z-20 h-full flex flex-col justify-center px-6 md:px-12 lg:px-20">
          {slides.map((slide, index) => {
            const Icon = slide.icon;
            return (
              <div
                key={index}
                className={`max-w-lg mx-auto transition-all duration-1000 ${index === currentSlide
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-12 pointer-events-none'
                  }`}
              >
                <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-8 md:p-10 space-y-6">
                  {/* Icon */}
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${slide.accentColor} flex items-center justify-center shadow-lg ${slide.glowColor}`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>

                  {/* Subtitle */}
                  <div className="flex items-center space-x-3">
                    <div className={`h-0.5 bg-gradient-to-r ${slide.accentColor} rounded-full w-12`} />
                    <p className="text-sm font-semibold text-emerald-200/90 uppercase tracking-widest">
                      {slide.subtitle}
                    </p>
                  </div>

                  {/* Title */}
                  <h1 className={`text-3xl md:text-4xl font-black leading-tight bg-gradient-to-r ${slide.accentColor} bg-clip-text text-transparent`}>
                    {slide.title}
                  </h1>

                  {/* Description */}
                  <p className="text-base text-white/80 leading-relaxed font-light">
                    {slide.description}
                  </p>

                  {/* Button */}
                  <div className="pt-2">
                    <Button
                      onClick={slide.isLastSlide ? handleComplete : nextSlide}
                      className={`w-full group relative overflow-hidden bg-gradient-to-r ${slide.accentColor} text-white font-semibold py-4 text-base rounded-xl transition-all duration-300 ${slide.glowColor}`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                      <div className="relative flex items-center justify-center">
                        {slide.isLastSlide ? (
                          <>
                            <CheckCircle className="w-5 h-5 mr-3" />
                            {slide.buttonText}
                          </>
                        ) : (
                          <>
                            {slide.buttonText}
                            <ArrowRight className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform" />
                          </>
                        )}
                      </div>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Arrows */}
        {currentSlide > 0 && (
          <button
            onClick={prevSlide}
            disabled={isAnimating}
            className="absolute left-6 top-1/2 -translate-y-1/2 z-30 group disabled:opacity-50"
          >
            <div className="bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 rounded-full p-3 group-hover:scale-110 transition">
              <ChevronLeft className="w-6 h-6 text-white" />
            </div>
          </button>
        )}
        {currentSlide < slides.length - 1 && (
          <button
            onClick={nextSlide}
            disabled={isAnimating}
            className="absolute right-6 top-1/2 -translate-y-1/2 z-30 group disabled:opacity-50"
          >
            <div className="bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 rounded-full p-3 group-hover:scale-110 transition">
              <ChevronRight className="w-6 h-6 text-white" />
            </div>
          </button>
        )}

        {/* Dots */}
        <div className="absolute bottom-8 left-8 z-30">
          <div className="flex items-center space-x-4 bg-black/20 backdrop-blur-xl border border-white/20 rounded-full px-6 py-3">
            <div className="flex space-x-2">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`relative transition-all duration-500 ${index === currentSlide ? 'w-10' : 'w-2'}`}
                  disabled={isAnimating}
                >
                  <div className={`h-2 rounded-full ${index === currentSlide
                    ? `bg-gradient-to-r ${slides[currentSlide].accentColor}`
                    : 'bg-white/40 hover:bg-white/60'
                    }`} />
                </button>
              ))}
            </div>
            <div className="flex items-center space-x-2 text-white/80 font-medium">
              <span className="text-lg font-bold">{currentSlide + 1}</span>
              <div className="w-px h-4 bg-white/40" />
              <span className="text-sm">{slides.length}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
