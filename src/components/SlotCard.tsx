'use client';

import { useState } from 'react';
import { ClassBooking } from '@/app/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Sparkles, Loader2, Clock, Layers, Box } from 'lucide-react';
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
      <Card className="h-full min-h-full border-none bg-zinc-900/80 hover:bg-zinc-800 shadow-2xl transition-all duration-500 group ring-1 ring-white/5 hover:ring-primary/40 relative overflow-hidden flex flex-col rounded-2xl">
        {/* Neon Accent Line */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary group-hover:w-2 transition-all duration-500 shadow-[2px_0_15px_rgba(139,92,246,0.6)]" />
        
        <CardContent className="p-3 flex flex-col gap-3 h-full relative z-10">
          <div className="space-y-2 flex-1">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                 <Badge variant="outline" className="text-[8px] font-black uppercase tracking-[0.1em] text-white border-primary/40 bg-primary/10 px-2 py-0.5 rounded-md">
                   {slot.productType || 'CLASS'}
                 </Badge>
                 <span className="text-[8px] font-black uppercase tracking-widest text-white/40">
                   {slot.course}
                 </span>
              </div>
              
              <h3 className="font-black text-xs leading-tight text-white group-hover:text-primary transition-colors tracking-tight line-clamp-2 uppercase">
                {slot.subject}
              </h3>
            </div>
            
            {slot.topic && (
              <div className="flex items-start gap-2 p-2 rounded-xl bg-black/40 border border-white/5 backdrop-blur-sm">
                <Layers className="w-3 h-3 text-primary/60 shrink-0 mt-0.5" />
                <p className="text-[9px] text-white font-bold leading-relaxed line-clamp-2 italic opacity-80">
                  {slot.topic}
                </p>
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-between gap-2 mt-auto pt-3 border-t border-white/5">
            <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-white/5 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:border-primary transition-all duration-300 shadow-lg">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-[7px] font-black text-white/30 uppercase tracking-[0.2em]">INSTRUCTOR</span>
                    <span className="text-[10px] font-black text-white truncate uppercase tracking-tight">
                      {slot.teacher || 'TBA'}
                    </span>
                </div>
            </div>
            {timeRangeLabel && (
                <div className="bg-black/60 border border-zinc-800 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-inner">
                  <Clock className="w-3 h-3 text-primary" />
                  <span className="text-[8px] font-black text-white whitespace-nowrap tracking-tighter">
                    {timeRangeLabel}
                  </span>
                </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full min-h-full border border-dashed border-zinc-800 bg-zinc-950/20 flex flex-col items-center justify-center p-4 hover:bg-zinc-900/40 hover:border-zinc-700 transition-all duration-500 group relative rounded-2xl overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.03),transparent)] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      
      <div className="text-center space-y-3 relative z-10">
        <div className="text-[9px] font-black text-white group-hover:text-primary transition-colors px-3 uppercase tracking-[0.3em] flex items-center gap-2 justify-center">
            {suggestion ? (
                <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
            ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-800 group-hover:bg-primary/60 transition-colors animate-pulse" />
            )}
            {suggestion || "AVAILABLE"}
        </div>
        
        {!suggestion && (
          <button 
            onClick={handleSuggest} 
            disabled={loading}
            className="rounded-xl h-9 text-[9px] font-black uppercase tracking-[0.2em] bg-zinc-900 text-white hover:bg-white hover:text-black transition-all border border-zinc-800 hover:border-white px-5 flex items-center justify-center gap-2.5 opacity-0 group-hover:opacity-100 disabled:opacity-50 shadow-2xl translate-y-2 group-hover:translate-y-0 duration-300"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            ANALYZE
          </button>
        )}
      </div>
    </Card>
  );
}
