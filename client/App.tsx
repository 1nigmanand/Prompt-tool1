import React, { useState, useEffect, useCallback, useRef } from 'react';
import { initializeAuthListener, signOut, getCurrentUser } from './services/firebaseAuthService';
import { ChallengeStatus, ChallengeProgress, User } from './types';
import { CHALLENGES } from './constants';
import { checkBackendHealth } from './services/ApiService';
import { audioSources } from './services/audioService';
import GoogleSignIn from './components/GoogleSignIn';
import ChallengeHost from './components/ChallengeHost';
import Spinner from './components/Spinner';

const PROGRESS_STORAGE_KEY = 'prompt-challenge-progress';
const MUTE_STORAGE_KEY = 'prompt-challenge-muted';

const App: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(getCurrentUser());
  const [isHidingAuth, setIsHidingAuth] = useState(false);
  
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      const savedState = localStorage.getItem(MUTE_STORAGE_KEY);
      return savedState ? JSON.parse(savedState) : false;
    } catch (e) {
      console.error("Failed to parse mute state from local storage", e);
      return false;
    }
  });

  const [challengeProgress, setChallengeProgress] = useState<Record<number, ChallengeProgress>>({});
  const [streakChange, setStreakChange] = useState<'increase' | 'decrease' | 'none'>('none');
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const streakUpAudioRef = useRef<HTMLAudioElement>(null);
  const streakDownAudioRef = useRef<HTMLAudioElement>(null);
  const buttonClickAudioRef = useRef<HTMLAudioElement>(null);
  const loginAudioRef = useRef<HTMLAudioElement>(null);
  const levelCompleteAudioRef = useRef<HTMLAudioElement>(null);
  const scanningAudioRef = useRef<HTMLAudioElement>(null);
  const range0to25AudioRef = useRef<HTMLAudioElement>(null);
  const range26to50AudioRef = useRef<HTMLAudioElement>(null);
  const range51to80AudioRef = useRef<HTMLAudioElement>(null);
  const range81to100AudioRef = useRef<HTMLAudioElement>(null);


  useEffect(() => {
    // Check backend connection instead of direct AI initialization
    const initializeApp = async () => {
      try {
        const backendHealthy = await checkBackendHealth();
        if (backendHealthy) {
          setIsInitialized(true);
          setError("");
        } else {
          setError("Backend server is not running. Please start the server on port 3002.");
          setIsInitialized(false);
        }
      } catch (error) {
        setError("Failed to connect to backend server. Please ensure the server is running.");
        setIsInitialized(false);
      }
    };

    initializeApp();

    // Load user progress
    try {
      const savedProgress = localStorage.getItem(PROGRESS_STORAGE_KEY);
      if (savedProgress) {
        setChallengeProgress(JSON.parse(savedProgress));
      } else {
        const initialProgress: Record<number, ChallengeProgress> = {};
        CHALLENGES.forEach((challenge, index) => {
          initialProgress[challenge.id] = {
            status: index === 0 ? ChallengeStatus.UNLOCKED : ChallengeStatus.LOCKED,
            streak: 0,
            previousSimilarityScore: 0,
          };
        });
        setChallengeProgress(initialProgress);
      }
    } catch (e) {
      console.error("Failed to parse progress from local storage", e);
      // Handle potential corrupted data by resetting progress
      const initialProgress: Record<number, ChallengeProgress> = {};
      CHALLENGES.forEach((challenge, index) => {
          initialProgress[challenge.id] = {
            status: index === 0 ? ChallengeStatus.UNLOCKED : ChallengeStatus.LOCKED,
            streak: 0,
            previousSimilarityScore: 0,
          };
        });
      setChallengeProgress(initialProgress);
    }
  }, []);

  // Persist progress to local storage whenever it changes
  useEffect(() => {
    if (Object.keys(challengeProgress).length > 0) {
      localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(challengeProgress));
    }
  }, [challengeProgress]);

  // Persist mute state to local storage
  useEffect(() => {
    try {
      localStorage.setItem(MUTE_STORAGE_KEY, JSON.stringify(isMuted));
    } catch (e) {
      console.error("Failed to save mute state to local storage", e);
    }
  }, [isMuted]);

  // Simplified main audio control
  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    audioElement.loop = true;
    audioElement.volume = 0.3;

    const syncPlayback = () => {
      if (!isMuted && document.visibilityState === 'visible') {
        audioElement.play().catch(e => {
          if (e.name === 'NotAllowedError') {
            console.warn("Autoplay was prevented. User interaction is needed.");
          }
        });
      } else {
        audioElement.pause();
      }
    };
    
    syncPlayback(); // Attempt to play on mount / mute change
    document.addEventListener('visibilitychange', syncPlayback);

    return () => {
      document.removeEventListener('visibilitychange', syncPlayback);
    };
  }, [isMuted]);

  // Control mute state for all SFX audio elements
  useEffect(() => {
    if (streakUpAudioRef.current) streakUpAudioRef.current.muted = isMuted;
    if (streakDownAudioRef.current) streakDownAudioRef.current.muted = isMuted;
    if (buttonClickAudioRef.current) buttonClickAudioRef.current.muted = isMuted;
    if (loginAudioRef.current) loginAudioRef.current.muted = isMuted;
    if (levelCompleteAudioRef.current) levelCompleteAudioRef.current.muted = isMuted;
    if (scanningAudioRef.current) scanningAudioRef.current.muted = isMuted;
    if (range0to25AudioRef.current) range0to25AudioRef.current.muted = isMuted;
    if (range26to50AudioRef.current) range26to50AudioRef.current.muted = isMuted;
    if (range51to80AudioRef.current) range51to80AudioRef.current.muted = isMuted;
    if (range81to100AudioRef.current) range81to100AudioRef.current.muted = isMuted;
  }, [isMuted]);

  // Play streak sound effects
  useEffect(() => {
    if (streakChange === 'increase') {
      streakUpAudioRef.current?.play().catch(console.warn);
    } else if (streakChange === 'decrease') {
      streakDownAudioRef.current?.play().catch(console.warn);
    }
    if (streakChange !== 'none') {
      const timer = setTimeout(() => setStreakChange('none'), 1000);
      return () => clearTimeout(timer);
    }
  }, [streakChange]);

  // Global click sound handler
  useEffect(() => {
    const playSound = () => {
      if (buttonClickAudioRef.current) {
        buttonClickAudioRef.current.currentTime = 0;
        buttonClickAudioRef.current.play().catch(console.warn);
      }
    };

    const handleClick = (event: MouseEvent) => {
      if (audioRef.current && audioRef.current.paused && !isMuted) {
        audioRef.current.play().catch(console.warn);
      }
      if (event.target instanceof HTMLElement && event.target.closest('button, [role="button"], select, a')) {
        playSound();
      }
    };

    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, [isMuted]);

  // Initialize Firebase auth listener
  useEffect(() => {
    const unsubscribe = initializeAuthListener(async (user) => {
      setUser(user);
      if (user) {
        console.log('🔐 User authenticated:', user.email);
        // Play login sound
        loginAudioRef.current?.play().catch(console.warn);
        
        // Sync user profile with backend
        try {
          const { firebaseApiService } = await import('./services/firebaseApiService');
          await firebaseApiService.createOrUpdateProfile({
            email: user.email,
            displayName: user.displayName || '',
            photoURL: user.photoURL || ''
          });
          console.log('✅ User profile synced with backend');
        } catch (error) {
          console.warn('⚠️ Failed to sync user profile:', error);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const handleAuthSuccess = (loggedInUser: User) => {
    loginAudioRef.current?.play().catch(console.warn);
    setIsHidingAuth(true);
    setTimeout(() => {
      setUser(loggedInUser);
      setIsHidingAuth(false);
    }, 1000);
  };

  const handleGoogleSignIn = (user: User) => {
    handleAuthSuccess(user);
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleToggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    
    // Imperatively play/pause to ensure user interaction unlocks audio
    if (audioRef.current) {
        if (nextMuted) {
            audioRef.current.pause();
        } else {
            // This play() call is triggered by a user click, so it should bypass autoplay restrictions.
            audioRef.current.play().catch(e => console.warn("Could not play audio:", e));
        }
    }
  }, [isMuted]);

  const pauseBgMusic = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const resumeBgMusic = useCallback(() => {
    if (!isMuted) {
      audioRef.current?.play().catch(console.warn);
    }
  }, [isMuted]);

  const playSimilarityScoreSound = useCallback((score: number): Promise<void> => {
    let audio: HTMLAudioElement | null = null;
    if (score >= 0 && score <= 25) {
        audio = range0to25AudioRef.current;
    } else if (score >= 26 && score <= 50) {
        audio = range26to50AudioRef.current;
    } else if (score >= 51 && score <= 80) {
        audio = range51to80AudioRef.current;
    } else if (score >= 81 && score <= 100) {
        audio = range81to100AudioRef.current;
    }

    if (audio) {
        pauseBgMusic();
        audio.currentTime = 0;
        return new Promise((resolve) => {
            const handleEnded = () => {
                audio?.removeEventListener('ended', handleEnded);
                resumeBgMusic();
                resolve();
            };
            audio.addEventListener('ended', handleEnded);
            audio.play().catch(err => {
                console.warn('Score sound playback failed:', err);
                audio?.removeEventListener('ended', handleEnded);
                resumeBgMusic(); // Resume music even if sound fails to play
                resolve();
            });
        });
    }

    return Promise.resolve(); // No sound to play
  }, [pauseBgMusic, resumeBgMusic]);

  const playLevelCompleteSound = useCallback(() => {
    levelCompleteAudioRef.current?.play().catch(console.warn);
  }, []);
  
  const playScanningSound = useCallback(() => {
    scanningAudioRef.current?.play().catch(console.warn);
  }, []);

  const stopScanningSound = useCallback(() => {
    if (scanningAudioRef.current) {
        scanningAudioRef.current.pause();
        scanningAudioRef.current.currentTime = 0;
    }
  }, []);

  if (!isInitialized) {
    return (
      <div className="fixed inset-0 bg-cyber-bg flex flex-col items-center justify-center text-cyber-dim p-4">
        {error ? (
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-display text-red-500">INITIALIZATION FAILED</h1>
            <p className="max-w-md bg-cyber-surface p-4 border border-red-500 rounded-md">{error}</p>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <Spinner />
            <p className="text-cyber-primary animate-flicker">INITIALIZING INTERFACE...</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <audio ref={audioRef} src={audioSources.backgroundMusic} loop />
      <audio ref={streakUpAudioRef} src={audioSources.streakUp} />
      <audio ref={streakDownAudioRef} src={audioSources.streakDown} />
      <audio ref={buttonClickAudioRef} src={audioSources.buttonClick} />
      <audio ref={loginAudioRef} src={audioSources.loginSound} />
      <audio ref={levelCompleteAudioRef} src={audioSources.levelComplete} />
      <audio ref={scanningAudioRef} src={audioSources.scanningSound} loop />
      <audio ref={range0to25AudioRef} src={audioSources.range0to25} />
      <audio ref={range26to50AudioRef} src={audioSources.range26to50} />
      <audio ref={range51to80AudioRef} src={audioSources.range51to80} />
      <audio ref={range81to100AudioRef} src={audioSources.range81to100} />
      
      {!user ? (
        <GoogleSignIn onSignIn={handleGoogleSignIn} />
      ) : (
        <ChallengeHost
          user={user}
          onLogout={handleLogout}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          challengeProgress={challengeProgress}
          setChallengeProgress={setChallengeProgress}
          streakChange={streakChange}
          setStreakChange={setStreakChange}
          onPauseBgMusic={pauseBgMusic}
          onResumeBgMusic={resumeBgMusic}
          onPlaySimilarityScoreSound={playSimilarityScoreSound}
          onPlayLevelCompleteSound={playLevelCompleteSound}
          onPlayScanningSound={playScanningSound}
          onStopScanningSound={stopScanningSound}
        />
      )}
    </>
  );
};

export default App;
