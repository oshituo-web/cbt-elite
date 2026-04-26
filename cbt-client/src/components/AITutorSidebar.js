import { AiService } from '../services/aiService'
import { ModalService } from '../services/ModalService'
import { DataService } from '../services/data'

export const AITutorSidebar = {
    isOpen: false,
    history: [],
    topic: null,
    subject: null,

    toggle(question, profile, topic = null, subject = null) {
        if (this.isOpen) {
            this.close();
        } else {
            this.open(question, profile, topic, subject);
        }
    },

    open(question, profile, topic = null, subject = null) {
        if (this.isOpen) {
            // If already open, just update context if context changed
            if (topic && this.topic !== topic) {
                this.topic = topic;
                this.subject = subject;
                this.currentQuestion = null;
                this.addMessage('system', `Elite AI is now focused on the topic: "${topic}".`);
            } else if (question && this.currentQuestion?.id !== question.id) {
                this.currentQuestion = question;
                this.topic = null;
                this.addMessage('system', `Elite AI is now focused on your current question.`);
            }
            return;
        }

        this.isOpen = true;
        this.currentQuestion = question;
        this.profile = profile;
        this.topic = topic;
        this.subject = subject;
        this.history = []; // Reset history for new session

        const sidebar = document.createElement('div');
        sidebar.id = 'ai-tutor-sidebar';
        sidebar.className = 'glass ai-tutor-sidebar active';
        
        let greeting = '';
        if (topic) {
            greeting = `Hello ${profile.username || 'Student'}! I'm your Elite AI Tutor. I see you're performing a <strong>Deep Dive into ${topic}</strong>. What would you like to clarify about this topic?`;
        } else if (question) {
            greeting = `Hello ${profile.username || 'Student'}! I'm your Elite AI Tutor. I see you're working on a <strong>${question.subject || 'Practice'}</strong> question. How can I help you understand this better?`;
        } else {
            greeting = `Hello ${profile.username || 'Student'}! I'm your Elite AI Tutor. How can I help you excel today?`;
        }
        
        sidebar.innerHTML = `
            <div class="sidebar-header">
                <div class="tutor-brand">
                    <div class="tutor-avatar pulse">
                        <i data-lucide="bot"></i>
                    </div>
                    <div>
                        <div class="tutor-name">Elite AI Tutor</div>
                        <div class="tutor-status">${topic ? 'Topic Expert' : 'Online & Ready'}</div>
                    </div>
                </div>
                <button id="close-tutor-btn" class="icon-btn">
                    <i data-lucide="x"></i>
                </button>
            </div>

            <div id="tutor-messages-container" class="messages-area">
                <div class="tutor-msg tutor">
                    <div class="msg-bubble">
                        ${greeting}
                    </div>
                </div>
            </div>

            <div class="quick-prompts">
                <button class="prompt-chip" data-prompt="Explain like I'm 5">👶 ELI5</button>
                <button class="prompt-chip" data-prompt="Give me a hint">💡 Hint</button>
                <button class="prompt-chip" data-prompt="Show step-by-step">🪜 Steps</button>
            </div>

            <div class="sidebar-footer">
                <div class="input-wrapper">
                    <textarea id="tutor-chat-input" placeholder="Ask anything..." rows="1"></textarea>
                    <button id="send-tutor-msg-btn" class="send-btn">
                        <i data-lucide="send"></i>
                    </button>
                </div>
                <div class="footer-meta">
                    <span class="credit-badge">
                        <i data-lucide="zap" style="width:10px;"></i>
                        Credits: <span id="tutor-credits-val">${profile.ai_credits || 0}</span>
                    </span>
                    <span class="session-label">${question.exam_type || 'Practice'} Mode</span>
                </div>
            </div>
        `;

        document.body.appendChild(sidebar);
        if (window.lucide) window.lucide.createIcons({ root: sidebar });

        // Add event listeners
        document.getElementById('close-tutor-btn').onclick = () => this.close();
        
        const input = document.getElementById('tutor-chat-input');
        input.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        };

        document.getElementById('send-tutor-msg-btn').onclick = () => this.sendMessage();

        // Prompt chips
        sidebar.querySelectorAll('.prompt-chip').forEach(btn => {
            btn.onclick = () => {
                input.value = btn.dataset.prompt;
                this.sendMessage();
            };
        });

        // Auto-focus input
        setTimeout(() => input.focus(), 300);
    },

    close() {
        this.isOpen = false;
        const sidebar = document.getElementById('ai-tutor-sidebar');
        if (sidebar) {
            sidebar.classList.remove('active');
            setTimeout(() => sidebar.remove(), 400);
        }
    },

    async sendMessage() {
        const input = document.getElementById('tutor-chat-input');
        const message = input.value.trim();
        if (!message) return;

        if ((this.profile.ai_credits || 0) <= 0) {
            ModalService.alert("Out of AI Credits", "You've used all your AI tutor credits. Visit the Elite Store to top up and keep chatting!", "info");
            return;
        }

        input.value = '';
        this.addMessage('user', message);
        
        const loadingId = 'loading-' + Date.now();
        this.addMessage('tutor', '<div class="typing-dots"><span></span><span></span><span></span></div>', loadingId);

        try {
            // Deduct credit
            const { error } = await DataService.useAICredit(this.profile.id, 'tutor_chat');
            if (error) throw error;
            
            this.profile.ai_credits--;
            this.updateCreditDisplay();

            const response = await AiService.tutorChat(this.currentQuestion, message, this.history, this.topic, this.subject);
            
            // Remove loading
            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) loadingEl.remove();

            this.addMessage('tutor', response);
        } catch (err) {
            console.error(err);
            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) loadingEl.innerHTML = '<div class="msg-bubble error">I encountered an error. Please try again.</div>';
        }
    },

    addMessage(role, content, id = null) {
        const container = document.getElementById('tutor-messages-container');
        if (!container) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = `tutor-msg ${role}`;
        if (id) msgDiv.id = id;

        // Simple markdown-to-html for bold and lists
        const formatted = role === 'tutor' ? content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>') : content;

        msgDiv.innerHTML = `<div class="msg-bubble">${formatted}</div>`;
        container.appendChild(msgDiv);
        
        // Scroll to bottom
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });

        if (role !== 'system') {
            this.history.push({ role, content });
        }
        return msgDiv;
    },

    updateCreditDisplay() {
        const el = document.getElementById('tutor-credits-val');
        if (el) el.innerText = this.profile.ai_credits;
    }
};
