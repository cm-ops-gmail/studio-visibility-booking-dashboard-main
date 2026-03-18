'use client';

import { useState } from 'react';
import { parseAndPreviewBulkData, submitBulkBookings } from '@/app/actions/bulk-booking';
import { BulkPreviewEntry } from '@/app/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  AlertCircle, 
  CheckCircle2, 
  ChevronLeft, 
  ClipboardPaste, 
  Loader2, 
  AlertTriangle,
  Info,
  XCircle,
  HelpCircle,
  Clock,
  User,
  Layers,
  MapPin,
  Calendar
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function BulkBookingPage() {
  const [rawData, setRawData] = useState('');
  const [preview, setPreview] = useState<BulkPreviewEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleParse = async () => {
    if (!rawData.trim()) return;
    setLoading(true);
    try {
      const data = await parseAndPreviewBulkData(rawData);
      setPreview(data);
      if (data.length === 0) {
        toast({ 
          variant: "destructive", 
          title: "Parsing Failed", 
          description: "Could not find required columns (Date, Scheduled Time, Studio). Ensure headers are included." 
        });
      } else {
        toast({
          title: "Preview Generated",
          description: `Identified ${data.length} potential slots.`
        });
      }
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error", description: "Failed to process data. Check console for details." });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const result = await submitBulkBookings(preview);
      toast({ 
        title: "Bulk Booking Successful", 
        description: `Successfully added ${result.count} new slots to the system.` 
      });
      setPreview([]);
      setRawData('');
    } catch (e) {
      toast({ variant: "destructive", title: "Submission Failed", description: "Could not write data to spreadsheet." });
    } finally {
      setSubmitting(false);
    }
  };

  const studioConflicts = preview.filter(p => p.conflicts.studio && !p.isDuplicate).length;
  const teacherConflicts = preview.filter(p => p.conflicts.teacher).length;
  const duplicates = preview.filter(p => p.isDuplicate).length;
  const readyCount = preview.filter(p => !p.isDuplicate && !p.conflicts.studio).length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-body p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex items-center justify-between border-b border-zinc-900 pb-8">
          <div className="space-y-2">
            <Link href="/">
              <Button variant="ghost" className="p-0 h-auto hover:bg-transparent text-orange-500 gap-2 font-black text-[10px] uppercase tracking-widest mb-2">
                <ChevronLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>
            </Link>
            <h1 className="text-4xl font-black uppercase tracking-tighter text-white">
              BULK SLOT <span className="text-orange-500">BOOKING</span>
            </h1>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-8">
          <Card className="bg-zinc-900 border-zinc-800 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <ClipboardPaste className="w-4 h-4 text-orange-500" />
                Paste Data from Google Sheets
              </CardTitle>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                Copy rows including headers. The system will automatically map the required columns even if there are extra ones.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea 
                value={rawData}
                onChange={(e) => setRawData(e.target.value)}
                placeholder="Date	Scheduled Time	End Time	Product Type	Course	Subject	Topic	Teacher 1	Studio..."
                className="min-h-[200px] bg-zinc-950 border-zinc-800 text-xs font-mono"
              />
              <div className="flex gap-4">
                <Button 
                  variant="outline"
                  onClick={() => {
                    setRawData('');
                    setPreview([]);
                  }}
                  className="h-12 border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-white"
                >
                  CLEAR
                </Button>
                <Button 
                  onClick={handleParse} 
                  disabled={loading || !rawData.trim()}
                  className="flex-1 h-12 bg-zinc-100 hover:bg-white text-black font-black uppercase tracking-[0.2em] rounded-xl"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'PROCESS & PREVIEW'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {preview.length > 0 && (
            <div className="space-y-6 animate-in-fade">
              <div className="flex flex-wrap gap-4 items-center">
                {(studioConflicts > 0 || duplicates > 0) && (
                  <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/20 px-4 py-2 rounded-xl gap-2 font-black text-[10px] uppercase tracking-widest">
                    <AlertTriangle className="w-4 h-4" />
                    {studioConflicts + duplicates} Occupied Slots Detected
                  </Badge>
                )}
                {teacherConflicts > 0 && (
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 px-4 py-2 rounded-xl gap-2 font-black text-[10px] uppercase tracking-widest">
                    <AlertTriangle className="w-4 h-4" />
                    {teacherConflicts} Teacher Schedule Conflict(s)
                  </Badge>
                )}
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-4 py-2 rounded-xl gap-2 font-black text-[10px] uppercase tracking-widest ml-auto">
                  <CheckCircle2 className="w-4 h-4" />
                  {readyCount} Ready to Book
                </Badge>
              </div>

              <Card className="bg-zinc-900 border-zinc-800 overflow-hidden shadow-2xl">
                <div className="max-h-[500px] overflow-auto">
                  <Table>
                    <TableHeader className="bg-zinc-950 sticky top-0 z-10">
                      <TableRow className="border-zinc-800">
                        <TableHead className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Date / Time Window</TableHead>
                        <TableHead className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Studio</TableHead>
                        <TableHead className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Teacher</TableHead>
                        <TableHead className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Subject / Topic</TableHead>
                        <TableHead className="text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.map((entry, idx) => (
                        <TableRow key={idx} className={cn(
                          "border-zinc-800 hover:bg-zinc-800/40 transition-colors",
                          (entry.isDuplicate || entry.conflicts.studio) && "bg-zinc-900/40"
                        )}>
                          <TableCell className="py-4">
                            <p className="text-[10px] font-black uppercase text-zinc-300">{entry.date}</p>
                            <p className="text-[10px] font-black uppercase text-orange-500">{entry.scheduledTime}</p>
                          </TableCell>
                          <TableCell>
                            <span className={cn(
                              "text-[10px] font-black uppercase px-2 py-1 rounded-md",
                              entry.conflicts.studio ? "bg-red-500/20 text-red-500 ring-1 ring-red-500/50" : "text-white"
                            )}>
                              {entry.studio}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={cn(
                              "text-[10px] font-black uppercase px-2 py-1 rounded-md",
                              entry.conflicts.teacher ? "bg-yellow-500/20 text-yellow-500 ring-1 ring-yellow-500/50" : "text-white"
                            )}>
                              {entry.teacher}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            <p className="text-[10px] font-black uppercase truncate">{entry.subject}</p>
                            <p className="text-[9px] font-bold text-zinc-500 truncate">{entry.topic}</p>
                          </TableCell>
                          <TableCell className="text-center">
                            {entry.isDuplicate || entry.conflicts.studio || entry.conflicts.teacher ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      "text-[8px] uppercase cursor-pointer hover:opacity-80 transition-all gap-1.5",
                                      (entry.isDuplicate || entry.conflicts.studio) ? "bg-red-500/10 text-red-500" : "bg-yellow-500/10 text-yellow-500"
                                    )}
                                  >
                                    {entry.isDuplicate || entry.conflicts.studio ? "Already occupied" : "Teacher overlap"}
                                    <HelpCircle className="w-2.5 h-2.5" />
                                  </Badge>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 bg-zinc-950 border-zinc-800 p-4 shadow-2xl z-[1000]">
                                  <div className="space-y-4">
                                    <h4 className={cn(
                                      "text-[10px] font-black uppercase tracking-widest flex items-center gap-2",
                                      (entry.isDuplicate || entry.conflicts.studio) ? "text-red-500" : "text-yellow-500"
                                    )}>
                                      <AlertCircle className="w-3 h-3" />
                                      {entry.conflicts.teacher && !entry.conflicts.studio ? "Teacher Schedule Conflict" : "Occupancy Blocked"}
                                    </h4>
                                    
                                    {entry.conflictingSlot ? (
                                      <div className="space-y-3 bg-zinc-900 p-3 rounded-xl border border-white/5">
                                        <div className="grid grid-cols-1 gap-3">
                                          <div className="space-y-1">
                                            <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                                              <Calendar className="w-3 h-3" /> Conflicting Date
                                            </p>
                                            <p className="text-[10px] font-black uppercase text-white">{entry.conflictingSlot.date || entry.date}</p>
                                          </div>
                                          
                                          <div className="space-y-1">
                                            <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                                              <Layers className="w-3 h-3" /> Existing Class
                                            </p>
                                            <p className="text-xs font-black uppercase text-white">{entry.conflictingSlot.subject}</p>
                                            {entry.conflictingSlot.topic && (
                                              <p className="text-[9px] font-bold text-zinc-400 italic">"{entry.conflictingSlot.topic}"</p>
                                            )}
                                          </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 border-t border-zinc-800 pt-3">
                                          <div className="space-y-1">
                                            <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                                              <User className="w-3 h-3" /> Teacher
                                            </p>
                                            <p className="text-[10px] font-black uppercase">{entry.conflictingSlot.teacher}</p>
                                          </div>
                                          <div className="space-y-1">
                                            <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                                              <Clock className="w-3 h-3" /> Time Window
                                            </p>
                                            <p className="text-[10px] font-black uppercase">{entry.conflictingSlot.time}</p>
                                          </div>
                                        </div>

                                        <div className="space-y-1 border-t border-zinc-800 pt-3">
                                            <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                                              <MapPin className="w-3 h-3" /> Location
                                            </p>
                                            <p className="text-[10px] font-black uppercase text-orange-500">{entry.conflictingSlot.studio || entry.studio}</p>
                                        </div>

                                        <Badge variant="outline" className="w-full justify-center bg-zinc-950 text-[7px] font-black uppercase tracking-widest py-1 border-zinc-800">
                                          SYSTEM TYPE: {entry.conflictingSlot.type}
                                        </Badge>
                                      </div>
                                    ) : (
                                      <div className="bg-zinc-900 p-3 rounded-xl border border-white/5">
                                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest text-center">
                                          Occupied by existing schedule or preparation window.
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            ) : (
                              <Badge className="bg-emerald-500/20 text-emerald-500 text-[8px] uppercase">READY</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              <div className="flex justify-end pt-4 gap-4 items-center">
                 {readyCount === 0 && preview.length > 0 && (
                   <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest flex items-center gap-2">
                     <XCircle className="w-4 h-4" />
                     No valid slots found to book.
                   </p>
                 )}
                <Button 
                  onClick={handleSubmit} 
                  disabled={submitting || readyCount === 0}
                  className="h-14 px-12 bg-orange-600 hover:bg-orange-500 text-white font-black uppercase tracking-[0.2em] rounded-xl shadow-xl shadow-orange-900/20 gap-3"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  CONFIRM BULK BOOKING ({readyCount})
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
