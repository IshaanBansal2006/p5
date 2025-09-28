'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface TruncatedTextProps {
  text: string;
  maxLines?: number;
  className?: string;
  hoverClassName?: string;
  showEllipsis?: boolean;
}

export function TruncatedText({
  text,
  maxLines = 3,
  className = '',
  hoverClassName = '',
  showEllipsis = true
}: TruncatedTextProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [needsTruncation, setNeedsTruncation] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  // Check if text actually needs truncation by measuring the element
  useEffect(() => {
    if (textRef.current) {
      const element = textRef.current;
      const lineHeight = parseInt(getComputedStyle(element).lineHeight) || 20;
      const maxHeight = lineHeight * maxLines;
      setNeedsTruncation(element.scrollHeight > maxHeight);
    }
  }, [text, maxLines]);

  if (!text || text.trim() === '') {
    return null;
  }

  if (!needsTruncation) {
    return (
      <div ref={textRef} className={className}>
        {text}
      </div>
    );
  }

  return (
    <div
      ref={textRef}
      className={cn(
        'transition-all duration-200 ease-in-out',
        isHovered ? 'cursor-text' : 'cursor-pointer',
        className,
        isHovered && hoverClassName
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: '-webkit-box',
        WebkitLineClamp: isHovered ? 'none' : maxLines,
        WebkitBoxOrient: 'vertical',
        overflow: isHovered ? 'visible' : 'hidden',
        textOverflow: isHovered ? 'initial' : 'ellipsis',
        whiteSpace: isHovered ? 'normal' : 'nowrap',
        wordBreak: isHovered ? 'break-word' : 'normal'
      }}
      title={isHovered ? undefined : 'Hover to expand'}
    >
      {text}
      {!isHovered && showEllipsis && (
        <span className="text-muted-foreground">...</span>
      )}
    </div>
  );
}

