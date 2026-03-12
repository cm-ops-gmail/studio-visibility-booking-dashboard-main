
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { fetchDaySchedule } from '@/app/actions/schedule';
import { DaySchedule, ClassBooking } from '@/app/lib/types';
import { format, addDays, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Clock, Filter, Layers, XCircle, Zap, CheckCircle2, CircleDashed, CalendarDays } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SlotCard } from '@/components/SlotCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function CalendarDashboard() {
  const [date, setDate] = useState<Date | null>(null);
  const [schedule, setSchedule] = useState<DaySchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [formattedDateLabel, setFormattedDateLabel] = useState('LOADING...');

  // Filter States
  const [filterStudio, setFilterStudio] = useState<string>('all');
  const [filterAvailability, setFilterAvailability] = useState<string>('all');

  const dataframeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const now = new Date();
    setDate(now);
    setFormattedDateLabel(format(now, 'MMMM d, yyyy').toUpperCase());
    setIsMounted(true);
  }, []);

  const loadData = async (targetDate: Date) => {
    setLoading(true);
    try {
      const dateStr = format(targetDate, 'yyyy-MM-dd');
      const data = await fetchDaySchedule(dateStr);
      setSchedule(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isMounted && date) {
      loadData(date);
      setFormattedDateLabel(format(date, 'MMMM d, yyyy').toUpperCase());
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
    const empty = { bookedByStudio: {}, availableByStudio: {} };
    if (!schedule) return empty;
    
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
            if (bookedByStudio[studio]) {
              bookedByStudio[studio].count++;
              bookedByStudio[studio].slots.push({
                id: slot.id,
                subject: slot.subject,
                time: `${slot.startTimeLabel} - ${slot.endTimeLabel}`,
                duration: slot.durationLabel,
                intervalStart: interval.start,
                studioName: studio
              });
            }
          }
        } else {
          if (availableByStudio[studio]) {
            availableByStudio[studio].count++;
            availableByStudio[studio].slots.push({
              id: slot.id,
              time: slot.startTimeLabel || '',
              intervalStart: interval.start,
              studioName: studio
            });
          }
        }
      });
    });

    return { bookedByStudio, availableByStudio };
  }, [schedule]);

  const totalBookedCount = useMemo(() => {
    if (!summaryData?.bookedByStudio) return 0;
    return Object.values(summaryData.bookedByStudio).reduce((acc, curr: any) => acc + (curr?.count || 0), 0);
  }, [summaryData]);

  const totalAvailableCount = useMemo(() => {
    if (!summaryData?.availableByStudio) return 0;
    return Object.values(summaryData.availableByStudio).reduce((acc, curr: any) => acc + (curr?.count || 0), 0);
  }, [summaryData]);

  const scrollToSlot = (intervalStart: string, studioName: string) => {
    const id = `slot-${intervalStart}-${studioName.replace(/\s+/g, '-')}`;
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  };

  if (!isMounted) {
    return (
      <div className="min-h-screen flex flex-col bg-zinc-950 items-center justify-center gap-6">
        <Loader2 className="h-12 w-12 text-orange-500 animate-spin" />
        <p className="text-zinc-500 font-black text-[10px] tracking-[0.4em] uppercase">Initializing Interface</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-white selection:bg-orange-500/30 selection:text-white font-body overflow-hidden">
      {/* Header - Fixed height */}
      <header className="shrink-0 bg-zinc-950 border-b border-zinc-900 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 z-[100]">
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

        <div className="flex items-center gap-2 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
          <Button variant="ghost" size="icon" onClick={prevDay} className="h-8 w-8 text-zinc-400 hover:bg-zinc-800 hover:text-white rounded-lg">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="px-6 h-8 font-black text-xs text-white hover:bg-zinc-800 rounded-lg tracking-widest uppercase">
                {formattedDateLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800 shadow-2xl" align="center">
              <Calendar mode="single" selected={date || undefined} onSelect={(d) => d && setDate(d)} initialFocus className="bg-zinc-900 text-white" />
            </PopoverContent>
          </Popover>

          <Button variant="ghost" size="icon" onClick={nextDay} className="h-8 w-8 text-zinc-400 hover:bg-zinc-800 hover:text-white rounded-lg">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={() => date && loadData(date)} disabled={loading} className="h-9 rounded-xl gap-2 border-zinc-800 text-zinc-400 bg-zinc-900 hover:bg-zinc-800 hover:text-white text-[10px] font-black tracking-widest px-4 shadow-lg transition-all">
          {loading ? <Loader2 className="h-3 w-3 animate-spin text-orange-500" /> : <RefreshCw className="h-3 w-3 text-orange-500" />}
          SYNC DATA
        </Button>
      </header>

      {/* Main Container - Scrollable Area */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Filter Bar */}
        <div className="shrink-0 px-6 py-4 bg-zinc-950/50 border-b border-zinc-900/50 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Layers className="w-3 h-3 text-orange-500" />
                  STUDIO
              </label>
              <Select value={filterStudio} onValueChange={setFilterStudio}>
                  <SelectTrigger className="w-[180px] h-9 rounded-xl bg-zinc-900 border-zinc-800 text-[10px] font-bold text-white uppercase">
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
                  <SelectTrigger className="w-[160px] h-9 rounded-xl bg-zinc-900 border-zinc-800 text-[10px] font-bold text-white uppercase">
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
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-[9px] font-black text-red-500 hover:text-white hover:bg-red-500/20 gap-2 rounded-xl px-4 transition-all">
              <XCircle className="w-3.5 h-3.5" />
              CLEAR ALL
            </Button>
          )}
        </div>

        {/* Summary Cards */}
        <div className="shrink-0 px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-950">
            <Card className="bg-zinc-900/40 border-zinc-800 shadow-xl ring-1 ring-red-500/10 flex flex-col">
                <CardHeader className="py-3 border-b border-zinc-800 bg-red-500/5">
                    <CardTitle className="text-sm font-black text-white flex items-center justify-between uppercase tracking-widest">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-red-500" />
                            Booked Slots
                        </div>
                        <span className="text-xl text-red-500">
                          {filterStudio === 'all' ? totalBookedCount : (summaryData.bookedByStudio[filterStudio]?.count || 0)}
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="max-h-[400px] overflow-y-auto p-4 space-y-3 scrollbar-hide">
                        {filterStudio === 'all' ? (
                            Object.entries(summaryData.bookedByStudio || {})
                                .filter(([_, data]: [any, any]) => data.count > 0)
                                .map(([studio, data]: [string, any]) => (
                                    <div key={studio} className="flex items-center justify-between border-b border-zinc-800/30 pb-2 last:border-0 last:pb-0">
                                        <span className="text-[10px] font-black text-white uppercase tracking-tight">{studio}</span>
                                        <span className="text-[10px] font-black text-red-500 uppercase">{data.count} SLOTS BOOKED</span>
                                    </div>
                                ))
                        ) : (
                            summaryData.bookedByStudio[filterStudio]?.slots?.map((b: any) => (
                                <div 
                                  key={b.id} 
                                  onClick={() => scrollToSlot(b.intervalStart, b.studioName)}
                                  className="flex flex-col border-b border-zinc-800/30 pb-2 last:border-0 last:pb-0 cursor-pointer hover:bg-red-500/5 p-1 rounded-lg transition-all"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black text-white uppercase tracking-tight truncate mr-2">{b.subject}</span>
                                        <span className="text-[9px] font-black text-red-500 whitespace-nowrap">{b.time}</span>
                                    </div>
                                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.2em]">{b.duration}</span>
                                </div>
                            ))
                        )}
                        {(filterStudio === 'all' ? totalBookedCount : (summaryData.bookedByStudio[filterStudio]?.count || 0)) === 0 && (
                            <p className="text-[9px] text-zinc-600 font-black text-center py-6 uppercase tracking-widest">No matching bookings</p>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-zinc-900/40 border-zinc-800 shadow-xl ring-1 ring-emerald-500/10 flex flex-col">
                <CardHeader className="py-3 border-b border-zinc-800 bg-emerald-500/5">
                    <CardTitle className="text-sm font-black text-white flex items-center justify-between uppercase tracking-widest">
                        <div className="flex items-center gap-2">
                            <CircleDashed className="w-4 h-4 text-emerald-500" />
                            Available Slots
                        </div>
                        <span className="text-xl text-emerald-500">
                          {filterStudio === 'all' ? totalAvailableCount : (summaryData.availableByStudio[filterStudio]?.count || 0)}
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="max-h-[400px] overflow-y-auto p-4 space-y-3 scrollbar-hide">
                        {filterStudio === 'all' ? (
                            Object.entries(summaryData.availableByStudio || {})
                                .filter(([_, data]: [any, any]) => data.count > 0)
                                .map(([studio, data]: [string, any]) => (
                                    <div key={studio} className="flex items-center justify-between border-b border-zinc-800/30 pb-2 last:border-0 last:pb-0">
                                        <span className="text-[10px] font-black text-white uppercase tracking-tight">{studio}</span>
                                        <span className="text-[10px] font-black text-emerald-500 uppercase">{data.count} SLOTS AVAILABLE</span>
                                    </div>
                                ))
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                {summaryData.availableByStudio[filterStudio]?.slots?.map((a: any, i: number) => (
                                    <div 
                                      key={`${a.id}-${i}`} 
                                      onClick={() => scrollToSlot(a.intervalStart, a.studioName)}
                                      className="flex items-center justify-center bg-zinc-950/50 p-2 rounded-lg border border-zinc-800 cursor-pointer hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all"
                                    >
                                        <span className="text-[9px] font-black text-emerald-500">{a.time}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {(filterStudio === 'all' ? totalAvailableCount : (summaryData.availableByStudio[filterStudio]?.count || 0)) === 0 && (
                            <p className="text-[9px] text-zinc-600 font-black text-center py-6 uppercase tracking-widest">No available slots</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Calendar Section (Dataframe) */}
        <div className="flex-1 bg-zinc-950 p-6 pt-0 min-h-[500px] flex flex-col">
            {loading ? (
              <div className="h-full flex-1 flex flex-col items-center justify-center gap-6 bg-zinc-900/20 border border-zinc-900 rounded-[2rem]">
                <Loader2 className="h-10 w-10 text-orange-500 animate-spin" />
                <p className="text-zinc-500 font-black text-[9px] tracking-[0.4em] uppercase">Refreshing Dataset</p>
              </div>
            ) : schedule && filteredIntervals.length > 0 ? (
              <div ref={dataframeRef} className="flex-1 bg-zinc-900/30 rounded-[2rem] border border-zinc-900 shadow-2xl overflow-auto scrollbar-hide relative">
                <Table className="border-separate border-spacing-0 w-full min-w-max">
                  <TableHeader className="sticky top-0 z-[60] bg-zinc-950">
                    <TableRow className="bg-zinc-950 border-none">
                      <TableHead className="w-[80px] min-w-[80px] sticky top-0 left-0 z-[70] bg-zinc-950 font-black text-orange-500 uppercase tracking-[0.2em] text-center border-r border-b border-zinc-900/50 p-4 text-[9px] shadow-[2px_2px_10px_rgba(0,0,0,0.5)]">
                        <div className="flex flex-col items-center gap-1.5">
                          <Clock className="w-4 h-4 text-orange-500" />
                          TIME
                        </div>
                      </TableHead>
                      {filteredStudios.map((studio) => (
                        <TableHead key={studio} className="min-w-[220px] font-black text-orange-500 uppercase tracking-[0.15em] text-center border-r border-b border-zinc-900/50 py-5 px-6 text-[10px] bg-zinc-950 sticky top-0 z-[60] shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
                          {studio}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredIntervals.map((interval) => (
                      <TableRow key={interval.start} className="border-none h-24">
                        <TableCell className="font-black text-orange-500 sticky left-0 z-20 bg-zinc-950/95 backdrop-blur-sm border-r border-b border-zinc-900/50 text-center align-middle py-4 text-[10px] px-2 h-full shadow-[5px_0_15px_rgba(0,0,0,0.3)]">
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

                          const cellId = `slot-${interval.start}-${studio.replace(/\s+/g, '-')}`;

                          if (slot.isBooked) {
                             if (!slot.isFirst) return null;
                             return (
                               <TableCell id={cellId} key={`${interval.start}-${studio}`} rowSpan={slot.rowSpan || 1} className="p-1.5 align-top h-full border-r border-b border-zinc-900/30" style={{ height: '1px' }}>
                                  <SlotCard slot={slot} existingBookings={[]} />
                               </TableCell>
                             );
                          }

                          return (
                            <TableCell id={cellId} key={`${interval.start}-${studio}`} className="p-1.5 align-top h-full border-r border-b border-zinc-900/30">
                              <SlotCard slot={slot} existingBookings={[]} />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="h-full flex-1 flex flex-col items-center justify-center text-center gap-8 bg-zinc-900/10 border border-zinc-900 rounded-[3rem] backdrop-blur-sm">
                <CalendarDays className="w-12 h-12 text-zinc-800" />
                <div className="space-y-2">
                    <h3 className="text-xl font-black text-white tracking-tight uppercase">No schedule data</h3>
                    <p className="text-zinc-600 font-bold text-[9px] uppercase tracking-widest">Adjust filters or select another date</p>
                </div>
                <Button onClick={clearFilters} variant="secondary" className="h-10 rounded-xl px-8 font-black uppercase tracking-widest text-[9px] bg-white text-black hover:bg-zinc-200">
                    RESET FILTERS
                </Button>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

