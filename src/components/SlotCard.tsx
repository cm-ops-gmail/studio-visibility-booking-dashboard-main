'use client';

import { useState } from 'react';
import { ClassBooking } from '@/app/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Sparkles, Loader2 } from 'lucide-react';
import { getSmartSuggestion } from '@/app/actions/schedule';
import { format } from 'date-fns';

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

  const timeRangeLabel = `${format(new Date(slot.startTime), 'h:mm')} - ${format(new Date(slot.endTime), 'h:mm a')}`;

  if (slot.isBooked) {
    return (
      <Card className="h-full border-l-4 border-l-[#403399] bg-white shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-3 flex flex-col gap-2 h-full">
          <div className="space-y-1">
            <div className="flex justify-between items-start gap-2">
              <Badge variant="outline" className="text-[8px] font-extrabold uppercase tracking-widest text-[#403399] border-[#403399]/10 bg-[#403399]/5 px-2 py-0">
                {slot.course || 'GENERAL'}
              </Badge>
              <span className="text-[9px] font-medium text-muted-foreground whitespace-nowrap">
                {timeRangeLabel}
              </span>
            </div>
            <h3 className="font-headline font-bold text-sm leading-tight text-foreground line-clamp-2">
              {slot.subject}
            </h3>
            <p className="text-[10px] text-muted-foreground line-clamp-1 italic">
              {slot.topic}
            </p>
          </div>
          
          <div className="flex items-center gap-2 mt-auto pt-2 border-t border-border/30">
            <div className="w-5 h-5 rounded-full bg-[#82A2ED]/20 flex items-center justify-center shrink-0">
              <User className="w-3 h-3 text-[#403399]" />
            </div>
            <span className="text-[10px] font-bold text-[#403399] truncate">
              {slot.teacher || 'TBA'}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full border-dashed border-2 bg-[#F8F9FD]/50 flex flex-col items-center justify-center p-3 hover:bg-[#F8F9FD] transition-colors group min-h-[60px]">
      <div className="text-center space-y-2">
        <p className="text-[9px] font-bold text-[#5C6B89] group-hover:text-[#403399] transition-colors px-2 uppercase tracking-widest">
          {suggestion || "AVAILABLE"}
        </p>
        
        {!suggestion && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSuggest} 
            disabled={loading}
            className="rounded-full h-6 text-[8px] bg-white hover:bg-[#403399] hover:text-white transition-all border-[#403399]/20 shadow-sm px-2"
          >
            {loading ? (
              <Loader2 className="w-2.5 h-2.5 animate-spin mr-1" />
            ) : (
              <Sparkles className="w-2.5 h-2.5 mr-1 text-[#82A2ED]" />
            )}
            Smart Idea
          </Button>
        )}
      </div>
    </Card>
  );
}
