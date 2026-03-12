
'use client';

import { useState } from 'react';
import { ClassBooking } from '@/app/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Clock, Sparkles, Loader2 } from 'lucide-react';
import { getSmartSuggestion } from '@/app/actions/schedule';

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

  if (slot.isBooked) {
    return (
      <Card className="h-full border-none bg-white shadow-none hover:shadow-sm transition-shadow">
        <CardContent className="p-3 flex flex-col gap-2 h-full">
          <div className="space-y-1">
            <div className="flex justify-between items-start">
              <Badge variant="outline" className="text-[9px] font-extrabold uppercase tracking-widest text-[#403399] border-[#403399]/10 bg-[#403399]/5 px-2 py-0">
                {slot.course || 'GENERAL'}
              </Badge>
            </div>
            <h3 className="font-headline font-bold text-sm leading-tight text-foreground line-clamp-2 min-h-[2.5rem]">
              {slot.subject}
            </h3>
            <p className="text-xs text-muted-foreground line-clamp-1 italic">
              {slot.topic}
            </p>
          </div>
          
          <div className="flex items-center gap-2 mt-auto pt-2 border-t border-border/30">
            <div className="w-5 h-5 rounded-full bg-[#82A2ED]/20 flex items-center justify-center">
              <User className="w-3 h-3 text-[#403399]" />
            </div>
            <span className="text-[11px] font-bold text-[#403399] truncate">
              {slot.teacher || 'TBA'}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full border-dashed border-2 bg-[#F8F9FD]/50 flex flex-col items-center justify-center p-4 hover:bg-[#F8F9FD] transition-colors group min-h-[140px]">
      <div className="text-center space-y-3">
        <p className="text-xs font-bold text-[#5C6B89] group-hover:text-[#403399] transition-colors px-2">
          {suggestion || 'AVAILABLE'}
        </p>
        
        {!suggestion && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSuggest} 
            disabled={loading}
            className="rounded-full h-7 text-[10px] bg-white hover:bg-[#403399] hover:text-white transition-all border-[#403399]/20 shadow-sm"
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
            ) : (
              <Sparkles className="w-3 h-3 mr-1 text-[#82A2ED]" />
            )}
            Smart Idea
          </Button>
        )}
      </div>
    </Card>
  );
}
