
'use client';

import { useState, useEffect } from 'react';
import { getAllRequests, updateRequestStatus } from '@/app/actions/booking';
import { BookingRequest } from '@/app/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, Calendar, Layers, Loader2, RefreshCw, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface AdminDashboardProps {
  onLogout?: () => void;
}

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await getAllRequests();
      setRequests(data);
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to load requests" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleAction = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await updateRequestStatus(id, status);
      toast({ title: `Booking ${status.toUpperCase()}` });
      loadRequests();
    } catch (e) {
      toast({ variant: "destructive", title: "Action Failed" });
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-body p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-zinc-900 pb-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-black uppercase tracking-tighter text-white">
              CONTROL <span className="text-orange-500">CENTER</span>
            </h1>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.4em]">Pending Requests: {pendingCount}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={loadRequests} variant="outline" className="h-10 rounded-xl gap-2 border-zinc-800 bg-zinc-900 hover:bg-zinc-800">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              REFRESH QUEUE
            </Button>
            <Button onClick={onLogout} variant="destructive" className="h-10 rounded-xl gap-2 font-black text-xs uppercase tracking-widest shadow-lg shadow-red-900/20">
              <LogOut className="w-4 h-4" />
              LOG OUT
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6">
          {requests.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center bg-zinc-900/40 border border-dashed border-zinc-800 rounded-3xl">
              <Clock className="w-12 h-12 text-zinc-800 mb-4" />
              <p className="text-xs font-black text-zinc-600 uppercase tracking-widest">No active requests in queue</p>
            </div>
          ) : (
            requests.slice().reverse().map((req) => (
              <Card key={req.id} className="bg-zinc-900 border-zinc-800 overflow-hidden shadow-2xl hover:border-zinc-700 transition-all">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row">
                    <div className={cn(
                      "w-full md:w-2 bg-zinc-800",
                      req.status === 'pending' ? "bg-yellow-500" : (req.status === 'approved' ? "bg-emerald-500" : "bg-red-500")
                    )} />
                    
                    <div className="flex-1 p-6 flex flex-col md:flex-row items-center gap-8">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 flex-1 w-full">
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                            <Layers className="w-3 h-3" /> STUDIO
                          </label>
                          <p className="text-xs font-black uppercase">{req.studio}</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                            <Calendar className="w-3 h-3" /> DATE
                          </label>
                          <p className="text-xs font-black uppercase">{format(new Date(req.date), 'MMM d, yyyy')}</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                            <Clock className="w-3 h-3" /> TIME / DURATION
                          </label>
                          <p className="text-xs font-black uppercase">{format(new Date(req.startTime), 'h:mm a')} • {req.duration}</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">STATUS</label>
                          <div>
                            <Badge className={cn(
                              "text-[8px] font-black uppercase tracking-widest px-2 py-0.5",
                              req.status === 'pending' ? "bg-yellow-500/10 text-yellow-500" : (req.status === 'approved' ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500")
                            )}>
                              {req.status}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {req.status === 'pending' && (
                        <div className="flex items-center gap-3 shrink-0">
                          <Button 
                            variant="outline" 
                            onClick={() => handleAction(req.id, 'rejected')}
                            className="h-10 w-10 p-0 rounded-xl border-zinc-800 bg-zinc-950 text-red-500 hover:bg-red-500 hover:text-white"
                          >
                            <XCircle className="w-5 h-5" />
                          </Button>
                          <Button 
                            onClick={() => handleAction(req.id, 'approved')}
                            className="h-10 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest flex items-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            APPROVE
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
