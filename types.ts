
export type GameStatus = 'IDLE' | 'COUNTDOWN' | 'PLAYING' | 'FINISHED' | 'SETUP';
export type Language = 'KO' | 'EN';

export interface Difficulty {
  id: string;
  name: { KO: string; EN: string };
  size: number;
  total: number;
}

export const DIFFICULTIES: Difficulty[] = [
  { id: 'easy', name: { KO: 'LITE', EN: 'LITE' }, size: 3, total: 9 },
  { id: 'normal', name: { KO: 'CLASSIC', EN: 'CLASSIC' }, size: 5, total: 25 },
  { id: 'hard', name: { KO: 'ELITE', EN: 'ELITE' }, size: 6, total: 36 },
];

export interface ScoreEntry {
  id: string;
  userId: string;
  difficultyId: string;
  time: number;
  date: number;
  userName: string;
}

export const TRANSLATIONS = {
  KO: {
    title: "ZENNUM",
    subtitle: "TAP THE NUMBERS FAST!",
    selectMode: "모드 선택",
    start: "챌린지 시작",
    best: "BEST",
    time: "TIME",
    progression: "PROGRESS",
    complete: "CHALLENGE COMPLETE",
    share: "결과 공유",
    retry: "다시 도전",
    home: "홈으로",
    evaluating: "분석 중...",
    globalRank: "글로벌 순위",
    close: "닫기",
    noRecords: "기록 없음",
    shareMsg: "한계를 돌파했습니다! 기록: {time}초. 도전하시겠습니까?",
    enterName: "이름을 입력하세요",
    saveName: "접속하기",
    welcome: "WELCOME MASTER",
    pbUpdated: "개인 최고 기록 갱신!",
    rendering: "이미지 생성 중...",
    uploading: "업로드 중...",
    sharing: "연결 중...",
    cancel: "취소",
    selectPlatform: "공유 플랫폼 선택",
    copySuccess: "링크가 복사되었습니다!",
    copyFail: "복사 실패",
    shareFail: "공유 중 오류가 발생했습니다.",
    saveSuccess: "이미지를 저장했습니다.",
    kakaotalk: "카카오톡",
    instagram: "인스타그램",
    saveImage: "이미지 저장",
    copyLink: "링크 복사",
    globalTop: "GLOBAL TOP 1000",
  },
  EN: {
    title: "ZENNUM",
    subtitle: "TAP THE NUMBERS FAST!",
    selectMode: "SELECT MODE",
    start: "START CHALLENGE",
    best: "BEST",
    time: "TIME",
    progression: "PROGRESS",
    complete: "CHALLENGE COMPLETE",
    share: "SHARE RESULT",
    retry: "RETRY",
    home: "HOME",
    evaluating: "EVALUATING...",
    globalRank: "GLOBAL RANK",
    close: "CLOSE",
    noRecords: "NO RECORDS",
    shareMsg: "Limit broken! Record: {time}s. Can you beat me?",
    enterName: "ENTER PLAYER NAME",
    saveName: "ENTER",
    welcome: "WELCOME MASTER",
    pbUpdated: "NEW PERSONAL BEST!",
    rendering: "RENDERING...",
    uploading: "UPLOADING...",
    sharing: "CONNECTING...",
    cancel: "CANCEL",
    selectPlatform: "SELECT PLATFORM",
    copySuccess: "LINK COPIED!",
    copyFail: "COPY FAILED",
    shareFail: "SHARING ERROR",
    saveSuccess: "IMAGE SAVED!",
    kakaotalk: "KAKAOTALK",
    instagram: "INSTAGRAM",
    saveImage: "SAVE IMAGE",
    copyLink: "COPY LINK",
    globalTop: "GLOBAL TOP 1000",
  }
};
