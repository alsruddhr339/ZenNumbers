
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Trophy, Play, RotateCcw, Award, ChevronRight, MessageSquareQuote, Medal, X, Share2, Globe, User, Volume2, VolumeX, ShieldCheck, Download, Copy, MessageCircle, Instagram, Loader2, Link as LinkIcon, Zap } from 'lucide-react';
import html2canvas from 'html2canvas';
import { Difficulty, DIFFICULTIES, GameStatus, ScoreEntry, TRANSLATIONS, Language } from './types';
import { getMotivationalMessage } from './services/geminiService';
import { uploadScore, getGlobalRankings, getGlobalRankForScore, uploadResultImage } from './services/firebaseService';

declare global {
  interface Window {
    Kakao: any;
  }
}

// 제공된 포스터 이미지를 공유용으로 사용 (직접 업로드된 URL이 있다면 교체 가능)
const BRAND_POSTER_URL = "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=1000&auto=format&fit=crop";

const App: React.FC = () => {
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
        try { window.Kakao.init(KAKAO_KEY); } catch (e) { console.error("Kakao Init Error", e); }
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
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
  };

  const playSound = (freq: number, type: OscillatorType = 'sine', duration: number = 0.1, volume: number = 0.1) => {
    if (!audioEnabled || !audioCtxRef.current) return;
    try {
      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtxRef.current.currentTime);
      gain.gain.setValueAtTime(volume, audioCtxRef.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtxRef.current.currentTime + duration);
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
      playSound(isDownbeat ? 55 : 40, 'triangle', 0.6, isDownbeat ? 0.1 : 0.05);
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
    if (!userName.trim()) { setStatus('SETUP'); return; }
    initAudio();
    setNextExpected(1);
    setElapsedTime(0);
    setAiMessage("");
    setGlobalRank(null);
    setIsPB(false);
    setShowShareModal(false);
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
      playSound(800 + (num * 20), 'sine', 0.08, 0.1); 
      if (num === difficulty.total) { finishGame(); }
      else {
        setNextExpected(prev => prev + 1);
        if (window.navigator.vibrate) window.navigator.vibrate(10);
      }
    } else {
      playSound(100, 'square', 0.4, 0.2); 
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

    const isNewPB = difficultyScores[0].id === scoreId;
    setIsPB(isNewPB);

    setIsRankLoading(true);
    setIsAiLoading(true);
    
    getMotivationalMessage(finalTime, difficulty.name[lang], lang).then(msg => {
      setAiMessage(msg);
      setIsAiLoading(false);
    });

    try {
      if (isNewPB) await uploadScore(newScore);
      const calculatedGlobalRank = await getGlobalRankForScore(difficulty.id, finalTime);
      setGlobalRank(calculatedGlobalRank);
    } catch (error) {
      console.warn("Ranking error", error);
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
    const formattedTime = elapsedTime.toFixed(4);
    const shareText = t.shareMsg.replace('{time}', formattedTime);
    
    if (platform === 'copy') {
      try {
        await navigator.clipboard.writeText(`${shareText}\n${CURRENT_URL}`);
        alert(t.copySuccess);
      } catch (e) { alert(t.copyFail); }
      return;
    }

    if (platform === 'ka') {
      if (!ensureKakaoInit()) { alert(t.shareFail); return; }
      
      // 카카오톡 공유는 이제 '즉시' 실행됩니다. 캡처 로딩 없음!
      window.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: `ZENNUM : ${difficulty.name[lang]}`,
          description: `${userName} - ${formattedTime}s\n${t.subtitle}`,
          imageUrl: BRAND_POSTER_URL,
          link: {
            mobileWebUrl: CURRENT_URL,
            webUrl: CURRENT_URL,
          },
        },
        buttons: [
          {
            title: lang === 'KO' ? '나도 도전하기' : 'Challenge Now',
            link: {
              mobileWebUrl: CURRENT_URL,
              webUrl: CURRENT_URL,
            },
          },
        ],
      });
      return;
    }

    // 인스타그램 및 저장 기능 (기존 캡처 로직 유지하되 최적화)
    if (platform === 'dl' || platform === 'ig') {
        if (!resultRef.current) return;
        setIsCapturing(true);
        setCaptureStep("RENDERING");
        try {
          const canvas = await html2canvas(resultRef.current, {
            backgroundColor: '#020617',
            scale: 1,
            useCORS: true,
            onclone: (clonedDoc) => {
              const all = clonedDoc.querySelectorAll('*');
              all.forEach((el: any) => {
                if (el.style.backdropFilter) el.style.backdropFilter = 'none';
              });
            }
          });
          
          canvas.toBlob(async (blob: any) => {
            if (blob) {
              if (platform === 'dl') {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `ZENNUM_${formattedTime}.png`;
                a.click();
              } else if (navigator.share) {
                const file = new File([blob], 'zennum.png', { type: 'image/png' });
                await navigator.share({ files: [file], title: 'ZENNUM', text: shareText });
              }
            }
            setIsCapturing(false);
          }, 'image/png');
        } catch (e) { setIsCapturing(false); }
    } else {
      const url = platform === 'fb' 
        ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(CURRENT_URL)}`
        : `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(CURRENT_URL)}`;
      window.open(url, '_blank');
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center bg-slate-950 text-slate-100 selection:bg-cyan-500/30 overflow-x-hidden relative font-['Outfit']">
      {/* Background FX */}
      <div className="fixed inset-0 -z-10 opacity-30 pointer-events-none">
        <div className="absolute top-[-10%] left-[-20%] w-[800px] h-[800px] bg-cyan-600/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-20%] w-[800px] h-[800px] bg-red-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
      </div>

      {status === 'SETUP' ? (
        <div className="flex-grow flex flex-col items-center justify-center p-6 w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
          <div className="glass w-full p-10 rounded-[3rem] text-center border-white/10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-white/50 to-red-500"></div>
            <div className="w-24 h-24 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-10 border border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
              <Zap size={48} className="text-cyan-400 animate-pulse" />
            </div>
            <h2 className="text-4xl font-black mb-4 tracking-tighter italic text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">{t.title}</h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mb-12">{t.enterName}</p>
            <input 
              type="text" 
              value={userName} 
              onChange={(e) => setUserName(e.target.value.slice(0, 10))}
              placeholder="PLAYER NAME"
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-6 text-center text-2xl font-black outline-none focus:border-cyan-500 transition-all mb-8 placeholder:text-slate-800"
            />
            <button 
              onClick={() => { if(userName.trim()) { localStorage.setItem('zen_user_name', userName); setStatus('IDLE'); } }}
              className="w-full bg-cyan-600 hover:bg-cyan-500 py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] transition-all shadow-[0_10px_40px_rgba(8,145,178,0.3)] active:scale-95"
            >
              {t.saveName}
            </button>
            <button onClick={() => setLang(l => l === 'KO' ? 'EN' : 'KO')} className="mt-10 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-cyan-400 transition-colors flex items-center gap-2 mx-auto"><Globe size={14} /> {lang === 'KO' ? 'English' : '한국어'}</button>
          </div>
        </div>
      ) : (
        <>
          <div className={`fixed top-8 left-8 right-8 z-40 flex justify-between items-center transition-all ${status === 'FINISHED' ? 'opacity-0 scale-90' : 'opacity-100'}`}>
            <div className="flex gap-3">
              <button onClick={() => setStatus('SETUP')} className="glass flex items-center gap-3 px-5 py-2.5 rounded-2xl border-white/10 group hover:border-cyan-500/30 transition-all">
                <User size={16} className="text-cyan-400" />
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">{userName}</span>
              </button>
              <button onClick={() => setAudioEnabled(!audioEnabled)} className="glass p-3 rounded-2xl border-white/10 text-slate-400 hover:text-cyan-400 transition-all">
                {audioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
            </div>
            <button onClick={() => setLang(l => l === 'KO' ? 'EN' : 'KO')} className="glass flex items-center gap-2 px-5 py-2.5 rounded-2xl border-white/10 group hover:border-cyan-500/30 transition-all active:scale-95"><Globe size={18} className="text-cyan-400 group-hover:rotate-45 transition-transform" /><span className="text-sm font-black text-white">{lang}</span></button>
          </div>

          <header className={`w-full pt-28 pb-12 text-center transition-all duration-700 ${status !== 'IDLE' ? 'opacity-20 scale-90 pt-16 translate-y-[-20px]' : ''}`}>
            <h1 className="text-7xl md:text-9xl font-black tracking-tighter italic bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-cyan-800 drop-shadow-[0_10px_30px_rgba(255,255,255,0.1)]">{t.title}</h1>
            <p className="text-cyan-500/80 font-black tracking-[0.6em] text-[12px] uppercase mt-2">{t.subtitle}</p>
          </header>

          <main className="w-full max-w-lg px-6 flex-grow">
            {status === 'IDLE' && (
              <div className="glass p-8 md:p-12 rounded-[4rem] w-full shadow-4xl space-y-8 animate-in slide-in-from-bottom-12 duration-700 border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-2xl font-black flex items-center gap-4 italic"><Award size={28} className="text-cyan-400" /> {t.selectMode}</h2>
                </div>
                <div className="grid gap-5">
                  {DIFFICULTIES.map((d) => {
                    const best = localTopScores[d.id][0];
                    const isActive = difficulty.id === d.id;
                    return (
                      <div key={d.id} className="relative group">
                        <button onClick={() => setDifficulty(d)} className={`w-full flex items-center justify-between p-6 rounded-[2.5rem] border-2 transition-all duration-300 ${isActive ? 'bg-cyan-500/10 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.1)]' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                          <div className="text-left">
                            <span className={`font-black text-xl block italic tracking-tight ${isActive ? 'text-white' : 'text-slate-400'}`}>{d.name[lang]}</span>
                            <span className="text-slate-600 text-[10px] font-black tracking-widest">{d.total} NUMBERS</span>
                          </div>
                          <div className="flex items-center gap-5">
                            {best && <div className="text-right"><div className="text-[9px] text-red-500 font-black tracking-widest">{t.best}</div><div className="text-white font-black text-sm">{best.time.toFixed(4)}s</div></div>}
                            <ChevronRight size={24} className={isActive ? 'text-cyan-400' : 'text-slate-800'} />
                          </div>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); loadGlobalRankings(d.id); }} className="absolute -right-3 -top-3 p-3 bg-slate-900 border border-slate-700 rounded-2xl text-yellow-500 shadow-2xl hover:scale-110 active:scale-90 transition-all z-10"><Trophy size={18} /></button>
                      </div>
                    );
                  })}
                </div>
                <button onClick={startGame} className="w-full mt-6 bg-white text-slate-950 font-black py-6 rounded-[2.5rem] shadow-[0_15px_50px_rgba(255,255,255,0.2)] flex items-center justify-center gap-5 uppercase tracking-[0.3em] text-lg hover:bg-cyan-400 transition-all active:scale-95 group">
                  <Play size={28} fill="currentColor" className="group-hover:scale-110 transition-transform" /> {t.start}
                </button>
              </div>
            )}

            {status === 'COUNTDOWN' && (
              <div className="flex items-center justify-center h-96 text-[15rem] font-black text-white italic drop-shadow-[0_0_50px_rgba(6,182,212,0.5)] animate-pulse">
                {countdown === 0 ? "GO!" : countdown}
              </div>
            )}

            {(status === 'PLAYING' || status === 'FINISHED') && (
              <div className={`w-full flex flex-col items-center gap-8 pb-32 transition-all duration-500 ${status === 'FINISHED' ? 'blur-2xl scale-90 opacity-0 pointer-events-none' : 'opacity-100'}`}>
                {/* HUD 스타일 상단바 */}
                <div className="w-full flex justify-between gap-4 px-2">
                  <div className="flex-1 bg-black/40 border-l-4 border-cyan-500 p-5 rounded-2xl backdrop-blur-3xl shadow-lg">
                    <span className="text-[10px] text-cyan-500 font-black uppercase tracking-[0.2em] mb-1 block italic">{t.time}</span>
                    <div className="text-3xl font-black text-white tabular-nums">{elapsedTime.toFixed(2)}</div>
                  </div>
                  <div className="flex-1 bg-black/40 border-r-4 border-red-500 p-5 rounded-2xl backdrop-blur-3xl shadow-lg text-right">
                    <span className="text-[10px] text-red-500 font-black uppercase tracking-[0.2em] mb-1 block italic">{t.progression}</span>
                    <div className="text-3xl font-black text-white tabular-nums">{nextExpected - 1}<span className="text-slate-600 mx-1 text-sm italic">/</span><span className="text-slate-400 text-lg">{difficulty.total}</span></div>
                  </div>
                </div>

                {/* 게임 그리드 */}
                <div className="bg-white/5 p-4 md:p-6 rounded-[3rem] grid gap-3 w-full aspect-square max-w-[500px] border border-white/10 shadow-4xl" style={{ gridTemplateColumns: `repeat(${difficulty.size}, 1fr)` }}>
                  {numbers.map((num) => {
                    const isCorrect = num < nextExpected;
                    return (
                      <button 
                        key={num} 
                        disabled={isCorrect || status === 'FINISHED'} 
                        onClick={() => handleCellClick(num)} 
                        className={`relative rounded-xl md:rounded-2xl flex items-center justify-center text-3xl font-black italic transition-all duration-200 
                          ${isCorrect ? 'opacity-0 scale-0 pointer-events-none' : 'bg-slate-900 border border-white/10 hover:border-cyan-500/50 shadow-lg'} 
                          ${wrongFlash === num ? 'bg-red-600 text-white shake border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'text-white'}`}
                      >
                        {num}
                        {/* 글로우 효과 */}
                        <div className={`absolute inset-0 rounded-xl md:rounded-2xl transition-opacity duration-300 ${!isCorrect ? 'opacity-0 group-hover:opacity-100' : 'opacity-0'} shadow-[inset_0_0_20px_rgba(6,182,212,0.2)]`}></div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </main>

          {/* 결과 모달 - 포스터 스타일 */}
          <div className={`fixed inset-0 z-[100] flex items-center justify-center transition-all duration-1000 cubic-bezier(0.23,1,0.32,1) ${status === 'FINISHED' ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-2xl" onClick={() => setStatus('IDLE')}></div>
            <div ref={resultRef} className="w-full max-w-lg glass bg-black/80 rounded-[4rem] p-12 flex flex-col items-center relative shadow-[0_0_100px_rgba(6,182,212,0.15)] overflow-hidden border-t border-white/10">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-white to-red-500"></div>
              
              <div data-html2canvas-ignore className="w-16 h-1 bg-white/10 rounded-full mb-12"></div>
              
              <div className="flex flex-col items-center mb-10">
                <div className="w-20 h-20 bg-cyan-500/20 rounded-[2rem] flex items-center justify-center shadow-lg mb-6 border border-cyan-500/20">
                  <Trophy size={40} className="text-cyan-400" />
                </div>
                <h3 className="text-5xl font-black italic uppercase tracking-tighter text-white drop-shadow-xl">{t.complete}</h3>
                <p className="text-[11px] text-slate-500 font-black uppercase tracking-[0.5em] mt-3">TARGET ACQUIRED</p>
              </div>

              {isPB && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-400 px-8 py-2.5 rounded-full text-[11px] font-black uppercase tracking-[0.2em] mb-10 animate-bounce flex items-center gap-3">
                  <ShieldCheck size={16} /> {t.pbUpdated}
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-5 w-full mb-10">
                <div className="bg-white/5 p-8 rounded-[2.5rem] flex flex-col items-center border border-white/5">
                  <span className="text-[10px] text-cyan-500 uppercase font-black tracking-widest mb-1 italic">{t.time}</span>
                  <div className="text-4xl font-black text-white italic">{elapsedTime.toFixed(4)}s</div>
                </div>
                <div className="bg-white/5 p-8 rounded-[2.5rem] flex flex-col items-center border border-white/5">
                  <span className="text-[10px] text-red-500 uppercase font-black tracking-widest mb-1 italic">{t.globalRank}</span>
                  <div className="text-4xl font-black text-white italic">#{globalRank || '---'}</div>
                </div>
              </div>

              {aiMessage ? (
                <div className="w-full bg-white/5 p-8 rounded-[2.5rem] mb-10 flex gap-5 text-left border border-white/5 shadow-inner">
                  <MessageSquareQuote size={24} className="text-cyan-400 flex-shrink-0" />
                  <p className="text-slate-200 italic font-bold leading-relaxed">"{aiMessage}"</p>
                </div>
              ) : isAiLoading ? (
                 <div className="w-full py-12 flex flex-col items-center opacity-30 animate-pulse">
                   <Loader2 className="animate-spin mb-3 text-cyan-400" size={24} />
                   <span className="text-[9px] font-black uppercase tracking-[0.3em]">{t.evaluating}</span>
                 </div>
              ) : null}

              <div className="flex items-center gap-3 mb-12 opacity-30">
                <LinkIcon size={14} className="text-slate-400" />
                <span className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400">ZENNUM • SEQUENCE MASTER</span>
              </div>

              <div data-html2canvas-ignore className="grid grid-cols-2 gap-5 w-full">
                <button onClick={() => setShowShareModal(true)} className="bg-cyan-600 hover:bg-cyan-500 py-6 rounded-3xl font-black border-t border-white/10 flex items-center justify-center gap-4 uppercase text-sm tracking-widest transition-all active:scale-95 shadow-xl">
                  <Share2 size={24} /> {t.share}
                </button>
                <button onClick={startGame} className="bg-white/5 py-6 rounded-3xl font-black flex items-center justify-center gap-4 uppercase text-sm tracking-widest border border-white/10 transition-all hover:bg-white/10 active:scale-95">
                  <RotateCcw size={24} /> {t.retry}
                </button>
              </div>
              <button data-html2canvas-ignore onClick={() => setStatus('IDLE')} className="mt-10 text-slate-700 text-[11px] uppercase font-black tracking-[0.4em] hover:text-cyan-400 transition-colors italic">{t.home}</button>
            </div>
          </div>

          {/* 공유 모달 */}
          {showShareModal && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 backdrop-blur-3xl bg-slate-950/80 animate-in fade-in zoom-in-95 duration-300">
              <div className="glass w-full max-w-sm rounded-[4rem] shadow-4xl border-white/10 p-12 flex flex-col items-center overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-red-500"></div>
                <div className="w-18 h-18 bg-cyan-500/10 rounded-3xl flex items-center justify-center mb-8 border border-cyan-500/20">
                  <Share2 size={36} className="text-cyan-400" />
                </div>
                <h3 className="text-3xl font-black mb-4 uppercase tracking-tighter italic">{t.share}</h3>
                <p className="text-slate-500 text-[11px] text-center mb-12 font-bold px-4 leading-relaxed uppercase tracking-[0.3em]">{t.selectPlatform}</p>
                
                <div className="grid grid-cols-2 gap-8 w-full mb-12">
                  <button onClick={() => shareToSocial('ka')} className="flex flex-col items-center gap-4 group">
                    <div className="w-16 h-16 bg-[#FEE500] text-[#191919] rounded-[1.5rem] flex items-center justify-center group-active:scale-90 transition-transform shadow-lg">
                      <MessageCircle size={32} fill="currentColor" />
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.kakaotalk}</span>
                  </button>
                  <button onClick={() => shareToSocial('ig')} className="flex flex-col items-center gap-4 group relative">
                    <div className="w-16 h-16 bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white rounded-[1.5rem] flex items-center justify-center group-active:scale-90 transition-transform shadow-lg">
                      <Instagram size={32} />
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.instagram}</span>
                    {isCapturing && <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-[1.5rem]"><Loader2 size={24} className="animate-spin text-white" /></div>}
                  </button>
                  <button onClick={() => shareToSocial('dl')} className="flex flex-col items-center gap-4 group relative">
                    <div className="w-16 h-16 bg-white/10 text-white rounded-[1.5rem] flex items-center justify-center group-active:scale-90 transition-transform shadow-lg border border-white/10">
                      <Download size={32} />
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.saveImage}</span>
                    {isCapturing && <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-[1.5rem]"><Loader2 size={24} className="animate-spin text-white" /></div>}
                  </button>
                  <button onClick={() => shareToSocial('copy')} className="flex flex-col items-center gap-4 group">
                    <div className="w-16 h-16 bg-white/10 text-cyan-400 rounded-[1.5rem] flex items-center justify-center group-active:scale-90 transition-transform shadow-lg border border-white/10">
                      <Copy size={32} />
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.copyLink}</span>
                  </button>
                </div>
                
                <button onClick={() => setShowShareModal(false)} className="w-full py-6 glass border-white/10 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 hover:text-white transition-all">{t.close}</button>
              </div>
            </div>
          )}

          {/* 랭킹 모달 */}
          {showRankingsFor && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 backdrop-blur-2xl bg-slate-950/90 animate-in fade-in">
              <div className="glass w-full max-w-md rounded-[4rem] shadow-4xl border-white/10 flex flex-col max-h-[80vh] overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500"></div>
                <div className="p-10 border-b border-white/5 flex justify-between items-center bg-white/5">
                  <h3 className="text-2xl font-black flex items-center gap-4 italic uppercase tracking-tight">
                    <Trophy size={28} className="text-yellow-500" /> {t.globalTop}
                  </h3>
                  <button onClick={() => setShowRankingsFor(null)} className="p-3 hover:bg-white/10 rounded-2xl transition-all"><X size={28} /></button>
                </div>
                <div className="overflow-y-auto p-8 space-y-4">
                  {globalScores.length > 0 ? globalScores.map((s, i) => (
                    <div key={s.id} className={`flex justify-between items-center p-6 rounded-[2rem] border-2 transition-all ${s.userId === userId ? 'bg-cyan-500/10 border-cyan-500/50 shadow-lg' : 'bg-white/5 border-transparent'}`}>
                      <div className="flex items-center gap-5">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black italic text-lg ${i < 3 ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'bg-white/10 text-slate-500'}`}>{i + 1}</div>
                        <div>
                          <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">{s.userName}</div>
                          <div className="text-xl font-black text-white italic tabular-nums">{s.time.toFixed(4)}s</div>
                        </div>
                      </div>
                      {i < 3 && <Medal size={24} className="text-yellow-500" />}
                    </div>
                  )) : <div className="py-24 text-center opacity-20 text-[12px] font-black uppercase tracking-[0.5em]">{t.noRecords}</div>}
                </div>
                <div className="p-10 bg-white/5 border-t border-white/5">
                  <button onClick={() => setShowRankingsFor(null)} className="w-full py-6 glass rounded-[2rem] text-[11px] font-black uppercase tracking-[0.5em] hover:bg-white/10 transition-all">{t.close}</button>
                </div>
              </div>
            </div>
          )}

          <footer className="w-full py-12 text-center text-slate-800 text-[11px] font-black tracking-[0.6em] uppercase italic">ZENNUM VER 5.2 • ELITE EDITION</footer>
        </>
      )}
      <style>{`.shake { animation: shake 0.12s ease-in-out 3; } @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }`}</style>
    </div>
  );
};

export default App;
