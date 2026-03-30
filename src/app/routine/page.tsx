
'use client';

import { useState } from 'react';
import { generateRoutine, generateCustomBulkRoutine } from '@/app/actions/routine';
import { SuggestedRoutineSlot, TeacherConflictInfo, BulkRoutineResult } from '@/app/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  Info,
  SlidersHorizontal,
  UploadCloud,
  FileSpreadsheet
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarComp } from '@/components/ui/calendar';
import { format, addDays } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

const DAYS_OF_WEEK = [
  { id: 0, label: 'Sun' }, { id: 1, label: 'Mon' }, { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' }, { id: 4, label: 'Thu' }, { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
];

const PRIORITY_TIMINGS = [
  { id: '10-12', label: '10 AM - 12 PM', range: { start: '10:00', end: '12:00' } },
  { id: '12-14', label: '12 PM - 2 PM', range: { start: '12:00', end: '14:00' } },
  { id: '14-16', label: '2 PM - 4 PM', range: { start: '14:00', end: '16:00' } },
  { id: '16-18', label: '4 PM - 6 PM', range: { start: '16:00', end: '18:00' } },
  { id: '18-20', label: '6 PM - 8 PM', range: { start: '18:00', end: '20:00' } },
  { id: '20-22', label: '8 PM - 10 PM', range: { start: '20:00', end: '22:00' } },
];

const ROUTINE_STUDIOS_LIST = [
  'Studio 1 - HQ1', 'Studio 2 - HQ1', 'Studio 3 - HQ1', 'Studio 4 - HQ1', 'Studio 5 - HQ5',
  'Studio 6 - HQ5', 'Studio 7 - HQ5', 'Studio 8 - HQ5', 'Studio 9 - NB2', 'Studio 10 - NB2',
  'Studio 11 - NB2',
];


export default function MakeYourRoutinePage() {
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(addDays(new Date(), 7));
  const [slotCount, setSlotCount] = useState<number | ''>(10);
  const [duration, setDuration] = useState<number | ''>(120);
  const [maxSlotsPerDay, setMaxSlotsPerDay] = useState<number | ''>(2);
  const [loading, setLoading] = useState(false);
  const [routine, setRoutine] = useState<SuggestedRoutineSlot[]>([]);
  const { toast } = useToast();

  const [priorityDays, setPriorityDays] = useState<number[]>([]);
  const [priorityTimings, setPriorityTimings] = useState<{start: string, end: string}[]>([]);
  const [priorityStudios, setPriorityStudios] = useState<string[]>([]);

  // State for bulk custom routine
  const [bulkRawData, setBulkRawData] = useState('');
  const [bulkRoutine, setBulkRoutine] = useState<BulkRoutineResult[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  const handlePriorityDayChange = (dayId: number, checked: boolean) => {
    setPriorityDays(prev => 
      checked ? [...prev, dayId] : prev.filter(d => d !== dayId)
    );
  };

  const handlePriorityTimingChange = (timingRange: {start: string, end: string}, checked: boolean) => {
    setPriorityTimings(prev => {
      if (checked) {
        return [...prev, timingRange];
      } else {
        return prev.filter(t => t.start !== timingRange.start || t.end !== timingRange.end);
      }
    });
  };

  const handlePriorityStudioChange = (studioName: string, checked: boolean) => {
    setPriorityStudios(prev =>
      checked ? [...prev, studioName] : prev.filter(s => s !== studioName)
    );
  };

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
    setRoutine([]);
    setBulkRoutine([]);
    try {
      const result = await generateRoutine(
        format(startDate, 'yyyy-MM-dd'),
        format(endDate, 'yyyy-MM-dd'),
        slotCount,
        duration,
        maxSlotsPerDay,
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
          description: `Found ${result.length} optimal slots.`
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

  const handleGenerateCustomBulk = async () => {
    if (!duration || !slotCount || !maxSlotsPerDay) {
       toast({
        variant: 'destructive',
        title: 'Missing Parameters',
        description:
          'Please specify Total Slots, Duration, and Max Slots per Day.',
      });
      return;
    }
    setBulkLoading(true);
    setBulkRoutine([]);
    setRoutine([]);
    try {
      const result = await generateCustomBulkRoutine(
        format(startDate, 'yyyy-MM-dd'),
        format(endDate, 'yyyy-MM-dd'),
        slotCount,
        duration,
        maxSlotsPerDay,
        priorityDays,
        priorityTimings,
        priorityStudios,
        bulkRawData
      );
      setBulkRoutine(result);
      if (result.length === 0) {
        toast({ variant: "destructive", title: "Processing Failed", description: "Could not find or schedule any classes."});
      } else {
        const scheduledCount = result.filter(r => r.status === 'scheduled' || r.status === 'auto_generated').length;
        toast({ title: "Bulk Routine Processed", description: `Successfully scheduled ${scheduledCount} of ${result.length} total classes.`});
      }
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error", description: "Failed to process bulk routine. Please check data format." });
    } finally {
      setBulkLoading(false);
    }
  };

  const updateSlot = (id: string, updates: Partial<SuggestedRoutineSlot>) => {
    setRoutine(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

   const handleBulkRoutineUpdate = (id: string, field: keyof BulkRoutineResult, value: string) => {
    setBulkRoutine(prev => 
      prev.map(item => item.id === id ? { ...item, [field]: value } : item)
    );
  };

  const exportToExcel = (data: SuggestedRoutineSlot[], fileName: string) => {
    if (data.length === 0) return;
    const worksheetData = data.map((s, idx) => ({
      '#': idx + 1,
      'Date': s.dateLabel,
      'Time Window': s.timeLabel,
      'Studio': s.studio,
      'Subject': s.subject || '',
      'Topic': s.topic || '',
      'Assigned Teacher': s.selectedTeacher || ''
    }));
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Suggested Routine");
    worksheet["!cols"] = [ { wch: 5 }, { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 30 }, { wch: 30 }, { wch: 20 } ];
    XLSX.writeFile(workbook, fileName);
    toast({ title: "Export Successful", description: "XLSX file has been downloaded." });
  };

  const exportBulkRoutineToExcel = () => {
    if (bulkRoutine.length === 0) return;
    const data = bulkRoutine.map((s, idx) => ({
        '#': idx + 1,
        'Status': s.status.replace('_', ' ').toUpperCase(),
        'Scheduled Date': s.status === 'scheduled' || s.status === 'auto_generated' || s.status === 'conflict' ? s.assignedDateLabel : 'NOT SCHEDULED',
        'Scheduled Time': s.status === 'scheduled' || s.status === 'auto_generated' || s.status === 'conflict' ? s.assignedTimeLabel : 'N/A',
        'Assigned Studio': s.status === 'scheduled' || s.status === 'auto_generated' || s.status === 'conflict' ? s.assignedStudio : 'N/A',
        'Teacher': s.assignedTeacher,
        'Subject': s.inputSubject,
        'Topic': s.inputTopic,
        'Course': s.inputCourse,
        'Product Type': s.inputProductType,
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Bulk Routine");
    worksheet["!cols"] = [ { wch: 5 }, { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 30 }, { wch: 30 }, { wch: 20 }, { wch: 20 } ];
    XLSX.writeFile(workbook, `Bulk_Routine_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast({ title: "Export Successful", description: "Bulk routine XLSX file has been downloaded." });
  }

  const commonControls = (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <div className="space-y-1">
        <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest px-2">WINDOW START</label>
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
        <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest px-2">WINDOW END</label>
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
        <Input type="number" value={slotCount} onChange={(e) => setSlotCount(e.target.value === '' ? '' : parseInt(e.target.value))} placeholder="e.g. 20" className="w-24 h-11 bg-zinc-950 border-zinc-800 text-[10px] font-black uppercase tracking-widest rounded-xl text-center" />
      </div>

      <div className="space-y-1">
        <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest px-2">MAX / DAY</label>
        <Input type="number" value={maxSlotsPerDay} onChange={(e) => setMaxSlotsPerDay(e.target.value === '' ? '' : parseInt(e.target.value))} placeholder="e.g. 3" className="w-24 h-11 bg-zinc-950 border-zinc-800 text-[10px] font-black uppercase tracking-widest rounded-xl text-center" />
      </div>

      <div className="space-y-1">
        <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest px-2">DURATION (MIN)</label>
        <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value === '' ? '' : parseInt(e.target.value))} placeholder="e.g. 90" className="w-28 h-11 bg-zinc-950 border-zinc-800 text-[10px] font-black uppercase tracking-widest rounded-xl text-center" />
      </div>
    </div>
  );

  const autoPlannerResults = (
    loading ? (
      <div className="h-96 flex flex-col items-center justify-center gap-6 mt-12">
        <div className="relative">
          <Loader2 className="w-16 h-16 animate-spin text-orange-500" />
          <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-orange-500/50" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.6em]">SYNTHESIZING AUTO-ROUTINE</p>
          <p className="text-[8px] font-bold text-zinc-700 uppercase tracking-widest italic">Scanned range for Studio 1-11 with {maxSlotsPerDay} daily slot limit...</p>
        </div>
      </div>
    ) : routine.length > 0 ? (
      <div className="space-y-6 animate-in-fade mt-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest gap-2">
              <ClipboardList className="w-4 h-4" />
              {routine.length} Gaps Identified across Studios 1-11
            </Badge>
          </div>
          <Button 
            onClick={() => exportToExcel(routine, `Auto_Routine_${format(new Date(), 'yyyy-MM-dd')}.xlsx`)}
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
    ) : (
      <div className="h-96 flex flex-col items-center justify-center gap-8 bg-zinc-900/10 border border-dashed border-zinc-800 rounded-[3rem] mt-12">
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
    )
  );

  const customBulkResults = (
    bulkLoading ? (
      <div className="h-96 flex flex-col items-center justify-center gap-6 mt-12">
        <div className="relative">
          <Loader2 className="w-16 h-16 animate-spin text-orange-500" />
          <SlidersHorizontal className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-orange-500/50" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.6em]">GENERATING BULK ROUTINE</p>
          <p className="text-[8px] font-bold text-zinc-700 uppercase tracking-widest italic">Applying priorities and resolving conflicts...</p>
        </div>
      </div>
    ) : bulkRoutine.length > 0 ? (
      <div className="space-y-6 animate-in-fade mt-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Bulk Routine Preview
            </Badge>
          </div>
          <Button onClick={exportBulkRoutineToExcel} className="h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl px-8 shadow-lg shadow-emerald-900/20 gap-3">
            <Download className="w-4 h-4" />
            EXPORT TO XLSX
          </Button>
        </div>
        <Card className="bg-zinc-900 border-zinc-800 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-zinc-950">
                <TableRow className="border-zinc-800">
                  <TableHead className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Date/Time</TableHead>
                  <TableHead className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Studio</TableHead>
                  <TableHead className="text-[10px] font-black text-zinc-500 uppercase tracking-widest w-[220px]">Teacher</TableHead>
                  <TableHead className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Subject</TableHead>
                  <TableHead className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Topic</TableHead>
                  <TableHead className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Course</TableHead>
                  <TableHead className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Product Type</TableHead>
                  <TableHead className="text-center text-[10px] font-black text-zinc-500 uppercase tracking-widest">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bulkRoutine.map(slot => (
                  <TableRow key={slot.id} className="border-zinc-800 hover:bg-zinc-800/40">
                    <TableCell className="w-[180px]">
                      <div className="flex items-center gap-2">
                         {slot.isAutoAssigned.date && <Sparkles className="w-3 h-3 text-cyan-400" />}
                         <div>
                            <p className="text-[10px] font-black uppercase text-zinc-300">{slot.assignedDateLabel || 'Not Assigned'}</p>
                            <p className="text-[10px] font-black uppercase text-orange-500">{slot.assignedTimeLabel || 'N/A'}</p>
                         </div>
                      </div>
                    </TableCell>
                    <TableCell className="w-[150px]">
                      <div className="flex items-center gap-2">
                         {slot.isAutoAssigned.studio && <Sparkles className="w-3 h-3 text-cyan-400" />}
                         <span className="text-[10px] font-black uppercase text-white">{slot.assignedStudio || 'N/A'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="w-[220px]">
                      <TeacherSelector
                        teacherPoolStatus={slot.teacherPoolStatus}
                        selectedTeacher={slot.assignedTeacher}
                        onSelect={(teacher) => handleBulkRoutineUpdate(slot.id, 'assignedTeacher', teacher)}
                      />
                    </TableCell>
                    <TableCell className="w-[200px]">
                       <Input
                        value={slot.inputSubject}
                        onChange={(e) => handleBulkRoutineUpdate(slot.id, 'inputSubject', e.target.value)}
                        className="h-9 bg-zinc-950 border-zinc-800 text-[10px] font-black uppercase rounded-lg"
                        placeholder="Subject..."
                      />
                    </TableCell>
                     <TableCell className="w-[200px]">
                       <Input
                        value={slot.inputTopic}
                        onChange={(e) => handleBulkRoutineUpdate(slot.id, 'inputTopic', e.target.value)}
                        className="h-9 bg-zinc-950 border-zinc-800 text-[10px] font-black uppercase rounded-lg"
                        placeholder="Topic..."
                      />
                    </TableCell>
                    <TableCell className="w-[180px]">
                       <Input
                        value={slot.inputCourse}
                        onChange={(e) => handleBulkRoutineUpdate(slot.id, 'inputCourse', e.target.value)}
                        className="h-9 bg-zinc-950 border-zinc-800 text-[10px] font-black uppercase rounded-lg"
                        placeholder="Course..."
                      />
                    </TableCell>
                    <TableCell className="w-[180px]">
                       <Input
                        value={slot.inputProductType}
                        onChange={(e) => handleBulkRoutineUpdate(slot.id, 'inputProductType', e.target.value)}
                        className="h-9 bg-zinc-950 border-zinc-800 text-[10px] font-black uppercase rounded-lg"
                        placeholder="Product Type..."
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      {slot.status === 'scheduled' && <Badge className="bg-emerald-500/20 text-emerald-500 text-[8px] uppercase">Scheduled</Badge>}
                      {slot.status === 'auto_generated' && <Badge className="bg-sky-500/20 text-sky-400 text-[8px] uppercase">Auto-Generated</Badge>}
                      {slot.status === 'no_slot_found' && <Badge variant="destructive" className="bg-gray-500/20 text-gray-400 text-[8px] uppercase">No Slot</Badge>}
                      
                      {slot.status === 'conflict' && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Badge variant="destructive" className="text-[8px] uppercase cursor-pointer">
                              Conflict
                            </Badge>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 bg-zinc-950 border-zinc-800 p-4 shadow-2xl z-[1000]">
                            <div className="space-y-3">
                               <h4 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-red-500"><AlertCircle className="w-3 h-3" /> Slot Conflict Detected</h4>

                               {slot.conflicts?.studio && (
                                  <div className="space-y-2 bg-zinc-900 p-3 rounded-xl border border-white/5">
                                      <p className="text-xs font-black uppercase text-white">Studio Occupied</p>
                                      {slot.conflictDetails ? (
                                        <div className="border-t border-zinc-800 pt-2 mt-2 space-y-1">
                                          <p className="text-[8px] font-bold text-zinc-500 uppercase">Conflicting Class:</p>
                                          <p className="text-xs font-black text-white">{slot.conflictDetails.subject}</p>
                                          {slot.conflictDetails.topic && <p className="text-[9px] text-zinc-400 italic">"{slot.conflictDetails.topic}"</p>}
                                          <p className="text-[9px] text-zinc-400">by {slot.conflictDetails.teacher} at {slot.conflictDetails.time}</p>
                                        </div>
                                      ) : (
                                        <p className="text-[9px] font-bold text-zinc-400">The studio '{slot.assignedStudio}' is already booked at this time.</p>
                                      )}
                                  </div>
                               )}

                               {slot.conflicts?.teacher && !slot.conflicts.studio && slot.conflictDetails && (
                                  <div className="space-y-2 bg-zinc-900 p-3 rounded-xl border border-white/5">
                                      <p className="text-xs font-black uppercase text-white">Teacher Conflict: {slot.assignedTeacher}</p>
                                      <p className="text-[9px] font-bold text-zinc-400 italic">Is already scheduled for: "{slot.conflictDetails.subject}"</p>
                                       <div className="flex items-center gap-4 border-t border-zinc-800 pt-2 mt-2">
                                          <span className="text-[9px] font-bold text-zinc-300 uppercase flex items-center gap-1"><Clock className="w-3 h-3"/> {slot.conflictDetails.time}</span>
                                          <span className="text-[9px] font-bold text-zinc-300 uppercase flex items-center gap-1"><MapPin className="w-3 h-3"/> {slot.conflictDetails.studio}</span>
                                      </div>
                                  </div>
                               )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                      
                      {slot.status === 'teacher_conflict' && (
                        <Popover>
                          <PopoverTrigger asChild><Badge variant="destructive" className="bg-yellow-500/20 text-yellow-500 text-[8px] uppercase cursor-pointer">Teacher Busy</Badge></PopoverTrigger>
                          <PopoverContent className="w-80 bg-zinc-950 border-zinc-800 p-4 shadow-2xl z-[1000]">
                            <div className="space-y-3">
                              <h4 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-yellow-500"><AlertCircle className="w-3 h-3" />Teacher Conflict</h4>
                              {slot.conflictDetails && (
                                <div className="space-y-2 bg-zinc-900 p-3 rounded-xl border border-white/5">
                                  <p className="text-xs font-black uppercase text-white">{slot.conflictDetails.subject}</p>
                                  {slot.conflictDetails.topic && <p className="text-[9px] font-bold text-zinc-400 italic">"{slot.conflictDetails.topic}"</p>}
                                  <div className="flex items-center gap-4 border-t border-zinc-800 pt-2 mt-2">
                                    <span className="text-[9px] font-bold text-zinc-300 uppercase flex items-center gap-1"><Clock className="w-3 h-3"/> {slot.conflictDetails.time}</span>
                                    <span className="text-[9px] font-bold text-zinc-300 uppercase flex items-center gap-1"><MapPin className="w-3 h-3"/> {slot.conflictDetails.studio}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    ) : (
      <div className="h-96 flex flex-col items-center justify-center gap-8 bg-zinc-900/10 border border-dashed border-zinc-800 rounded-[3rem] mt-12">
        <div className="w-20 h-20 rounded-[2.5rem] bg-zinc-900 border border-zinc-800 flex items-center justify-center">
          <LayoutGrid className="w-8 h-8 text-zinc-700" />
        </div>
        <div className="text-center space-y-3">
          <h3 className="text-xl font-black text-white uppercase tracking-tighter">Custom Bulk Routine</h3>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest max-w-sm mx-auto leading-relaxed">
            Set your priorities, paste your class data, and the system will build an optimized schedule for you.
          </p>
        </div>
      </div>
    )
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-body p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-12">
        <header className="flex items-center justify-between gap-8 border-b border-zinc-900 pb-12">
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
        </header>

        <Tabs defaultValue="routine-planner" className="w-full">
          <TabsList className="grid w-full max-w-lg mx-auto grid-cols-2 h-14 p-2 rounded-2xl bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="routine-planner" className="rounded-xl h-full data-[state=active]:bg-orange-600 data-[state=active]:text-white text-[10px] font-black uppercase tracking-widest transition-all gap-2">
              <Sparkles className="w-4 h-4" />
              Auto-Planner
            </TabsTrigger>
            <TabsTrigger value="custom-routine" className="rounded-xl h-full data-[state=active]:bg-orange-600 data-[state=active]:text-white text-[10px] font-black uppercase tracking-widest transition-all gap-2">
              <SlidersHorizontal className="w-4 h-4" />
              Custom Bulk Routine
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="routine-planner" className="mt-8">
            <div className="bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800 shadow-2xl space-y-6">
              <p className="text-center text-xs text-zinc-400 font-bold uppercase tracking-widest">
                The planner will automatically find the most flexible, isolated gaps in the schedule.
              </p>
              <div className="flex flex-col items-center gap-6">
                {commonControls}
                <Button 
                  onClick={handleGenerate} 
                  disabled={loading}
                  className="h-12 px-8 bg-orange-600 hover:bg-orange-500 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl self-center shadow-lg shadow-orange-900/20 gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  SYNTHESIZE AUTO-ROUTINE
                </Button>
              </div>
            </div>
            {autoPlannerResults}
          </TabsContent>

          <TabsContent value="custom-routine" className="mt-8">
            <div className="bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800 shadow-2xl">
              <div className="flex flex-col gap-8">
                {commonControls}
                <div className="border-t border-zinc-800 my-2" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-4">
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Priority Days of Week</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-3">
                      {DAYS_OF_WEEK.map(day => (
                        <div key={day.id} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`day-${day.id}`} 
                            checked={priorityDays.includes(day.id)} 
                            onCheckedChange={(checked) => handlePriorityDayChange(day.id, !!checked)} 
                            className="h-5 w-5 border-zinc-700 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                          />
                          <label htmlFor={`day-${day.id}`} className="text-sm font-bold text-zinc-300">{day.label}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Priority Time Windows</h3>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                      {PRIORITY_TIMINGS.map(timing => (
                        <div key={timing.id} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`time-${timing.id}`} 
                            checked={priorityTimings.some(t => t.start === timing.range.start)} 
                            onCheckedChange={(checked) => handlePriorityTimingChange(timing.range, !!checked)} 
                            className="h-5 w-5 border-zinc-700 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                          />
                          <label htmlFor={`time-${timing.id}`} className="text-sm font-bold text-zinc-300">{timing.label}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                 <div className="border-t border-zinc-800 my-2" />
                 <div className="px-4">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-orange-500" />
                      Priority Studios (Optional)
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-3">
                      {ROUTINE_STUDIOS_LIST.map(studio => (
                        <div key={studio} className="flex items-center space-x-2">
                          <Checkbox
                            id={`studio-${studio}`}
                            checked={priorityStudios.includes(studio)}
                            onCheckedChange={(checked) => handlePriorityStudioChange(studio, !!checked)}
                            className="h-5 w-5 border-zinc-700 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                          />
                          <label htmlFor={`studio-${studio}`} className="text-sm font-bold text-zinc-300">{studio}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-zinc-800 my-2" />
                  <div className="px-4 space-y-4">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><UploadCloud className="w-4 h-4 text-orange-500" />Bulk Class Data</h3>
                    <Textarea
                      value={bulkRawData}
                      onChange={(e) => setBulkRawData(e.target.value)}
                      placeholder="Paste your class data from a spreadsheet, including headers. The system will auto-assign Date and Studio if columns are left blank, based on your priorities."
                      className="min-h-[150px] bg-zinc-950 border-zinc-800 text-xs font-mono"
                    />
                  </div>
                <div className="flex justify-center mt-4">
                  <Button 
                    onClick={handleGenerateCustomBulk} 
                    disabled={bulkLoading}
                    className="h-12 px-8 bg-orange-600 hover:bg-orange-500 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl self-center shadow-lg shadow-orange-900/20 gap-2"
                  >
                    {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SlidersHorizontal className="w-4 h-4" />}
                    GENERATE BULK ROUTINE
                  </Button>
                </div>
              </div>
            </div>
            {customBulkResults}
          </TabsContent>
        </Tabs>
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
