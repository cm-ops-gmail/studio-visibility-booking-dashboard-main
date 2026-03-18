'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { fetchDaySchedule, fetchRangeData } from '@/app/actions/schedule';
import { DaySchedule, ClassBooking } from '@/app/lib/types';
import { format, addDays, subDays, isBefore, parse, isValid, eachDayOfInterval, startOfDay, addMinutes, setHours, setMinutes } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Clock, Filter, Layers, XCircle, CheckCircle2, CircleDashed, CalendarDays, Lock, Monitor, Calendar as CalendarIcon, LayoutList, CalendarRange, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [currentTime, setCurrentTime] = useState<string>('');

  // Range Filters
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [rangeBookings, setRangeBookings] = useState<ClassBooking[]>([]);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  // Filter States
  const [filterStudio, setFilterStudio] = useState<string>('all');
  const [filterAvailability, setFilterAvailability] = useState<string>('all');

  const dataframeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const now = new Date();
    setDate(now);
    setIsMounted(true);

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

  const loadRangeData = async (start: Date, end: Date) => {
    setRangeLoading(true);
    try {
      const data = await fetchRangeData(start, end);
      setRangeBookings(data);
    } catch (e) {
      console.error(e);
    } finally {
      setRangeLoading(false);
    }
  };

  useEffect(() => {
    if (isMounted && date) {
      loadData(date);
    }
  }, [date, isMounted]);

  useEffect(() => {
    if (isMounted && startDate && endDate) {
      loadRangeData(startDate, endDate);
    } else {
      setRangeBookings([]);
    }
  }, [startDate, endDate, isMounted]);

  const nextDay = () => date && setDate(addDays(date, 1));
  const prevDay = () => date && setDate(subDays(date, 1));

  const clearFilters = () => {
    setFilterStudio('all');
    setFilterAvailability('all');
    setStartDate(null);
    setEndDate(null);
  };

  const isRangeMode = !!(startDate && endDate);
  const isFiltered = filterStudio !== 'all' || filterAvailability !== 'all' || isRangeMode;

  const toggleDayExpansion = (day: string) => {
    setExpandedDays(prev => ({ ...prev, [day]: !prev[day] }));
  };

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
    const now = new Date();
    const studios = schedule?.studios || [];
    
    if (isRangeMode && startDate && endDate) {
      const bookedByStudio: Record<string, { count: number; slots: any[] }> = {};
      const availableByDay: Record<string, { dateLabel: string; slots: any[] }> = {};
      studios.forEach(s => bookedByStudio[s] = { count: 0, slots: [] });

      const filteredRangeBookings = rangeBookings.filter(b => {
        const studioMatch = filterStudio === 'all' || b.studio === filterStudio;
        const statusMatch = filterAvailability === 'all' || 
          (filterAvailability === 'booked' && b.requestStatus !== 'pending') ||
          (filterAvailability === 'pending' && b.requestStatus === 'pending');
        return studioMatch && statusMatch;
      });

      filteredRangeBookings.forEach(b => {
        if (!bookedByStudio[b.studio]) bookedByStudio[b.studio] = { count: 0, slots: [] };
        bookedByStudio[b.studio].count++;
        bookedByStudio[b.studio].slots.push({
          ...b,
          time: `${format(new Date(b.startTime), 'MMM d')} • ${b.startTimeLabel || format(new Date(b.startTime), 'h:mm a')}`,
          intervalStart: b.startTime,
          studioName: b.studio
        });
      });

      // Calculate availability for each day in range
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      let totalAvailableInRange = 0;

      days.forEach(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayLabel = format(day, 'EEEE, MMM d');
        availableByDay[dayStr] = { dateLabel: dayLabel, slots: [] };

        // Generate intervals for this day (10 AM - 10 PM)
        const dayStart = setMinutes(setHours(startOfDay(day), 10), 0);
        const dayEnd = setMinutes(setHours(startOfDay(day), 22), 0);

        let current = new Date(dayStart);
        while (current <= dayEnd) {
          const next = addMinutes(current, 30);
          const currentISO = current.toISOString();
          const midPoint = addMinutes(current, 1);

          studios.forEach(studio => {
            if (filterStudio !== 'all' && studio !== filterStudio) return;

            const isOccupied = rangeBookings.some(b => {
                if (b.studio !== studio) return false;
                const bStart = new Date(b.startTime);
                const bEnd = new Date(b.endTime);
                return midPoint >= bStart && midPoint < bEnd;
            });

            if (!isOccupied) {
              const isExpired = isBefore(current, now);
              availableByDay[dayStr].slots.push({
                id: `range-free-${dayStr}-${studio}-${currentISO}`,
                time: format(current, 'h:mm a'),
                studioName: studio,
                isExpired,
                intervalStart: currentISO
              });
              totalAvailableInRange++;
            }
          });
          current = next;
        }
      });

      return { bookedByStudio, availableByDay, totalAvailable: totalAvailableInRange };
    }

    // Default: Single Day View Summary
    const empty = { bookedByStudio: {}, availableByStudio: {}, totalAvailable: 0 };
    if (!schedule) return empty;
    
    const bookedByStudio: Record<string, { count: number; slots: any[] }> = {};
    const availableByStudio: Record<string, { count: number; slots: any[] }> = {};
    let totalAvailable = 0;

    studios.forEach(s => {
      bookedByStudio[s] = { count: 0, slots: [] };
      availableByStudio[s] = { count: 0, slots: [] };
    });

    const processedBookedIds = new Set<string>();

    schedule.intervals.forEach(interval => {
      studios.forEach(studio => {
        const slot = schedule.grid[interval.start]?.[studio];
        if (!slot) return;

        if (slot.isBooked) {
          if (!processedBookedIds.has(slot.id)) {
            processedBookedIds.add(slot.id);
            if (bookedByStudio[studio]) {
              bookedByStudio[studio].count++;
              bookedByStudio[studio].slots.push({
                ...slot,
                time: `${slot.startTimeLabel} - ${slot.endTimeLabel}`,
                intervalStart: interval.start,
                studioName: studio,
              });
            }
          }
        } else {
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
            totalAvailable++;
            availableByStudio[studio].slots.push({
              id: slot.id,
              time: slot.startTimeLabel || format(new Date(slot.startTime), 'h:mm a'),
              intervalStart: interval.start,
              studioName: studio,
              isExpired
            });
          }
        }
      });
    });

    return { bookedByStudio, availableByStudio, totalAvailable };
  }, [schedule, rangeBookings, isRangeMode, startDate, endDate, filterStudio, filterAvailability]);

  const totalBookedCount = useMemo(() => {
    if (!summaryData?.bookedByStudio) return 0;
    return Object.values(summaryData.bookedByStudio).reduce((acc, curr: any) => acc + (curr?.count || 0), 0);
  }, [summaryData]);

  const scrollToSlot = (intervalStart: string, studioName: string) => {
    if (isRangeMode) {
      const dateStr = format(new Date(intervalStart), 'yyyy-MM-dd');
      setDate(new Date(dateStr));
      setStartDate(null);
      setEndDate(null);
      return;
    }
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
          <Image src="/logo.png" alt="Content Operations" fill className="object-contain" priority />
        </div>
        <div className="flex items-center gap-4">
          <Link href="https://ops-live-class-monitoring-dashboard.vercel.app/" target="_blank">
            <Button variant="ghost" className="text-[10px] font-black text-zinc-500 hover:text-white uppercase tracking-[0.2em] gap-2">
              <Monitor className="w-3.5 h-3.5" /> Live Class Monitor
            </Button>
          </Link>
          <Link href="/bulk-booking">
            <Button variant="ghost" className="text-[10px] font-black text-zinc-500 hover:text-white uppercase tracking-[0.2em] gap-2">
              <LayoutList className="w-3.5 h-3.5" /> Bulk Slot Booking
            </Button>
          </Link>
          <Link href="/admin">
            <Button variant="ghost" className="text-[10px] font-black text-zinc-500 hover:text-white uppercase tracking-[0.2em] gap-2">
              <Lock className="w-3.5 h-3.5" /> Admin Access
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="shrink-0 px-10 py-12 space-y-4 bg-zinc-950">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse shadow-[0_0_12px_rgba(249,115,22,0.8)]" />
          <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.4em]">Real Time MONITORING</span>
        </div>
        <div className="space-y-1">
          <h1 className="text-5xl font-extrabold tracking-tighter text-white">Content Operations</h1>
          <h2 className="text-4xl font-bold italic text-indigo-400/90 tracking-tighter">Studio Booking and Slot Visibility Dashboard..</h2>
        </div>
        <div className="flex items-center gap-4 pt-4">
          <div className="flex items-center gap-3 bg-zinc-900/60 border border-zinc-800/80 px-6 py-2 rounded-full shadow-lg">
            <CalendarDays className="w-4 h-4 text-indigo-400" />
            <span className="text-[11px] font-black text-zinc-300 uppercase tracking-widest">{date ? format(date, 'MMM do, yyyy') : '---'}</span>
          </div>
          <div className="flex items-center gap-3 bg-zinc-900/60 border border-zinc-800/80 px-6 py-2 rounded-full shadow-lg">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span className="text-[11px] font-black text-zinc-300 uppercase tracking-widest">BD Time: {currentTime || '--:--:-- --'}</span>
          </div>
        </div>
      </section>

      {/* Operations Bar */}
      <div className="shrink-0 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900/50 px-6 py-8 flex flex-col items-center gap-6 z-[100]">
        <div className="flex items-center gap-6 flex-wrap justify-center w-full">
          <div className="flex items-center gap-2 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
            <Button variant="ghost" size="icon" onClick={prevDay} className="h-10 w-10 text-zinc-400 hover:bg-zinc-800 hover:text-white rounded-lg">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className={cn("w-[240px] h-12 pl-3 text-left font-normal bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:text-white", !date && "text-muted-foreground")}>
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800 shadow-2xl z-[1000]" align="start">
                <Calendar mode="single" selected={date || undefined} onSelect={(d) => d && setDate(d)} initialFocus className="bg-zinc-900 text-white p-4" />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" onClick={nextDay} className="h-10 w-10 text-zinc-400 hover:bg-zinc-800 hover:text-white rounded-lg">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          <Button variant="outline" onClick={() => date && loadData(date)} disabled={loading} className="h-12 rounded-xl gap-3 border-zinc-800 text-zinc-400 bg-zinc-900 hover:bg-zinc-800 hover:text-white text-xs font-black tracking-[0.2em] px-8 shadow-lg transition-all uppercase">
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-orange-500" /> : <RefreshCw className="h-4 w-4 text-orange-500" />} SYNC DATA
          </Button>
        </div>

        <div className="flex items-center gap-10 flex-wrap justify-center w-full">
          <div className="flex items-center gap-4">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-orange-500" /> STUDIO
              </label>
              <Select value={filterStudio} onValueChange={setFilterStudio}>
                  <SelectTrigger className="w-[220px] h-11 rounded-xl bg-zinc-900 border-zinc-800 text-xs font-black text-white uppercase tracking-widest">
                      <SelectValue placeholder="All Studios" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="bg-zinc-900 border-zinc-800 text-white z-[1000]">
                      <SelectItem value="all">ALL LOCATIONS</SelectItem>
                      {schedule?.studios.map(studio => (
                          <SelectItem key={studio} value={studio}>{studio.toUpperCase()}</SelectItem>
                      ))}
                  </SelectContent>
              </Select>
          </div>
          <div className="flex items-center gap-4">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-2.5">
                  <Filter className="w-4 h-4 text-orange-500" /> STATUS
              </label>
              <Select value={filterAvailability} onValueChange={setFilterAvailability}>
                  <SelectTrigger className="w-[220px] h-11 rounded-xl bg-zinc-900 border-zinc-800 text-xs font-black text-white uppercase tracking-widest">
                      <SelectValue placeholder="All Slots" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="bg-zinc-900 border-zinc-800 text-white z-[1000]">
                      <SelectItem value="all">ALL SLOTS</SelectItem>
                      <SelectItem value="available">AVAILABLE ONLY</SelectItem>
                      <SelectItem value="booked">BOOKED CLASSES</SelectItem>
                      <SelectItem value="pending">PENDING APPROVAL</SelectItem>
                  </SelectContent>
              </Select>
          </div>
          {isFiltered && (
            <Button variant="ghost" onClick={clearFilters} className="h-11 text-[10px] font-black text-red-500 hover:text-white hover:bg-red-500/20 gap-2.5 rounded-xl px-6 transition-all tracking-[0.2em] uppercase">
              <XCircle className="w-4 h-4" /> CLEAR ALL
            </Button>
          )}
        </div>

        {/* Range Filters */}
        <div className="flex items-center gap-8 flex-wrap justify-center w-full border-t border-zinc-900 pt-6">
          <div className="flex items-center gap-4">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-2.5">
                  <CalendarRange className="w-4 h-4 text-orange-500" /> START DATE
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={"outline"} className={cn("w-[200px] h-10 rounded-xl bg-zinc-900 border-zinc-800 text-xs font-black uppercase tracking-widest", !startDate && "text-zinc-600")}>
                    {startDate ? format(startDate, "MMM d, yyyy") : "Select Start"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800 z-[1000]" align="start">
                  <Calendar mode="single" selected={startDate || undefined} onSelect={setStartDate} className="bg-zinc-900 text-white" />
                </PopoverContent>
              </Popover>
          </div>
          <div className="flex items-center gap-4">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-2.5">
                  <CalendarRange className="w-4 h-4 text-orange-500" /> END DATE
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={"outline"} className={cn("w-[200px] h-10 rounded-xl bg-zinc-900 border-zinc-800 text-xs font-black uppercase tracking-widest", !endDate && "text-zinc-600")}>
                    {endDate ? format(endDate, "MMM d, yyyy") : "Select End"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800 z-[1000]" align="start">
                  <Calendar mode="single" selected={endDate || undefined} onSelect={setEndDate} className="bg-zinc-900 text-white" />
                </PopoverContent>
              </Popover>
          </div>
          {isRangeMode && startDate && endDate && (
            <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20 px-4 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-widest animate-pulse">
              ANALYZING RANGE: {format(startDate, 'MMM d')} - {format(endDate, 'MMM d')}
            </Badge>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="shrink-0 px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-950">
          <Card className="bg-zinc-900/40 border-zinc-800 shadow-xl ring-1 ring-white/5 flex flex-col">
              <CardHeader className="py-3 border-b border-zinc-800 bg-white/5">
                  <CardTitle className="text-sm font-black text-white flex items-center justify-between uppercase tracking-widest">
                      <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-orange-500" /> {isRangeMode ? 'Range Bookings' : 'Occupied Slots'}</div>
                      <span className="text-xl text-white">{totalBookedCount}</span>
                  </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                  <div className="max-h-[300px] overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-zinc-800">
                      {rangeLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                          <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Fetching Range Data</p>
                        </div>
                      ) : filterStudio === 'all' && !isRangeMode ? (
                          Object.entries(summaryData.bookedByStudio || {})
                              .filter(([_, data]: [any, any]) => data.count > 0)
                              .map(([studio, data]: [string, any]) => (
                                  <div key={studio} className="flex items-center justify-between border-b border-zinc-800/30 pb-2 last:border-0 last:pb-0">
                                      <span className="text-[10px] font-black text-white uppercase tracking-tight">{studio}</span>
                                      <span className="text-[10px] font-black text-red-500 uppercase">{data.count} SLOTS OCCUPIED</span>
                                  </div>
                              ))
                      ) : (
                          Object.values(summaryData.bookedByStudio || {})
                              .flatMap((data: any) => data.slots || [])
                              .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                              .map((b: any) => (
                                <div key={b.id} onClick={() => scrollToSlot(b.intervalStart, b.studioName)} className="flex flex-col border-b border-zinc-800/30 pb-2 last:border-0 last:pb-0 cursor-pointer hover:bg-white/5 p-1 rounded-lg transition-all">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col min-w-0">
                                          <span className={cn("text-[10px] font-black uppercase tracking-tight truncate", b.requestStatus === 'pending' ? "text-yellow-500" : (b.isPrep ? "text-purple-400" : "text-white"))}>{b.subject}</span>
                                          {isRangeMode && <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-tight">{b.studioName}</span>}
                                        </div>
                                        <span className={cn("text-[9px] font-black whitespace-nowrap ml-4", b.requestStatus === 'pending' ? "text-yellow-500" : (b.isPrep ? "text-purple-400" : "text-red-500"))}>{b.time}</span>
                                    </div>
                                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.2em]">{b.durationLabel || b.duration || ''}</span>
                                </div>
                              ))
                      )}
                      {totalBookedCount === 0 && !rangeLoading && <p className="text-[9px] text-zinc-600 font-black text-center py-6 uppercase tracking-widest">No matching records</p>}
                  </div>
              </CardContent>
          </Card>

          <Card className="bg-zinc-900/40 border-zinc-800 shadow-xl ring-1 ring-white/5 flex flex-col">
              <CardHeader className="py-3 border-b border-zinc-800 bg-white/5">
                  <CardTitle className="text-sm font-black text-white flex items-center justify-between uppercase tracking-widest">
                      <div className="flex items-center gap-2"><CircleDashed className="w-4 h-4 text-emerald-500" /> {isRangeMode ? 'Range Availability' : 'Available Slots'}</div>
                      <span className="text-xl text-emerald-500">{summaryData.totalAvailable}</span>
                  </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                  <div className="max-h-[300px] overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-zinc-800">
                      {rangeLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                          <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                          <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Calculating Gaps</p>
                        </div>
                      ) : isRangeMode ? (
                        <div className="space-y-4">
                          {Object.entries(summaryData.availableByDay || {}).map(([day, dayData]: [string, any]) => {
                            if (dayData.slots.length === 0) return null;
                            const isExpanded = expandedDays[day];
                            return (
                              <div key={day} className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/40">
                                <button onClick={() => toggleDayExpansion(day)} className="w-full flex items-center justify-between p-3 bg-zinc-900 hover:bg-zinc-800 transition-colors">
                                  <span className="text-[10px] font-black uppercase tracking-widest">{dayData.dateLabel}</span>
                                  <div className="flex items-center gap-3">
                                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[8px] font-black">{dayData.slots.length} SLOTS</Badge>
                                    {isExpanded ? <ChevronUp className="w-3 h-3 text-zinc-500" /> : <ChevronDown className="w-3 h-3 text-zinc-500" />}
                                  </div>
                                </button>
                                {isExpanded && (
                                  <div className="p-2 grid grid-cols-2 gap-2 border-t border-zinc-800 animate-in-fade">
                                    {dayData.slots.map((s: any) => (
                                      <div key={s.id} onClick={() => scrollToSlot(s.intervalStart, s.studioName)} className={cn("p-2 rounded-lg border text-center cursor-pointer transition-all", s.isExpired ? "bg-sky-500/10 border-sky-500/20 text-sky-400 hover:bg-sky-500/20" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20")}>
                                        <div className="text-[9px] font-black">{s.time}</div>
                                        <div className="text-[7px] opacity-50 uppercase font-bold truncate">{s.studioName}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : filterStudio === 'all' ? (
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
                                  <div key={`${a.id}-${i}`} onClick={() => scrollToSlot(a.intervalStart, a.studioName)} className={cn("flex items-center justify-center p-2 rounded-lg border cursor-pointer transition-all", a.isExpired ? "bg-sky-500/10 border-sky-500/30 text-sky-400 hover:bg-sky-500/20" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20")}>
                                      <span className="text-[9px] font-black">{a.time}</span>
                                  </div>
                              ))}
                          </div>
                      )}
                      {summaryData.totalAvailable === 0 && <p className="text-[9px] text-zinc-600 font-black text-center py-6 uppercase tracking-widest">No available slots</p>}
                  </div>
              </CardContent>
          </Card>
      </div>

      {/* Calendar Section */}
      <div className="px-6 pb-6 flex-1 flex flex-col min-h-0">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-zinc-900/20 border border-zinc-900 rounded-[3rem]">
              <Loader2 className="h-10 w-10 text-orange-500 animate-spin" />
              <p className="text-zinc-500 font-black text-[9px] tracking-[0.4em] uppercase">Refreshing Dataset</p>
            </div>
          ) : schedule && filteredIntervals.length > 0 && !isRangeMode ? (
            <div ref={dataframeRef} className="bg-zinc-900/30 rounded-[3rem] border border-zinc-900 shadow-2xl overflow-auto relative flex-1">
              <Table className="border-separate border-spacing-0 w-full min-w-max">
                <TableHeader className="sticky top-0 z-[60] bg-zinc-900">
                  <TableRow className="bg-zinc-900 border-none">
                    <TableHead className="w-[80px] min-w-[80px] sticky top-0 left-0 z-[70] bg-zinc-900 font-black text-orange-500 uppercase tracking-[0.2em] text-center border-r border-b border-zinc-900/50 p-4 text-[9px] shadow-[2px_2px_10px_rgba(0,0,0,0.5)]">
                      <div className="flex flex-col items-center gap-1.5"><Clock className="w-4 h-4 text-orange-500" /> TIME</div>
                    </TableHead>
                    {filteredStudios.map((studio) => (
                      <TableHead key={studio} className="min-w-[200px] font-black text-orange-500 uppercase tracking-[0.15em] text-center border-r border-b border-zinc-900/50 py-5 px-6 text-[10px] bg-zinc-900 sticky top-0 z-[60] shadow-[0_2px_10px_rgba(0,0,0,0.5)]">{studio}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIntervals.map((interval) => (
                    <TableRow key={interval.start} className="border-none">
                      <TableCell className="font-black text-orange-500 sticky left-0 z-20 bg-zinc-900/95 backdrop-blur-sm border-r border-b border-zinc-900/50 text-center align-middle py-4 text-[10px] px-2 shadow-[5px_0_15px_rgba(0,0,0,0.3)]" style={{ height: '1px' }}>{interval.label}</TableCell>
                      {filteredStudios.map((studio) => {
                        const slot = schedule.grid[interval.start]?.[studio];
                        if (!slot) return <TableCell key={`${interval.start}-${studio}`} className="p-0 border-r border-b border-zinc-900/10" style={{ height: '1px' }} />;
                        const cellId = `slot-${interval.start}-${studio.replace(/\s+/g, '-')}`;
                        if (slot.isBooked) {
                           if (!slot.isFirst) return null;
                           return <TableCell id={cellId} key={`${interval.start}-${studio}`} rowSpan={slot.rowSpan || 1} className="p-1.5 align-top border-r border-b border-zinc-900/30" style={{ height: '1px' }}><SlotCard slot={slot} existingBookings={[]} /></TableCell>;
                        }
                        return <TableCell id={cellId} key={`${interval.start}-${studio}`} className="p-1.5 align-top border-r border-b border-zinc-900/30" style={{ height: '1px' }}><SlotCard slot={slot} existingBookings={[]} /></TableCell>;
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : isRangeMode ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-8 bg-zinc-900/10 border border-zinc-900 rounded-[3rem] backdrop-blur-sm">
              <CalendarRange className="w-12 h-12 text-orange-500 animate-pulse" />
              <div className="space-y-4">
                  <h3 className="text-xl font-black text-white tracking-tight uppercase">Range Analysis Active</h3>
                  <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-[0.2em] max-w-md mx-auto leading-relaxed">
                    Interactive calendar grid is optimized for daily operations. For range analysis, use the summary cards above to see occupied vs available slots by day and studio.
                  </p>
                  <Button onClick={() => setDate(startDate || date)} variant="secondary" className="h-12 rounded-xl px-10 font-black uppercase tracking-widest text-[10px] bg-white text-black hover:bg-zinc-200 gap-3">
                    <LayoutList className="w-4 h-4" /> SWITCH TO DAY VIEW
                  </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-8 bg-zinc-900/10 border border-zinc-900 rounded-[3rem] backdrop-blur-sm">
              <CalendarDays className="w-12 h-12 text-zinc-800" />
              <div className="space-y-2">
                  <h3 className="text-xl font-black text-white tracking-tight uppercase">No schedule data</h3>
                  <p className="text-zinc-600 font-bold text-[9px] uppercase tracking-widest">Adjust filters or select another date</p>
              </div>
              <Button onClick={clearFilters} variant="secondary" className="h-10 rounded-xl px-8 font-black uppercase tracking-widest text-[9px] bg-white text-black hover:bg-zinc-200">RESET FILTERS</Button>
            </div>
          )}
      </div>

      <footer className="shrink-0 bg-zinc-950 border-t border-zinc-900 py-10 mt-auto">
        <div className="flex justify-center items-center">
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">© 2026 10 MS CONTENT OPERATIONS. ALL RIGHTS RESERVED.</p>
        </div>
      </footer>
    </div>
  );
}
