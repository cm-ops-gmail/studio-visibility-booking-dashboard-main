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
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-4 group">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/40 group-hover:scale-110 transition-transform duration-300">
            <Zap className="w-6 h-6 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-white">
              STUDIO <span className="text-primary">GRID</span>
            </h1>
            <p className="text-[10px] text-white font-bold uppercase tracking-[0.2em]">Dhaka Standard Time</p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-zinc-900/50 p-1.5 rounded-xl border border-zinc-800">
          <Button variant="ghost" size="icon" onClick={prevDay} className="h-9 w-9 text-white hover:bg-zinc-800 rounded-lg">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="px-6 h-9 font-black text-sm text-white hover:bg-zinc-800 rounded-lg transition-all"
              >
                {isMounted ? format(date, 'EEEE, MMMM d, yyyy').toUpperCase() : 'LOADING...'}
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

          <Button variant="ghost" size="icon" onClick={nextDay} className="h-9 w-9 text-white hover:bg-zinc-800 rounded-lg">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
            <Button 
                variant="outline" 
                size="sm" 
                onClick={() => loadData(date)}
                disabled={loading}
                className="rounded-xl gap-2 border-zinc-800 text-white bg-zinc-900 hover:bg-zinc-800 transition-all shadow-lg"
            >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            SYNC DATA
            </Button>
        </div>
      </header>

      {/* Modern Filter Bar */}
      <div className="px-6 py-5 bg-zinc-950/50 border-b border-zinc-900 flex flex-wrap items-center gap-8">
        <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                <Layers className="w-3 h-3 text-primary" />
                STUDIO LOCATION
            </label>
            <Select value={filterStudio} onValueChange={setFilterStudio}>
                <SelectTrigger className="w-[240px] h-11 rounded-xl bg-zinc-900 border-zinc-800 focus:ring-primary focus:border-primary text-sm font-bold text-white">
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

        <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                <Filter className="w-3 h-3 text-primary" />
                AVAILABILITY TYPE
            </label>
            <Select value={filterAvailability} onValueChange={setFilterAvailability}>
                <SelectTrigger className="w-[200px] h-11 rounded-xl bg-zinc-900 border-zinc-800 focus:ring-primary focus:border-primary text-sm font-bold text-white">
                    <SelectValue placeholder="All Slots" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                    <SelectItem value="all">ALL TIME SLOTS</SelectItem>
                    <SelectItem value="available">AVAILABLE ONLY</SelectItem>
                    <SelectItem value="booked">BOOKED CLASSES</SelectItem>
                </SelectContent>
            </Select>
        </div>

        {isFiltered && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearFilters}
            className="mt-6 text-[10px] font-black text-red-500 hover:text-red-400 hover:bg-red-500/10 gap-2 rounded-xl px-4 py-5"
          >
            <XCircle className="w-4 h-4" />
            CLEAR FILTERS
          </Button>
        )}

        <div className="ml-auto mt-6 hidden lg:flex items-center gap-6">
            <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-md border-2 border-dashed border-zinc-700 bg-zinc-900/50" />
                <span className="text-[10px] font-bold text-white tracking-wider">AVAILABLE</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-md bg-primary shadow-[0_0_10px_rgba(139,92,246,0.3)]" />
                <span className="text-[10px] font-bold text-white tracking-wider">BOOKED</span>
            </div>
        </div>
      </div>

      <main className="flex-1 p-6 overflow-hidden flex flex-col">
        {!isMounted || loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-pulse">
            <div className="relative">
                <Loader2 className="h-16 w-16 text-primary animate-spin" />
                <Zap className="h-6 w-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="text-white font-black text-sm tracking-[0.3em] uppercase">Initializing Grid...</p>
          </div>
        ) : schedule && filteredIntervals.length > 0 ? (
          <div className="bg-zinc-900/30 rounded-[2.5rem] border border-zinc-900 shadow-2xl overflow-hidden flex-1 flex flex-col backdrop-blur-sm animate-in-fade">
            <div className="overflow-auto flex-1">
              <Table className="border-separate border-spacing-0 w-full min-w-max h-full">
                <TableHeader className="sticky top-0 z-30">
                  <TableRow className="bg-zinc-950/95 hover:bg-zinc-950 border-none">
                    <TableHead className="w-[120px] min-w-[120px] sticky left-0 z-40 bg-zinc-950 font-black text-primary uppercase tracking-[0.2em] text-center border-r border-b border-zinc-800/50 p-6 text-[10px]">
                      <div className="flex flex-col items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        TIME
                      </div>
                    </TableHead>
                    {filteredStudios.map((studio) => (
                      <TableHead key={studio} className="min-w-[280px] font-black text-white uppercase tracking-widest text-center border-r border-b border-zinc-800/50 py-8 last:border-r-0 whitespace-nowrap px-6 text-xs">
                        {studio}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIntervals.map((interval) => (
                    <TableRow key={interval.start} className="hover:bg-zinc-900/10 border-none group transition-colors duration-300">
                      <TableCell className="font-black text-white sticky left-0 z-20 bg-zinc-950/90 backdrop-blur-md border-r border-b border-zinc-900/50 text-center align-middle py-6 text-[11px] leading-tight px-2 h-24 group-hover:text-primary transition-colors">
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
                                 "p-1.5 align-top h-full transition-all duration-500",
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
                              "p-1.5 align-top h-24 transition-all duration-500",
                              isVisible ? "border-r border-b border-zinc-900/50 last:border-r-0" : "opacity-0 pointer-events-none"
                            )}
                          >
                             <div className="h-full w-full">
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
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center gap-8 bg-zinc-900/20 border border-zinc-900 rounded-[3rem] shadow-2xl max-w-4xl mx-auto w-full animate-in-fade">
            <div className="w-24 h-24 bg-zinc-900 border border-zinc-800 rounded-3xl flex items-center justify-center shadow-2xl">
              <CalendarIcon className="w-12 h-12 text-zinc-700" />
            </div>
            <div className="space-y-4">
                <h3 className="text-3xl font-black text-white tracking-tighter">NO DATA FOUND</h3>
                <p className="text-white max-w-md mx-auto font-medium text-sm leading-relaxed">
                    No matching schedule data found for your current filters on {format(date, 'MMMM d, yyyy')}. Try adjusting your studio or availability criteria.
                </p>
            </div>
            <Button onClick={clearFilters} variant="secondary" className="rounded-2xl px-10 h-14 font-black uppercase tracking-[0.2em] bg-white text-black hover:bg-zinc-200 transition-all shadow-xl shadow-white/5">
                RESET FILTERS
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}