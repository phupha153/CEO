import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Sparkles, Plus, Trash2, User, Bot, Copy } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

function MessageBubble({ message }) {
    const isUser = message.role === 'user';
    
    return (
        <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
            {!isUser && (
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md">
                    <Sparkles className="h-4 w-4 text-white" />
                </div>
            )}
            <div className={cn("max-w-[85%]", isUser && "flex flex-col items-end")}>
                {message.content && (
                    <div className={cn(
                        "rounded-2xl px-4 py-3 shadow-sm",
                        isUser ? "bg-slate-800 text-white rounded-tr-sm" : "bg-white border border-slate-200 rounded-tl-sm text-slate-800"
                    )}>
                        {isUser ? (
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                        ) : (
                            <ReactMarkdown 
                                className="text-sm prose prose-sm prose-slate max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:text-slate-100"
                                components={{
                                    code: ({ inline, className, children, ...props }) => {
                                        const match = /language-(\w+)/.exec(className || '');
                                        return !inline && match ? (
                                            <div className="relative group/code mt-2 mb-2">
                                                <pre className="rounded-lg p-3 overflow-x-auto text-xs">
                                                    <code className={className} {...props}>{children}</code>
                                                </pre>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover/code:opacity-100 bg-slate-800 hover:bg-slate-700"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
                                                        toast.success('คัดลอกโค้ดแล้ว');
                                                    }}
                                                >
                                                    <Copy className="h-3 w-3 text-slate-300" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <code className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-mono font-medium" {...props}>
                                                {children}
                                            </code>
                                        );
                                    },
                                    a: ({ children, ...props }) => (
                                        <a {...props} className="text-blue-600 hover:text-blue-800 font-medium underline underline-offset-2" target="_blank" rel="noopener noreferrer">{children}</a>
                                    ),
                                    p: ({ children }) => <p className="my-2">{children}</p>,
                                    ul: ({ children }) => <ul className="my-2 ml-5 list-disc space-y-1 marker:text-slate-400">{children}</ul>,
                                    ol: ({ children }) => <ol className="my-2 ml-5 list-decimal space-y-1 marker:text-slate-500 font-medium">{children}</ol>,
                                    li: ({ children }) => <li className="pl-1"><span className="font-normal">{children}</span></li>,
                                    h3: ({ children }) => <h3 className="text-sm font-bold text-slate-900 mt-4 mb-2">{children}</h3>,
                                    h4: ({ children }) => <h4 className="text-sm font-semibold text-slate-800 mt-3 mb-1">{children}</h4>,
                                    strong: ({ children }) => <strong className="font-semibold text-indigo-900">{children}</strong>,
                                }}
                            >
                                {message.content}
                            </ReactMarkdown>
                        )}
                    </div>
                )}
            </div>
            {isUser && (
                <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-slate-600" />
                </div>
            )}
        </div>
    );
}

export default function SystemAssistantPage() {
    const [conversations, setConversations] = useState([]);
    const [activeConversation, setActiveConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef(null);

    // โหลดประวัติการสนทนาทั้งหมด
    useEffect(() => {
        loadConversations();
    }, []);

    const loadConversations = async () => {
        setIsLoading(true);
        try {
            const list = await base44.agents.listConversations({ agent_name: "system_assistant" });
            setConversations(list || []);
            
            if (list && list.length > 0) {
                // เลือกแชทล่าสุด
                setActiveConversation(list[0]);
            } else {
                // สร้างแชทใหม่ถ้ายังไม่มี
                await handleNewChat();
            }
        } catch (error) {
            console.error("Error loading conversations:", error);
            toast.error("ไม่สามารถโหลดประวัติการสนทนาได้");
        } finally {
            setIsLoading(false);
        }
    };

    const handleNewChat = async () => {
        try {
            setIsLoading(true);
            const newConv = await base44.agents.createConversation({
                agent_name: "system_assistant",
                metadata: { name: `สนทนา ${new Date().toLocaleString('th-TH')}` }
            });
            setConversations(prev => [newConv, ...prev]);
            setActiveConversation(newConv);
            setMessages([]);
        } catch (error) {
            toast.error("ไม่สามารถสร้างแชทใหม่ได้");
        } finally {
            setIsLoading(false);
        }
    };

    // สมัครรับข้อมูลเมื่อเปลี่ยนแชท
    useEffect(() => {
        if (!activeConversation) return;

        setMessages(activeConversation.messages || []);

        const unsubscribe = base44.agents.subscribeToConversation(activeConversation.id, (data) => {
            setMessages(data.messages || []);
            setIsSending(false);
        });

        return () => {
            unsubscribe();
        };
    }, [activeConversation?.id]);

    // Scroll down เมื่อมีข้อความใหม่
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || !activeConversation || isSending) return;

        const text = input.trim();
        setInput('');
        setIsSending(true);

        // Optimistic UI update
        const optimisticMsg = { role: 'user', content: text, id: Date.now().toString() };
        setMessages(prev => [...prev, optimisticMsg]);

        try {
            await base44.agents.addMessage(activeConversation, {
                role: "user",
                content: text
            });
        } catch (error) {
            toast.error("ส่งข้อความไม่สำเร็จ");
            setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
            setInput(text);
            setIsSending(false);
        }
    };

    const handleDeleteChat = async (convId) => {
        if (!confirm("คุณต้องการลบประวัติการสนทนานี้ใช่หรือไม่?")) return;
        
        try {
            // ปัจจุบัน SDK อาจจะยังไม่มี deleteConversation, ถ้ามีให้ใช้ ถ้าไม่มีก็แค่ซ่อนจาก UI
            // ถ้าไม่มีเราลบจาก state ชั่วคราวไปก่อน
            setConversations(prev => prev.filter(c => c.id !== convId));
            if (activeConversation?.id === convId) {
                const remaining = conversations.filter(c => c.id !== convId);
                if (remaining.length > 0) {
                    setActiveConversation(remaining[0]);
                } else {
                    await handleNewChat();
                }
            }
            toast.success("ลบประวัติแล้ว (เฉพาะในหน้านี้)");
        } catch (error) {
            toast.error("ไม่สามารถลบได้");
        }
    };

    return (
        <div className="flex h-[calc(100vh-64px)] w-full bg-slate-50 relative overflow-hidden">
            {/* Sidebar ประวัติแชท */}
            <div className="w-72 bg-white border-r border-slate-200 hidden md:flex flex-col">
                <div className="p-4 border-b border-slate-200">
                    <Button onClick={handleNewChat} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                        <Plus className="w-4 h-4 mr-2" />
                        เริ่มการสนทนาใหม่
                    </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {conversations.map(conv => (
                        <div 
                            key={conv.id}
                            className={cn(
                                "group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all",
                                activeConversation?.id === conv.id 
                                    ? "bg-indigo-50 text-indigo-700 font-medium" 
                                    : "hover:bg-slate-100 text-slate-600"
                            )}
                            onClick={() => setActiveConversation(conv)}
                        >
                            <div className="truncate text-sm flex-1">
                                {conv.metadata?.name || 'สนทนาใหม่'}
                            </div>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500"
                                onClick={(e) => { e.stopPropagation(); handleDeleteChat(conv.id); }}
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    ))}
                    {conversations.length === 0 && !isLoading && (
                        <div className="text-center py-8 text-slate-400 text-sm">
                            ไม่มีประวัติการสนทนา
                        </div>
                    )}
                </div>
            </div>

            {/* พื้นที่แชทหลัก */}
            <div className="flex-1 flex flex-col relative h-full">
                {/* Header */}
                <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3 shadow-sm z-10 shrink-0">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
                        <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-slate-800">ผู้ช่วย AI ระบบจัดการหอพัก</h1>
                        <p className="text-xs text-slate-500">พร้อมตอบคำถามและแนะนำวิธีการใช้งานระบบ</p>
                    </div>
                    
                    {/* ปุ่ม New Chat สำหรับหน้าจอมือถือ */}
                    <Button 
                        variant="outline" 
                        size="icon" 
                        className="ml-auto md:hidden"
                        onClick={handleNewChat}
                    >
                        <Plus className="w-4 h-4" />
                    </Button>
                </div>

                {/* ข้อความสนทนา */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth bg-slate-50">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto px-4 opacity-70">
                            <div className="h-20 w-20 bg-indigo-100 rounded-full flex items-center justify-center mb-6">
                                <Bot className="h-10 w-10 text-indigo-500" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-700 mb-2">สวัสดีครับ! ให้ผมช่วยอะไรดีครับ?</h2>
                            <p className="text-slate-500 text-sm mb-8">
                                ผมสามารถแนะนำการใช้งานระบบหอพักต่างๆ ได้ เช่น การสร้างบิล, การตั้งค่าค่าใช้จ่ายรายเดือน, หรือการจดมิเตอร์
                            </p>
                            <div className="flex flex-col gap-2 w-full">
                                <Button variant="outline" className="justify-start text-left h-auto py-3 px-4 bg-white hover:border-indigo-300" onClick={() => setInput("การเพิ่มค่าเน็ตรายเดือนต้องทำยังไง?")}>
                                    "การเพิ่มค่าเน็ตรายเดือนต้องทำยังไง?"
                                </Button>
                                <Button variant="outline" className="justify-start text-left h-auto py-3 px-4 bg-white hover:border-indigo-300" onClick={() => setInput("บิลรายเดือนคำนวณจากอะไรบ้าง?")}>
                                    "บิลรายเดือนคำนวณจากอะไรบ้าง?"
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-3xl mx-auto space-y-6 pb-4">
                            {messages.map((msg, idx) => (
                                <motion.div 
                                    key={msg.id || idx}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <MessageBubble message={msg} />
                                </motion.div>
                            ))}
                            {isSending && (
                                <div className="flex justify-start">
                                    <div className="bg-slate-200 text-slate-600 rounded-2xl rounded-bl-sm px-4 py-2 text-sm flex items-center gap-2">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        กำลังพิมพ์...
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                {/* กล่องพิมพ์ข้อความ */}
                <div className="bg-white border-t border-slate-200 p-4 shrink-0">
                    <div className="max-w-3xl mx-auto relative">
                        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-end gap-2">
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="ถามคำถามเกี่ยวกับการใช้งาน..."
                                className="flex-1 bg-slate-50 border-slate-200 focus-visible:ring-indigo-500 rounded-xl h-12"
                                disabled={isSending || isLoading}
                            />
                            <Button 
                                type="submit"
                                disabled={!input.trim() || isSending || isLoading}
                                className="bg-indigo-600 hover:bg-indigo-700 h-12 w-12 rounded-xl shrink-0"
                            >
                                {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-1" />}
                            </Button>
                        </form>
                        <div className="text-center mt-2">
                            <span className="text-[10px] text-slate-400">AI อาจให้ข้อมูลที่ไม่ถูกต้องได้ กรุณาตรวจสอบข้อมูลอีกครั้ง</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}