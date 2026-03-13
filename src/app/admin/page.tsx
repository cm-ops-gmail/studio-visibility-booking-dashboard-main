
'use client';

import { useState } from 'react';
import { AdminDashboard } from '@/components/AdminDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock, User } from 'lucide-react';

export default function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Hardcoded credentials as requested
    if (username === 'admin' && password === 'password123') {
      setIsLoggedIn(true);
      setError('');
    } else {
      setError('Invalid credentials');
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-zinc-900 border-zinc-800 shadow-2xl">
          <CardHeader className="text-center space-y-2 border-b border-zinc-800 py-8">
            <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center mx-auto shadow-xl mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-black text-white uppercase tracking-tighter">Admin Access</CardTitle>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">Dhaka Operations Hub</p>
          </CardHeader>
          <CardContent className="p-8">
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-4">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <Input 
                    placeholder="USERNAME" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-12 bg-zinc-950 border-zinc-800 h-12 rounded-xl text-xs font-bold uppercase tracking-widest"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <Input 
                    type="password"
                    placeholder="PASSWORD" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-12 bg-zinc-950 border-zinc-800 h-12 rounded-xl text-xs font-bold uppercase tracking-widest"
                  />
                </div>
              </div>
              
              {error && <p className="text-[10px] text-red-500 font-bold text-center uppercase tracking-widest">{error}</p>}
              
              <Button type="submit" className="w-full h-12 bg-orange-600 hover:bg-orange-500 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-orange-900/20">
                Authenticate System
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <AdminDashboard />;
}
