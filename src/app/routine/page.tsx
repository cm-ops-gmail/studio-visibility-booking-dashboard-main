'use client';

import { useState } from 'react';
import { generateRoutine } from '@/app/actions/routine';
import { SuggestedRoutineSlot, TeacherConflictInfo } from '@/app/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  Loader2, 
  ChevronLeft, 
  Sparkles, 
  Download,
  Search,
  Check,
  ChevronRight,
  HelpCircle,
  ClipboardList,
  LayoutGrid,
  AlertCircle,
  XCircle,
  Info
} from 'lucide-react';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Calendar as CalendarComp } from '@/components/ui/calendar';
import { format, addDays } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

export default function MakeYourRoutinePage() {
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(addDays(new Date(), 7));
  const [slotCount, setSlotCount] = useState<number | ''>(10);
  const [duration, setDuration] = useState<number | ''>(60);
  const [maxSlotsPerDay, setMaxSlotsPerDay] = useState<number | ''>(2);
  const [loading, setLoading] = useState(false);
  const [routine, setRoutine] = useState<SuggestedRoutineSlot[]>([]);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!slotCount || !duration || !maxSlotsPerDay) {
      toast({
        variant: "destructive",
        title: "Missing Parameters",
        description: "Please specify slot count, duration, and max slots per day."
      });
      return;
    }

    setLoading(true);
    try {
      const result = await generateRoutine(
        format(startDate, 'yyyy-MM-dd'),
        format(endDate, 'yyyy-MM-dd'),
        slotCount,
        duration,
        maxSlotsPerDay
      );
      
      const initialized = result.map(s => ({
        ...s,
        subject: '',
        topic: '',
        selectedTeacher: ''
      }));
      setRoutine(initialized);
      
      if (result.length === 0) {
        toast({
          variant: "destructive",
          title: "No Availability Found",
          description: "Could not find any free slots in the selected range."
        });
      } else {
        toast({
          title: "Routine Generated",
          description: `Found ${result.length} optimal slots respecting your constraints.`
        });
      }
    } catch (e) {
      console.error(e);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to scan schedules. Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSlot = (id: string, updates: Partial<SuggestedRoutineSlot>) => {
    setRoutine(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const exportToExcel = () => {
    if (routine.length === 0) return;

    const data = routine.map((s, idx) => ({
      '#': idx + 1,
      'Date': s.dateLabel,
      'Time Window': s.timeLabel,
      'Studio': s.studio,
      'Subject': s.subject || '',
      'Topic': s.topic || '',
      'Assigned Teacher': s.selectedTeacher || 'TBA'
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Suggested Routine");
    
    worksheet["!cols"] = [ { wch: 5 }, { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 30 }, { wch: 30 }, { wch: 20 } ];

    XLSX.writeFile(workbook, `Studio_Routine_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    
    toast({
      title: "Export Successful",
      description: "Routine XLSX file has been downloaded."
    });
  };

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
              ROUTINE <span className="text-orange-500">PLANNER</span>
            </h1>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.4em]">Optimized Gap Synthesis (Studio 1-11 Only)</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 bg-zinc-900/40 p-4 rounded-3xl border border-zinc-800 shadow-2xl">
            <div className="space-y-1">
              <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest px-2">PROJECT WINDOW START</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-11 w-[160px] bg-zinc-950 border-zinc-800 text-[10px] font-black uppercase tracking-widest rounded-xl">
                    <Calendar className="w-3.5 h-3.5 mr-2 text-orange-500" />
                    {format(startDate, 'MMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800 z-[1100]">
                  <CalendarComp mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} className="bg-zinc-900 text-white" />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest px-2">PROJECT WINDOW END</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-11 w-[160px] bg-zinc-950 border-zinc-800 text-[10px] font-black uppercase tracking-widest rounded-xl">
                    <Calendar className="w-3.5 h-3.5 mr-2 text-orange-500" />
                    {format(endDate, 'MMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800 z-[1100]">
                  <CalendarComp mode="single" selected={endDate} onSelect={(d) => d && setEndDate(d)} className="bg-zinc-900 text-white" />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest px-2">TOTAL SLOTS</label>
              <Input 
                type="number" 
                value={slotCount === '' ? '' : slotCount} 
                onChange={(e) => {
                  const val = e.target.value;
                  setSlotCount(val === '' ? '' : parseInt(val));
                }}
                className="w-20 h-11 bg-zinc-950 border-zinc-800 text-[10px] font-black uppercase tracking-widest rounded-xl text-center"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest px-2">MAX SLOTS / DAY</label>
              <Input 
                type="number" 
                value={maxSlotsPerDay === '' ? '' : maxSlotsPerDay} 
                onChange={(e) => {
                  const val = e.target.value;
                  setMaxSlotsPerDay(val === '' ? '' : parseInt(val));
                }}
                className="w-24 h-11 bg-zinc-950 border-zinc-800 text-[10px] font-black uppercase tracking-widest rounded-xl text-center"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest px-2">DURATION (MIN)</label>
              <Input 
                type="number" 
                value={duration === '' ? '' : duration} 
                onChange={(e) => {
                  const val = e.target.value;
                  setDuration(val === '' ? '' : parseInt(val));
                }}
                className="w-24 h-11 bg-zinc-950 border-zinc-800 text-[10px] font-black uppercase tracking-widest rounded-xl text-center"
              />
            </div>

            <Button 
              onClick={handleGenerate} 
              disabled={loading}
              className="h-11 px-8 bg-orange-600 hover:bg-orange-500 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl self-end shadow-lg shadow-orange-900/20"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              SYNTHESIZE ROUTINE
            </Button>
          </div>
        </header>

        {routine.length > 0 ? (
          <div className="space-y-6 animate-in-fade">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest gap-2">
                  <ClipboardList className="w-4 h-4" />
                  {routine.length} Gaps Identified across Studios 1-11
                </Badge>
              </div>
              <Button 
                onClick={exportToExcel}
                className="h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl px-8 shadow-lg shadow-emerald-900/20 gap-3"
              >
                <Download className="w-4 h-4" />
                EXPORT TO XLSX
              </Button>
            </div>

            <Card className="bg-zinc-900 border-zinc-800 overflow-hidden shadow-2xl">
              <Table>
                <TableHeader className="bg-zinc-950">
                  <TableRow className="border-zinc-800">
                    <TableHead className="w-[60px] text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">#</TableHead>
                    <TableHead className="w-[180px] text-[10px] font-black text-zinc-500 uppercase tracking-widest">Date / Window</TableHead>
                    <TableHead className="w-[180px] text-[10px] font-black text-zinc-500 uppercase tracking-widest">Location</TableHead>
                    <TableHead className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Subject</TableHead>
                    <TableHead className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Topic</TableHead>
                    <TableHead className="w-[220px] text-[10px] font-black text-zinc-500 uppercase tracking-widest">Instructor Pool</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {routine.map((slot, idx) => (
                    <TableRow key={slot.id} className="border-zinc-800 hover:bg-zinc-800/40 transition-colors">
                      <TableCell className="text-center">
                        <span className="text-[10px] font-black text-zinc-600">{idx + 1}</span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase text-zinc-300">{slot.dateLabel}</p>
                          <p className="text-[10px] font-black uppercase text-orange-500">{slot.timeLabel}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-zinc-600" />
                          <span className="text-[10px] font-black uppercase text-white">{slot.studio}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input 
                          placeholder="Subject..." 
                          value={slot.subject}
                          onChange={(e) => updateSlot(slot.id, { subject: e.target.value })}
                          className="h-9 bg-zinc-950 border-zinc-800 text-[10px] font-black uppercase rounded-lg"
                        />
                      </TableCell>
                      <TableCell>
                        <Input 
                          placeholder="Topic..." 
                          value={slot.topic}
                          onChange={(e) => updateSlot(slot.id, { topic: e.target.value })}
                          className="h-9 bg-zinc-950 border-zinc-800 text-[10px] font-black uppercase rounded-lg"
                        />
                      </TableCell>
                      <TableCell>
                        <TeacherSelector 
                          teacherPoolStatus={slot.teacherPoolStatus} 
                          selectedTeacher={slot.selectedTeacher || ''} 
                          onSelect={(teacher) => updateSlot(slot.id, { selectedTeacher: teacher })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        ) : loading ? (
          <div className="h-96 flex flex-col items-center justify-center gap-6">
            <div className="relative">
              <Loader2 className="w-16 h-16 animate-spin text-orange-500" />
              <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-orange-500/50" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.6em]">SYNTHESIZING OPTIMAL ROUTINE</p>
              <p className="text-[8px] font-bold text-zinc-700 uppercase tracking-widest italic">Scanned range for Studio 1-11 with {maxSlotsPerDay} daily slot limit...</p>
            </div>
          </div>
        ) : (
          <div className="h-96 flex flex-col items-center justify-center gap-8 bg-zinc-900/10 border border-dashed border-zinc-800 rounded-[3rem]">
            <div className="w-20 h-20 rounded-[2.5rem] bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <LayoutGrid className="w-8 h-8 text-zinc-700" />
            </div>
            <div className="text-center space-y-3">
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Project Routine Synthesis</h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest max-w-sm mx-auto leading-relaxed">
                Define your project constraints above. The system will scan Studios 1-11 across your selected range to find conflict-free gaps and available instructors.
              </p>
            </div>
          </div>
        )}
      </div>

      <footer className="mt-20 border-t border-zinc-900 py-12 text-center">
        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em]">© 2026 10 MS CONTENT OPERATIONS. ALL RIGHTS RESERVED.</p>
      </footer>
    </div>
  );
}

function TeacherSelector({ 
  teacherPoolStatus, 
  selectedTeacher, 
  onSelect 
}: { 
  teacherPoolStatus: Record<string, TeacherConflictInfo>, 
  selectedTeacher: string, 
  onSelect: (teacher: string) => void 
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const teacherNames = Object.keys(teacherPoolStatus);
  const filtered = teacherNames.filter(t => 
    t.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => {
    // Sort available teachers to the top
    const aBusy = teacherPoolStatus[a].isBusy;
    const bBusy = teacherPoolStatus[b].isBusy;
    if (aBusy === bBusy) return a.localeCompare(b);
    return aBusy ? 1 : -1;
  });

  const freeCount = teacherNames.filter(name => !teacherPoolStatus[name].isBusy).length;
  const busyCount = teacherNames.filter(name => teacherPoolStatus[name].isBusy).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className={cn(
            "w-full h-10 justify-between text-[10px] font-black uppercase tracking-widest rounded-xl border-zinc-800 hover:bg-zinc-800 transition-all",
            selectedTeacher ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-zinc-950 text-zinc-500"
          )}
        >
          <div className="flex items-center gap-2 truncate">
            {selectedTeacher ? <User className="w-3 h-3" /> : <Search className="w-3 h-3" />}
            {selectedTeacher || "SELECT TEACHER"}
          </div>
          <ChevronRight className="w-3 h-3 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0 bg-zinc-950 border-zinc-800 shadow-2xl z-[2000]">
        <div className="p-3 border-b border-zinc-900 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <Input 
              placeholder="SEARCH ALL INSTRUCTORS..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 bg-zinc-900 border-zinc-800 text-[10px] font-black uppercase tracking-widest rounded-lg"
            />
          </div>
        </div>
        <div className="max-h-[300px] overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-zinc-800">
          {filtered.length > 0 ? (
            filtered.map((teacher) => {
              const status = teacherPoolStatus[teacher];
              return (
                <div key={teacher} className="flex items-center gap-1 group/row">
                  <button
                    disabled={status.isBusy}
                    onClick={() => {
                      onSelect(teacher);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex-1 flex items-center justify-between px-3 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                      status.isBusy 
                        ? "text-red-500 bg-red-500/5 cursor-not-allowed opacity-60" 
                        : (selectedTeacher === teacher 
                            ? "bg-emerald-600 text-white" 
                            : "text-zinc-400 hover:bg-zinc-900 hover:text-white")
                    )}
                  >
                    <span className="truncate">{teacher}</span>
                    {selectedTeacher === teacher && <Check className="w-3.5 h-3.5" />}
                    {status.isBusy && <XCircle className="w-3.5 h-3.5" />}
                  </button>
                  
                  {status.isBusy && status.conflict && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-500/20 rounded-lg shrink-0">
                          <Info className="w-4 h-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent side="right" className="w-64 bg-zinc-950 border-zinc-800 p-4 shadow-2xl z-[2100]">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
                            <AlertCircle className="w-4 h-4 text-red-500" />
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-white">Occupancy Conflict</h4>
                          </div>
                          <div className="space-y-2">
                            <div className="space-y-0.5">
                              <p className="text-[8px] font-black text-zinc-500 uppercase">Existing Assignment</p>
                              <p className="text-[10px] font-black uppercase text-white leading-tight">{status.conflict.subject}</p>
                              {status.conflict.topic && (
                                <p className="text-[9px] font-bold text-zinc-400 italic">Topic: {status.conflict.topic}</p>
                              )}
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                              <div className="flex items-center gap-2">
                                <Clock className="w-3 h-3 text-red-500/70" />
                                <span className="text-[9px] font-bold text-zinc-300 uppercase">{status.conflict.time}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3 h-3 text-red-500/70" />
                                <span className="text-[9px] font-bold text-zinc-300 uppercase">{status.conflict.studio}</span>
                              </div>
                            </div>
                            <div className="pt-2 border-t border-zinc-800">
                               <p className="text-[8px] font-bold text-zinc-600 uppercase italic">On {status.conflict.date}</p>
                            </div>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center space-y-2">
              <HelpCircle className="w-6 h-6 text-zinc-800 mx-auto" />
              <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">No Instructors Found</p>
            </div>
          )}
        </div>
        <div className="p-3 bg-zinc-900/50 border-t border-zinc-900 flex items-center justify-between">
          <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">
            POOL: {teacherNames.length}
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[7px] font-black text-zinc-500 uppercase">FREE ({freeCount})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-[7px] font-black text-red-500 uppercase">BUSY ({busyCount})</span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
