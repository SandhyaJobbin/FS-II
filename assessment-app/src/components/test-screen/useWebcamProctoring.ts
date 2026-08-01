import { useState, useEffect, RefObject } from 'react';
import { CAMERA_PROCTORING_ENABLED } from '../../config';

// Loads a script exactly once and only resolves after it has actually parsed.
// Dedupe MUST share the in-flight promise.
const scriptLoadPromises = new Map<string, Promise<void>>();
const loadScript = (src: string): Promise<void> => {
  const cached = scriptLoadPromises.get(src);
  if (cached) return cached;
  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
      } else {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', (err) => reject(err));
      }
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = (err) => reject(err);
    document.body.appendChild(script);
  });
  scriptLoadPromises.set(src, promise);
  return promise;
};

export function useWebcamProctoring(
  videoRef: RefObject<HTMLVideoElement | null>,
  silentLog: (logType: string, details: Record<string, any>) => void
) {
  const [model, setModel] = useState<any>(null);
  const [webcamActive, setWebcamActive] = useState(false);
  const [faceStatus, setFaceStatus] = useState<'detecting' | 'ok' | 'no_face' | 'multiple_faces'>('detecting');

  // Webcam initialization
  useEffect(() => {
    if (!CAMERA_PROCTORING_ENABLED) return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    const startWebcam = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' }
        });
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          stream = null;
          return;
        }
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.catch(err => {
              if ((err as DOMException).name !== 'AbortError') {
                console.error('Webcam play failed:', err);
              }
            });
          }
          setWebcamActive(true);
        }
      } catch (err) {
        if (!cancelled) console.error('Failed to access webcam:', err);
      }
    };

    startWebcam();
    return () => {
      cancelled = true;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [videoRef]);

  // BlazeFace client-side face recognition model initialization
  useEffect(() => {
    if (!CAMERA_PROCTORING_ENABLED) return;
    let active = true;
    const initModel = async () => {
      try {
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
        if (!(window as any).tf || typeof (window as any).tf.loadGraphModel !== 'function') {
          throw new Error('tf global missing loadGraphModel after tf.min.js load');
        }
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.0.7/dist/blazeface.min.js');
        if (!active) return;
        if (!(window as any).blazeface) throw new Error('blazeface global not available after script load');
        const loadedModel = await (window as any).blazeface.load();
        if (!active) return;
        setModel(loadedModel);
      } catch (err) {
        console.error('Failed to load BlazeFace model:', err);
      }
    };

    initModel();
    return () => {
      active = false;
    };
  }, []);

  // Detection loop
  useEffect(() => {
    if (!model || !videoRef.current || !webcamActive) return;

    const interval = setInterval(async () => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

      try {
        const returnTensors = false;
        const predictions = await model.estimateFaces(videoRef.current, returnTensors);

        if (predictions.length === 0) {
          setFaceStatus('no_face');
          silentLog('webcam_anomaly', {
            description: 'No face detected in webcam view'
          });
        } else if (predictions.length > 1) {
          setFaceStatus('multiple_faces');
          silentLog('webcam_anomaly', {
            description: `Multiple faces detected in webcam view: ${predictions.length} faces`
          });
        } else {
          setFaceStatus('ok');
        }
      } catch (err) {
        console.error('Face prediction error:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [model, webcamActive, videoRef, silentLog]);

  return { faceStatus };
}
