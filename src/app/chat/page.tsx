'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, Bot, User, Loader2, Send } from 'lucide-react';
import { sendMessageToAgent } from '@/app/actions/chat';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  sender: 'user' | 'agent';
  text: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { sender: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const agentReply = await sendMessageToAgent(input);
      const agentMessage: Message = { sender: 'agent', text: agentReply };
      setMessages((prev) => [...prev, agentMessage]);
    } catch (error) {
      console.error(error);
      const errorMessage: Message = {
        sender: 'agent',
        text: 'Sorry, something went wrong. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-scroll to the bottom when new messages are added
    if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
        if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
        }
    }
  }, [messages]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-body p-6 md:p-12 flex flex-col">
      <div className="max-w-4xl mx-auto space-y-8 w-full flex-1 flex flex-col">
        <header className="flex items-center justify-between border-b border-zinc-900 pb-8">
          <div className="space-y-2">
            <Link href="/">
              <Button variant="ghost" className="p-0 h-auto hover:bg-transparent text-orange-500 gap-2 font-black text-[10px] uppercase tracking-widest mb-2">
                <ChevronLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>
            </Link>
            <h1 className="text-4xl font-black uppercase tracking-tighter text-white flex items-center gap-4">
              <Bot className="w-8 h-8 text-orange-500" />
              CHAT <span className="text-orange-500">AGENT</span>
            </h1>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.4em]">Powered by n8n Automation</p>
          </div>
        </header>

        <Card className="bg-zinc-900 border-zinc-800 shadow-2xl flex-1 flex flex-col">
          <CardContent className="p-6 flex-1 flex flex-col gap-4">
            <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
              <div className="space-y-6">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex items-start gap-4",
                      message.sender === 'user' ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.sender === 'agent' && (
                      <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center shrink-0">
                        <Bot className="w-6 h-6 text-white" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-lg p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
                        message.sender === 'user'
                          ? "bg-indigo-600 text-white rounded-br-none"
                          : "bg-zinc-800 text-zinc-200 rounded-bl-none"
                      )}
                    >
                      {message.text}
                    </div>
                     {message.sender === 'user' && (
                      <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                        <User className="w-6 h-6 text-zinc-400" />
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex items-start gap-4 justify-start">
                    <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center shrink-0">
                      <Bot className="w-6 h-6 text-white" />
                    </div>
                    <div className="max-w-lg p-4 rounded-2xl bg-zinc-800 text-zinc-200 rounded-bl-none">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            <form onSubmit={handleSendMessage} className="flex items-center gap-4 pt-4 border-t border-zinc-800">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask the agent anything..."
                className="bg-zinc-950 border-zinc-800 text-sm flex-1 resize-none"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
              />
              <Button type="submit" disabled={loading || !input.trim()} className="h-12 w-12 p-0 bg-orange-600 hover:bg-orange-500 rounded-xl shrink-0">
                <Send className="w-5 h-5" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
