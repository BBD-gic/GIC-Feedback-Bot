// FeedbackBot.jsx
import React, { useEffect, useState, useRef } from "react";
import "./feedback-bot.css";

export default function FeedbackBot() {
    const [chat, setChat] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPopup, setShowPopup] = useState(false);
    const [inputVisible, setInputVisible] = useState(true);
    const [hasStarted, setHasStarted] = useState(false);
    const messagesEndRef = useRef(null);

    const phone = new URLSearchParams(window.location.search).get("phone");

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const fetchNextQuestion = async (updatedChat) => {
        setLoading(true);
        try {
            const answers = [];
            for (let i = 0; i < updatedChat.length; i++) {
                if (updatedChat[i].sender === "bot" && i + 1 < updatedChat.length && updatedChat[i + 1].sender === "user") {
                    answers.push({ question: updatedChat[i].text, answer: updatedChat[i + 1].text });
                }
            }

            const res = await fetch("http://localhost:4000/next-question", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ answers, phone })
            });

            const data = await res.json();
            const botMsg = data.question || "Hmm... can you try that again?";
            const isEnding = botMsg.toLowerCase().includes("ending the conversation now");

            if (isEnding) {
                const [finalNote] = botMsg.split(/ending the conversation now/i);
                if (finalNote.trim()) {
                    setChat((prev) => [...prev, { sender: "bot", text: finalNote.trim() }]);
                }
                setInputVisible(false);
                setTimeout(() => setShowPopup(true), 5000);
            } else {
                setChat((prev) => [...prev, { sender: "bot", text: botMsg.trim() }]);
            }
        } catch (err) {
            console.error("Error getting next question:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!hasStarted) {
            setHasStarted(true);
            fetchNextQuestion([]);
        }
    }, [hasStarted]);

    useEffect(scrollToBottom, [chat]);

    const handleSend = () => {
        if (!input.trim() || loading) return;
        const userMessage = { sender: "user", text: input.trim() };
        const updatedChat = [...chat, userMessage];
        setChat(updatedChat);
        setInput("");
        fetchNextQuestion(updatedChat);
    };

    return (
        <div className="chat-container">
            <div className="chat-header">
                <div className="logo-wrap">
                    <img src="/bbd-logo-bw.png" alt="Logo" />
                </div>
                <h1 className="chat-title">Chat with Ragnar</h1>
            </div>

            <div className={`chat-window ${showPopup ? "blurred" : ""}`}>
                {chat.map((msg, idx) => (
                    <div key={idx} className={`chat-bubble ${msg.sender}`}>
                        {msg.text}
                    </div>
                ))}
                {loading && (
                    <div className="chat-bubble bot typing">
                        <span className="dot"></span>
                        <span className="dot"></span>
                        <span className="dot"></span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {inputVisible && (
                <div className="chat-input">
                    <input
                        type="text"
                        placeholder="Type your reply..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    />
                    <img
                        src="/send-button.png"
                        alt="Send"
                        className="send-button"
                        onClick={handleSend}
                    />
                </div>
            )}

            {showPopup && (
                <div className="thank-you-popup">
                    <div className="popup-logo">
                        <img src="/bbd-logo-bw.png" alt="BBD Logo" />
                    </div>
                    <div className="popup-text">
                        <h2>Thanks for chatting!</h2>
                        <p>We loved hearing your thoughts about the camp. See you next time!</p>
                    </div>
                </div>
            )}
        </div>
    );
}
