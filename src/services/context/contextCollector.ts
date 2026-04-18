/**
 * 컨텍스트 수집기 (Phase 4)
 *
 * 시간, 화면, 시스템 환경 정보를 수집하여
 * 시스템 프롬프트에 주입할 수 있는 형태로 반환한다.
 */

export interface ContextSnapshot {
  /** 시간 컨텍스트 (항상 사용 가능) */
  time: TimeContext;
  /** 시스템 컨텍스트 */
  system: SystemContext;
}

export interface TimeContext {
  hour: number;
  minute: number;
  dayOfWeek: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  isLateNight: boolean;
}

export interface SystemContext {
  /** 앱 활성 시간 (분) */
  sessionMinutes: number;
}

const DAY_NAMES_KO = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

const appStartTime = Date.now();

function getTimeOfDay(hour: number): TimeContext['timeOfDay'] {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'night';
}

/**
 * 현재 컨텍스트 스냅샷을 수집한다.
 */
export function collectContext(): ContextSnapshot {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();

  return {
    time: {
      hour,
      minute,
      dayOfWeek: DAY_NAMES_KO[now.getDay()],
      timeOfDay: getTimeOfDay(hour),
      isLateNight: hour >= 23 || hour < 5,
    },
    system: {
      sessionMinutes: Math.floor((Date.now() - appStartTime) / 60_000),
    },
  };
}

/**
 * 컨텍스트를 시스템 프롬프트에 삽입할 문자열로 변환한다.
 */
export function formatContextForPrompt(ctx: ContextSnapshot): string {
  const parts: string[] = [];

  // 시간 컨텍스트 (항상)
  const { time } = ctx;
  const hourStr = time.hour < 12
    ? `오전 ${time.hour}시 ${time.minute}분`
    : time.hour === 12
      ? `오후 12시 ${time.minute}분`
      : `오후 ${time.hour - 12}시 ${time.minute}분`;
  parts.push(`현재 시각: ${hourStr} (${time.dayOfWeek})`);

  if (time.isLateNight) {
    parts.push('늦은 시간입니다. 사용자의 건강을 걱정해주세요.');
  }

  // 세션 시간
  if (ctx.system.sessionMinutes > 120) {
    const hours = Math.floor(ctx.system.sessionMinutes / 60);
    parts.push(`사용자가 ${hours}시간 넘게 앱을 사용 중입니다.`);
  }

  return `[현재 컨텍스트]\n${parts.join('\n')}`;
}
