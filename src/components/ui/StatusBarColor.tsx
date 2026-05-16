'use client';

import { useEffect } from 'react';

export type StatusBarTheme = 'blue' | 'green' | 'white' | 'black';

interface StatusBarColorProps {
  theme: StatusBarTheme;
}

export function StatusBarColor({ theme }: StatusBarColorProps) {
  // Define status bar colors for each theme
  const statusBarColors = {
    blue: {
      light: '#0d7c3f',
      dark: '#0d7c3f'
    },
    green: {
      light: '#059669',
      dark: '#059669'
    },
    white: {
      light: '#ffffff',
      dark: '#ffffff'
    },
    black: {
      light: '#000000',
      dark: '#000000'
    }
  };

  const colors = statusBarColors[theme];

  // Effect to dynamically update meta tags
  useEffect(() => {
    if (typeof document === 'undefined') return;

    // Remove existing theme-color meta tags
    document.querySelectorAll('meta[name="theme-color"]').forEach(tag => tag.remove());
    document.querySelectorAll('meta[name="msapplication-TileColor"]').forEach(tag => tag.remove());
    document.querySelectorAll('meta[name="apple-mobile-web-app-status-bar-style"]').forEach(tag => tag.remove());

    // Create and append new theme-color meta tags
    const lightMetaTag = document.createElement('meta');
    lightMetaTag.name = 'theme-color';
    lightMetaTag.content = colors.light;
    lightMetaTag.setAttribute('media', '(prefers-color-scheme: light)');
    document.head.appendChild(lightMetaTag);

    const darkMetaTag = document.createElement('meta');
    darkMetaTag.name = 'theme-color';
    darkMetaTag.content = colors.dark;
    darkMetaTag.setAttribute('media', '(prefers-color-scheme: dark)');
    document.head.appendChild(darkMetaTag);

    const tileMetaTag = document.createElement('meta');
    tileMetaTag.name = 'msapplication-TileColor';
    tileMetaTag.content = colors.light;
    document.head.appendChild(tileMetaTag);

    const appleMetaTag = document.createElement('meta');
    appleMetaTag.name = 'apple-mobile-web-app-status-bar-style';
    appleMetaTag.content = (theme === 'blue' || theme === 'green') ? 'black-translucent' : 'default';
    document.head.appendChild(appleMetaTag);

    return () => {
      lightMetaTag.remove();
      darkMetaTag.remove();
      tileMetaTag.remove();
      appleMetaTag.remove();
    };
  }, [theme, colors]);

  return null;
}
