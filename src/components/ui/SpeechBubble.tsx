import { useEffect, useState } from 'react';
import { useAvatarStore } from '../../stores/avatarStore';

interface SpeechBubbleProps {
  message: string;
  duration?: number;
}

export default function SpeechBubble({ message, duration = 10000 }: SpeechBubbleProps) {
  const [isVisible, setIsVisible] = useState(true);
  const { position } = useAvatarStore();

  useEffect(() => {
    setIsVisible(true);
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration]);

  if (!isVisible || !message) return null;

  // Position bubble above and to the right of avatar
  const bubbleStyle = {
    left: `${Math.min(position.x + 50, window.innerWidth - 320)}px`,
    top: `${Math.max(position.y - 150, 10)}px`,
  };

  return (
    <div
      className="speech-bubble fixed z-50 max-w-xs"
      style={bubbleStyle}
    >
      <div className="relative bg-white rounded-2xl shadow-lg px-4 py-3 border border-gray-200">
        {/* Speech bubble tail */}
        <div
          className="absolute w-4 h-4 bg-white border-l border-b border-gray-200 transform rotate-45"
          style={{
            bottom: '-8px',
            left: '20px',
          }}
        />

        {/* Message content */}
        <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
          {message}
        </p>
      </div>
    </div>
  );
}
