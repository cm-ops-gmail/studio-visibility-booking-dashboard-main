'use client';

import { useState, useEffect, useMemo } from 'react';
import { ClassBooking } from '@/app/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Clock, Layers, ExternalLink, History, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isBefore, parse, isValid } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitBookingRequest } from '@/app/actions/booking';
import { useToast } from '@/hooks/use-toast';

interface SlotCardProps {
  slot: ClassBooking;
  existingBookings: ClassBooking[];
}

export function SlotCard({ slot }: SlotCardProps) {
  const [now, setNow] = useState<Date | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState('1 hr');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const isExpired = useMemo(() => {
    if (!now) return false;
    try {
      const referenceDate = parse(slot.date, 'yyyy-MM-dd', new Date());
      const slotDateTime = parse(slot.scheduledTime, 'h:mm a', referenceDate);
      if (!isValid(slotDateTime)) return isBefore(new Date(slot.startTime), now);
      return isBefore(slotDateTime, now);
    } catch (e) {
      return isBefore(new Date(slot.startTime), now);
    }
  }, [now, slot.date, slot.scheduledTime, slot.startTime]);

  const handleRequestBooking = async () => {
    setIsSubmitting(true);
    try {
      // 1. Submit internal request for the dashboard state
      await submitBookingRequest({
        studio: slot.studio,
        date: slot.date,
        startTime: slot.startTime,
        duration: selectedDuration,
      });

      // 2. Redirect to the provided Google Form link
      const formLink = "https://forms.gle/bf4WzXLC9KCoD2WG8"; 
      window.open(formLink, '_blank');

      toast({
        title: "Redirecting to Form",
        description: "Local request recorded. Please complete the details in the Google Form.",
      });

      setIsDialogOpen(false);
      // Refresh to show the "PENDING" state immediately in the grid
      window.location.reload();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: "Could not process request. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const timeRangeLabel = slot.startTimeLabel && slot.endTimeLabel 
    ? `${slot.startTimeLabel} - ${slot.endTimeLabel}`
    : slot.startTimeLabel || '';

  if (slot.isBooked) {
    const isPending = slot.requestStatus === 'pending';
    
    return (
      <Card className={cn(
        "h-full min-h-full border-none bg-zinc-900/80 hover:bg-zinc-800 shadow-2xl transition-all duration-500 group relative overflow-hidden flex flex-col rounded-2xl ring-1",
        isPending ? "ring-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.2)]" : "ring-white/5",
        isPending 
          ? "hover:ring-yellow-400" 
          : (isExpired ? "hover:ring-sky-400/40" : "hover:ring-red-500/40")
      )}>
        <div className={cn(
          "absolute left-0 top-0 bottom-0 w-1.5 group-hover:w-2 transition-all duration-500",
          isPending 
            ? "bg-yellow-500 shadow-[2px_0_15px_rgba(234,179,8,0.4)]" 
            : (isExpired ? "bg-sky-500 shadow-[2px_0_15px_rgba(56,189,248,0.4)]" : "bg-red-500 shadow-[2px_0_15px_rgba(239,68,68,0.4)]")
        )} />
        
        <CardContent className="p-3 flex flex-col gap-3 h-full relative z-10">
          <div className="space-y-2 flex-1">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                 <Badge variant="outline" className={cn(
                   "text-[8px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-md",
                   isPending 
                    ? "text-yellow-500 border-yellow-500/40 bg-yellow-500/10" 
                    : (isExpired ? "text-sky-400 border-sky-400/40 bg-sky-400/10" : "text-white border-red-500/40 bg-red-500/10")
                 )}>
                   {slot.productType || 'CLASS'}
                 </Badge>
                 {isPending && (
                    <Badge variant="outline" className="text-[8px] font-black uppercase tracking-[0.1em] text-yellow-500 border-yellow-500/40 bg-yellow-500/10 px-2 py-0.5 rounded-md">
                      PENDING APPROVAL
                    </Badge>
                 )}
                 {(isExpired && !isPending) && (
                    <Badge variant="outline" className="text-[8px] font-black uppercase tracking-[0.1em] text-sky-400 border-sky-400/40 bg-sky-400/10 px-2 py-0.5 rounded-md">
                      EXPIRED
                    </Badge>
                 )}
                 <span className="text-[8px] font-black uppercase tracking-widest text-white/40">
                   {slot.course}
                 </span>
              </div>
              
              <h3 className={cn(
                "font-black text-xs leading-tight transition-colors tracking-tight line-clamp-2 uppercase",
                isPending 
                  ? "text-yellow-500" 
                  : (isExpired ? "text-zinc-400 group-hover:text-sky-400" : "text-white group-hover:text-red-500")
              )}>
                {slot.subject}
              </h3>
            </div>
            
            {slot.topic && (
              <div className="flex items-start gap-2 p-2 rounded-xl bg-black/40 border border-white/5 backdrop-blur-sm">
                <Layers className={cn("w-3 h-3 shrink-0 mt-0.5", isPending ? "text-yellow-500/60" : (isExpired ? "text-sky-400/60" : "text-red-500/60"))} />
                <p className="text-[9px] text-white font-bold leading-relaxed line-clamp-2 italic opacity-80">
                  {slot.topic}
                </p>
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-between gap-2 mt-auto pt-3 border-t border-white/5">
            <div className="flex items-center gap-2 min-w-0">
                <div className={cn(
                  "w-8 h-8 rounded-xl bg-zinc-800 border border-white/5 flex items-center justify-center shrink-0 transition-all duration-300 shadow-lg",
                  isPending ? "group-hover:bg-yellow-500" : (isExpired ? "group-hover:bg-sky-500" : "group-hover:bg-red-500")
                )}>
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
                  <Clock className={cn("w-3 h-3", isPending ? "text-yellow-500" : (isExpired ? "text-sky-400" : "text-red-500"))} />
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
    <Card className={cn(
      "h-full min-h-full border border-dashed flex flex-col items-center justify-center p-4 transition-all duration-500 group relative rounded-2xl overflow-hidden",
      isExpired 
        ? "border-sky-500/60 bg-sky-500/5 hover:bg-sky-500/10" 
        : "border-emerald-500/40 bg-zinc-950/20 hover:bg-emerald-500/5 hover:border-emerald-500/60"
    )}>
      <div className={cn(
        "absolute inset-0 transition-opacity duration-700 opacity-0 group-hover:opacity-100",
        isExpired 
          ? "bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.05),transparent)]" 
          : "bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.03),transparent)]"
      )} />
      
      <div className="text-center space-y-3 relative z-10 w-full px-2">
        <div className={cn(
          "text-[9px] font-black px-3 uppercase tracking-[0.3em] flex items-center gap-2 justify-center transition-colors",
          isExpired 
            ? "text-sky-400 group-hover:text-sky-400/80" 
            : "text-white group-hover:text-emerald-500"
        )}>
            <div className={cn(
              "w-1.5 h-1.5 rounded-full animate-pulse transition-colors",
              isExpired ? "bg-sky-500" : "bg-zinc-800 group-hover:bg-emerald-500/60"
            )} />
            {isExpired ? "TIME EXPIRED" : "AVAILABLE"}
        </div>
        
        {!isExpired ? (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full rounded-xl h-9 text-[9px] font-black uppercase tracking-[0.2em] bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all border-emerald-500/30 hover:border-emerald-500 px-4 flex items-center justify-center gap-2 shadow-lg"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Request a Booking
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-950 border-zinc-800 text-white">
              <DialogHeader>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Request Studio Time</DialogTitle>
                <DialogDescription className="text-zinc-500 text-xs font-bold uppercase tracking-widest">
                  {slot.studio} • {slot.scheduledTime}
                </DialogDescription>
              </DialogHeader>
              
              <div className="py-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Select Duration</label>
                  <Select value={selectedDuration} onValueChange={setSelectedDuration}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 rounded-xl h-12 font-bold">
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                      <SelectItem value="30 mins">30 MINS</SelectItem>
                      <SelectItem value="1 hr">1 HR</SelectItem>
                      <SelectItem value="1 hr 30 mins">1 HR 30 MINS</SelectItem>
                      <SelectItem value="2 hrs">2 HRS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button 
                  onClick={handleRequestBooking} 
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4" />
                      FILL OUT THE BOOKING FORM
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : (
          <div className="flex flex-col items-center">
            <div className="bg-sky-500/10 border border-sky-500/30 p-2 rounded-xl flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-[8px] font-black text-sky-400 tracking-widest uppercase">Slot has passed</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}