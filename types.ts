
export type GameStatus = 'IDLE' | 'COUNTDOWN' | 'PLAYING' | 'FINISHED' | 'SETUP';
export type Language = 'KO' | 'EN';

export interface Difficulty {
  id: string;
  name: { KO: string; EN: string };
  size: number;
  total: number;
}

export const DIFFICULTIES: Difficulty[] = [
  { id: 'easy', name: { KO: '라이트', EN: 'Lite' }, size: 3, total: 9 },
  { id: 'normal', name: { KO: '클래식', EN: 'Classic' }, size: 5, total: 25 },
  { id: 'hard', name: { KO: '엘리트', EN: 'Elite' }, size: 6, total: 36 },
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
    title: "젠 넘버즈",
    subtitle: "최종본: 오디토리 임머시브",
    selectMode: "모드 선택",
    selectLang: "언어",
    start: "챌린지 시작",
    best: "최고 기록",
    rank: "순위",
    elapsed: "진행 시간",
    progression: "진행도",
    complete: "챌린지 완료",
    share: "결과 공유",
    retry: "다시 도전",
    home: "홈으로",
    masterComment: "마스터의 한마디",
    evaluating: "정신력을 평가 중...",
    globalRank: "글로벌 랭킹",
    close: "닫기",
    noRecords: "아직 기록이 없습니다.",
    shareMsg: "집중력 한계 돌파! 제 기록은 {time}초입니다. 도전해보세요!",
    enterName: "플레이어 이름을 입력하세요",
    saveName: "저장 및 시작",
    welcome: "환영합니다, 마스터",
    pbUpdated: "최고 기록 달성! 서버에 기록되었습니다.",
    rendering: "이미지 생성 중...",
    uploading: "데이터 업로드 중...",
    sharing: "공유 채널 연결 중...",
    cancel: "취소",
    selectPlatform: "플랫폼 선택",
    copySuccess: "결과 링크가 복사되었습니다!",
    copyFail: "복사 실패",
    shareFail: "공유 중 오류가 발생했습니다.",
    saveSuccess: "이미지를 저장했습니다. 공유해보세요!",
    kakaotalk: "카카오톡",
    instagram: "인스타그램",
    saveImage: "이미지 저장",
    copyLink: "링크 복사",
    globalTop: "글로벌 Top 1000",
  },
  EN: {
    title: "ZEN NUMBERS",
    subtitle: "FINAL: SONIC IMMERSIVE",
    selectMode: "SELECT MODE",
    selectLang: "LANG",
    start: "START CHALLENGE",
    best: "PERSONAL BEST",
    rank: "RANK",
    elapsed: "ELAPSED",
    progression: "PROGRESS",
    complete: "CHALLENGE COMPLETE",
    share: "SHARE RESULT",
    retry: "RETRY",
    home: "HOME",
    masterComment: "ZEN MASTER COMMENT",
    evaluating: "EVALUATING SPIRIT...",
    globalRank: "GLOBAL RANKINGS",
    close: "CLOSE",
    noRecords: "NO RECORDS YET.",
    shareMsg: "Broke the limit! My record is {time}s. Can you beat me?",
    enterName: "Enter Player Name",
    saveName: "Save & Start",
    welcome: "Welcome, Master",
    pbUpdated: "New PB! Syncing with Global Leaderboard.",
    rendering: "Rendering Image...",
    uploading: "Uploading Data...",
    sharing: "Connecting...",
    cancel: "Cancel",
    selectPlatform: "Select Platform",
    copySuccess: "Link copied to clipboard!",
    copyFail: "Copy failed",
    shareFail: "Error during sharing.",
    saveSuccess: "Image saved. Go ahead and share it!",
    kakaotalk: "KakaoTalk",
    instagram: "Instagram",
    saveImage: "Save Image",
    copyLink: "Copy Link",
    globalTop: "Global Top 1000",
  }
};
