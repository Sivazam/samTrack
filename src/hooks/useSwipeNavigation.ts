import { useRef, useCallback, useEffect } from 'react';

interface UseSwipeNavigationOptions {
  /** Ordered list of tab IDs */
  tabs: string[];
  /** Currently active tab ID */
  activeTab: string;
  /** Callback to change tab */
  onTabChange: (tabId: string) => void;
  /** Minimum swipe distance in px to trigger navigation (default: 50) */
  threshold?: number;
  /** Maximum vertical movement allowed before swipe is cancelled (default: 100) */
  maxVerticalMovement?: number;
  /** Whether swipe navigation is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Returns true if the element or any ancestor (up to the container) is
 * horizontally scrollable, is a table, or is inside a dialog/modal.
 * When true, the swipe gesture should be suppressed so the inner
 * component can handle its own touch interactions.
 */
function isInsideScrollableOrInteractive(target: EventTarget | null, container: HTMLElement): boolean {
  let el = target as HTMLElement | null;
  while (el && el !== container) {
    // 1. Dialog / modal / sheet overlays — never swipe inside these
    if (
      el.getAttribute('role') === 'dialog' ||
      el.getAttribute('data-radix-portal') !== null ||
      el.closest('[role="dialog"]') ||
      el.closest('[data-radix-portal]')
    ) {
      return true;
    }

    // 2. Horizontally scrollable containers (overflow-x-auto / overflow-x-scroll)
    const style = window.getComputedStyle(el);
    const overflowX = style.overflowX;
    if (
      (overflowX === 'auto' || overflowX === 'scroll') &&
      el.scrollWidth > el.clientWidth
    ) {
      return true;
    }

    // 3. Tables and table wrappers
    const tag = el.tagName.toLowerCase();
    if (tag === 'table' || tag === 'thead' || tag === 'tbody' || tag === 'tr' || tag === 'td' || tag === 'th') {
      return true;
    }

    // 4. Explicit opt-out attribute: data-no-swipe
    if (el.hasAttribute('data-no-swipe')) {
      return true;
    }

    el = el.parentElement;
  }
  return false;
}

/**
 * Hook for swipe-to-navigate between tabs on mobile.
 * Returns a ref to attach to the swipeable container element.
 *
 * Swipe left → next tab, swipe right → previous tab.
 * Ignores swipes that are predominantly vertical (scrolling),
 * and swipes originating inside scrollable/interactive content
 * (tables, overflow-x containers, dialogs, elements with data-no-swipe).
 */
export function useSwipeNavigation({
  tabs,
  activeTab,
  onTabChange,
  threshold = 50,
  maxVerticalMovement = 80,
  enabled = true,
}: UseSwipeNavigationOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndX = useRef(0);
  const touchEndY = useRef(0);
  const isSwiping = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled) return;

    // Suppress swipe if touch started inside a scrollable / interactive element
    if (containerRef.current && isInsideScrollableOrInteractive(e.target, containerRef.current)) {
      isSwiping.current = false;
      return;
    }

    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;
    isSwiping.current = true;
  }, [enabled]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isSwiping.current) return;
    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping.current || !enabled) return;
    isSwiping.current = false;

    const deltaX = touchStartX.current - touchEndX.current;
    const deltaY = Math.abs(touchStartY.current - touchEndY.current);

    // Ignore if vertical movement is too large (user is scrolling)
    if (deltaY > maxVerticalMovement) return;

    // Ignore if horizontal movement is too small
    if (Math.abs(deltaX) < threshold) return;

    // Ignore if swipe is more vertical than horizontal
    if (deltaY > Math.abs(deltaX)) return;

    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex === -1) return;

    if (deltaX > 0 && currentIndex < tabs.length - 1) {
      // Swiped left → go to next tab
      onTabChange(tabs[currentIndex + 1]);
    } else if (deltaX < 0 && currentIndex > 0) {
      // Swiped right → go to previous tab
      onTabChange(tabs[currentIndex - 1]);
    }
  }, [enabled, threshold, maxVerticalMovement, tabs, activeTab, onTabChange]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, enabled]);

  return containerRef;
}
