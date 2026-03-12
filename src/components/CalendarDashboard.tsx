'use client';

import { useState, useEffect, useMemo } from 'react';
import { fetchDaySchedule } from '@/app/actions/schedule';
import { DaySchedule, ClassBooking } from '@/app/lib/types';
import { format, addDays, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2, RefreshCw, Clock, Filter, Layers, XCircle, Zap } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SlotCard } from '@/components/SlotCard';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function CalendarDashboard() {
  const [date, setDate] = useState<Date>(() => new Date());
  const [schedule, setSchedule] = useState<DaySchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  // Filter States
  const [filterStudio, setFilterStudio] = useState<string>('all');
  const [filterAvailability, setFilterAvailability] = useState<string>('all');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const loadData = async (targetDate: Date) => {
    setLoading(true);
    try {
      const dateStr = format(targetDate, 'yyyy-MM-dd');
      const data = await fetchDaySchedule(dateStr);
      setSchedule(data);
    } catch (e) {
      console.error('Failed to load schedule:', e);
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

  const clearFilters = () => {
    setFilterStudio('all');
    setFilterAvailability('all');
  };

  const isFiltered = filterStudio !== 'all' || filterAvailability !== 'all';

  const filteredStudios = useMemo(() => {
    if (!schedule) return [];
    if (filterStudio === 'all') return schedule.studios;
    return schedule.studios.filter(s => s === filterStudio);
  }, [schedule, filterStudio]);

  const filteredIntervals = useMemo(() => {
    if (!schedule) return [];
    if (!isFiltered) return schedule.intervals;

    return schedule.intervals.filter((interval) => {
      return filteredStudios.some((studio) => {
        const slot = schedule.grid[interval.start][studio];
        if (!slot) return false;
        
        const isVisible = (slot.isBooked && (filterAvailability === 'all' || filterAvailability === 'booked')) ||
                        (!slot.isBooked && (filterAvailability === 'all' || filterAvailability === 'available'));
        
        return isVisible;
      });
    });
  }, [schedule, filteredStudios, filterAvailability, isFiltered]);

  const studioBookings = useMemo(() => {
    if (!schedule) return {};
    const map: Record<string, ClassBooking[]> = {};
    schedule.studios.forEach(studio => {
      map[studio] = [];
      schedule.intervals.forEach(interval => {
        const booking = schedule.grid[interval.start][studio];
        if (booking && booking.isBooked && !map[studio].some(b => b.id === booking.id)) {
          map[studio].push(booking);
        }
      });
    });
    return map;
  }, [schedule]);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-white selection:bg-primary/30 selection:text-white">
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 px-4 py-2 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg">
            <Zap className="w-4 h-4 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tighter text-white">
              STUDIO <span className="text-primary">GRID</span>
            </h1>
            <p className="text-[8px] text-white/60 font-bold uppercase tracking-widest">Dhaka Standard Time</p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800">
          <Button variant="ghost" size="icon" onClick={prevDay} className="h-7 w-7 text-white hover:bg-zinc-800 rounded">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="px-4 h-7 font-black text-xs text-white hover:bg-zinc-800 rounded transition-all"
              >
                {isMounted ? format(date, 'MMM d, yyyy').toUpperCase() : 'LOADING...'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800" align="center">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
                className="bg-zinc-900 text-white"
              />
            </PopoverContent>
          </Popover>

          <Button variant="ghost" size="icon" onClick={nextDay} className="h-7 w-7 text-white hover:bg-zinc-800 rounded">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
            <Button 
                variant="outline" 
                size="sm" 
                onClick={() => loadData(date)}
                disabled={loading}
                className="h-8 rounded-lg gap-1.5 border-zinc-800 text-white bg-zinc-900 hover:bg-zinc-800 text-[10px] font-black"
            >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            SYNC
            </Button>
        </div>
      </header>

      {/* Compact Filter Bar */}
      <div className="px-4 py-2 bg-zinc-950/50 border-b border-zinc-900 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
            <label className="text-[9px] font-black text-white/50 uppercase tracking-widest flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-primary" />
                STUDIO
            </label>
            <Select value={filterStudio} onValueChange={setFilterStudio}>
                <SelectTrigger className="w-[180px] h-8 rounded-lg bg-zinc-900 border-zinc-800 text-[11px] font-bold text-white">
                    <SelectValue placeholder="All Studios" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                    <SelectItem value="all">ALL LOCATIONS</SelectItem>
                    {schedule?.studios.map(studio => (
                        <SelectItem key={studio} value={studio}>{studio.toUpperCase()}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>

        <div className="flex items-center gap-3">
            <label className="text-[9px] font-black text-white/50 uppercase tracking-widest flex items-center gap-1.5">
                <Filter className="w-3 h-3 text-primary" />
                STATUS
            </label>
            <Select value={filterAvailability} onValueChange={setFilterAvailability}>
                <SelectTrigger className="w-[160px] h-8 rounded-lg bg-zinc-900 border-zinc-800 text-[11px] font-bold text-white">
                    <SelectValue placeholder="All Slots" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                    <SelectItem value="all">ALL SLOTS</SelectItem>
                    <SelectItem value="available">AVAILABLE ONLY</SelectItem>
                    <SelectItem value="booked">BOOKED ONLY</SelectItem>
                </SelectContent>
            </Select>
        </div>

        {isFiltered && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearFilters}
            className="h-8 text-[9px] font-black text-red-500 hover:text-red-400 hover:bg-red-500/10 gap-1.5 rounded-lg px-3"
          >
            <XCircle className="w-3 h-3" />
            RESET
          </Button>
        )}

        <div className="ml-auto hidden sm:flex items-center gap-4">
            <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm border border-dashed border-zinc-700 bg-zinc-900/50" />
                <span className="text-[9px] font-bold text-white/50 uppercase">FREE</span>
            </div>
            <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-primary" />
                <span className="text-[9px] font-bold text-white/50 uppercase">BOOKED</span>
            </div>
        </div>
      </div>

      <main className="flex-1 p-4 overflow-hidden flex flex-col">
        {!isMounted || loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-white/40 font-black text-[10px] tracking-widest uppercase">Grid Initializing...</p>
          </div>
        ) : schedule && filteredIntervals.length > 0 ? (
          <div className="bg-zinc-900/20 rounded-2xl border border-zinc-900 shadow-2xl overflow-hidden flex-1 flex flex-col backdrop-blur-sm">
            <div className="overflow-auto flex-1">
              <Table className="border-separate border-spacing-0 w-full min-w-max">
                <TableHeader className="sticky top-0 z-30">
                  <TableRow className="bg-zinc-950/95 border-none">
                    <TableHead className="w-[80px] min-w-[80px] sticky left-0 z-40 bg-zinc-950 font-black text-primary uppercase tracking-widest text-center border-r border-b border-zinc-800/50 p-3 text-[9px]">
                      <div className="flex flex-col items-center gap-1">
                        <Clock className="w-3 h-3" />
                        TIME
                      </div>
                    </TableHead>
                    {filteredStudios.map((studio) => (
                      <TableHead key={studio} className="min-w-[200px] font-black text-white/80 uppercase tracking-widest text-center border-r border-b border-zinc-800/50 py-3 whitespace-nowrap px-4 text-[10px]">
                        {studio}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIntervals.map((interval) => (
                    <TableRow key={interval.start} className="hover:bg-zinc-900/5 border-none h-16 transition-colors">
                      <TableCell className="font-black text-white/90 sticky left-0 z-20 bg-zinc-950/90 backdrop-blur-md border-r border-b border-zinc-900/50 text-center align-middle py-3 text-[10px] px-1 h-full">
                        {interval.label}
                      </TableCell>
                      {filteredStudios.map((studio) => {
                        const slot = schedule.grid[interval.start][studio];
                        if (!slot) return <TableCell key={`${interval.start}-${studio}`} className="p-0 border-b border-zinc-900/20" />;

                        const isVisible = (slot.isBooked && (filterAvailability === 'all' || filterAvailability === 'booked')) ||
                                        (!slot.isBooked && (filterAvailability === 'all' || filterAvailability === 'available'));

                        if (slot.isBooked) {
                           if (!slot.isFirst) return null;
                           
                           return (
                             <TableCell 
                               key={`${interval.start}-${studio}`} 
                               rowSpan={isVisible ? slot.rowSpan : 1} 
                               className={cn(
                                 "p-1 align-top h-full transition-all",
                                 isVisible ? "border-r border-b border-zinc-900/50 last:border-r-0" : "opacity-0 pointer-events-none"
                               )}
                               style={{ height: '1px' }}
                             >
                                <div className="h-full w-full min-h-full">
                                    {isVisible ? (
                                        <SlotCard slot={slot} existingBookings={studioBookings[studio] || []} />
                                    ) : null}
                                </div>
                             </TableCell>
                           );
                        }

                        return (
                          <TableCell 
                            key={`${interval.start}-${studio}`} 
                            className={cn(
                              "p-1 align-top h-full transition-all",
                              isVisible ? "border-r border-b border-zinc-900/50 last:border-r-0" : "opacity-0 pointer-events-none"
                            )}
                          >
                             <div className="h-full w-full min-h-full">
                                {isVisible ? (
                                    <SlotCard slot={slot} existingBookings={studioBookings[studio] || []} />
                                ) : null}
                             </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-10 text-center gap-6 bg-zinc-900/10 border border-zinc-900 rounded-3xl max-w-2xl mx-auto w-full">
            <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center">
              <CalendarIcon className="w-8 h-8 text-zinc-700" />
            </div>
            <div className="space-y-2">
                <h3 className="text-xl font-black text-white tracking-tight">NO SLOTS FOUND</h3>
                <p className="text-white/40 max-w-xs mx-auto font-medium text-[11px] leading-relaxed">
                    Check your filters or select a different date to see available studio sessions.
                </p>
            </div>
            <Button onClick={clearFilters} variant="secondary" className="h-10 rounded-xl px-6 font-black uppercase tracking-widest text-[10px] bg-white text-black hover:bg-zinc-200">
                RESET FILTERS
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
