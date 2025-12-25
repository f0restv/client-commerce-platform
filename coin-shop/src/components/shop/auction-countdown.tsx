'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCountdown } from '@/lib/utils/format';

interface AuctionCountdownProps {
  endDate: string;
  variant?: 'compact' | 'full' | 'badge';
  onExpire?: () => void;
}

export function AuctionCountdown({
  endDate,
  variant = 'full',
  onExpire,
}: AuctionCountdownProps) {
  const [countdown, setCountdown] = useState(formatCountdown(endDate));

  useEffect(() => {
    const timer = setInterval(() => {
      const newCountdown = formatCountdown(endDate);
      setCountdown(newCountdown);

      if (newCountdown.expired && onExpire) {
        onExpire();
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endDate, onExpire]);

  if (countdown.expired) {
    return (
      <div className="text-red-600 font-semibold flex items-center gap-2">
        <Clock className="w-4 h-4" />
        Auction Ended
      </div>
    );
  }

  if (variant === 'badge') {
    return (
      <div className="inline-flex items-center gap-1 bg-gold-100 text-gold-800 px-2 py-1 rounded-full text-sm font-medium">
        <Clock className="w-3 h-3" />
        {countdown.days > 0 && `${countdown.days}d `}
        {countdown.hours}h {countdown.minutes}m
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Clock className="w-4 h-4 text-gold-600" />
        <span className="text-gray-600 dark:text-gray-300">
          {countdown.days > 0 && `${countdown.days}d `}
          {String(countdown.hours).padStart(2, '0')}:
          {String(countdown.minutes).padStart(2, '0')}:
          {String(countdown.seconds).padStart(2, '0')}
        </span>
      </div>
    );
  }

  // Full variant
  const isUrgent = countdown.days === 0 && countdown.hours < 1;

  return (
    <div className={cn(
      'p-4 rounded-lg border',
      isUrgent
        ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
        : 'bg-gold-50 border-gold-200 dark:bg-gold-900/20 dark:border-gold-800'
    )}>
      <div className="flex items-center gap-2 mb-3">
        <Clock className={cn('w-5 h-5', isUrgent ? 'text-red-600' : 'text-gold-600')} />
        <span className={cn('font-semibold', isUrgent ? 'text-red-800' : 'text-gold-800')}>
          {isUrgent ? 'Ending Soon!' : 'Time Remaining'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {countdown.days > 0 && (
          <>
            <div className="countdown-digit">{countdown.days}</div>
            <span className="text-xs text-gray-500">D</span>
          </>
        )}
        <div className="countdown-digit">{String(countdown.hours).padStart(2, '0')}</div>
        <span className="text-gray-500">:</span>
        <div className="countdown-digit">{String(countdown.minutes).padStart(2, '0')}</div>
        <span className="text-gray-500">:</span>
        <div className={cn('countdown-digit', isUrgent && 'bg-red-600')}>
          {String(countdown.seconds).padStart(2, '0')}
        </div>
      </div>
    </div>
  );
}
