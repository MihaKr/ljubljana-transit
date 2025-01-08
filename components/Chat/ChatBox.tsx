import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { sendMessageToDialogflow } from './DialogFlowService';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'system';
    timestamp: Date;
    queryParams?: Record<string, string>;
}

interface ChatBoxProps {
    onSendMessage: (message: string) => void;
}

const ChatBox = ({ onSendMessage }: ChatBoxProps) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            text: input,
            sender: 'user',
            timestamp: new Date(),
            queryParams: {
                timeZone: 'Europe/Paris',
            },
        };

        setMessages((prevMessages) => [...prevMessages, userMessage]);
        onSendMessage(input);
        setInput('');

        const botResponse = await sendMessageToDialogflow(input);

        const systemMessage: Message = {
            id: Date.now().toString(),
            text: botResponse,
            sender: 'system',
            timestamp: new Date(),
            queryParams: {
                timeZone: 'Europe/Paris',
            },
        };

        setMessages((prevMessages) => [...prevMessages, systemMessage]);
    };

    // Scroll to the bottom of the messages when new messages are added
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow border">
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex ${
                            message.sender === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                    >
                        <div
                            className={`max-w-[75%] p-3 rounded-lg ${
                                message.sender === 'user'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-100 text-gray-800'
                            }`}
                            style={{ whiteSpace: 'pre-wrap' }} // Ensuring text wraps properly
                        >
                            {message.text}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} /> {/* This div helps scroll to the bottom */}
            </div>

            {/* Input area */}
            <div className="border-t p-4 bg-white fixed bottom-0 left-0 right-0 z-10">
                <div className="flex space-x-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask about bus routes..."
                        className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        onClick={handleSend}
                        className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <Send size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatBox;
