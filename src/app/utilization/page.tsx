'use client';

import { useState, useEffect, useMemo } from 'react';
import { fetchUtilizationStats } from '@/app/actions/utilization';
import { UtilizationStat } from '@/app/lib/types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  Calendar, 
  ChevronLeft, 
  Loader2, 
  MapPin, 
  TrendingUp, 
  Clock, 
  PieChart,
  LayoutGrid,
  RotateCcw,
  Divide,
  ChevronRight,
  Info
} from 'lucide-react';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { Calendar as CalendarComp } from '@/components/ui/calendar';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function StudioUtilizationPage() {
  const [startDate, setStartDate] = useState<Date>(() => startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(() => endOfMonth(new Date()));
  const [scenario, setScenario] = useState<'original' | 'current'>('original');
  const [stats, setStats] = useState<UtilizationStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [studioFilter, setStudioFilter] = useState('all');

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await fetchUtilizationStats(
        format(startDate, 'yyyy-MM-dd'),
        format(endDate, 'yyyy-MM-dd'),
        scenario
      );
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [startDate, endDate, scenario]);

  const resetFilters = () => {
    setStartDate(startOfMonth(new Date()));
    setEndDate(endOfMonth(new Date()));
    setStudioFilter('all');
  };

  const isFiltered = useMemo(() => {
    const defaultStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const defaultEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');
    return studioFilter !== 'all' || 
           format(startDate, 'yyyy-MM-dd') !== defaultStart || 
           format(endDate, 'yyyy-MM-dd') !== defaultEnd;
  }, [startDate, endDate, studioFilter]);

  const filteredStats = useMemo(() => {
    if (studioFilter === 'all') return stats;
    return stats.filter(s => s.studio === studioFilter);
  }, [stats, studioFilter]);

  const daysInRange = eachDayOfInterval({ start: startDate, end: endDate }).length;
  const totalUsedHours = stats.reduce((acc, curr) => acc + curr.usedHours, 0);
  const totalAvailableCapacity = stats.reduce((acc, curr) => acc + curr.totalAvailableHours, 0);
  const totalAvg = totalAvailableCapacity > 0 ? (totalUsedHours / totalAvailableCapacity) * 100 : 0;
  
  const totalClassHours = stats.reduce((acc, curr) => {
    return acc + (curr.details.classes.length * 2.5);
  }, 0);
  
  const totalShootHours = stats.reduce((acc, curr) => {
    return acc + curr.details.shoots.reduce((sum: number, s: any) => sum + s.duration, 0);
  }, 0);

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-body p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-12">
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 border-b border-zinc-900 pb-12">
          <div className="space-y-3">
            <Link href="/">
              <Button variant="ghost" className="p-0 h-auto hover:bg-transparent text-orange-500 gap-2 font-black text-[10px] uppercase tracking-widest mb-2">
                <ChevronLeft className="w-4 h-4" />
                Back to Operations Hub
              </Button>
            </Link>
            <h1 className="text-5xl font-black uppercase tracking-tighter text-white">
              STUDIO <span className="text-orange-500">UTILIZATION</span>
            </h1>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.4em]">Resource Efficiency Tracking System</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 bg-zinc-900/40 p-2 rounded-2xl border border-zinc-800 shadow-2xl">
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-12 w-[160px] bg-zinc-950 border-zinc-800 text-[10px] font-black uppercase tracking-widest">
                    <Calendar className="w-4 h-4 mr-2 text-orange-500" />
                    {format(startDate, 'MMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800 z-[1100]">
                  <CalendarComp mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} className="bg-zinc-900 text-white" />
                </PopoverContent>
              </Popover>
              <div className="w-2 h-px bg-zinc-800" />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-12 w-[160px] bg-zinc-950 border-zinc-800 text-[10px] font-black uppercase tracking-widest">
                    <Calendar className="w-4 h-4 mr-2 text-orange-500" />
                    {format(endDate, 'MMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800 z-[1100]">
                  <CalendarComp mode="single" selected={endDate} onSelect={(d) => d && setEndDate(d)} className="bg-zinc-900 text-white" />
                </PopoverContent>
              </Popover>
            </div>
            
            <Select value={studioFilter} onValueChange={setStudioFilter}>
              <SelectTrigger className="w-[180px] h-12 bg-zinc-950 border-zinc-800 text-[10px] font-black uppercase tracking-widest">
                <SelectValue placeholder="All Studios" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                <SelectItem value="all">ALL LOCATIONS</SelectItem>
                {stats.map(s => (
                  <SelectItem key={s.studio} value={s.studio}>{s.studio.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isFiltered && (
              <Button 
                variant="ghost" 
                onClick={resetFilters}
                className="h-12 px-4 rounded-xl text-red-500 hover:text-white hover:bg-red-500/20 text-[10px] font-black uppercase tracking-widest gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                CLEAR ALL
              </Button>
            )}
          </div>
        </header>

        {/* Scenario Switcher */}
        <div className="flex flex-col gap-6">
          <Tabs defaultValue="original" className="w-full" onValueChange={(v) => setScenario(v as any)}>
            <TabsList className="bg-zinc-900 border border-zinc-800 p-1 h-14 rounded-2xl w-full max-w-md mx-auto grid grid-cols-2">
              <TabsTrigger 
                value="original" 
                className="rounded-xl data-[state=active]:bg-orange-600 data-[state=active]:text-white text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Ideal Scenario
              </TabsTrigger>
              <TabsTrigger 
                value="current" 
                className="rounded-xl data-[state=active]:bg-orange-600 data-[state=active]:text-white text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Current Scenario
              </TabsTrigger>
            </TabsList>
            
            <div className="mt-8 text-center space-y-2">
              <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20 px-6 py-2 rounded-full font-black text-[9px] uppercase tracking-[0.2em]">
                {scenario === 'original' ? 'Scenario: 10 AM - 10 PM (12H Operations)' : 'Scenario: 2 PM - 10 PM (8H) / Weekends (4H)'}
              </Badge>
            </div>

            <TabsContent value="original" className="mt-12">
              <UtilizationContent 
                stats={stats} 
                filteredStats={filteredStats} 
                loading={loading} 
                totalAvg={totalAvg}
                totalUsedHours={totalUsedHours}
                totalAvailableCapacity={totalAvailableCapacity}
                totalClassHours={totalClassHours}
                totalShootHours={totalShootHours}
                startDate={startDate}
                endDate={endDate}
                scenario={scenario}
              />
            </TabsContent>

            <TabsContent value="current" className="mt-12">
              <UtilizationContent 
                stats={stats} 
                filteredStats={filteredStats} 
                loading={loading} 
                totalAvg={totalAvg}
                totalUsedHours={totalUsedHours}
                totalAvailableCapacity={totalAvailableCapacity}
                totalClassHours={totalClassHours}
                totalShootHours={totalShootHours}
                startDate={startDate}
                endDate={endDate}
                scenario={scenario}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      <footer className="mt-20 border-t border-zinc-900 py-12 text-center">
        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em]">© 2026 10 MS CONTENT OPERATIONS HUB</p>
      </footer>
    </div>
  );
}

function UtilizationContent({ 
  stats, 
  filteredStats, 
  loading, 
  totalAvg, 
  totalUsedHours, 
  totalAvailableCapacity, 
  totalClassHours, 
  totalShootHours,
  startDate,
  endDate,
  scenario
}: { 
  stats: UtilizationStat[], 
  filteredStats: UtilizationStat[], 
  loading: boolean, 
  totalAvg: number,
  totalUsedHours: number,
  totalAvailableCapacity: number,
  totalClassHours: number,
  totalShootHours: number,
  startDate: Date,
  endDate: Date,
  scenario: 'original' | 'current'
}) {
  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Dialog>
          <DialogTrigger asChild>
            <Card className="bg-zinc-900 border-zinc-800 shadow-xl overflow-hidden cursor-pointer transition-all duration-500 group hover:border-orange-500/50 hover:shadow-orange-500/10 hover:-translate-y-1">
              <CardContent className="p-8 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 group-hover:bg-orange-500 transition-all duration-500">
                  <TrendingUp className="w-6 h-6 text-orange-500 group-hover:text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Aggregate Efficiency</p>
                  <h3 className="text-4xl font-black text-white">{totalAvg.toFixed(1)}%</h3>
                </div>
                <div className="pt-2 border-t border-zinc-800">
                  <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest group-hover:text-orange-500 transition-colors">Click for computation logic</p>
                </div>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] h-[80vh] bg-zinc-950 border-zinc-900 text-white shadow-2xl flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-8 border-b border-zinc-900">
              <DialogTitle className="text-4xl font-black uppercase tracking-tighter flex items-center gap-4 text-white">
                <TrendingUp className="w-10 h-10 text-orange-500" />
                EFFICIENCY <span className="text-orange-500">LOGIC</span>
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 p-12 flex flex-col justify-start items-center text-center space-y-12 overflow-y-auto">
              <div className="bg-zinc-900 p-12 rounded-[3rem] border border-white/5 space-y-8 w-full max-w-4xl shadow-2xl shrink-0">
                <div className="space-y-4">
                  <p className="text-xs font-black text-zinc-400 uppercase tracking-[0.5em]">MATHEMATICAL FORMULA</p>
                  <div className="flex items-center justify-center gap-8 text-4xl md:text-5xl font-black text-white">
                    <span>Utilized Hours</span>
                    <Divide className="w-10 h-10 text-orange-500" />
                    <span>Operational Capacity</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-12 pt-12 border-t border-zinc-800">
                  <div className="space-y-4">
                    <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">Numerator (Used)</p>
                    <p className="text-7xl font-black text-orange-500">{totalUsedHours.toFixed(1)}H</p>
                    <p className="text-[10px] font-bold text-zinc-100 uppercase tracking-[0.2em] leading-relaxed">Sum of all tracked sessions<br/>across selected range</p>
                  </div>
                  <div className="space-y-4">
                    <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">Denominator (Capacity)</p>
                    <p className="text-7xl font-black text-zinc-200">{totalAvailableCapacity.toFixed(0)}H</p>
                    <p className="text-[10px] font-bold text-zinc-100 uppercase tracking-[0.2em] leading-relaxed">
                      {stats.length} Studios × Calculated Duration<br/>({scenario === 'original' ? '12H Daily' : '8H Weekday / 4H Weekend'})
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Card className="bg-zinc-900 border-zinc-800 shadow-xl overflow-hidden cursor-pointer transition-all duration-500 group hover:border-indigo-500/50 hover:shadow-indigo-500/10 hover:-translate-y-1">
              <CardContent className="p-8 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 group-hover:bg-indigo-500 transition-all duration-500">
                  <Clock className="w-6 h-6 text-indigo-500 group-hover:text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Combined Operational Hours</p>
                  <h3 className="text-4xl font-black text-white">{totalUsedHours.toFixed(1)} <span className="text-lg text-zinc-500 font-bold uppercase tracking-widest">hrs</span></h3>
                </div>
                <div className="pt-2 border-t border-zinc-800">
                  <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest group-hover:text-indigo-500 transition-colors">View duration breakdown</p>
                </div>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] h-[80vh] bg-zinc-950 border-zinc-900 text-white shadow-2xl flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-8 border-b border-zinc-900">
              <DialogTitle className="text-4xl font-black uppercase tracking-tighter flex items-center gap-4 text-white">
                <Clock className="w-10 h-10 text-indigo-500" />
                DURATION <span className="text-indigo-500">AUDIT</span>
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 p-12 space-y-12 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="bg-zinc-900 p-12 rounded-[3rem] border border-indigo-500/20 flex flex-col items-center justify-center space-y-6 text-center group">
                  <div>
                    <p className="text-xs font-black text-zinc-400 uppercase tracking-[0.4em]">CENTRAL CLASS OPS</p>
                    <h3 className="text-7xl font-black text-white mt-4">{totalClassHours.toFixed(1)} HRS</h3>
                  </div>
                  <div className="bg-indigo-500 text-white text-[11px] font-black uppercase tracking-[0.3em] px-8 py-3 rounded-full">
                    FIXED 2.5H PER SESSION
                  </div>
                </div>
                <div className="bg-zinc-900 p-12 rounded-[3rem] border border-emerald-500/20 flex flex-col items-center justify-center space-y-6 text-center">
                  <div>
                    <p className="text-xs font-black text-zinc-400 uppercase tracking-[0.4em]">RECORD SHOOT CENTRAL</p>
                    <h3 className="text-7xl font-black text-white mt-4">{totalShootHours.toFixed(1)} HRS</h3>
                  </div>
                  <div className="bg-emerald-500 text-white text-[11px] font-black uppercase tracking-[0.3em] px-8 py-3 rounded-full">
                    VARIABLE SESSION LENGTH
                  </div>
                </div>
              </div>
              <div className="bg-zinc-900/50 p-12 rounded-[3rem] border border-zinc-800 text-center space-y-4">
                 <p className="text-xs font-black text-zinc-600 uppercase tracking-[0.5em]">CUMULATIVE OPERATIONAL LOAD</p>
                 <h2 className="text-9xl font-black text-white">{totalUsedHours.toFixed(1)} <span className="text-4xl text-zinc-700">HRS</span></h2>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Card className="bg-zinc-900 border-zinc-800 shadow-xl overflow-hidden cursor-pointer transition-all duration-500 group hover:border-emerald-500/50 hover:shadow-emerald-500/10 hover:-translate-y-1">
              <CardContent className="p-8 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 group-hover:bg-emerald-500 transition-all duration-500">
                  <LayoutGrid className="w-6 h-6 text-emerald-500 group-hover:text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Active Studio Grid</p>
                  <h3 className="text-4xl font-black text-white">{stats.length} <span className="text-lg text-zinc-500 font-bold uppercase tracking-widest">Units</span></h3>
                </div>
                <div className="pt-2 border-t border-zinc-800">
                  <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest group-hover:text-emerald-500 transition-colors">See all tracked locations</p>
                </div>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] h-[80vh] bg-zinc-950 border-zinc-900 text-white shadow-2xl flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-8 border-b border-zinc-900">
              <DialogTitle className="text-4xl font-black uppercase tracking-tighter flex items-center gap-4 text-white">
                <LayoutGrid className="w-10 h-10 text-emerald-500" />
                OPERATIONAL <span className="text-emerald-500">UNITS</span>
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 p-12 overflow-hidden">
              <ScrollArea className="h-full pr-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {stats.map(s => (
                    <div key={s.studio} className="bg-zinc-900 p-8 rounded-3xl border border-white/5 flex items-center justify-between group hover:border-emerald-500/30 transition-all shadow-xl">
                      <div className="space-y-2">
                        <span className="text-lg font-black uppercase tracking-tight text-zinc-200 group-hover:text-emerald-500 transition-colors">{s.studio}</span>
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">LOCATION ID: {s.studio.split('-')[1] || 'HQ'}</p>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <span className="text-2xl font-black text-white">{s.percentage.toFixed(0)}%</span>
                        <div className={cn(
                          "w-4 h-4 rounded-full shadow-[0_0_15px]",
                          s.percentage > 75 ? "bg-emerald-500 shadow-emerald-500/60" : (s.percentage > 40 ? "bg-orange-500 shadow-orange-500/60" : "bg-red-500 shadow-red-500/60")
                        )} />
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="h-96 flex flex-col items-center justify-center gap-6">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500" />
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em]">Aggregating Data Sources</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredStats.map((studioStat) => (
            <Card key={studioStat.studio} className="bg-zinc-900 border-zinc-800 shadow-2xl hover:border-zinc-700 transition-all group overflow-hidden">
              <div className="h-2 w-full bg-zinc-950 overflow-hidden">
                 <div 
                  className={cn(
                    "h-full transition-all duration-1000",
                    studioStat.percentage > 75 ? "bg-emerald-500" : (studioStat.percentage > 40 ? "bg-orange-500" : "bg-red-500")
                  )} 
                  style={{ width: `${studioStat.percentage}%` }}
                 />
              </div>
              <CardHeader className="p-8 pb-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-orange-500" />
                      <CardTitle className="text-sm font-black uppercase tracking-widest text-white">{studioStat.studio}</CardTitle>
                    </div>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Usage Intensity</p>
                  </div>
                  <div className="text-right">
                    <h4 className={cn(
                      "text-2xl font-black",
                      studioStat.percentage > 75 ? "text-emerald-500" : (studioStat.percentage > 40 ? "text-orange-500" : "text-red-500")
                    )}>{studioStat.percentage.toFixed(1)}%</h4>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8 pt-0 space-y-6">
                <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 border-b border-zinc-800 pb-4">
                  <span>Used: {studioStat.usedHours.toFixed(1)} hrs</span>
                  <span>Cap: {studioStat.totalAvailableHours.toFixed(1)} hrs</span>
                </div>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="w-full h-12 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-[10px] font-black uppercase tracking-widest gap-3">
                      <BarChart3 className="w-4 h-4 text-orange-500" />
                      SEE DETAIL BREAK DOWN
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[95vw] h-[90vh] bg-zinc-950 border-zinc-900 text-white p-0 overflow-hidden flex flex-col shadow-2xl z-[2000]">
                    <DialogHeader className="p-4 md:p-8 border-b border-zinc-900 bg-zinc-950 shrink-0">
                      <div className="flex items-center justify-between gap-6">
                        <div className="space-y-2">
                          <DialogTitle className="text-3xl font-black uppercase tracking-tighter text-white">
                            {studioStat.studio} <span className="text-orange-500">AUDIT</span>
                          </DialogTitle>
                          <div className="flex items-center gap-3">
                            <p className="text-[10px] text-zinc-100 font-black uppercase tracking-[0.2em]">
                              {format(startDate, 'MMMM d')} — {format(endDate, 'MMMM d, yyyy')}
                            </p>
                            <Badge variant="outline" className="border-orange-500/30 text-orange-500 text-[8px] font-black tracking-widest bg-orange-500/5 px-2 py-0.5">
                              {scenario === 'original' ? '12H DAILY CAPACITY' : '8H WEEKDAY / 4H WEEKEND CAPACITY'}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                           <h2 className="text-5xl font-black text-orange-500 leading-none">{studioStat.percentage.toFixed(1)}%</h2>
                           <p className="text-[10px] font-black text-zinc-100 uppercase tracking-widest mt-2">EFFICIENCY SCORE</p>
                        </div>
                      </div>
                    </DialogHeader>

                    <ScrollArea className="flex-1 bg-zinc-950">
                      <div className="p-4 md:p-8 space-y-12">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                          {/* Class Data Column */}
                          <div className="space-y-6">
                            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                              <div className="space-y-1">
                                <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-3 text-white">
                                  <TrendingUp className="w-4 h-4 text-indigo-500" />
                                  CENTRAL CLASS OPS
                                </h3>
                                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">SESSIONS DETECTED: {studioStat.details.classes.length}</p>
                              </div>
                              <Badge variant="outline" className="bg-indigo-500/5 text-indigo-500 border-indigo-500/10 text-[8px] font-black uppercase px-2 py-0.5">2.5H FIXED WINDOW</Badge>
                            </div>

                            <div className="bg-zinc-900 p-4 rounded-2xl border border-white/5 space-y-2 group hover:border-indigo-500/20 transition-all">
                              <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-white">{studioStat.details.classes.length}</span>
                                <span className="text-zinc-600 text-xl font-black">×</span>
                                <span className="text-2xl font-black text-white">2.5</span>
                                <span className="text-zinc-600 text-xl font-black">=</span>
                                <span className="text-2xl font-black text-indigo-500">{(studioStat.details.classes.length * 2.5).toFixed(1)}</span>
                              </div>
                              <p className="text-[8px] font-black text-zinc-100 uppercase tracking-[0.2em]">SESSIONS × OPERATIONAL DURATION = TOTAL UTILIZED HRS</p>
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                              {studioStat.details.classes.length === 0 ? (
                                <div className="py-12 text-center bg-zinc-900/20 rounded-2xl border border-dashed border-zinc-800">
                                  <p className="text-[10px] text-zinc-700 font-black uppercase tracking-widest">No Class Records In This Period</p>
                                </div>
                              ) : (
                                studioStat.details.classes.map((cls, i) => (
                                  <div key={i} className="bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/40 flex items-center justify-between hover:border-zinc-700 transition-all group">
                                    <div className="space-y-1 min-w-0">
                                      <p className="text-[10px] font-black uppercase text-zinc-100 group-hover:text-orange-500 transition-colors truncate">{cls.topic || cls.subject || 'Untitled Session'}</p>
                                      <div className="flex items-center gap-2 text-[8px] font-bold text-zinc-500 uppercase tracking-tight">
                                        <span>{cls.date}</span>
                                        <span className="w-1 h-1 bg-zinc-800 rounded-full" />
                                        <span>{cls.time}</span>
                                      </div>
                                    </div>
                                    <Badge variant="outline" className="text-[7px] font-black uppercase bg-zinc-950/50 border-zinc-800 text-zinc-400 px-1.5 py-0.5">2.5 HRS</Badge>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          {/* Shoot Data Column */}
                          <div className="space-y-6">
                            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                              <div className="space-y-1">
                                <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-3 text-white">
                                  <PieChart className="w-4 h-4 text-emerald-500" />
                                  RECORD SHOOT CENTRAL
                                </h3>
                                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">SESSIONS DETECTED: {studioStat.details.shoots.length}</p>
                              </div>
                              <Badge variant="outline" className="bg-emerald-500/5 text-emerald-500 border-emerald-500/10 text-[8px] font-black uppercase px-2 py-0.5">VARIABLE DURATION</Badge>
                            </div>

                            <div className="bg-zinc-900 p-4 rounded-2xl border border-white/5 space-y-2 group hover:border-emerald-500/20 transition-all">
                              <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-white">
                                  {studioStat.details.shoots.reduce((acc: number, curr: any) => acc + curr.duration, 0).toFixed(1)}
                                </span>
                                <span className="text-zinc-600 text-xl font-black">/</span>
                                <span className="text-2xl font-black text-white">{studioStat.details.shoots.length || 1}</span>
                                <span className="text-zinc-600 text-xl font-black">=</span>
                                <span className="text-2xl font-black text-emerald-500">
                                  {(studioStat.details.shoots.reduce((acc: number, curr: any) => acc + curr.duration, 0) / (studioStat.details.shoots.length || 1)).toFixed(1)}
                                </span>
                              </div>
                              <p className="text-[8px] font-black text-zinc-100 uppercase tracking-[0.2em]">TOTAL ACCUMULATED HRS / SESSIONS = AVG INTENSITY</p>
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                              {studioStat.details.shoots.length === 0 ? (
                                <div className="py-12 text-center bg-zinc-900/20 rounded-2xl border border-dashed border-zinc-800">
                                  <p className="text-[10px] text-zinc-700 font-black uppercase tracking-widest">No Shoot Records In This Period</p>
                                </div>
                              ) : (
                                studioStat.details.shoots.map((sht, i) => (
                                  <div key={i} className="bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/40 flex items-center justify-between hover:border-zinc-700 transition-all group">
                                    <div className="space-y-1 min-w-0">
                                      <p className="text-[10px] font-black uppercase text-zinc-100 group-hover:text-emerald-500 transition-colors truncate">{sht.topic || 'Untitled Shoot'}</p>
                                      <div className="flex items-center gap-2 text-[8px] font-bold text-zinc-500 uppercase tracking-tight">
                                        <span>{sht.date}</span>
                                        <span className="w-1 h-1 bg-zinc-800 rounded-full" />
                                        <span>{sht.time}</span>
                                      </div>
                                    </div>
                                    <Badge variant="outline" className="text-[7px] font-black uppercase border-emerald-500/20 text-emerald-500 bg-emerald-500/5 px-1.5 py-0.5">
                                      {sht.duration.toFixed(1)}H
                                    </Badge>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </ScrollArea>

                    <div className="p-6 bg-zinc-900 border-t border-zinc-800 shrink-0">
                      <div className="max-w-4xl mx-auto flex flex-row items-center justify-between gap-12 px-8">
                        <div className="space-y-1">
                          <p className="text-[8px] text-zinc-500 font-black uppercase tracking-[0.4em]">CUMULATIVE COMBINED DURATION</p>
                          <h4 className="text-2xl font-black text-white uppercase">
                            {studioStat.usedHours.toFixed(1)} <span className="text-zinc-600 text-xs">HOURS TOTAL</span>
                          </h4>
                        </div>
                        <div className="h-8 w-px bg-zinc-800" />
                        <div className="text-right space-y-1">
                          <p className="text-[8px] text-zinc-500 font-black uppercase tracking-[0.4em]">OPERATIONAL CAPACITY</p>
                          <h4 className="text-2xl font-black text-zinc-600 uppercase">
                            {studioStat.totalAvailableHours.toFixed(1)} <span className="text-zinc-700 text-xs">HOURS AVAILABLE</span>
                          </h4>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
