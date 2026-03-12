'use client';

import { useState, useEffect } from 'react';
import { fetchDaySchedule } from '@/app/actions/schedule';
import { DaySchedule, ClassBooking } from '@/app/lib/types';
import { format, addDays, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SlotCard } from '@/components/SlotCard';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function CalendarDashboard() {
  const [date, setDate] = useState<Date>(new Date());
  const [schedule, setSchedule] = useState<DaySchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
    if (isMounted) {
      loadData(date);
    }
  }, [date, isMounted]);

  const nextDay = () => setDate(addDays(date, 1));
  const prevDay = () => setDate(subDays(date, 1));

  const getBookingsForStudio = (studio: string): ClassBooking[] => {
    if (!schedule) return [];
    return schedule.timeSlots
      .map(time => schedule.grid[time][studio])
      .filter(slot => slot.isBooked);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FD]">
      <header className="sticky top-0 z-30 bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[#403399] rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <CalendarIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-headline font-bold tracking-tight text-[#403399]">
              Studio TimeGrid
            </h1>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Operations</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg border">
          <Button variant="ghost" size="icon" onClick={prevDay} className="h-8 w-8 hover:bg-white rounded-md">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "px-4 h-8 font-semibold text-sm hover:bg-white rounded-md transition-all",
                  !date && "text-muted-foreground"
                )}
              >
                {isMounted ? format(date, 'EEEE, MMMM d, yyyy') : 'Loading...'}
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

          <Button variant="ghost" size="icon" onClick={nextDay} className="h-8 w-8 hover:bg-white rounded-md">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button 
            variant="outline" 
            size="sm" 
            onClick={() => loadData(date)}
            disabled={loading}
            className="rounded-full gap-2 border-primary/20 text-primary"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sync
        </Button>
      </header>

      <main className="flex-1 p-6 overflow-hidden">
        {!isMounted || loading ? (
          <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-muted-foreground font-medium">Fetching class schedule...</p>
          </div>
        ) : schedule && schedule.studios.length > 0 ? (
          <div className="bg-white rounded-3xl border shadow-sm overflow-hidden h-full flex flex-col">
            <div className="overflow-auto flex-1">
              <Table className="border-separate border-spacing-0">
                <TableHeader className="sticky top-0 z-20">
                  <TableRow className="bg-[#F8F9FD] hover:bg-[#F8F9FD]">
                    <TableHead className="w-[120px] sticky left-0 z-30 bg-[#F8F9FD] font-bold text-[#403399] uppercase tracking-wider text-center border-r border-b">
                      TIME
                    </TableHead>
                    {schedule.studios.map((studio) => (
                      <TableHead key={studio} className="min-w-[280px] font-bold text-[#403399] uppercase tracking-wider text-center border-r border-b py-6 last:border-r-0">
                        {studio}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedule.timeSlots.map((time) => (
                    <TableRow key={time} className="hover:bg-transparent">
                      <TableCell className="font-bold text-[#5C6B89] sticky left-0 z-10 bg-[#F8F9FD] border-r border-b text-center align-middle py-8">
                        {time}
                      </TableCell>
                      {schedule.studios.map((studio) => (
                        <TableCell key={`${time}-${studio}`} className="p-2 border-r border-b last:border-r-0 min-h-[160px]">
                          <SlotCard 
                            slot={schedule.grid[time][studio]} 
                            existingBookings={getBookingsForStudio(studio)} 
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4 bg-white border rounded-3xl shadow-sm max-w-2xl mx-auto">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
              <CalendarIcon className="w-10 h-10 text-muted-foreground" />
            </div>
            <div className="space-y-2">
                <h3 className="text-xl font-headline font-bold text-foreground">No Classes Scheduled</h3>
                <p className="text-muted-foreground px-10">
                    There are no studio bookings for {format(date, 'MMMM d, yyyy')}.
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
