'use client';

import { ClassBooking } from '@/app/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Clock, Layers, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SlotCardProps {
  slot: ClassBooking;
  existingBookings: ClassBooking[];
}

export function SlotCard({ slot }: SlotCardProps) {
  const timeRangeLabel = slot.startTimeLabel && slot.endTimeLabel 
    ? `${slot.startTimeLabel} - ${slot.endTimeLabel}`
    : '';

  if (slot.isBooked) {
    return (
      <Card className="h-full min-h-full border-none bg-zinc-900/80 hover:bg-zinc-800 shadow-2xl transition-all duration-500 group ring-1 ring-white/5 hover:ring-red-500/40 relative overflow-hidden flex flex-col rounded-2xl">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500 group-hover:w-2 transition-all duration-500 shadow-[2px_0_15px_rgba(239,68,68,0.4)]" />
        
        <CardContent className="p-3 flex flex-col gap-3 h-full relative z-10">
          <div className="space-y-2 flex-1">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                 <Badge variant="outline" className="text-[8px] font-black uppercase tracking-[0.1em] text-white border-red-500/40 bg-red-500/10 px-2 py-0.5 rounded-md">
                   {slot.productType || 'CLASS'}
                 </Badge>
                 <span className="text-[8px] font-black uppercase tracking-widest text-white/40">
                   {slot.course}
                 </span>
              </div>
              
              <h3 className="font-black text-xs leading-tight text-white group-hover:text-red-500 transition-colors tracking-tight line-clamp-2 uppercase">
                {slot.subject}
              </h3>
            </div>
            
            {slot.topic && (
              <div className="flex items-start gap-2 p-2 rounded-xl bg-black/40 border border-white/5 backdrop-blur-sm">
                <Layers className="w-3 h-3 text-red-500/60 shrink-0 mt-0.5" />
                <p className="text-[9px] text-white font-bold leading-relaxed line-clamp-2 italic opacity-80">
                  {slot.topic}
                </p>
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-between gap-2 mt-auto pt-3 border-t border-white/5">
            <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-white/5 flex items-center justify-center shrink-0 group-hover:bg-red-500 group-hover:border-red-500 transition-all duration-300 shadow-lg">
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
                  <Clock className="w-3 h-3 text-red-500" />
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
    <Card className="h-full min-h-full border border-dashed border-emerald-500/40 bg-zinc-950/20 flex flex-col items-center justify-center p-4 hover:bg-emerald-500/5 hover:border-emerald-500/60 transition-all duration-500 group relative rounded-2xl overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.03),transparent)] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      
      <div className="text-center space-y-3 relative z-10 w-full px-2">
        <div className="text-[9px] font-black text-white group-hover:text-emerald-500 transition-colors px-3 uppercase tracking-[0.3em] flex items-center gap-2 justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-800 group-hover:bg-emerald-500/60 transition-colors animate-pulse" />
            AVAILABLE
        </div>
        
        <div className="flex flex-col gap-2 items-center">
          <a 
            href="https://forms.gle/bf4WzXLC9KCoD2WG8" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full"
          >
            <Button 
              variant="outline" 
              className="w-full rounded-xl h-9 text-[9px] font-black uppercase tracking-[0.2em] bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all border-emerald-500/30 hover:border-emerald-500 px-4 flex items-center justify-center gap-2 shadow-lg"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Request a Booking
            </Button>
          </a>
        </div>
      </div>
    </Card>
  );
}
