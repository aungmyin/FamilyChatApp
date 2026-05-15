import { useState, useEffect, useRef } from 'react';

export const useConnectionQuality = () => {
  const [quality, setQuality] = useState('medium');
  const qualityRef = useRef('medium');

  useEffect(() => {
    const measureBandwidth = async () => {
      try {
        const start = performance.now();
        const testSize = 1024 * 1024; // 1MB
        const response = await fetch(
          `data:text/plain;base64,${btoa('x'.repeat(testSize))}`,
          { cache: 'no-store' }
        );
        const end = performance.now();
        const timeInSeconds = (end - start) / 1000;
        const bandwidthMbps = (testSize * 8) / (timeInSeconds * 1024 * 1024);

        let newQuality = 'low';
        if (bandwidthMbps > 5) {
          newQuality = 'high';
        } else if (bandwidthMbps > 2) {
          newQuality = 'medium';
        }

        if (newQuality !== qualityRef.current) {
          qualityRef.current = newQuality;
          setQuality(newQuality);
        }
      } catch (error) {
        console.warn('Failed to measure bandwidth:', error);
      }
    };

    const interval = setInterval(measureBandwidth, 30000);
    measureBandwidth();

    return () => clearInterval(interval);
  }, []);

  const getConstraints = () => {
    const baseConstraints = {
      audio: true,
      video: {
        facingMode: 'user',
      },
    };

    switch (qualityRef.current) {
      case 'high':
        return {
          ...baseConstraints,
          video: {
            ...baseConstraints.video,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
        };
      case 'medium':
        return {
          ...baseConstraints,
          video: {
            ...baseConstraints.video,
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 24 },
          },
        };
      case 'low':
        return {
          ...baseConstraints,
          video: {
            ...baseConstraints.video,
            width: { ideal: 320 },
            height: { ideal: 240 },
            frameRate: { ideal: 15 },
          },
        };
      default:
        return baseConstraints;
    }
  };

  return { quality, getConstraints };
};
