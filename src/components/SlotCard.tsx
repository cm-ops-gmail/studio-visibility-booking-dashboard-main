'use client';

import { useState } from 'react';
import { ClassBooking } from '@/app/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Sparkles, Loader2, Info, BookOpen, Layers, Clock } from 'lucide-react';
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
      <Card className="h-full min-h-full border-none bg-zinc-900/50 hover:bg-zinc-800/80 shadow-2xl transition-all duration-300 group ring-1 ring-primary/20 hover:ring-primary/50 relative overflow-hidden flex flex-col">
        {/* Animated Accent Bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary group-hover:w-2 transition-all duration-300 shadow-[4px_0_15px_rgba(139,92,246,0.4)]" />
        
        <CardContent className="p-5 flex flex-col gap-4 h-full relative z-10">
          <div className="space-y-3 flex-1">
            <div className="flex justify-between items-start gap-3">
              <div className="flex flex-col gap-2">
                {slot.productType && (
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80">
                    {slot.productType}
                  </span>
                )}
                <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest text-white border-zinc-700 bg-zinc-800/50 px-3 py-1">
                  {slot.course || 'GENERAL'}
                </Badge>
              </div>
              {timeRangeLabel && (
                <div className="bg-zinc-950/80 border border-zinc-800 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-inner">
                  <Clock className="w-3 h-3 text-zinc-500" />
                  <span className="text-[10px] font-black text-zinc-300 whitespace-nowrap tracking-wider">
                    {timeRangeLabel}
                  </span>
                </div>
              )}
            </div>
            
            <h3 className="font-black text-xl leading-[1.15] text-white group-hover:text-primary transition-colors tracking-tight line-clamp-3">
              {slot.subject}
            </h3>
            
            {slot.topic && (
              <div className="flex items-start gap-2.5 mt-3 p-3 rounded-2xl bg-zinc-950/40 border border-zinc-800/30">
                <Layers className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
                <p className="text-xs text-zinc-400 font-medium leading-relaxed italic line-clamp-3">
                  {slot.topic}
                </p>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3 mt-auto pt-4 border-t border-zinc-800/50">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary transition-colors duration-300">
              <User className="w-5 h-5 text-primary group-hover:text-white transition-colors" />
            </div>
            <div className="flex flex-col">
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">INSTRUCTOR</span>
                <span className="text-sm font-black text-white truncate max-w-[180px]">
                  {slot.teacher || 'TBA'}
                </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full min-h-full border-2 border-dashed border-zinc-800 bg-zinc-950/20 flex flex-col items-center justify-center p-6 hover:bg-zinc-900/40 hover:border-zinc-700 transition-all duration-500 group relative">
      <div className="text-center space-y-4">
        <div className="text-[11px] font-black text-zinc-600 group-hover:text-zinc-400 transition-colors px-4 uppercase tracking-[0.3em] flex items-center gap-3 justify-center">
            {suggestion ? (
                <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-800 group-hover:bg-primary transition-colors" />
            )}
            {suggestion || "AVAILABLE"}
        </div>
        
        {!suggestion && (
          <button 
            onClick={handleSuggest} 
            disabled={loading}
            className="rounded-2xl h-11 text-[10px] font-black uppercase tracking-[0.2em] bg-zinc-900 text-zinc-400 hover:bg-primary hover:text-white transition-all border border-zinc-800 hover:border-primary shadow-2xl px-6 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 disabled:opacity-50 hover:scale-105 active:scale-95"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            GET IDEA
          </button>
        )}
      </div>
    </Card>
  );
}