
'use client';

import { useState, useEffect } from 'react';
import { fetchDaySchedule } from '@/app/actions/schedule';
import { DaySchedule } from '@/app/lib/types';
import { format, addDays, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SlotCard } from '@/components/SlotCard';
import { cn } from '@/lib/utils';

export function CalendarDashboard() {
  const [date, setDate] = useState<Date>(new Date());
  const [schedule, setSchedule] = useState<DaySchedule | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async (targetDate: Date) => {
    setLoading(true);
    try {
      const data = await fetchDaySchedule(targetDate);
      setSchedule(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(date);
  }, [date]);

  const nextDay = () => setDate(addDays(date, 1));
  const prevDay = () => setDate(subDays(date, 1));

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-20 bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <CalendarIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-headline font-bold tracking-tight text-foreground">
              Studio TimeGrid
            </h1>
            <p className="text-xs text-muted-foreground font-medium">Class Operations Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-muted p-1 rounded-lg border">
          <Button variant="ghost" size="icon" onClick={prevDay} className="h-8 w-8 hover:bg-white rounded-md shadow-sm">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "px-4 h-8 font-medium text-sm hover:bg-white rounded-md shadow-sm transition-all",
                  !date && "text-muted-foreground"
                )}
              >
                {format(date, 'EEEE, MMMM d, yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Button variant="ghost" size="icon" onClick={nextDay} className="h-8 w-8 hover:bg-white rounded-md shadow-sm">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button 
            variant="outline" 
            size="sm" 
            onClick={() => loadData(date)}
            disabled={loading}
            className="hidden sm:flex rounded-full gap-2 border-primary/20 text-primary"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </header>

      <main className="flex-1 p-6 overflow-x-auto">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 py-20">
            <div className="relative">
                <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <CalendarIcon className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="text-muted-foreground font-medium animate-pulse">Syncing schedule from Google Sheets...</p>
          </div>
        ) : schedule && schedule.studios.length > 0 ? (
          <div className="grid gap-6 min-w-max pb-10" style={{ gridTemplateColumns: `repeat(${schedule.studios.length}, minmax(320px, 1fr))` }}>
            {schedule.studios.map((studio) => (
              <div key={studio} className="flex flex-col gap-4">
                <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 sticky top-24 z-10 backdrop-blur-sm">
                  <h2 className="text-lg font-headline font-bold text-primary text-center uppercase tracking-wide">
                    {studio}
                  </h2>
                </div>
                
                <div className="flex flex-col gap-4">
                  {schedule.slots[studio].map((slot) => (
                    <div key={slot.id} className="min-h-[140px]">
                      <SlotCard 
                        slot={slot} 
                        existingBookings={schedule.slots[studio]} 
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4 bg-white border rounded-3xl shadow-sm max-w-2xl mx-auto">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
              <CalendarIcon className="w-10 h-10 text-muted-foreground" />
            </div>
            <div className="space-y-2">
                <h3 className="text-xl font-headline font-bold text-foreground">No Classes Scheduled</h3>
                <p className="text-muted-foreground px-10">
                    There are no studio bookings for {format(date, 'MMMM d, yyyy')}. You can check another date or add new data to your Google Sheet.
                </p>
            </div>
            <Button onClick={() => setDate(new Date())} variant="secondary" className="rounded-full mt-2">
                Back to Today
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
