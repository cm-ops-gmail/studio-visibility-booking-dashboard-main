'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { fetchDaySchedule } from '@/app/actions/schedule';
import { DaySchedule, ClassBooking } from '@/app/lib/types';
import { format, addDays, subDays, isBefore, parse, isValid } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Clock, Filter, Layers, XCircle, Zap, CheckCircle2, CircleDashed, CalendarDays, Lock, Info, Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SlotCard } from '@/components/SlotCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';

export function CalendarDashboard() {
  const [date, setDate] = useState<Date | null>(null);
  const [schedule, setSchedule] = useState<DaySchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [formattedDateLabel, setFormattedDateLabel] = useState('LOADING...');
  const [currentTime, setCurrentTime] = useState<string>('');

  // Filter States
  const [filterStudio, setFilterStudio] = useState<string>('all');
  const [filterAvailability, setFilterAvailability] = useState<string>('all');

  const dataframeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const now = new Date();
    setDate(now);
    setFormattedDateLabel(format(now, 'MMMM d, yyyy').toUpperCase());
    setIsMounted(true);

    // Live Clock for BD Time
    const updateTime = () => {
      const bdTime = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Dhaka',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true
      }).format(new Date());
      setCurrentTime(bdTime);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
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
        
        const matchesAvailability = 
          (filterAvailability === 'all') || 
          (filterAvailability === 'available' && !slot.isBooked) ||
          (filterAvailability === 'booked' && slot.isBooked && slot.requestStatus !== 'pending' && !slot.isPrepSlot) ||
          (filterAvailability === 'pending' && slot.isBooked && slot.requestStatus === 'pending');
        
        return matchesAvailability;
      });
    });
  }, [schedule, filteredStudios, filterAvailability]);

  const summaryData = useMemo(() => {
    const empty = { bookedByStudio: {}, availableByStudio: {} };
    if (!schedule) return empty;
    
    const now = new Date();
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
                duration: slot.durationLabel || '',
                intervalStart: interval.start,
                studioName: studio,
                requestStatus: slot.requestStatus,
                isPrep: slot.isPrepSlot
              });
            }
          }
        } else {
          // Check for expiration
          let isExpired = false;
          try {
            const referenceDate = parse(slot.date, 'yyyy-MM-dd', new Date());
            const slotDateTime = parse(slot.scheduledTime, 'h:mm a', referenceDate);
            if (!isValid(slotDateTime)) isExpired = isBefore(new Date(slot.startTime), now);
            else isExpired = isBefore(slotDateTime, now);
          } catch (e) {
            isExpired = isBefore(new Date(slot.startTime), now);
          }

          if (availableByStudio[studio]) {
            availableByStudio[studio].count++;
            availableByStudio[studio].slots.push({
              id: slot.id,
              time: slot.startTimeLabel || '',
              intervalStart: interval.start,
              studioName: studio,
              isExpired
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
    <div className="min-h-screen flex flex-col bg-zinc-950 text-white selection:bg-orange-500/30 selection:text-white font-body overflow-hidden">
      {/* Brand Header */}
      <header className="shrink-0 bg-zinc-950 border-b border-zinc-900 px-6 py-6 flex items-center justify-between">
        <div className="relative h-14 w-[300px]">
          <Image 
            src="/logo.png" 
            alt="Content Operations" 
            fill 
            className="object-contain"
            priority
          />
        </div>
        <Link href="/admin">
          <Button variant="ghost" className="text-[10px] font-black text-zinc-500 hover:text-white uppercase tracking-[0.2em] gap-2">
            <Lock className="w-3 h-3" />
            Admin Access
          </Button>
        </Link>
      </header>

      {/* Hero Monitoring Section */}
      <section className="shrink-0 px-10 py-12 space-y-4 bg-zinc-950">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse shadow-[0_0_12px_rgba(249,115,22,0.8)]" />
          <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.4em]">
            Real Time MONITORING
          </span>
        </div>
        
        <div className="space-y-1">
          <h1 className="text-5xl font-extrabold tracking-tighter text-white">
            Content Operations
          </h1>
          <h2 className="text-4xl font-bold italic text-indigo-400/90 tracking-tighter">
            Studio Booking and Slot Visibility Dashboard..
          </h2>
        </div>

        <div className="flex items-center gap-4 pt-4">
          <div className="flex items-center gap-3 bg-zinc-900/60 border border-zinc-800/80 px-6 py-2 rounded-full shadow-lg">
            <CalendarDays className="w-4 h-4 text-indigo-400" />
            <span className="text-[11px] font-black text-zinc-300 uppercase tracking-widest">
              {date ? format(date, 'MMM do, yyyy') : '---'}
            </span>
          </div>
          <div className="flex items-center gap-3 bg-zinc-900/60 border border-zinc-800/80 px-6 py-2 rounded-full shadow-lg">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span className="text-[11px] font-black text-zinc-300 uppercase tracking-widest">
              BD Time: {currentTime || '--:--:-- --'}
            </span>
          </div>
        </div>
      </section>

      {/* Operations Bar (Date, Sync, Filters) */}
      <div className="shrink-0 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900/50 px-6 py-8 flex flex-col items-center gap-8 z-[100]">
        <div className="flex items-center gap-6 flex-wrap justify-center w-full">
          <div className="flex items-center gap-2 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
            <Button variant="ghost" size="icon" onClick={prevDay} className="h-10 w-10 text-zinc-400 hover:bg-zinc-800 hover:text-white rounded-lg">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="px-10 h-10 font-black text-sm text-white hover:bg-zinc-800 rounded-lg tracking-[0.2em] uppercase">
                  {formattedDateLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800 shadow-2xl" align="center">
                <Calendar mode="single" selected={date || undefined} onSelect={(d) => d && setDate(d)} initialFocus className="bg-zinc-900 text-white" />
              </PopoverContent>
            </Popover>

            <Button variant="ghost" size="icon" onClick={nextDay} className="h-10 w-10 text-zinc-400 hover:bg-zinc-800 hover:text-white rounded-lg">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <Button variant="outline" onClick={() => date && loadData(date)} disabled={loading} className="h-12 rounded-xl gap-3 border-zinc-800 text-zinc-400 bg-zinc-900 hover:bg-zinc-800 hover:text-white text-xs font-black tracking-[0.2em] px-8 shadow-lg transition-all uppercase">
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-orange-500" /> : <RefreshCw className="h-4 w-4 text-orange-500" />}
            SYNC DATA
          </Button>
        </div>

        <div className="flex items-center gap-10 flex-wrap justify-center w-full">
          <div className="flex items-center gap-4">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-orange-500" />
                  STUDIO
              </label>
              <Select value={filterStudio} onValueChange={setFilterStudio}>
                  <SelectTrigger className="w-[220px] h-11 rounded-xl bg-zinc-900 border-zinc-800 text-xs font-black text-white uppercase tracking-widest">
                      <SelectValue placeholder="All Studios" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="bg-zinc-900 border-zinc-800 text-white">
                      <SelectItem value="all">ALL LOCATIONS</SelectItem>
                      {schedule?.studios.map(studio => (
                          <SelectItem key={studio} value={studio}>{studio.toUpperCase()}</SelectItem>
                      ))}
                  </SelectContent>
              </Select>
          </div>

          <div className="flex items-center gap-4">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-2.5">
                  <Filter className="w-4 h-4 text-orange-500" />
                  STATUS
              </label>
              <Select value={filterAvailability} onValueChange={setFilterAvailability}>
                  <SelectTrigger className="w-[220px] h-11 rounded-xl bg-zinc-900 border-zinc-800 text-xs font-black text-white uppercase tracking-widest">
                      <SelectValue placeholder="All Slots" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="bg-zinc-900 border-zinc-800 text-white">
                      <SelectItem value="all">ALL SLOTS</SelectItem>
                      <SelectItem value="available">AVAILABLE ONLY</SelectItem>
                      <SelectItem value="booked">BOOKED CLASSES</SelectItem>
                      <SelectItem value="pending">PENDING APPROVAL</SelectItem>
                  </SelectContent>
              </Select>
          </div>

          {isFiltered && (
            <Button variant="ghost" onClick={clearFilters} className="h-11 text-[10px] font-black text-red-500 hover:text-white hover:bg-red-500/20 gap-2.5 rounded-xl px-6 transition-all tracking-[0.2em] uppercase">
              <XCircle className="w-4 h-4" />
              CLEAR ALL
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="shrink-0 px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-950">
          <Card className="bg-zinc-900/40 border-zinc-800 shadow-xl ring-1 ring-white/5 flex flex-col">
              <CardHeader className="py-3 border-b border-zinc-800 bg-white/5">
                  <CardTitle className="text-sm font-black text-white flex items-center justify-between uppercase tracking-widest">
                      <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-orange-500" />
                          Occupied Slots
                      </div>
                      <span className="text-xl text-white">
                        {filterStudio === 'all' ? totalBookedCount : (summaryData.bookedByStudio[filterStudio]?.count || 0)}
                      </span>
                  </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                  <div className="max-h-[300px] overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-zinc-800">
                      {filterStudio === 'all' ? (
                          Object.entries(summaryData.bookedByStudio || {})
                              .filter(([_, data]: [any, any]) => data.count > 0)
                              .map(([studio, data]: [string, any]) => (
                                  <div key={studio} className="flex items-center justify-between border-b border-zinc-800/30 pb-2 last:border-0 last:pb-0">
                                      <span className="text-[10px] font-black text-white uppercase tracking-tight">{studio}</span>
                                      <span className="text-[10px] font-black text-red-500 uppercase">{data.count} SLOTS OCCUPIED</span>
                                  </div>
                              ))
                      ) : (
                          summaryData.bookedByStudio[filterStudio]?.slots?.map((b: any) => (
                              <div 
                                key={b.id} 
                                onClick={() => scrollToSlot(b.intervalStart, b.studioName)}
                                className="flex flex-col border-b border-zinc-800/30 pb-2 last:border-0 last:pb-0 cursor-pointer hover:bg-white/5 p-1 rounded-lg transition-all"
                              >
                                  <div className="flex items-center justify-between">
                                      <span className={cn(
                                        "text-[10px] font-black uppercase tracking-tight truncate mr-2",
                                        b.requestStatus === 'pending' ? "text-yellow-500" : (b.isPrep ? "text-purple-400" : "text-white")
                                      )}>{b.subject}</span>
                                      <span className={cn(
                                        "text-[9px] font-black whitespace-nowrap",
                                        b.requestStatus === 'pending' ? "text-yellow-500" : (b.isPrep ? "text-purple-400" : "text-red-500")
                                      )}>{b.time}</span>
                                  </div>
                                  <span className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.2em]">{b.duration}</span>
                              </div>
                          ))
                      )}
                      {(filterStudio === 'all' ? totalBookedCount : (summaryData.bookedByStudio[filterStudio]?.count || 0)) === 0 && (
                          <p className="text-[9px] text-zinc-600 font-black text-center py-6 uppercase tracking-widest">No matching records</p>
                      )}
                  </div>
              </CardContent>
          </Card>

          <Card className="bg-zinc-900/40 border-zinc-800 shadow-xl ring-1 ring-white/5 flex flex-col">
              <CardHeader className="py-3 border-b border-zinc-800 bg-white/5">
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
                  <div className="max-h-[300px] overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-zinc-800">
                      {filterStudio === 'all' ? (
                          Object.entries(summaryData.availableByStudio || {})
                              .filter(([_, data]: [any, any]) => data.count > 0)
                              .map(([studio, data]: [string, any]) => (
                                  <div key={studio} className="flex items-center justify-between border-b border-zinc-800/30 pb-2 last:border-0 last:pb-0">
                                      <span className="text-[10px] font-black text-white uppercase tracking-tight">{studio}</span>
                                      <span className="text-[10px] font-black text-emerald-500 uppercase">{data.count} SLOTS OPEN</span>
                                  </div>
                              ))
                      ) : (
                          <div className="grid grid-cols-2 gap-3">
                              {summaryData.availableByStudio[filterStudio]?.slots?.map((a: any, i: number) => (
                                  <div 
                                    key={`${a.id}-${i}`} 
                                    onClick={() => scrollToSlot(a.intervalStart, a.studioName)}
                                    className={cn(
                                      "flex items-center justify-center p-2 rounded-lg border cursor-pointer transition-all",
                                      a.isExpired 
                                        ? "bg-sky-500/10 border-sky-500/30 text-sky-400 hover:bg-sky-500/20" 
                                        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20"
                                    )}
                                  >
                                      <span className="text-[9px] font-black">{a.time}</span>
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
      <div className="px-6 pb-6 flex-1 flex flex-col min-h-0">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-zinc-900/20 border border-zinc-900 rounded-[2rem]">
              <Loader2 className="h-10 w-10 text-orange-500 animate-spin" />
              <p className="text-zinc-500 font-black text-[9px] tracking-[0.4em] uppercase">Refreshing Dataset</p>
            </div>
          ) : schedule && filteredIntervals.length > 0 ? (
            <div 
              ref={dataframeRef} 
              className="bg-zinc-900/30 rounded-[2rem] border border-zinc-900 shadow-2xl overflow-auto relative flex-1"
            >
              <Table className="border-separate border-spacing-0 w-full min-w-max">
                <TableHeader className="sticky top-0 z-[60] bg-zinc-900">
                  <TableRow className="bg-zinc-900 border-none">
                    <TableHead className="w-[80px] min-w-[80px] sticky top-0 left-0 z-[70] bg-zinc-900 font-black text-orange-500 uppercase tracking-[0.2em] text-center border-r border-b border-zinc-900/50 p-4 text-[9px] shadow-[2px_2px_10px_rgba(0,0,0,0.5)]">
                      <div className="flex flex-col items-center gap-1.5">
                        <Clock className="w-4 h-4 text-orange-500" />
                        TIME
                      </div>
                    </TableHead>
                    {filteredStudios.map((studio) => (
                      <TableHead key={studio} className="min-w-[200px] font-black text-orange-500 uppercase tracking-[0.15em] text-center border-r border-b border-zinc-900/50 py-5 px-6 text-[10px] bg-zinc-900 sticky top-0 z-[60] shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
                        {studio}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIntervals.map((interval) => (
                    <TableRow key={interval.start} className="border-none">
                      <TableCell className="font-black text-orange-500 sticky left-0 z-20 bg-zinc-900/95 backdrop-blur-sm border-r border-b border-zinc-900/50 text-center align-middle py-4 text-[10px] px-2 h-full shadow-[5px_0_15px_rgba(0,0,0,0.3)]" style={{ height: '1px' }}>
                        {interval.label}
                      </TableCell>
                      {filteredStudios.map((studio) => {
                        const slot = schedule.grid[interval.start]?.[studio];
                        if (!slot) return <TableCell key={`${interval.start}-${studio}`} className="p-0 border-r border-b border-zinc-900/10" style={{ height: '1px' }} />;

                        const isVisible = 
                          (filterAvailability === 'all') || 
                          (filterAvailability === 'available' && !slot.isBooked) ||
                          (filterAvailability === 'booked' && slot.isBooked && slot.requestStatus !== 'pending' && !slot.isPrepSlot) ||
                          (filterAvailability === 'pending' && slot.isBooked && slot.requestStatus === 'pending');

                        if (!isVisible) {
                           return <TableCell key={`${interval.start}-${studio}`} className="p-0 border-r border-b border-zinc-900/5 bg-transparent" style={{ height: '1px' }} />;
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
                          <TableCell id={cellId} key={`${interval.start}-${studio}`} className="p-1.5 align-top h-full border-r border-b border-zinc-900/30" style={{ height: '1px' }}>
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
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-8 bg-zinc-900/10 border border-zinc-900 rounded-[3rem] backdrop-blur-sm">
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

      {/* Footer */}
      <footer className="shrink-0 bg-zinc-950 border-t border-zinc-900 py-10 mt-auto">
        <div className="flex justify-center items-center">
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">
            © 2026 10 MS CONTENT OPERATIONS. ALL RIGHTS RESERVED.
          </p>
        </div>
      </footer>
    </div>
  );
}
