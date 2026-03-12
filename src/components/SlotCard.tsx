
'use client';

import { useState } from 'react';
import { ClassBooking } from '@/app/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, BookOpen, Clock, Sparkles, Loader2 } from 'lucide-react';
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
      const result = await getSmartSuggestion(slot, existingBookings.filter(b => b.isBooked));
      setSuggestion(result.suggestedDescription);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (slot.isBooked) {
    return (
      <Card className="h-full border-l-4 border-l-primary bg-white shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4 flex flex-col gap-2 h-full justify-between">
          <div className="space-y-1">
            <div className="flex justify-between items-start">
              <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider text-primary border-primary/20 bg-primary/5">
                {slot.course || 'GENERAL'}
              </Badge>
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {slot.scheduledTime}
              </div>
            </div>
            <h3 className="font-headline font-bold text-base leading-tight text-foreground line-clamp-2">
              {slot.subject}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-1 italic">
              {slot.topic}
            </p>
          </div>
          
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
            <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-xs font-medium text-foreground truncate">
              {slot.teacher || 'TBA'}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full border-dashed border-2 bg-muted/30 flex flex-col items-center justify-center p-4 hover:bg-muted/50 transition-colors group">
      <div className="text-center space-y-3">
        <div className="flex flex-col items-center">
          <span className="text-xs text-muted-foreground font-medium mb-1">
             {slot.scheduledTime}
          </span>
          <span className="text-sm font-semibold text-muted-foreground group-hover:text-primary transition-colors">
            {suggestion || 'Available for booking'}
          </span>
        </div>
        
        {!suggestion && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSuggest} 
            disabled={loading}
            className="rounded-full h-8 text-[11px] bg-white hover:bg-primary hover:text-white transition-all border-primary/20"
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
            ) : (
              <Sparkles className="w-3 h-3 mr-1 text-accent group-hover:text-white" />
            )}
            Smart Suggest
          </Button>
        )}
      </div>
    </Card>
  );
}
