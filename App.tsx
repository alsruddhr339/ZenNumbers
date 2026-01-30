
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Trophy, Play, RotateCcw, Award, ChevronRight, MessageSquareQuote, Medal, X, Share2, Globe, User, Volume2, VolumeX, ShieldCheck, Download, Copy, MessageCircle, Instagram, Loader2, Link } from 'lucide-react';
import html2canvas from 'html2canvas';
import { Difficulty, DIFFICULTIES, GameStatus, ScoreEntry, TRANSLATIONS, Language } from './types';
import { getMotivationalMessage } from './services/geminiService';
import { uploadScore, getGlobalRankings, getGlobalRankForScore, uploadResultImage } from './services/firebaseService';

declare global {
  interface Window {
    Kakao: any;
  }
}

const App: React.FC = () => {
  const [status, setStatus] = useState<GameStatus>(localStorage.getItem('zen_user_name') ? 'IDLE' : 'SETUP');
  const [lang, setLang] = useState<Language>('KO');
  const [difficulty, setDifficulty] = useState<Difficulty>(DIFFICULTIES[1]);
  const [numbers, setNumbers] = useState<number[]>([]);
  const [nextExpected, setNextExpected] = useState<number>(1);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [allScores, setAllScores] = useState<ScoreEntry[]>([]);
  const [globalScores, setGlobalScores] = useState<ScoreEntry[]>([]);
  const [aiMessage, setAiMessage] = useState<string>("");
  const [isRankLoading, setIsRankLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureStep, setCaptureStep] = useState<string>(""); 
  const [sharingPlatform, setSharingPlatform] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [wrongFlash, setWrongFlash] = useState<number | null>(null);
  const [globalRank, setGlobalRank] = useState<number | null>(null);
  const [showRankingsFor, setShowRankingsFor] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [userName, setUserName] = useState<string>(localStorage.getItem('zen_user_name') || '');
  const [currentScoreId, setCurrentScoreId] = useState<string>("");
  const [userId] = useState<string>(() => {
    let id = localStorage.getItem('zen_user_id');
    if (!id) {
      id = 'user_' + Math.random().toString(36).substr(2, 9) + Date.now();
      localStorage.setItem('zen_user_id', id);
    }
    return id;
  });
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isPB, setIsPB] = useState(false);
  const [cachedUploadUrl, setCachedUploadUrl] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const musicIntervalRef = useRef<number | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const t = TRANSLATIONS[lang];

  const KAKAO_KEY = 'a7c872a95007ae033c540c81f170eaeb';
  const CURRENT_URL = window.location.origin;

  const ensureKakaoInit = () => {
    if (window.Kakao) {
      if (!window.Kakao.isInitialized()) {
        try {
          window.Kakao.init(KAKAO_KEY);
        } catch (e) {
          console.error("Kakao Init Error", e);
        }
      }
      return window.Kakao.isInitialized();
    }
    return false;
  };

  useEffect(() => {
    ensureKakaoInit();
    const saved = localStorage.getItem('zen_all_scores');
    if (saved) {
      try { setAllScores(JSON.parse(saved)); } catch (e) { setAllScores([]); }
    }
    return () => stopMusic();
  }, []);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(console.warn);
    }
  };

  const playSound = (freq: number, type: OscillatorType = 'sine', duration: number = 0.1, volume: number = 0.1, decay: boolean = true) => {
    if (!audioEnabled || !audioCtxRef.current) return;
    try {
      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtxRef.current.currentTime);
      gain.gain.setValueAtTime(volume, audioCtxRef.current.currentTime);
      if (decay) gain.gain.exponentialRampToValueAtTime(0.0001, audioCtxRef.current.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      osc.start();
      osc.stop(audioCtxRef.current.currentTime + duration);
    } catch (e) {}
  };

  const startTenseMusic = () => {
    if (!audioEnabled || !audioCtxRef.current) return;
    let step = 0;
    musicIntervalRef.current = window.setInterval(() => {
      const isDownbeat = step % 4 === 0;
      playSound(isDownbeat ? 55 : 40, 'triangle', 0.6, isDownbeat ? 0.15 : 0.08);
      if (step % 2 === 1) playSound(1800, 'sine', 0.02, 0.005);
      step++;
    }, 400);
  };

  const stopMusic = () => {
    if (musicIntervalRef.current) {
      clearInterval(musicIntervalRef.current);
      musicIntervalRef.current = null;
    }
  };

  const shuffle = (array: number[]) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const startGame = () => {
    if (!userName.trim()) {
      setStatus('SETUP');
      return;
    }
    initAudio();
    setNextExpected(1);
    setElapsedTime(0);
    setAiMessage("");
    setGlobalRank(null);
    setIsPB(false);
    setShowShareModal(false);
    setCachedUploadUrl(null);
    setNumbers(shuffle(Array.from({ length: difficulty.total }, (_, i) => i + 1)));
    setStatus('COUNTDOWN');
    setCountdown(3);
  };

  useEffect(() => {
    if (status === 'COUNTDOWN') {
      if (countdown > 0) {
        playSound(330, 'sine', 0.15, 0.1); 
        const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        playSound(660, 'sine', 0.4, 0.15); 
        setStatus('PLAYING');
        setStartTime(performance.now());
        startTenseMusic();
      }
    }
  }, [status, countdown]);

  useEffect(() => {
    if (status === 'PLAYING') {
      timerRef.current = window.setInterval(() => {
        setElapsedTime((performance.now() - startTime) / 1000);
      }, 10);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [status, startTime]);

  const handleCellClick = (num: number) => {
    if (status !== 'PLAYING') return;
    if (num === nextExpected) {
      playSound(1000 + (num * 30), 'sine', 0.08, 0.1); 
      if (num === difficulty.total) {
        finishGame();
      } else {
        setNextExpected(prev => prev + 1);
        if (window.navigator.vibrate) window.navigator.vibrate(10);
      }
    } else {
      playSound(120, 'square', 0.4, 0.2); 
      setWrongFlash(num);
      if (window.navigator.vibrate) window.navigator.vibrate([100, 50, 100]);
      setTimeout(() => setWrongFlash(null), 200);
    }
  };

  const finishGame = async () => {
    stopMusic();
    const finalTime = (performance.now() - startTime) / 1000;
    if (timerRef.current) clearInterval(timerRef.current);
    
    setStatus('FINISHED');
    setElapsedTime(finalTime);
    playSound(1100, 'sine', 0.5, 0.1);

    const scoreId = Math.random().toString(36).substr(2, 9);
    setCurrentScoreId(scoreId);

    const newScore: ScoreEntry = {
      id: scoreId,
      userId,
      difficultyId: difficulty.id,
      time: finalTime,
      date: Date.now(),
      userName: userName
    };

    const updatedScores = [...allScores, newScore];
    setAllScores(updatedScores);
    localStorage.setItem('zen_all_scores', JSON.stringify(updatedScores));

    const difficultyScores = updatedScores
      .filter(s => s.difficultyId === difficulty.id)
      .sort((a, b) => a.time - b.time);

    const previousBest = difficultyScores.length > 1 ? difficultyScores.filter(s => s.id !== newScore.id)[0] : null;
    const isNewPB = !previousBest || finalTime < previousBest.time;
    setIsPB(isNewPB);

    setIsRankLoading(true);
    setIsAiLoading(true);
    
    getMotivationalMessage(finalTime, difficulty.name[lang], lang).then(msg => {
      setAiMessage(msg);
      setIsAiLoading(false);
    });

    try {
      if (isNewPB) {
        await uploadScore(newScore);
      }
      const calculatedGlobalRank = await getGlobalRankForScore(difficulty.id, finalTime);
      setGlobalRank(calculatedGlobalRank);
    } catch (error) {
      console.warn("Ranking sync issue:", error);
    } finally {
      setIsRankLoading(false);
    }
  };

  const localTopScores = useMemo(() => {
    const result: Record<string, ScoreEntry[]> = {};
    DIFFICULTIES.forEach(d => {
      result[d.id] = allScores
        .filter(s => s.difficultyId === d.id)
        .sort((a, b) => a.time - b.time);
    });
    return result;
  }, [allScores]);

  const loadGlobalRankings = async (diffId: string) => {
    setShowRankingsFor(diffId);
    const scores = await getGlobalRankings(diffId);
    setGlobalScores(scores);
  };

  const shareToSocial = async (platform: 'fb' | 'tw' | 'ka' | 'ig' | 'dl' | 'copy') => {
    const formattedTime = elapsedTime.toFixed(6);
    const shareText = t.shareMsg.replace('{time}', formattedTime);
    
    if (platform === 'copy') {
      try {
        await navigator.clipboard.writeText(`${shareText}\n${CURRENT_URL}`);
        alert(lang === 'KO' ? "결과 링크가 복사되었습니다!" : "Link copied!");
      } catch (e) {
        alert("Copy failed");
      }
      return;
    }

    setSharingPlatform(platform);

    if (platform === 'ka') {
      if (!ensureKakaoInit()) {
        alert("Kakao SDK load failed.");
        setSharingPlatform(null);
        return;
      }

      setIsCapturing(true);
      setCaptureStep("RENDERING");
      
      try {
        let finalImageUrl = cachedUploadUrl;
        
        if (!finalImageUrl && resultRef.current) {
          // html2canvas가 간혹 무한루프에 빠지는 것을 방지하기 위한 타임아웃
          const capturePromise = html2canvas(resultRef.current, {
            backgroundColor: '#020617',
            scale: 1.0, // 해상도 낮추어 속도 우선
            useCORS: true,
            logging: false,
            onclone: (clonedDoc) => {
              // 캡처 전용 스타일: 모든 블러와 애니메이션 제거
              const elements = clonedDoc.querySelectorAll('*');
              elements.forEach((el: any) => {
                el.style.animation = 'none';
                el.style.transition = 'none';
                if (el.classList.contains('glass') || el.classList.contains('backdrop-blur-md') || el.classList.contains('backdrop-blur-3xl')) {
                  el.style.backdropFilter = 'none';
                  el.style.webkitBackdropFilter = 'none';
                  el.style.background = 'rgba(15, 23, 42, 0.98)';
                }
              });
            },
            ignoreElements: (el) => el.hasAttribute('data-html2canvas-ignore'),
          });

          // 5초 타임아웃
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000));
          
          const canvas: any = await Promise.race([capturePromise, timeoutPromise]);
          
          setCaptureStep("UPLOADING");
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
          if (blob) {
            finalImageUrl = await uploadResultImage(blob, currentScoreId);
            setCachedUploadUrl(finalImageUrl);
          }
        }

        setCaptureStep("SHARING");
        window.Kakao.Share.sendDefault({
          objectType: 'feed',
          content: {
            title: `젠 넘버즈: ${difficulty.name[lang]} 챌린지`,
            description: `${userName} 마스터의 기록: ${formattedTime}초\n\n지금 도전: ${CURRENT_URL}`,
            imageUrl: finalImageUrl || 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=600&auto=format&fit=crop',
            link: {
              mobileWebUrl: CURRENT_URL,
              webUrl: CURRENT_URL,
            },
          },
          buttons: [
            {
              title: '나도 도전하기',
              link: {
                mobileWebUrl: CURRENT_URL,
                webUrl: CURRENT_URL,
              },
            },
          ],
        });
      } catch (e) {
        console.error("Sharing sequence failure:", e);
        // 캡처 실패 시에도 기본 이미지로 카톡 창은 띄워줌
        window.Kakao.Share.sendDefault({
          objectType: 'feed',
          content: {
            title: `젠 넘버즈: ${difficulty.name[lang]} 챌린지`,
            description: `${userName} 마스터의 기록: ${formattedTime}초\n\n지금 도전: ${CURRENT_URL}`,
            imageUrl: 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=600&auto=format&fit=crop',
            link: { mobileWebUrl: CURRENT_URL, webUrl: CURRENT_URL },
          },
          buttons: [{ title: '나도 도전하기', link: { mobileWebUrl: CURRENT_URL, webUrl: CURRENT_URL } }],
        });
      } finally {
        setIsCapturing(false);
        setCaptureStep("");
        setSharingPlatform(null);
      }
      return;
    }

    if (platform === 'dl' || platform === 'ig') {
        if (!resultRef.current) {
          setSharingPlatform(null);
          return;
        }
        setIsCapturing(true);
        setCaptureStep("RENDERING");
        try {
          const canvas = await html2canvas(resultRef.current, {
            backgroundColor: '#020617',
            scale: 1.5,
            useCORS: true,
            logging: false,
            onclone: (clonedDoc) => {
                const elements = clonedDoc.querySelectorAll('*');
                elements.forEach((el: any) => {
                  el.style.animation = 'none';
                  el.style.transition = 'none';
                  if (el.classList.contains('glass') || el.classList.contains('backdrop-blur-md') || el.classList.contains('backdrop-blur-3xl')) {
                    el.style.backdropFilter = 'none';
                    el.style.webkitBackdropFilter = 'none';
                    el.style.background = 'rgba(15, 23, 42, 0.98)';
                  }
                });
            },
            ignoreElements: (element) => element.hasAttribute('data-html2canvas-ignore'),
          });
          
          canvas.toBlob(async (blob: any) => {
            if (!blob) {
              setIsCapturing(false);
              setCaptureStep("");
              setSharingPlatform(null);
              return;
            }
            if (platform === 'dl') {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `Zen_${formattedTime}s.png`;
              a.click();
              URL.revokeObjectURL(url);
            } else if (navigator.share) {
              const file = new File([blob], 'zen_result.png', { type: 'image/png' });
              await navigator.share({ files: [file], title: 'Zen Numbers', text: shareText + "\n" + CURRENT_URL });
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Zen_Instagram_${formattedTime}s.png`;
                a.click();
                URL.revokeObjectURL(url);
                alert(lang === 'KO' ? "이미지를 저장했습니다. 인스타그램에 공유해보세요!" : "Image saved. Share it on Instagram!");
            }
            setIsCapturing(false);
            setCaptureStep("");
            setSharingPlatform(null);
          });
        } catch (e) {
          console.error("Download Error:", e);
          setIsCapturing(false);
          setCaptureStep("");
          setSharingPlatform(null);
        }
    } else if (platform === 'fb' || platform === 'tw') {
      const url = platform === 'fb' 
        ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(CURRENT_URL)}`
        : `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(CURRENT_URL)}`;
      window.open(url, '_blank');
      setSharingPlatform(null);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center bg-slate-950 text-slate-100 selection:bg-indigo-500/30 overflow-x-hidden relative">
      <div className="fixed inset-0 -z-10 opacity-20 pointer-events-none">
        <div className="absolute top-[-5%] left-[-10%] w-[600px] h-[600px] bg-indigo-600 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-5%] right-[-10%] w-[600px] h-[600px] bg-purple-600 rounded-full blur-[100px]"></div>
      </div>

      {status === 'SETUP' ? (
        <div className="flex-grow flex flex-col items-center justify-center p-6 w-full max-w-md animate-in fade-in zoom-in-95">
          <div className="glass w-full p-10 rounded-[3.5rem] text-center border-white/10 shadow-4xl relative">
            <div className="w-20 h-20 bg-indigo-500/20 rounded-[2rem] flex items-center justify-center mx-auto mb-8">
              <User size={40} className="text-indigo-400" />
            </div>
            <h2 className="text-2xl font-black mb-2">{t.welcome}</h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-10">{t.enterName}</p>
            <input 
              type="text" 
              value={userName} 
              onChange={(e) => setUserName(e.target.value.slice(0, 10))}
              placeholder={lang === 'KO' ? "이름 입력" : "ENTER NAME"}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-center text-xl font-black outline-none focus:border-indigo-500 transition-all mb-6"
            />
            <button 
              onClick={() => { if(userName.trim()) { localStorage.setItem('zen_user_name', userName); setStatus('IDLE'); } }}
              className="w-full bg-indigo-600 hover:bg-indigo-500 py-5 rounded-3xl font-black uppercase tracking-widest transition-all"
            >
              {t.saveName}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className={`fixed top-6 left-6 right-6 z-40 flex justify-between items-center transition-opacity ${status === 'FINISHED' ? 'opacity-0' : 'opacity-100'}`}>
            <div className="flex gap-2">
              <button onClick={() => setStatus('SETUP')} className="glass flex items-center gap-2 px-4 py-2 rounded-2xl border-white/10 group">
                <User size={14} className="text-slate-500 group-hover:text-indigo-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{userName}</span>
              </button>
              <button onClick={() => setAudioEnabled(!audioEnabled)} className="glass p-2.5 rounded-2xl border-white/10 text-slate-400">
                {audioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
            </div>
            <button onClick={() => setLang(l => l === 'KO' ? 'EN' : 'KO')} className="glass flex items-center gap-2 px-4 py-2 rounded-2xl border-white/10"><Globe size={16} className="text-indigo-400" /><span className="text-xs font-black">{lang}</span></button>
          </div>

          <header className={`w-full pt-20 pb-8 text-center transition-all ${status !== 'IDLE' ? 'opacity-30 scale-90 pt-10' : ''}`}>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 to-pink-400">{t.title}</h1>
            <p className="text-slate-500 font-bold tracking-[0.4em] text-[10px] uppercase">{t.subtitle}</p>
          </header>

          <main className="w-full max-w-lg px-4 flex-grow">
            {status === 'IDLE' && (
              <div className="glass p-6 md:p-10 rounded-[3rem] w-full shadow-2xl space-y-6 animate-in slide-in-from-bottom-8">
                <h2 className="text-xl font-black flex items-center gap-3"><Award size={24} className="text-indigo-400" /> {t.selectMode}</h2>
                <div className="grid gap-4">
                  {DIFFICULTIES.map((d) => {
                    const best = localTopScores[d.id][0];
                    return (
                      <div key={d.id} className="relative group">
                        <button onClick={() => setDifficulty(d)} className={`w-full flex items-center justify-between p-5 rounded-[2rem] border transition-all ${difficulty.id === d.id ? 'bg-indigo-500/20 border-indigo-400' : 'bg-white/5 border-transparent'}`}>
                          <div className="text-left">
                            <span className="font-black text-lg block">{d.name[lang]}</span>
                            <span className="text-slate-500 text-[9px] font-black tracking-widest">{d.size}x{d.size} • {d.total} NUMS</span>
                          </div>
                          <div className="flex items-center gap-4">
                            {best && <div className="text-right"><div className="text-[8px] text-slate-500 font-black">{t.best}</div><div className="text-indigo-400 font-black text-xs">{best.time.toFixed(6)}s</div></div>}
                            <ChevronRight size={20} className={difficulty.id === d.id ? 'text-indigo-400' : 'text-slate-700'} />
                          </div>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); loadGlobalRankings(d.id); }} className="absolute -right-2 -top-2 p-2.5 bg-slate-900 border border-slate-700 rounded-2xl text-yellow-500 shadow-xl z-10"><Trophy size={16} /></button>
                      </div>