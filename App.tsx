
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
  // 기본 언어를 'EN'으로 설정
  const [lang, setLang] = useState<Language>('EN');
  const [status, setStatus] = useState<GameStatus>(localStorage.getItem('zen_user_name') ? 'IDLE' : 'SETUP');
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
        alert(t.copySuccess);
      } catch (e) {
        alert(t.copyFail);
      }
      return;
    }

    setSharingPlatform(platform);

    if (platform === 'ka') {
      if (!ensureKakaoInit()) {
        alert(t.shareFail);
        setSharingPlatform(null);
        return;
      }

      setIsCapturing(true);
      setCaptureStep("RENDERING");
      
      try {
        let finalImageUrl = cachedUploadUrl;
        
        if (!finalImageUrl && resultRef.current) {
          const canvas = await html2canvas(resultRef.current, {
            backgroundColor: '#020617',
            scale: 1,
            useCORS: true,
            logging: false,
            onclone: (clonedDoc) => {
              const all = clonedDoc.querySelectorAll('*');
              all.forEach((el: any) => {
                el.style.animation = 'none';
                el.style.transition = 'none';
                if (el.style.backdropFilter || el.style.webkitBackdropFilter) {
                   el.style.backdropFilter = 'none';
                   el.style.webkitBackdropFilter = 'none';
                   el.style.background = 'rgba(15, 23, 42, 0.95)';
                }
              });
            },
            ignoreElements: (el) => el.hasAttribute('data-html2canvas-ignore'),
          });
          
          setCaptureStep("UPLOADING");
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 0.8));
          if (blob) {
            finalImageUrl = await uploadResultImage(blob, currentScoreId);
            if (finalImageUrl) setCachedUploadUrl(finalImageUrl);
          }
        }

        setCaptureStep("SHARING");
        window.Kakao.Share.sendDefault({
          objectType: 'feed',
          content: {
            title: `Zen Numbers: ${difficulty.name[lang]}`,
            description: `${userName}: ${formattedTime}s`,
            imageUrl: finalImageUrl || 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=600&auto=format&fit=crop',
            link: {
              mobileWebUrl: CURRENT_URL,
              webUrl: CURRENT_URL,
            },
          },
          buttons: [
            {
              title: lang === 'KO' ? '도전하기' : 'Try Now',
              link: {
                mobileWebUrl: CURRENT_URL,
                webUrl: CURRENT_URL,
              },
            },
          ],
        });
      } catch (e) {
        console.error("Kakao Share Fail:", e);
        window.Kakao.Share.sendDefault({
          objectType: 'text',
          text: `${shareText}\n${CURRENT_URL}`,
          link: { mobileWebUrl: CURRENT_URL, webUrl: CURRENT_URL },
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
            onclone: (clonedDoc) => {
              const all = clonedDoc.querySelectorAll('*');
              all.forEach((el: any) => {
                if (el.style.backdropFilter || el.style.webkitBackdropFilter) {
                   el.style.backdropFilter = 'none';
                   el.style.webkitBackdropFilter = 'none';
                   el.style.background = 'rgba(15, 23, 42, 0.95)';
                }
              });
            }
          });
          
          canvas.toBlob(async (blob: any) => {
            if (blob) {
              if (platform === 'dl') {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `ZenResult_${formattedTime}.png`;
                a.click();
              } else if (navigator.share) {
                const file = new File([blob], 'zen_result.png', { type: 'image/png' });
                await navigator.share({ files: [file], title: 'Zen Numbers', text: shareText });
              }
            }
            setIsCapturing(false);
            setCaptureStep("");
            setSharingPlatform(null);
          }, 'image/png');
        } catch (e) {
          setIsCapturing(false);
          setCaptureStep("");
          setSharingPlatform(null);
        }
    } else {
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
            <button onClick={() => setLang(l => l === 'KO' ? 'EN' : 'KO')} className="mt-8 text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 mx-auto"><Globe size={14} /> {lang === 'KO' ? 'English' : '한국어'}</button>
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
            <button onClick={() => setLang(l => l === 'KO' ? 'EN' : 'KO')} className="glass flex items-center gap-2 px-4 py-2 rounded-2xl border-white/10 transition-all active:scale-95 group"><Globe size={16} className="text-indigo-400 group-hover:rotate-12 transition-transform" /><span className="text-xs font-black">{lang}</span></button>
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
                            <span className="text-slate-500 text-[9px] font-black tracking-widest">{d.size}x{d.size} • {d.total} {lang === 'KO' ? '숫자' : 'NUMS'}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            {best && <div className="text-right"><div className="text-[8px] text-slate-500 font-black">{t.best}</div><div className="text-indigo-400 font-black text-xs">{best.time.toFixed(6)}s</div></div>}
                            <ChevronRight size={20} className={difficulty.id === d.id ? 'text-indigo-400' : 'text-slate-700'} />
                          </div>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); loadGlobalRankings(d.id); }} className="absolute -right-2 -top-2 p-2.5 bg-slate-900 border border-slate-700 rounded-2xl text-yellow-500 shadow-xl z-10 hover:scale-110 transition-transform"><Trophy size={16} /></button>
                      </div>
                    );
                  })}
                </div>
                <button onClick={startGame} className="w-full mt-4 bg-gradient-to-br from-indigo-500 to-pink-600 text-white font-black py-5 rounded-[2rem] shadow-2xl flex items-center justify-center gap-4 uppercase tracking-widest active:scale-95"><Play size={24} fill="currentColor" /> {t.start}</button>
              </div>
            )}

            {status === 'COUNTDOWN' && <div className="flex items-center justify-center h-80 text-[12rem] font-black text-white drop-shadow-2xl animate-ping opacity-50">{countdown === 0 ? "GO" : countdown}</div>}

            {(status === 'PLAYING' || status === 'FINISHED') && (
              <div className={`w-full flex flex-col items-center gap-6 pb-20 transition-all ${status === 'FINISHED' ? 'blur-sm scale-95 opacity-50' : ''}`}>
                <div className="w-full flex justify-between glass px-8 py-5 rounded-[2.5rem] sticky top-4 z-20 backdrop-blur-3xl">
                  <div className="flex flex-col"><span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{t.progression}</span><div className="text-2xl font-black">{nextExpected - 1}<span className="text-slate-600 mx-1">/</span><span className="text-slate-400 text-sm">{difficulty.total}</span></div></div>
                  <div className="flex flex-col items-end"><span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{t.elapsed}</span><div className="text-2xl font-black text-indigo-300">{elapsedTime.toFixed(4)}s</div></div>
                </div>
                <div className="glass p-4 md:p-6 rounded-[3rem] grid gap-3 w-full aspect-square max-w-[500px]" style={{ gridTemplateColumns: `repeat(${difficulty.size}, 1fr)` }}>
                  {numbers.map((num) => (
                    <button key={num} disabled={num < nextExpected || status === 'FINISHED'} onClick={() => handleCellClick(num)} className={`relative rounded-2xl flex items-center justify-center text-2xl font-black transition-all ${num < nextExpected || status === 'FINISHED' ? 'opacity-0 scale-50 pointer-events-none' : 'bg-white/5 border border-white/10 hover:bg-indigo-500/20 active:scale-90'} ${wrongFlash === num ? 'bg-red-500 text-white shake' : 'text-slate-300'}`}>{num}</button>
                  ))}
                </div>
              </div>
            )}
          </main>

          <div className={`fixed inset-0 z-[100] flex items-end justify-center transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${status === 'FINISHED' ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => setStatus('IDLE')}></div>
            <div ref={resultRef} className="w-full max-w-2xl glass bg-slate-900/95 rounded-t-[4rem] p-10 flex flex-col items-center relative shadow-2xl overflow-hidden">
              <div data-html2canvas-ignore className="w-12 h-1.5 bg-white/10 rounded-full mb-10"></div>
              
              <div className="flex flex-col items-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-lg mb-4">
                  <Trophy size={32} className="text-white" />
                </div>
                <h3 className="text-4xl font-black italic uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500">{t.complete}</h3>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] mt-1">{difficulty.name[lang]} CHALLENGE</p>
              </div>

              {isPB && <div className="bg-green-500/20 border border-green-500/50 text-green-400 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest mb-6 animate-pulse flex items-center gap-2"><ShieldCheck size={14} /> {t.pbUpdated}</div>}
              
              <div className="grid grid-cols-2 gap-4 w-full mb-8">
                <div className="bg-white/5 p-6 rounded-[2.5rem] flex flex-col items-center border border-white/5"><span className="text-[9px] text-slate-500 uppercase font-black">{t.elapsed}</span><div className="text-3xl font-black text-indigo-300">{elapsedTime.toFixed(6)}s</div></div>
                <div className="bg-indigo-500/10 p-6 rounded-[2.5rem] flex flex-col items-center border border-white/5"><span className="text-[9px] text-indigo-400 uppercase font-black">{t.globalRank}</span><div className="text-3xl font-black text-white">#{globalRank || '...'}</div></div>
              </div>

              {aiMessage ? (
                <div className="w-full bg-white/5 p-6 rounded-[2.5rem] mb-8 flex gap-4 text-left border border-white/5">
                  <MessageSquareQuote size={20} className="text-indigo-400 flex-shrink-0" />
                  <p className="text-slate-200 italic font-bold">"{aiMessage}"</p>
                </div>
              ) : isAiLoading ? (
                 <div className="w-full py-10 flex flex-col items-center opacity-30 animate-pulse"><Loader2 className="animate-spin mb-2" size={20} /><span className="text-[8px] font-black uppercase tracking-widest">{t.evaluating}</span></div>
              ) : null}

              <div className="flex items-center gap-2 mb-8 opacity-40">
                <Link size={12} className="text-slate-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">ZEN NUMBERS • {window.location.host}</span>
              </div>

              <div data-html2canvas-ignore className="grid grid-cols-2 gap-4 w-full">
                <button onClick={() => setShowShareModal(true)} className="bg-indigo-600 py-6 rounded-3xl font-black border-t border-white/10 flex items-center justify-center gap-3 uppercase text-xs tracking-widest transition-transform active:scale-95 shadow-xl"><Share2 size={20} /> {t.share}</button>
                <button onClick={startGame} className="bg-white/5 py-6 rounded-3xl font-black flex items-center justify-center gap-3 uppercase text-xs tracking-widest border border-white/10 transition-transform active:scale-95"><RotateCcw size={20} /> {t.retry}</button>
              </div>
              <button data-html2canvas-ignore onClick={() => setStatus('IDLE')} className="mt-6 text-slate-600 text-[10px] uppercase font-black tracking-widest hover:text-slate-400 transition-colors">{t.home}</button>
              
              {isCapturing && (
                <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-2xl flex flex-col items-center justify-center z-50 animate-in fade-in duration-300">
                  <Loader2 className="animate-spin text-indigo-400 mb-6" size={50} />
                  <span className="text-xs font-black uppercase tracking-[0.3em] text-white text-center px-10">
                    {captureStep === "RENDERING" ? t.rendering : 
                     captureStep === "UPLOADING" ? t.uploading : 
                     t.sharing}
                  </span>
                  <button onClick={() => {setIsCapturing(false); setSharingPlatform(null);}} className="mt-10 text-[9px] font-black text-slate-500 uppercase tracking-widest border border-white/10 px-4 py-2 rounded-xl active:bg-white/5">{t.cancel}</button>
                </div>
              )}
            </div>
          </div>

          {showShareModal && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 backdrop-blur-3xl bg-slate-950/80 animate-in fade-in zoom-in-95 duration-300">
              <div className="glass w-full max-sm:max-w-xs max-w-sm rounded-[4rem] shadow-4xl border-white/10 p-10 flex flex-col items-center">
                <div className="w-16 h-16 bg-indigo-500/20 rounded-3xl flex items-center justify-center mb-6"><Share2 size={32} className="text-indigo-400" /></div>
                <h3 className="text-2xl font-black mb-3 uppercase tracking-tighter">{t.share}</h3>
                <p className="text-slate-500 text-[10px] text-center mb-10 font-bold px-4 leading-relaxed uppercase tracking-widest">{t.selectPlatform}</p>
                <div className="grid grid-cols-2 gap-6 w-full mb-10">
                  <button onClick={() => shareToSocial('ka')} className="flex flex-col items-center gap-3 group relative">
                    <div className="w-14 h-14 bg-[#FEE500] text-[#191919] rounded-2xl flex items-center justify-center group-active:scale-90 transition-transform"><MessageCircle size={24} fill="currentColor" /></div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">{t.kakaotalk}</span>
                    {isCapturing && sharingPlatform === 'ka' && <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl"><Loader2 size={24} className="animate-spin text-white" /></div>}
                  </button>
                  <button onClick={() => shareToSocial('ig')} className="flex flex-col items-center gap-3 group relative">
                    <div className="w-14 h-14 bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white rounded-2xl flex items-center justify-center group-active:scale-90 transition-transform"><Instagram size={24} /></div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">{t.instagram}</span>
                    {isCapturing && sharingPlatform === 'ig' && <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl"><Loader2 size={24} className="animate-spin text-white" /></div>}
                  </button>
                  <button onClick={() => shareToSocial('dl')} className="flex flex-col items-center gap-3 group relative">
                    <div className="w-14 h-14 bg-white/10 text-white rounded-2xl flex items-center justify-center group-active:scale-90 transition-transform"><Download size={24} /></div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">{t.saveImage}</span>
                    {isCapturing && sharingPlatform === 'dl' && <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl"><Loader2 size={24} className="animate-spin text-white" /></div>}
                  </button>
                  <button onClick={() => shareToSocial('copy')} className="flex flex-col items-center gap-3 group">
                    <div className="w-14 h-14 bg-indigo-600/20 text-indigo-400 rounded-2xl flex items-center justify-center group-active:scale-90 transition-transform"><Copy size={24} /></div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">{t.copyLink}</span>
                  </button>
                </div>
                <button onClick={() => setShowShareModal(false)} className="w-full py-5 glass border-white/10 rounded-3xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-white/5 transition-colors">{t.close}</button>
              </div>
            </div>
          )}

          {showRankingsFor && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-2xl bg-slate-950/80 animate-in fade-in">
              <div className="glass w-full max-w-md rounded-[3.5rem] shadow-4xl border-white/10 flex flex-col max-h-[85vh]">
                <div className="p-8 border-b border-white/5 flex justify-between items-center"><h3 className="text-xl font-black flex items-center gap-3"><Trophy size={20} className="text-yellow-500" /> {t.globalTop}</h3><button onClick={() => setShowRankingsFor(null)} className="p-2 hover:bg-white/5 rounded-xl transition-colors"><X size={24} /></button></div>
                <div className="overflow-y-auto p-6 space-y-3">
                  {globalScores.length > 0 ? globalScores.map((s, i) => (
                    <div key={s.id} className={`flex justify-between items-center p-5 rounded-3xl border transition-all ${s.userId === userId ? 'bg-indigo-500/20 border-indigo-500' : 'bg-white/5 border-transparent'}`}>
                      <div className="flex items-center gap-4"><div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${i < 3 ? 'bg-yellow-500 text-black' : 'bg-white/10 text-slate-500'}`}>{i + 1}</div><div><div className="text-[9px] font-black uppercase text-slate-500">{s.userName}</div><div className="text-lg font-black">{s.time.toFixed(6)}s</div></div></div>
                      {i < 3 && <Medal size={20} className="text-yellow-500" />}
                    </div>
                  )) : <div className="py-20 text-center opacity-30 text-[10px] font-black uppercase tracking-[0.3em]">{t.noRecords}</div>}
                </div>
                <div className="p-8"><button onClick={() => setShowRankingsFor(null)} className="w-full py-5 glass rounded-3xl text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-colors">{t.close}</button></div>
              </div>
            </div>
          )}

          <footer className="w-full py-16 text-center text-slate-800 text-[10px] font-black tracking-[0.5em] uppercase">Zen Edition 5.1 • Master Net</footer>
        </>
      )}
      <style>{`.shake { animation: shake 0.12s ease-in-out 3; } @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }`}</style>
    </div>
  );
};

export default App;
