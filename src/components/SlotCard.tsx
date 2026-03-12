'use client';

import { useState } from 'react';
import { ClassBooking } from '@/app/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Sparkles, Loader2, Clock, Layers } from 'lucide-react';
import { getSmartSuggestion } from '@/app/actions/schedule';
import { cn } from '@/lib/utils';

interface SlotCardProps {
  slot: ClassBooking;
  existingBookings: ClassBooking[];
}

export function SlotCard({ slot, existingBookings }: SlotCardProps) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSuggest = async () => {
    setLoading(true);
    try {
      const result = await getSmartSuggestion(slot, existingBookings);
      setSuggestion(result.suggestedDescription);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const timeRangeLabel = slot.startTimeLabel && slot.endTimeLabel 
    ? `${slot.startTimeLabel} - ${slot.endTimeLabel}`
    : '';

  if (slot.isBooked) {
    return (
      <Card className="h-full min-h-full border-none bg-zinc-900/60 hover:bg-zinc-800/90 shadow-xl transition-all duration-300 group ring-1 ring-primary/20 hover:ring-primary/40 relative overflow-hidden flex flex-col">
        {/* Animated Accent Bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary group-hover:w-1.5 transition-all duration-300 shadow-[2px_0_10px_rgba(139,92,246,0.4)]" />
        
        <CardContent className="p-3 flex flex-col gap-2 h-full relative z-10">
          <div className="space-y-1.5 flex-1">
            <div className="flex justify-between items-start gap-2">
              <div className="flex flex-wrap gap-1">
                {slot.productType && (
                  <span className="text-[8px] font-black uppercase tracking-[0.15em] text-white/70">
                    {slot.productType}
                  </span>
                )}
                <Badge variant="outline" className="text-[8px] font-black uppercase tracking-wider text-white border-white/10 bg-zinc-800/40 px-1.5 py-0">
                  {slot.course || 'GENERAL'}
                </Badge>
              </div>
              {timeRangeLabel && (
                <div className="bg-zinc-950/60 border border-zinc-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5 text-white/50" />
                  <span className="text-[8px] font-bold text-white whitespace-nowrap">
                    {timeRangeLabel}
                  </span>
                </div>
              )}
            </div>
            
            <h3 className="font-bold text-sm leading-tight text-white group-hover:text-primary transition-colors tracking-tight line-clamp-2">
              {slot.subject}
            </h3>
            
            {slot.topic && (
              <div className="flex items-start gap-1.5 p-1.5 rounded-lg bg-zinc-950/30 border border-white/5">
                <Layers className="w-3 h-3 text-white/40 shrink-0 mt-0.5" />
                <p className="text-[10px] text-white/80 font-medium leading-normal line-clamp-2 italic">
                  {slot.topic}
                </p>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 mt-auto pt-2 border-t border-white/5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary transition-colors">
              <User className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex flex-col min-w-0">
                <span className="text-[7px] font-black text-white/50 uppercase tracking-widest">INSTRUCTOR</span>
                <span className="text-[11px] font-bold text-white truncate">
                  {slot.teacher || 'TBA'}
                </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full min-h-full border border-dashed border-zinc-800 bg-zinc-950/10 flex flex-col items-center justify-center p-3 hover:bg-zinc-900/30 hover:border-zinc-700 transition-all duration-300 group relative">
      <div className="text-center space-y-2">
        <div className="text-[9px] font-black text-white/60 group-hover:text-white transition-colors px-2 uppercase tracking-[0.2em] flex items-center gap-1.5 justify-center">
            {suggestion ? (
                <Sparkles className="w-3 h-3 text-primary animate-pulse" />
            ) : (
                <div className="w-1 h-1 rounded-full bg-primary/40 transition-colors" />
            )}
            {suggestion || "AVAILABLE"}
        </div>
        
        {!suggestion && (
          <button 
            onClick={handleSuggest} 
            disabled={loading}
            className="rounded-lg h-7 text-[8px] font-black uppercase tracking-widest bg-zinc-900 text-white hover:bg-primary transition-all border border-zinc-800 hover:border-primary px-3 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            IDEA
          </button>
        )}
      </div>
    </Card>
  );
}
