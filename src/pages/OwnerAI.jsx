
import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, RefreshCw, Loader2, AlertCircle, Clock, Check, Lock } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from 'react-markdown';
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

// เพิ่มฟังก์ชันสำหรับดึง emoji ตามบทบาท
const getRoleEmoji = (role) => {
    const emojiMap = {
        developer: '👨‍💻',
        owner: '👑',
        manager: '👔',
        employee: '👤'
    };
    return emojiMap[role] || '👤';
};

// ปรับปรุงฟังก์ชันสำหรับลบ User Context ออกจากข้อความ
const stripUserContext = (content) => {
    if (!content) return content;
    
    // ลบ [User Context: {...}] ทั้งหมด (รองรับหลายบรรทัด)
    let cleaned = content.replace(/\[User Context:\s*\{[^}]*\}\]\s*/gi, '');
    
    // ลบ JSON object ที่เหลืออยู่ (กรณีที่มีการแสดงผลไม่สมบูรณ์)
    cleaned = cleaned.replace(/^\s*[,}]\s*"?[a-z_]+[a-z_"]*:.*$/gim, '');
    
    // ลบบรรทัดว่างที่เกิดขึ้นจากการลบ
    cleaned = cleaned.replace(/^\s*[\r\n]/gm, '');
    
    // Trim whitespace ที่เหลือ
    return cleaned.trim();
};

function MessageBubble({ message, isStreaming }) { // Removed responseTime from props
    const isUser = message.role === 'user';
    
    // ดึง userRole จาก context ถ้ามี
    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me(),
        staleTime: 60 * 60 * 1000,
    });
    const userRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'owner' : 'employee');
    
    // แปลง tool name เป็นภาษาไทย
    const getToolDisplayName = (toolName) => {
        const toolMap = {
            'entities.Payment.list': '🔍 กำลังดึงข้อมูลการชำระเงิน',
            'entities.Payment.filter': '🔍 กำลังค้นหาข้อมูลการชำระเงิน',
            'entities.Room.list': '🏠 กำลังดึงข้อมูลห้องพัก',
            'entities.Room.filter': '🏠 กำลังค้นหาข้อมูลห้องพัก',
            'entities.Tenant.list': '👤 กำลังดึงข้อมูลผู้เช่า',
            'entities.Tenant.filter': '👤 กำลังค้นหาข้อมูลผู้เช่า',
            'entities.Booking.list': '📅 กำลังดึงข้อมูลการจอง',
            'entities.Booking.filter': '📅 กำลังค้นหาข้อมูลการจอง',
            'entities.Expense.list': '💸 กำลังดึงข้อมูลค่าใช้จ่าย',
            'entities.Expense.filter': '💸 กำลังค้นหาข้อมูลค่าใช้จ่าย',
            'entities.MaintenanceRequest.list': '🔧 กำลังดึงข้อมูลแจ้งซ่อม',
            'entities.MaintenanceRequest.filter': '🔧 กำลังค้นหาข้อมูลแจ้งซ่อม',
            'entities.MeterReading.list': '⚡ กำลังดึงข้อมูลมิเตอร์',
            'entities.MeterReading.filter': '⚡ กำลังค้นหาข้อมูลมิเตอร์',
            'entities.Config.list': '⚙️ กำลังดึงข้อมูลการตั้งค่า',
            'system.getCurrentDate': '📅 กำลังดึงวันที่ปัจจุบัน',
            'system.getCurrentTime': '⏰ กำลังดึงเวลาปัจจุบัน',
            'system.getDateTime': '🗓️ กำลังดึงวันและเวลาปัจจุบัน',
        };
        
        return toolMap[toolName] || `⚙️ กำลังประมวลผล: ${toolName.split('.').pop()}`;
    };
    
    // ทำความสะอาดข้อความก่อนแสดง
    const displayContent = isUser ? stripUserContext(message.content) : message.content;
    
    // เช็คว่ามี tool calls ที่กำลัง running อยู่หรือไม่
    const hasRunningTools = message.tool_calls?.some(
        tc => tc.status === 'running' || tc.status === 'in_progress' || !tc.status
    );
    
    return (
        <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"} mb-4`}>
            {!isUser && (
                <div className="h-8 w-8 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
                    {isStreaming || hasRunningTools ? (
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                        <Bot className="w-5 h-5 text-white" />
                    )}
                </div>
            )}
            <div className={`max-w-[75%] ${isUser && "flex flex-col items-end"}`}>
                {/* แสดง tool_calls */}
                {message.tool_calls?.length > 0 && (
                    <div className="mb-2 space-y-2">
                        {message.tool_calls.map((toolCall, idx) => {
                            const isRunning = toolCall.status === 'running' || toolCall.status === 'in_progress' || !toolCall.status;
                            const isCompleted = toolCall.status === 'completed' || toolCall.status === 'success';
                            const isFailed = toolCall.status === 'failed' || toolCall.status === 'error';
                            
                            return (
                                <div 
                                    key={idx} 
                                    className={`text-sm px-4 py-3 rounded-lg border-2 ${
                                        isRunning ? 'bg-blue-50 border-blue-300 animate-pulse' : 
                                        isCompleted ? 'bg-green-50 border-green-300' :
                                        isFailed ? 'bg-red-50 border-red-300' :
                                        'bg-gray-50 border-gray-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        {isRunning && <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />}
                                        {isCompleted && <Check className="w-4 h-4 text-green-600 flex-shrink-0" />}
                                        {isFailed && <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />}
                                        <span className={`font-medium ${
                                            isRunning ? 'text-blue-700' :
                                            isCompleted ? 'text-green-700' :
                                            isFailed ? 'text-red-700' :
                                            'text-gray-700'
                                        }`}>
                                            {getToolDisplayName(toolCall.name || 'unknown')}
                                        </span>
                                    </div>
                                    
                                    {/* แสดง arguments ถ้ามี */}
                                    {toolCall.arguments_string && (
                                        <div className="mt-2 text-xs text-gray-600 bg-white/50 rounded p-2">
                                            <span className="font-semibold">เงื่อนไขการค้นหา:</span>
                                            <pre className="mt-1 whitespace-pre-wrap break-words">
                                                {(() => {
                                                    try {
                                                        const args = JSON.parse(toolCall.arguments_string);
                                                        if (args.query) {
                                                            return JSON.stringify(args.query, null, 2);
                                                        }
                                                        return JSON.stringify(args, null, 2);
                                                    } catch {
                                                        return toolCall.arguments_string;
                                                    }
                                                })()}
                                            </pre>
                                        </div>
                                    )}
                                    
                                    {/* แสดงผลลัพธ์ถ้าเสร็จแล้ว */}
                                    {isCompleted && toolCall.results && (
                                        <div className="mt-2 text-xs text-green-700 bg-white/50 rounded p-2">
                                            <span className="font-semibold">✓ สำเร็จ</span>
                                            {(() => {
                                                try {
                                                    const results = typeof toolCall.results === 'string' 
                                                        ? JSON.parse(toolCall.results) 
                                                        : toolCall.results;
                                                    
                                                    if (Array.isArray(results)) {
                                                        return <span className="ml-2">พบ {results.length} รายการ</span>;
                                                    }
                                                } catch {
                                                    return null;
                                                }
                                            })()}
                                        </div>
                                    )}
                                    
                                    {/* แสดง error ถ้าล้มเหลว */}
                                    {isFailed && toolCall.results && (
                                        <div className="mt-2 text-xs text-red-700 bg-white/50 rounded p-2">
                                            <span className="font-semibold">✗ ล้มเหลว:</span>
                                            <span className="ml-2">{toolCall.results}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
                
                {/* แสดง content */}
                {displayContent && (
                    <div>
                        <div className={`rounded-lg px-4 py-2.5 ${
                            isUser 
                                ? "bg-blue-600 text-white" 
                                : "bg-white border border-gray-200"
                        }`}>
                            {isUser ? (
                                <p className="text-sm whitespace-pre-wrap">{displayContent}</p>
                            ) : (
                                <ReactMarkdown 
                                    className="text-sm prose prose-sm max-w-none"
                                    components={{
                                        p: ({ children }) => <p className="my-1">{children}</p>,
                                        ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
                                        ol: ({ children }) => <ol className="my-1 ml-4 list-decimal">{children}</ol>,
                                        li: ({ children }) => <li className="my-0.5">{children}</li>,
                                    }}
                                >
                                    {displayContent}
                                </ReactMarkdown>
                            )}
                        </div>
                        {/* Removed the responseTime display logic */}
                    </div>
                )}
                
                {/* แสดง "กำลังคิด..." ถ้ายังไม่มี content และมี tool calls ที่กำลัง running */}
                {!displayContent && hasRunningTools && (
                    <div className="bg-white border border-gray-200 rounded-lg px-4 py-2.5">
                        <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                            <span className="text-sm text-gray-600">กำลังประมวลผลข้อมูล...</span>
                        </div>
                    </div>
                )}
            </div>
            {isUser && (
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm">{getRoleEmoji(userRole)}</span>
                </div>
            )}
        </div>
    );
}

export default function OwnerAI() {
    const queryClient = useQueryClient();
    const [conversation, setConversation] = useState(null);
    const [messageInput, setMessageInput] = useState('');
    const [messages, setMessages] = useState([]);
    const [isInitializing, setIsInitializing] = useState(true);
    const [sendingMessage, setSendingMessage] = useState(false);
    const [messageCount, setMessageCount] = useState(0);
    const [isAIResponding, setIsAIResponding] = useState(false);
    const [responseTimeout, setResponseTimeout] = useState(false);
    const [startTime, setStartTime] = useState(null); // Retained for current AI thinking time
    const [currentResponseTime, setCurrentResponseTime] = useState(0); // Retained for current AI thinking time
    const messagesEndRef = useRef(null);
    const unsubscribeRef = useRef(null);
    const lastMessageTimeRef = useRef(0);
    const timeoutRef = useRef(null);
    const timerIntervalRef = useRef(null);

    const navigate = useNavigate();

    const agentName = 'owner_assistant';
    const maxCharacters = 150;
    const MAX_MESSAGES_PER_MONTH = 200;
    const RESPONSE_TIMEOUT = 60000; // เพิ่มเป็น 60 วินาที (1 นาที)

    // ดึงข้อมูล current user
    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me(),
        staleTime: 60 * 60 * 1000,
    });

    const userRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'owner' : 'employee');
    const userPermissions = currentUser?.permissions || [];
    const hasAIAccess = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('ai_chat_access');

    // เพิ่ม useEffect สำหรับอัปเดต timer แบบ real-time
    useEffect(() => {
        if (isAIResponding && startTime) {
            // อัปเดตเวลาทุก 100ms
            timerIntervalRef.current = setInterval(() => {
                setCurrentResponseTime((Date.now() - startTime) / 1000);
            }, 100);
        } else {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }
        }

        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        };
    }, [isAIResponding, startTime]);

    useEffect(() => {
        const countMessagesThisMonth = () => {
            if (!conversation?.id) return;
            
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            
            const userMessagesThisMonth = messages.filter(msg => {
                if (msg.role !== 'user') return false;
                const msgDate = new Date(msg.created_date || msg.timestamp);
                return msgDate.getMonth() === currentMonth && msgDate.getFullYear() === currentYear;
            });
            
            setMessageCount(userMessagesThisMonth.length);
        };
        
        countMessagesThisMonth();
    }, [messages, conversation]);

    useEffect(() => {
        const initConversation = async () => {
            try {
                setIsInitializing(true);
                const cachedConvId = localStorage.getItem('ai_conversation_id');
                
                if (cachedConvId) {
                    try {
                        const existingConv = await base44.agents.getConversation(cachedConvId);
                        setConversation(existingConv);
                        setMessages(existingConv.messages || []);
                        setIsInitializing(false);
                        return;
                    } catch (error) {
                        localStorage.removeItem('ai_conversation_id');
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const newConv = await base44.agents.createConversation({
                    agent_name: agentName,
                    metadata: {
                        name: `การสนทนา ${new Date().toLocaleDateString('th-TH')}`,
                        description: 'สอบถามข้อมูลหอพัก',
                    }
                });
                
                setConversation(newConv);
                localStorage.setItem('ai_conversation_id', newConv.id);
            } catch (error) {
                toast.error('ไม่สามารถสร้างการสนทนาได้ กรุณาลองใหม่อีกครั้ง');
            } finally {
                setIsInitializing(false);
            }
        };

        if (currentUser) {
            initConversation();
        }
    }, [currentUser]);

    const sendMessageMutation = useMutation({
        mutationFn: async (content) => {
            if (!conversation) throw new Error('ไม่พบการสนทนา');
            
            if (messageCount >= MAX_MESSAGES_PER_MONTH) {
                throw new Error(`คุณใช้งานครบ ${MAX_MESSAGES_PER_MONTH} ข้อความต่อเดือนแล้ว กรุณาติดต่อผู้พัฒนาระบบ`);
            }
            
            const now = Date.now();
            const timeSinceLastMessage = now - lastMessageTimeRef.current;
            if (timeSinceLastMessage < 2000) {
                throw new Error('กรุณารอ 2 วินาที ก่อนส่งข้อความถัดไป');
            }
            lastMessageTimeRef.current = now;
            
            const messageStartTime = Date.now();
            setStartTime(messageStartTime);
            setCurrentResponseTime(0);
            setIsAIResponding(true);
            setResponseTimeout(false);
            
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            
            // เพิ่ม timeout เป็น 60 วินาที
            timeoutRef.current = setTimeout(() => {
                setResponseTimeout(true);
                setIsAIResponding(false);
                setStartTime(null);
                if (timerIntervalRef.current) {
                    clearInterval(timerIntervalRef.current);
                }
                toast.error('AI ใช้เวลานานเกินไป (60s) ลองแบ่งคำถามเป็นส่วนย่อยๆ', {
                    duration: 5000,
                });
            }, RESPONSE_TIMEOUT);
            
            // ❌ ลบการส่ง User Context ออก - Base44 มี built-in อยู่แล้ว
            const result = await base44.agents.addMessage(conversation, {
                role: 'user',
                content: content // ส่งแค่ content เฉยๆ ไม่ต้องแนบ User Context
            });
            return result;
        },
        onSuccess: () => {
            setMessageInput('');
            setSendingMessage(false);
        },
        onError: (error) => {
            setSendingMessage(false);
            setIsAIResponding(false);
            setStartTime(null);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
            toast.error(error.message || 'ส่งข้อความไม่สำเร็จ');
        }
    });

    useEffect(() => {
        if (conversation?.id) {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }

            try {
                const unsubscribe = base44.agents.subscribeToConversation(
                    conversation.id,
                    (data) => {
                        setMessages(data.messages || []);
                        
                        // เช็คว่า AI ตอบเสร็จหรือยัง - ปรับเงื่อนไขใหม่
                        const lastMessage = data.messages?.[data.messages.length - 1];
                        if (lastMessage?.role === 'assistant') {
                            const hasRunningTools = lastMessage.tool_calls?.some(
                                tc => tc.status === 'running' || tc.status === 'in_progress' || !tc.status
                            );
                            
                            // ถือว่า AI ตอบเสร็จเมื่อ:
                            // 1. มี content และไม่มี running tools
                            // 2. หรือไม่มี tool_calls เลย และมี content
                            if (lastMessage.content && !hasRunningTools) {
                                setIsAIResponding(false);
                                setResponseTimeout(false);
                                
                                // Removed: message response time logic
                                
                                if (startTime) { // This `startTime` is for the current timer, not historical message timing
                                    setStartTime(null); // Stop the current timer
                                }
                                
                                if (timeoutRef.current) {
                                    clearTimeout(timeoutRef.current);
                                }
                            }
                        }
                    }
                );
                unsubscribeRef.current = unsubscribe;
            } catch (error) {
                toast.error('ไม่สามารถเชื่อมต่อกับการสนทนาได้');
            }

            return () => {
                if (unsubscribeRef.current) {
                    unsubscribeRef.current();
                }
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }
                if (timerIntervalRef.current) {
                    clearInterval(timerIntervalRef.current);
                }
            };
        }
    }, [conversation?.id, startTime]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = () => {
        if (!messageInput.trim() || !conversation || sendingMessage) return;
        
        if (messageCount >= MAX_MESSAGES_PER_MONTH) {
            toast.error(`คุณใช้งานครบ ${MAX_MESSAGES_PER_MONTH} ข้อความต่อเดือนแล้ว กรุณาติดต่อผู้พัฒนาระบบ`);
            return;
        }
        
        setSendingMessage(true);
        sendMessageMutation.mutate(messageInput.trim());
    };

    const handleResetConversation = async () => {
        try {
            setIsInitializing(true);
            localStorage.removeItem('ai_conversation_id');
            
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
            
            setStartTime(null);
            setCurrentResponseTime(0);
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const newConv = await base44.agents.createConversation({
                agent_name: agentName,
                metadata: {
                    name: `การสนทนา ${new Date().toLocaleDateString('th-TH')}`,
                    description: 'สอบถามข้อมูลหอพัก',
                }
            });
            
            setConversation(newConv);
            setMessages([]);
            setIsAIResponding(false);
            setResponseTimeout(false);
            localStorage.setItem('ai_conversation_id', newConv.id);
            toast.success('เริ่มการสนทนาใหม่แล้ว');
        } catch (error) {
            toast.error('ไม่สามารถสร้างการสนทนาใหม่ได้');
        } finally {
            setIsInitializing(false);
        }
    };

    const handleRetry = () => {
        if (messageInput.trim()) {
            setResponseTimeout(false);
            handleSendMessage();
        }
    };

    const remainingCharacters = maxCharacters - messageInput.length;
    const remainingMessages = userRole === 'developer' ? 'Unlimited' : MAX_MESSAGES_PER_MONTH - messageCount;


    const exampleQuestions = [
        "มีห้องว่างกี่ห้อง",
        "รายได้เดือนนี้",
        "มีผู้เช่ากี่คน",
        "ค่าเช่าค้างชำระ",
        "แจ้งซ่อมกี่รายการ"
    ];

    const handleExampleClick = (question) => {
        if (remainingMessages !== 'Unlimited' && remainingMessages <= 0) {
            toast.error(`คุณใช้งานครบ ${MAX_MESSAGES_PER_MONTH} ข้อความต่อเดือนแล้ว กรุณาติดต่อผู้พัฒนาระบบ`);
            return;
        }
        setMessageInput(question);
    };

    // เช็คสิทธิ์ก่อนแสดง UI
    if (!hasAIAccess) {
        return (
            <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
                <div className="max-w-2xl mx-auto">
                    <Card className="bg-white/90 backdrop-blur-sm border-red-200 shadow-2xl">
                        <CardContent className="p-12 text-center">
                            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Lock className="w-12 h-12 text-red-600" />
                            </div>
                            <h2 className="text-3xl font-bold text-slate-800 mb-3">ไม่มีสิทธิ์เข้าถึง AI ผู้ช่วย</h2>
                            <p className="text-slate-600 mb-6 text-lg">
                                คุณไม่มีสิทธิ์ในการใช้งาน AI ผู้ช่วย กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์
                            </p>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                                <p className="text-sm text-blue-800">
                                    💡 <strong>คำแนะนำ:</strong> ติดต่อเจ้าของหอพักหรือผู้จัดการเพื่อขอสิทธิ์ "เข้าถึง AI ผู้ช่วย"
                                </p>
                            </div>
                            <Button
                                onClick={() => navigate(createPageUrl('Dashboard'))}
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                            >
                                กลับไปหน้าแดชบอร์ด
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <Bot className="w-8 h-8 text-blue-600" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">AI ผู้ช่วย</h1>
                            <p className="text-sm text-gray-500">
                                ถามคำถามสั้นๆ ได้เลย 
                                {isAIResponding && currentResponseTime > 0 && (
                                    <span className="ml-2 text-blue-600 font-semibold animate-pulse">
                                        (กำลังคิด... {currentResponseTime.toFixed(1)}s)
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={handleResetConversation}
                        variant="outline"
                        size="sm"
                        disabled={isInitializing}
                        className="rounded-xl"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        เริ่มใหม่
                    </Button>
                </div>

                {/* เพิ่มคำเตือนเมื่อ timeout */}
                {responseTimeout && (
                    <div className="mb-4 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                        <div className="flex items-start gap-3">
                            <Clock className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm text-red-800 font-semibold mb-2">
                                    ⚠️ AI ใช้เวลานานเกินไป (เกิน 1 นาที)
                                </p>
                                <p className="text-xs text-red-700 mb-3">
                                    <strong>แนะนำ:</strong> ลองแบ่งคำถามเป็นส่วนย่อยๆ เช่น:<br/>
                                    • แทนที่จะถาม "วิเคราะห์รายได้ทั้งปี" → ถาม "รายได้เดือนนี้"<br/>
                                    • แทนที่จะถาม "สรุปทุกอย่าง" → ถาม "มีห้องว่างกี่ห้อง" หรือ "รายได้-รายจ่ายเดือนนี้"
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={handleRetry}
                                        size="sm"
                                        className="bg-red-600 hover:bg-red-700"
                                    >
                                        ลองใหม่อีกครั้ง
                                    </Button>
                                    <Button
                                        onClick={handleResetConversation}
                                        size="sm"
                                        variant="outline"
                                        className="border-red-600 text-red-600"
                                    >
                                        เริ่มการสนทนาใหม่
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {remainingMessages !== 'Unlimited' && remainingMessages <= 20 && (
                    <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm text-amber-800 font-medium">
                                เหลือ {remainingMessages} / {MAX_MESSAGES_PER_MONTH} ข้อความ
                            </p>
                            {remainingMessages === 0 && (
                                <p className="text-xs text-amber-700 mt-1">
                                    หากต้องการเพิ่มโควต้า กรุณาติดต่อผู้พัฒนาระบบ
                                </p>
                            )}
                        </div>
                    </div>
                )}

                <Card className="shadow-xl border-0 bg-white">
                    <CardContent className="p-0">
                        {isInitializing ? (
                            <div className="flex flex-col items-center justify-center p-12">
                                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3" />
                                <p className="text-sm text-gray-600">กำลังเตรียม AI ผู้ช่วย...</p>
                            </div>
                        ) : (
                            <>
                                <div className="min-h-[300px] max-h-[500px] overflow-y-auto p-6 bg-white">
                                    {!messageInput.trim() && messages.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full py-12">
                                            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                                                <Bot className="w-10 h-10 text-blue-600" />
                                            </div>
                                            
                                            <p className="text-center text-gray-700 mb-8 max-w-md">
                                                เริ่มสนทนาด้วยคำถามของคุณ หรือเลือกคำถามด่วน
                                            </p>
                                            
                                            <div className="w-full max-w-2xl">
                                                <p className="text-center text-gray-600 mb-4 font-medium">คำถามด่วน:</p>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {exampleQuestions.map((question, index) => (
                                                        <button
                                                            key={index}
                                                            onClick={() => handleExampleClick(question)}
                                                            disabled={remainingMessages !== 'Unlimited' && remainingMessages <= 0}
                                                            className="text-left px-4 py-3 bg-white hover:bg-blue-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed rounded-xl border border-gray-200 hover:border-blue-300 transition-all text-sm text-blue-600 font-medium shadow-sm hover:shadow"
                                                        >
                                                            {question}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {messages.map((msg, idx) => {
                                                const isLastMessage = idx === messages.length - 1;
                                                const shouldShowStreaming = isLastMessage && msg.role === 'assistant' && isAIResponding;
                                                
                                                return (
                                                    <MessageBubble 
                                                        key={idx} 
                                                        message={msg} 
                                                        isStreaming={shouldShowStreaming}
                                                    />
                                                );
                                            })}
                                            
                                            {/* แสดง loading พร้อม timer เมื่อ AI กำลังตอบ */}
                                            {isAIResponding && 
                                             messages.length > 0 && 
                                             messages[messages.length - 1]?.role === 'user' && 
                                             !responseTimeout && (
                                                <div className="flex gap-3 justify-start mb-4">
                                                    <div className="h-8 w-8 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
                                                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                                                    </div>
                                                    <div className="bg-white border border-gray-200 rounded-lg px-4 py-2.5">
                                                        <div className="flex items-center gap-2">
                                                            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                                            <span className="text-sm text-gray-600">
                                                                กำลังคิด... {currentResponseTime > 0 && (
                                                                    <span className="font-semibold text-blue-600">
                                                                        {currentResponseTime.toFixed(1)}s
                                                                    </span>
                                                                )}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            <div ref={messagesEndRef} />
                                        </>
                                    )}
                                </div>

                                <div className="border-t bg-white p-4 rounded-b-2xl">
                                    <div className="flex gap-3 items-end">
                                        <div className="flex-1">
                                            <Textarea
                                                value={messageInput}
                                                onChange={(e) => {
                                                    if (e.target.value.length <= maxCharacters) {
                                                        setMessageInput(e.target.value);
                                                    }
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        if (!sendingMessage && messageInput.trim() && (remainingMessages === 'Unlimited' || remainingMessages > 0) && !isAIResponding) {
                                                            handleSendMessage();
                                                        }
                                                    }
                                                }}
                                                placeholder="พิมพ์คำถาม..."
                                                rows={2}
                                                className="resize-none rounded-xl"
                                                disabled={sendingMessage || !messageInput.trim() || (remainingMessages !== 'Unlimited' && remainingMessages <= 0) || isAIResponding}
                                            />
                                            <div className="flex justify-between items-center mt-2 px-2">
                                                <p className={`text-xs ${
                                                    remainingMessages !== 'Unlimited' && remainingMessages <= 20 ? 'text-red-500 font-semibold' : 
                                                    remainingMessages !== 'Unlimited' && remainingMessages <= 50 ? 'text-orange-500' : 
                                                    'text-gray-400'
                                                }`}>
                                                    {remainingMessages === 'Unlimited' ? (
                                                        'ใช้งานได้ไม่จำกัด'
                                                    ) : (
                                                        `เหลือ ${remainingMessages} / ${MAX_MESSAGES_PER_MONTH} ข้อความในเดือนนี้`
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            onClick={handleSendMessage}
                                            disabled={sendingMessage || !messageInput.trim() || (remainingMessages !== 'Unlimited' && remainingMessages <= 0) || isAIResponding}
                                            className="bg-indigo-500 hover:bg-indigo-600 rounded-full h-14 w-14 flex items-center justify-center flex-shrink-0"
                                        >
                                            {sendingMessage || isAIResponding ? (
                                                <Loader2 className="w-5 h-5 text-white animate-spin" />
                                            ) : (
                                                <Send className="w-5 h-5 text-white" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {userRole === 'developer' && (
                    <div className="mt-4 text-center">
                        <p className="text-xs text-gray-500">
                            👨‍💻 Developer Mode: ใช้งานได้ไม่จำกัด
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
