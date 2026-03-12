'use client';

import { useState, useEffect, useMemo } from 'react';
import { fetchDaySchedule } from '@/app/actions/schedule';
import { DaySchedule, ClassBooking } from '@/app/lib/types';
import { format, addDays, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2, RefreshCw, Clock, Filter, Layers, XCircle, Zap, CheckCircle2, CircleDashed, CalendarDays } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SlotCard } from '@/components/SlotCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

export function CalendarDashboard() {
  const [date, setDate] = useState<Date | null>(null);
  const [schedule, setSchedule] = useState<DaySchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  // Filter States
  const [filterStudio, setFilterStudio] = useState<string>('all');
  const [filterAvailability, setFilterAvailability] = useState<string>('all');

  useEffect(() => {
    setIsMounted(true);
    setDate(new Date());
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
    if (isMounted && date) {
      loadData(date);
    }
  }, [date, isMounted]);

  const nextDay = () => date && setDate(addDays(date, 1));
  const prevDay = () => date && setDate(subDays(date, 1));

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
    
    return schedule.intervals.filter((interval) => {
      return filteredStudios.some((studio) => {
        const slot = schedule.grid[interval.start]?.[studio];
        if (!slot) return false;
        
        const matchesAvailability = (filterAvailability === 'all') || 
                                   (filterAvailability === 'booked' && slot.isBooked) ||
                                   (filterAvailability === 'available' && !slot.isBooked);
        
        return matchesAvailability;
      });
    });
  }, [schedule, filteredStudios, filterAvailability]);

  const summaryData = useMemo(() => {
    if (!schedule) return { bookedByStudio: {}, availableByStudio: {} };
    
    const bookedByStudio: Record<string, { count: number; slots: any[] }> = {};
    const availableByStudio: Record<string, { count: number; slots: any[] }> = {};

    schedule.studios.forEach(s => {
      bookedByStudio[s] = { count: 0, slots: [] };
      availableByStudio[s] = { count: 0, slots: [] };
    });

    const processedBookedIds = new Set<string>();

    schedule.intervals.forEach(interval => {
      schedule.studios.forEach(studio => {
        const slot = schedule.grid[interval.start]?.[studio];
        if (!slot) return;

        if (slot.isBooked) {
          if (!processedBookedIds.has(slot.id)) {
            processedBookedIds.add(slot.id);
            bookedByStudio[studio].count++;
            bookedByStudio[studio].slots.push({
              id: slot.id,
              subject: slot.subject,
              time: `${slot.startTimeLabel} - ${slot.endTimeLabel}`,
              duration: slot.durationLabel
            });
          }
        } else {
          availableByStudio[studio].count++;
          availableByStudio[studio].slots.push({
            id: slot.id,
            time: slot.startTimeLabel || ''
          });
        }
      });
    });

    return { bookedByStudio, availableByStudio };
  }, [schedule]);

  const studioBookings = useMemo(() => {
    if (!schedule) return {};
    const map: Record<string, ClassBooking[]> = {};
    schedule.studios.forEach(studio => {
      map[studio] = [];
      schedule.intervals.forEach(interval => {
        const booking = schedule.grid[interval.start]?.[studio];
        if (booking && booking.isBooked && !map[studio].some(b => b.id === booking.id)) {
          map[studio].push(booking);
        }
      });
    });
    return map;
  }, [schedule]);

  const totalBookedCount = Object.values(summaryData.bookedByStudio || {}).reduce((acc: number, curr: any) => acc + curr.count, 0);
  const totalAvailableCount = Object.values(summaryData.availableByStudio || {}).reduce((acc: number, curr: any) => acc + curr.count, 0);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-white selection:bg-orange-500/30 selection:text-white font-body">
      <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-900 px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(234,88,12,0.3)]">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter text-orange-500">
              STUDIO <span className="text-orange-500">GRID</span>
            </h1>
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-[0.2em]">Dhaka Operations Hub</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800 shadow-inner">
          <Button variant="ghost" size="icon" onClick={prevDay} className="h-8 w-8 text-zinc-400 hover:bg-zinc-800 hover:text-white rounded-lg">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="px-6 h-8 font-black text-xs text-white hover:bg-zinc-800 rounded-lg transition-all tracking-widest"
              >
                {isMounted && date ? format(date, 'MMMM d, yyyy').toUpperCase() : 'LOADING...'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800 shadow-2xl" align="center">
              <Calendar
                mode="single"
                selected={date || undefined}
                onSelect={(d) => d && setDate(d)}
                initialFocus
                className="bg-zinc-900 text-white"
              />
            </PopoverContent>
          </Popover>

          <Button variant="ghost" size="icon" onClick={nextDay} className="h-8 w-8 text-zinc-400 hover:bg-zinc-800 hover:text-white rounded-lg">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3">
            <Button 
                variant="outline" 
                size="sm" 
                onClick={() => date && loadData(date)}
                disabled={loading}
                className="h-9 rounded-xl gap-2 border-zinc-800 text-zinc-400 bg-zinc-900 hover:bg-zinc-800 hover:text-white text-[10px] font-black tracking-widest px-4 shadow-lg hover:shadow-orange-500/5"
            >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            SYNC DATA
            </Button>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="px-6 py-3 bg-zinc-950/50 border-b border-zinc-900/50 flex flex-wrap items-center gap-6 animate-in fade-in slide-in-from-top-1 duration-500">
        <div className="flex items-center gap-3">
            <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <Layers className="w-3 h-3 text-orange-500" />
                STUDIO
            </label>
            <Select value={filterStudio} onValueChange={setFilterStudio}>
                <SelectTrigger className="w-[140px] h-9 rounded-xl bg-zinc-900 border-zinc-800 text-[10px] font-bold text-white hover:border-zinc-700 transition-all">
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
            <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <Filter className="w-3 h-3 text-orange-500" />
                STATUS
            </label>
            <Select value={filterAvailability} onValueChange={setFilterAvailability}>
                <SelectTrigger className="w-[140px] h-9 rounded-xl bg-zinc-900 border-zinc-800 text-[10px] font-bold text-white hover:border-zinc-700 transition-all">
                    <SelectValue placeholder="All Slots" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                    <SelectItem value="all">ALL SLOTS</SelectItem>
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
            className="h-9 text-[9px] font-black text-red-500 hover:text-white hover:bg-red-500/20 gap-2 rounded-xl px-4 transition-all"
          >
            <XCircle className="w-3.5 h-3.5" />
            CLEAR ALL
          </Button>
        )}

        <div className="ml-auto hidden sm:flex items-center gap-6">
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-md border border-emerald-500/50 bg-emerald-500/10" />
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Available</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-md bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]" />
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Booked</span>
            </div>
        </div>
      </div>

      {/* Summary Cards */}
      {!loading && schedule && (
        <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-2 duration-700">
            {/* Booked Slots Card */}
            <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden shadow-2xl ring-1 ring-red-500/20">
                <CardHeader className="pb-2 border-b border-zinc-800 bg-red-500/5">
                    <CardTitle className="text-sm font-black text-white flex items-center justify-between uppercase tracking-widest">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-red-500" />
                            Booked Slots
                        </div>
                        <span className="text-2xl text-red-500">
                          {filterStudio === 'all' ? totalBookedCount : (summaryData.bookedByStudio[filterStudio]?.count || 0)}
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-fit max-h-[400px]">
                        <div className="p-4 space-y-3">
                            {filterStudio === 'all' ? (
                                // Grouped by Studio: "Studio 1: 5 slots booked"
                                Object.entries(summaryData.bookedByStudio)
                                    .filter(([_, data]) => data.count > 0)
                                    .map(([studio, data]) => (
                                        <div key={studio} className="flex items-center justify-between border-b border-zinc-800/50 pb-2 last:border-0 last:pb-0">
                                            <span className="text-[10px] font-black text-white uppercase tracking-tight">{studio}</span>
                                            <span className="text-[10px] font-black text-red-500 uppercase">{data.count} SLOTS BOOKED</span>
                                        </div>
                                    ))
                            ) : (
                                // Specific Studio Details: timing and duration
                                summaryData.bookedByStudio[filterStudio]?.slots.length > 0 ? (
                                    summaryData.bookedByStudio[filterStudio].slots.map((b) => (
                                        <div key={b.id} className="flex flex-col border-b border-zinc-800/50 pb-2 last:border-0 last:pb-0">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black text-white uppercase tracking-tight">{b.subject}</span>
                                                <span className="text-[9px] font-black text-red-500">{b.time}</span>
                                            </div>
                                            <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">{b.duration}</span>
                                        </div>
                                    ))
                                ) : null
                            )}
                            {(filterStudio === 'all' ? totalBookedCount : (summaryData.bookedByStudio[filterStudio]?.count || 0)) === 0 && (
                                <p className="text-[9px] text-zinc-500 font-black text-center py-8 uppercase tracking-[0.2em]">No bookings matched</p>
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>

            {/* Available Slots Card */}
            <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden shadow-2xl ring-1 ring-emerald-500/20">
                <CardHeader className="pb-2 border-b border-zinc-800 bg-emerald-500/5">
                    <CardTitle className="text-sm font-black text-white flex items-center justify-between uppercase tracking-widest">
                        <div className="flex items-center gap-2">
                            <CircleDashed className="w-4 h-4 text-emerald-500" />
                            Available Slots
                        </div>
                        <span className="text-2xl text-emerald-500">
                          {filterStudio === 'all' ? totalAvailableCount : (summaryData.availableByStudio[filterStudio]?.count || 0)}
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-fit max-h-[400px]">
                        <div className="p-4 space-y-3">
                            {filterStudio === 'all' ? (
                                // Grouped by Studio: "Studio 1: 5 slots available"
                                Object.entries(summaryData.availableByStudio)
                                    .filter(([_, data]) => data.count > 0)
                                    .map(([studio, data]) => (
                                        <div key={studio} className="flex items-center justify-between border-b border-zinc-800/50 pb-2 last:border-0 last:pb-0">
                                            <span className="text-[10px] font-black text-white uppercase tracking-tight">{studio}</span>
                                            <span className="text-[10px] font-black text-emerald-500 uppercase">{data.count} SLOTS AVAILABLE</span>
                                        </div>
                                    ))
                            ) : (
                                // Specific Studio Details: All slots for that day
                                summaryData.availableByStudio[filterStudio]?.slots.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        {summaryData.availableByStudio[filterStudio].slots.map((a, i) => (
                                            <div key={`${a.id}-${i}`} className="flex items-center justify-between bg-zinc-950/50 p-2 rounded-lg border border-zinc-800">
                                                <span className="text-[9px] font-black text-emerald-500">{a.time}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : null
                            )}
                            {(filterStudio === 'all' ? totalAvailableCount : (summaryData.availableByStudio[filterStudio]?.count || 0)) === 0 && (
                                <p className="text-[9px] text-zinc-500 font-black text-center py-8 uppercase tracking-[0.2em]">No slots available</p>
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
      )}

      <main className="flex-1 p-6 overflow-hidden flex flex-col bg-[radial-gradient(circle_at_top_right,rgba(234,88,12,0.03),transparent)]">
        {!isMounted || loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <div className="relative">
                <div className="absolute inset-0 bg-orange-600/20 blur-3xl animate-pulse" />
                <Loader2 className="h-12 w-12 text-orange-500 animate-spin relative z-10" />
            </div>
            <p className="text-zinc-500 font-black text-[10px] tracking-[0.4em] uppercase animate-pulse">Initializing Interface</p>
          </div>
        ) : schedule && filteredIntervals.length > 0 ? (
          <div className="bg-zinc-900/20 rounded-[2rem] border border-zinc-900 shadow-2xl overflow-hidden flex-1 flex flex-col backdrop-blur-md">
            <div className="overflow-auto flex-1 scrollbar-hide">
              <Table className="border-separate border-spacing-0 w-full min-w-max">
                <TableHeader className="sticky top-0 z-30">
                  <TableRow className="bg-zinc-950/95 border-none">
                    <TableHead className="w-[70px] min-w-[70px] sticky left-0 z-40 bg-zinc-950 font-black text-orange-500 uppercase tracking-[0.2em] text-center border-r border-b border-zinc-900/50 p-4 text-[9px]">
                      <div className="flex flex-col items-center gap-1.5">
                        <Clock className="w-4 h-4 text-orange-500" />
                        TIME
                      </div>
                    </TableHead>
                    {filteredStudios.map((studio) => (
                      <TableHead key={studio} className="min-w-[140px] font-black text-orange-500 uppercase tracking-[0.15em] text-center border-r border-b border-zinc-900/50 py-4 whitespace-nowrap px-6 text-[10px]">
                        {studio}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIntervals.map((interval) => (
                    <TableRow key={interval.start} className="hover:bg-zinc-900/5 border-none h-20 transition-all duration-300">
                      <TableCell className="font-black text-orange-500 sticky left-0 z-20 bg-zinc-950/90 backdrop-blur-xl border-r border-b border-zinc-900/50 text-center align-middle py-4 text-[10px] px-2 h-full shadow-xl shadow-black/20">
                        {interval.label}
                      </TableCell>
                      {filteredStudios.map((studio) => {
                        const slot = schedule.grid[interval.start]?.[studio];
                        if (!slot) return <TableCell key={`${interval.start}-${studio}`} className="p-0 border-b border-zinc-900/10" />;

                        const isVisible = (slot.isBooked && (filterAvailability === 'all' || filterAvailability === 'booked')) ||
                                        (!slot.isBooked && (filterAvailability === 'all' || filterAvailability === 'available'));

                        if (!isVisible) {
                           return <TableCell key={`${interval.start}-${studio}`} className="p-0 border-r border-b border-zinc-900/5 bg-transparent" />;
                        }

                        if (slot.isBooked) {
                           if (!slot.isFirst) return null;
                           
                           return (
                             <TableCell 
                               key={`${interval.start}-${studio}`} 
                               rowSpan={slot.rowSpan || 1} 
                               className="p-1.5 align-top h-full border-r border-b border-zinc-900/30 last:border-r-0 group transition-all"
                               style={{ height: '1px' }}
                             >
                                <div className="h-full w-full min-h-full">
                                    <SlotCard slot={slot} existingBookings={studioBookings[studio] || []} />
                                </div>
                             </TableCell>
                           );
                        }

                        return (
                          <TableCell 
                            key={`${interval.start}-${studio}`} 
                            className="p-1.5 align-top h-full border-r border-b border-zinc-900/30 last:border-r-0 group transition-all"
                          >
                             <div className="h-full w-full min-h-full">
                                <SlotCard slot={slot} existingBookings={studioBookings[studio] || []} />
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
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center gap-8 bg-zinc-900/10 border border-zinc-900 rounded-[3rem] max-w-2xl mx-auto w-full backdrop-blur-sm animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-zinc-900 border border-zinc-800 rounded-[2rem] flex items-center justify-center shadow-2xl relative">
              <div className="absolute inset-0 bg-orange-600/5 blur-2xl rounded-full" />
              <CalendarDays className="w-10 h-10 text-zinc-800 relative z-10" />
            </div>
            <div className="space-y-3">
                <h3 className="text-2xl font-black text-white tracking-tight">GRID IS EMPTY</h3>
                <p className="text-zinc-500 max-w-xs mx-auto font-bold text-xs leading-relaxed uppercase tracking-widest">
                    NO SESSIONS MATCH YOUR CURRENT FILTERS FOR THIS DATE.
                </p>
            </div>
            <Button onClick={clearFilters} variant="secondary" className="h-12 rounded-2xl px-10 font-black uppercase tracking-[0.2em] text-[10px] bg-white text-black hover:bg-zinc-200 shadow-xl transition-all hover:scale-105 active:scale-95">
                RESET FILTERS
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
