import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { Loader2 } from 'lucide-react';

declare global {
  interface Window {
    Kakao: any;
  }
}

const KAKAO_KEY = 'a7c872a95007ae033c540c81f170eaeb';
const CURRENT_URL = window.location.href;

const ensureKakaoInit = () => {
  if (!window.Kakao) return false;
  if (!window.Kakao.isInitialized()) {
    try {
      window.Kakao.init(KAKAO_KEY);
    } catch {
      return false;
    }
  }
  return true;
};

const App: React.FC = () => {
  const [status, setStatus] = useState<'IDLE' | 'PLAYING' | 'FINISHED'>('IDLE');
  const [numbers, setNumbers] = useState<number[]>([]);
  const [nextExpected, setNextExpected] = useState(1);
  const [startTime, setStartTime] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);

  const shuffle = (arr: number[]) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const startGame = () => {
    setNumbers(shuffle(Array.from({ length: 16 }, (_, i) => i + 1)));
    setNextExpected(1);
    setElapsedTime(0);
    setStatus('PLAYING');
    setStartTime(performance.now());
  };

  const finishGame = () => {
    const final = (performance.now() - startTime) / 1000;
    setElapsedTime(final);
    setStatus('FINISHED');
  };

  const handleClick = (num: number) => {
    if (num !== nextExpected) return;
    if (num === 16) finishGame();
    else setNextExpected((p) => p + 1);
  };

  /* ===============================
     🔗 SHARE (카카오 = 결과 이미지)
  =============================== */
  const shareToKakao = async () => {
    if (!ensureKakaoInit()) {
      alert('Kakao SDK Error');
      return;
    }

    if (!resultRef.current) return;

    setIsCapturing(true);

    try {
      const canvas = await html2canvas(resultRef.current, {
        backgroundColor: '#020617',
        scale: 2,
        useCORS: true,
      });

      const imageDataUrl = canvas.toDataURL('image/png');

      window.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: 'Zen Numbers 결과',
          description: `기록: ${elapsedTime.toFixed(6)}초`,
          imageUrl: imageDataUrl, // ⭐ 결과 이미지
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
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center">
      {status === 'IDLE' && (
        <button
          onClick={startGame}
          className="bg-indigo-600 px-10 py-6 rounded-3xl font-black"
        >
          START
        </button>
      )}

      {status === 'PLAYING' && (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}
        >
          {numbers.map((n) => (
            <button
              key={n}
              onClick={() => handleClick(n)}
              className="w-20 h-20 bg-white/10 rounded-xl font-black"
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {status === 'FINISHED' && (
        <div
          ref={resultRef}
          className="bg-slate-900 p-10 rounded-3xl text-center w-[320px]"
        >
          <h2 className="text-3xl font-black mb-4">CLEAR</h2>
          <div className="text-2xl font-black text-indigo-400 mb-6">
            {elapsedTime.toFixed(6)}s
          </div>

          <button
            onClick={shareToKakao}
            className="bg-yellow-400 text-black font-black py-4 px-6 rounded-2xl w-full"
          >
            카카오톡 공유
          </button>

          <button
            onClick={() => setStatus('IDLE')}
            className="mt-4 text-xs text-slate-400"
          >
            다시하기
          </button>
        </div>
      )}

      {isCapturing && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center">
          <Loader2 className="animate-spin text-white" size={40} />
        </div>
      )}
    </div>
  );
};

export default App;
