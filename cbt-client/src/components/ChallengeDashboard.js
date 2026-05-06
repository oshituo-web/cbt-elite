import { MultiplayerService } from '../services/multiplayerService'
import { ModalService } from '../services/ModalService'

export const ChallengeDashboard = {
    _room: null,
    _questions: [],
    _profile: null,
    _currentQuestionIndex: 0,
    _score: 0,
    _answersSubmitted: 0,
    _timer: null,
    _onBack: null,

    async render(profile, onBack) {
        this._profile = profile;
        this._onBack = onBack;

        const container = document.getElementById('dashboard-container');
        container.style.display = 'block';
        container.innerHTML = `
        <style>
            .challenge-wrapper {
                max-width: 720px;
                margin: 0 auto;
                padding: calc(var(--header-height) + 1.5rem) 1rem 6rem;
                animation: slideUpFade 0.5s ease;
            }
            .race-bar-track {
                height: 10px;
                background: rgba(255,255,255,0.06);
                border-radius: 10px;
                overflow: hidden;
                flex: 1;
            }
            .race-bar-fill {
                height: 100%;
                border-radius: 10px;
                background: var(--accent-gradient);
                transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            .challenge-option-btn {
                width: 100%;
                text-align: left;
                padding: 1rem 1.25rem;
                border-radius: 14px;
                background: rgba(255,255,255,0.04);
                border: 1.5px solid var(--glass-border);
                color: var(--text-primary);
                font-size: 0.95rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                font-family: 'Outfit', sans-serif;
                display: flex;
                align-items: center;
                gap: 0.85rem;
            }
            .challenge-option-btn:hover:not(:disabled) {
                border-color: var(--accent-primary);
                background: rgba(37, 99, 235, 0.08);
                transform: translateX(4px);
            }
            .challenge-option-btn.correct {
                border-color: var(--success);
                background: rgba(16, 185, 129, 0.12);
            }
            .challenge-option-btn.wrong {
                border-color: var(--error);
                background: rgba(239, 68, 68, 0.1);
                opacity: 0.6;
            }
            .option-label {
                width: 28px;
                height: 28px;
                border-radius: 8px;
                background: rgba(255,255,255,0.07);
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 900;
                font-size: 0.75rem;
                flex-shrink: 0;
            }
        </style>

        <div class="challenge-wrapper">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <h1 style="font-family: 'Outfit'; font-weight: 900; font-size: 1.75rem; color: var(--text-primary); margin: 0;">⚔️ Challenge Mode</h1>
                    <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.2rem;">Compete live against friends in real time</p>
                </div>
                <button id="challenge-back-btn" class="header-icon-btn" title="Back" style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 12px; background: rgba(255,255,255,0.08); border: 1px solid var(--glass-border); color: var(--text-primary);">
                    <i data-lucide="arrow-left" style="width: 22px; stroke-width: 3px;"></i>
                </button>
            </div>

            <!-- Lobby Options -->
            <div id="challenge-lobby" style="display: grid; gap: 1.5rem;">
                <!-- Create Room Card -->
                <div class="glass card" style="padding: 2rem; border-radius: 24px; border: 2px solid rgba(37,99,235,0.25); background: linear-gradient(135deg, rgba(37,99,235,0.06), rgba(124,58,237,0.04));">
                    <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
                        <div style="background: var(--accent-gradient); width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <i data-lucide="plus-circle" style="color: white; width: 24px;"></i>
                        </div>
                        <div>
                            <h2 style="font-family: 'Outfit'; font-weight: 900; font-size: 1.25rem; margin: 0; color: var(--text-primary);">Create a Room</h2>
                            <p style="color: var(--text-secondary); font-size: 0.8rem; margin: 0.2rem 0 0;">Pick a subject, get a code, share it with friends</p>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem;">
                        <div>
                            <label style="font-size: 0.7rem; font-weight: 800; color: var(--accent-primary); text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 0.5rem;">Subject</label>
                            <select id="create-subject" class="glass-select" style="width: 100%; height: 44px;">
                                <option value="Mathematics">Mathematics</option>
                                <option value="English">English</option>
                                <option value="Physics">Physics</option>
                                <option value="Chemistry">Chemistry</option>
                                <option value="Biology">Biology</option>
                                <option value="Economics">Economics</option>
                                <option value="Government">Government</option>
                                <option value="Literature">Literature</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size: 0.7rem; font-weight: 800; color: var(--accent-primary); text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 0.5rem;">Exam Type</label>
                            <select id="create-exam-type" class="glass-select" style="width: 100%; height: 44px;">
                                <option value="JAMB">JAMB</option>
                                <option value="WAEC">WAEC</option>
                            </select>
                        </div>
                    </div>
                    <button id="create-room-btn" class="btn-primary" style="width: 100%; height: 52px; font-weight: 900; font-size: 1rem; border-radius: 14px; background: var(--accent-gradient);">
                        CREATE ROOM & GET CODE
                    </button>
                </div>

                <!-- Join Room Card -->
                <div class="glass card" style="padding: 2rem; border-radius: 24px; border: 2px solid rgba(124,58,237,0.2);">
                    <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
                        <div style="background: linear-gradient(135deg, #7c3aed, #6d28d9); width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <i data-lucide="log-in" style="color: white; width: 24px;"></i>
                        </div>
                        <div>
                            <h2 style="font-family: 'Outfit'; font-weight: 900; font-size: 1.25rem; margin: 0; color: var(--text-primary);">Join a Room</h2>
                            <p style="color: var(--text-secondary); font-size: 0.8rem; margin: 0.2rem 0 0;">Enter a 6-digit code from your friend</p>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.75rem;">
                        <input type="text" id="join-room-code" maxlength="6" placeholder="ENTER CODE" class="glass-input" 
                            style="flex: 1; height: 52px; text-align: center; font-size: 1.5rem; font-weight: 900; letter-spacing: 0.25em; text-transform: uppercase; font-family: 'Outfit';">
                        <button id="join-room-btn" class="btn-secondary" style="height: 52px; padding: 0 1.5rem; font-weight: 900; border-radius: 14px; border-color: var(--accent-secondary); color: var(--accent-secondary); white-space: nowrap;">
                            JOIN →
                        </button>
                    </div>
                </div>
            </div>

            <!-- Waiting Room (hidden by default) -->
            <div id="challenge-waiting-room" style="display: none;">
            </div>

            <!-- Live Game Area (hidden by default) -->
            <div id="challenge-game-area" style="display: none;">
            </div>
        </div>
        `;

        if (window.lucide) window.lucide.createIcons({ root: container });
        this._attachLobbyListeners();
    },

    _attachLobbyListeners() {
        document.getElementById('challenge-back-btn').onclick = () => {
            MultiplayerService.unsubscribe();
            this._onBack?.();
        };

        document.getElementById('create-room-btn').onclick = () => this._createRoom();
        document.getElementById('join-room-btn').onclick = () => this._joinRoom();

        const codeInput = document.getElementById('join-room-code');
        if (codeInput) {
            codeInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this._joinRoom();
            });
        }
    },

    async _createRoom() {
        const btn = document.getElementById('create-room-btn');
        const subject = document.getElementById('create-subject').value;
        const examType = document.getElementById('create-exam-type').value;

        btn.disabled = true;
        btn.innerHTML = '<div class="loader-spinner" style="width:20px;height:20px;margin:0 auto;"></div>';

        try {
            const room = await MultiplayerService.createRoom(this._profile, subject, examType, 20);
            this._room = room;
            this._showWaitingRoom(room, true);
        } catch (err) {
            ModalService.alert('Error', err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'CREATE ROOM & GET CODE';
        }
    },

    async _joinRoom() {
        const btn = document.getElementById('join-room-btn');
        const code = document.getElementById('join-room-code')?.value?.trim().toUpperCase();

        if (!code || code.length < 4) return ModalService.alert('Invalid Code', 'Please enter a valid room code.', 'warning');

        btn.disabled = true;
        btn.textContent = 'Joining...';

        try {
            const { room, questions } = await MultiplayerService.joinRoom(code, this._profile);
            this._room = room;
            this._questions = questions;
            this._showWaitingRoom(room, false);
        } catch (err) {
            ModalService.alert('Error', err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'JOIN →';
        }
    },

    _showWaitingRoom(room, isHost) {
        document.getElementById('challenge-lobby').style.display = 'none';
        const waitingDiv = document.getElementById('challenge-waiting-room');
        waitingDiv.style.display = 'block';

        waitingDiv.innerHTML = `
            <div class="glass card" style="padding: 2.5rem; border-radius: 24px; text-align: center; border: 2px solid rgba(37,99,235,0.3);">
                <div style="font-size: 0.7rem; font-weight: 800; color: var(--accent-primary); text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 0.75rem;">Waiting for Players</div>
                <div style="font-family: 'Outfit'; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">Share this code with your friend</div>
                <div style="font-family: 'Outfit'; font-size: 3.5rem; font-weight: 900; color: var(--text-primary); letter-spacing: 0.25em; background: rgba(255,255,255,0.04); padding: 1rem 2rem; border-radius: 20px; border: 2px dashed rgba(255,255,255,0.1); margin-bottom: 0.75rem;">
                    ${room.room_code}
                </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 2.5rem;">Subject: <strong>${room.subject}</strong> · Exam: <strong>${room.exam_type}</strong> · ${room.question_count} Questions</div>
                
                <div id="waiting-participants" style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 2rem; max-width: 320px; margin-left: auto; margin-right: auto;"></div>
                
                ${isHost ? `
                <button id="start-challenge-btn" class="btn-primary" style="width: 100%; height: 56px; font-weight: 900; font-size: 1.1rem; background: var(--accent-gradient); border-radius: 16px; margin-bottom: 1rem;" disabled>
                    🚀 START CHALLENGE
                </button>` : `
                <div style="display: flex; align-items: center; gap: 0.75rem; justify-content: center; color: var(--text-secondary); font-weight: 600;">
                    <div class="loader-spinner" style="width: 18px; height: 18px;"></div>
                    Waiting for host to start...
                </div>`}
                <button id="leave-room-btn" class="btn-secondary" style="width: 100%; height: 44px; font-weight: 700; opacity: 0.7;">
                    ← Leave Room
                </button>
            </div>
        `;

        // Subscribe to real-time participant updates
        MultiplayerService.subscribeToRoom(room.id, (participants, roomUpdate) => {
            if (roomUpdate?.status === 'active') {
                // Host started! Begin game for everyone
                this._beginGame();
                return;
            }
            if (participants) this._renderParticipants(participants, isHost);
        });

        // Fetch initial participants
        MultiplayerService.getLeaderboard(room.id).then(p => this._renderParticipants(p, isHost));

        // Event listeners
        if (isHost) {
            document.getElementById('start-challenge-btn').onclick = async () => {
                const startBtn = document.getElementById('start-challenge-btn');
                startBtn.disabled = true;
                startBtn.textContent = 'Starting...';
                try {
                    await MultiplayerService.startChallenge(room.id, this._profile.id);
                    // Fetch questions for host (they didn't join via joinRoom)
                    const { questions } = await MultiplayerService.joinRoom(room.room_code, this._profile);
                    this._questions = questions;
                    this._beginGame();
                } catch (err) {
                    ModalService.alert('Error', err.message, 'error');
                    startBtn.disabled = false;
                    startBtn.textContent = '🚀 START CHALLENGE';
                }
            };
        }

        document.getElementById('leave-room-btn').onclick = () => {
            MultiplayerService.unsubscribe();
            document.getElementById('challenge-lobby').style.display = 'grid';
            waitingDiv.style.display = 'none';
            waitingDiv.innerHTML = '';
        };
    },

    _renderParticipants(participants, isHost) {
        const container = document.getElementById('waiting-participants');
        if (!container) return;

        container.innerHTML = participants.map((p, i) => `
            <div style="display: flex; align-items: center; gap: 1rem; padding: 0.85rem 1.25rem; background: rgba(255,255,255,0.04); border-radius: 12px; border: 1px solid var(--glass-border);">
                <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.9rem; color: white; flex-shrink: 0; overflow: hidden;">
                    ${p.avatar_url ? `<img src="${p.avatar_url}" style="width:100%;height:100%;object-fit:cover;">` : p.display_name?.[0]?.toUpperCase() || '?'}
                </div>
                <span style="font-weight: 700; color: var(--text-primary); font-size: 0.9rem; flex: 1;">${p.display_name || 'Anonymous'}</span>
                ${i === 0 ? `<span style="font-size: 0.65rem; font-weight: 800; color: #f59e0b; background: rgba(245,158,11,0.1); padding: 2px 8px; border-radius: 6px;">HOST</span>` : ''}
                <span style="font-size: 0.7rem; color: var(--success); font-weight: 700;">✓ READY</span>
            </div>
        `).join('') || '<div style="color: var(--text-secondary); font-size: 0.85rem;">Waiting for players...</div>';

        // Enable start button if ≥2 players
        const startBtn = document.getElementById('start-challenge-btn');
        if (startBtn) startBtn.disabled = participants.length < 2;
    },

    _beginGame() {
        this._currentQuestionIndex = 0;
        this._score = 0;
        this._answersSubmitted = 0;

        document.getElementById('challenge-waiting-room').style.display = 'none';
        const gameArea = document.getElementById('challenge-game-area');
        gameArea.style.display = 'block';
        gameArea.innerHTML = `
            <div id="challenge-leaderboard-bar" class="glass" style="padding: 1rem 1.5rem; border-radius: 16px; margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 0.6rem;"></div>
            <div id="challenge-question-card" class="glass card" style="padding: 2rem; border-radius: 20px;"></div>
        `;

        this._renderQuestion();

        // Start real-time leaderboard updates
        MultiplayerService.subscribeToRoom(this._room.id, (participants) => {
            if (participants) this._renderLeaderboardBar(participants);
        });
        MultiplayerService.getLeaderboard(this._room.id).then(p => this._renderLeaderboardBar(p));
    },

    _renderLeaderboardBar(participants) {
        const bar = document.getElementById('challenge-leaderboard-bar');
        if (!bar) return;
        const total = this._questions.length || 1;
        bar.innerHTML = participants.map((p, i) => {
            const pct = Math.min(100, Math.round((p.score / total) * 100));
            const isMe = p.user_id === this._profile.id;
            return `
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <span style="font-size: 0.7rem; font-weight: 900; color: var(--text-secondary); width: 18px; text-align: right;">#${i + 1}</span>
                    <span style="font-size: 0.8rem; font-weight: ${isMe ? '900' : '600'}; color: ${isMe ? 'var(--accent-primary)' : 'var(--text-primary)'}; width: 100px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.display_name || 'Player'}</span>
                    <div class="race-bar-track">
                        <div class="race-bar-fill" style="width: ${pct}%; background: ${isMe ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.15)'};">
                        </div>
                    </div>
                    <span style="font-size: 0.8rem; font-weight: 900; color: var(--text-primary); width: 30px; text-align: right;">${p.score}</span>
                    ${p.is_finished ? `<span style="font-size: 0.65rem; color: var(--success); font-weight: 800; white-space: nowrap;">DONE ✓</span>` : ''}
                </div>
            `;
        }).join('');
    },

    _renderQuestion() {
        const qCard = document.getElementById('challenge-question-card');
        if (!qCard) return;

        if (this._currentQuestionIndex >= this._questions.length) {
            return this._finishGame();
        }

        const q = this._questions[this._currentQuestionIndex];
        const answers = q.question_answers || q.answers || [];
        const labels = ['A', 'B', 'C', 'D'];
        const total = this._questions.length;

        qCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.75rem;">
                <span style="font-size: 0.7rem; font-weight: 800; color: var(--accent-primary); text-transform: uppercase; letter-spacing: 0.1em;">Question ${this._currentQuestionIndex + 1} of ${total}</span>
                <span style="font-size: 0.85rem; font-weight: 900; color: var(--text-primary);">Score: ${this._score}</span>
            </div>
            <div style="height: 4px; background: rgba(255,255,255,0.06); border-radius: 4px; margin-bottom: 2rem; overflow: hidden;">
                <div style="width: ${((this._currentQuestionIndex) / total) * 100}%; height: 100%; background: var(--accent-gradient); border-radius: 4px; transition: width 0.4s ease;"></div>
            </div>
            <p style="font-family: 'Outfit'; font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1.75rem; line-height: 1.6;">
                ${q.question_text || 'Question unavailable'}
            </p>
            <div id="options-container" style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${answers.map((a, i) => `
                    <button class="challenge-option-btn" data-answer-id="${a.id || i}" data-is-correct="${a.is_correct}">
                        <span class="option-label">${labels[i] || i + 1}</span>
                        <span>${a.answer_text || a.option_text || `Option ${labels[i]}`}</span>
                    </button>
                `).join('')}
            </div>
        `;

        // Attach option listeners
        qCard.querySelectorAll('.challenge-option-btn').forEach(btn => {
            btn.onclick = () => this._handleAnswer(btn, answers);
        });
    },

    async _handleAnswer(selectedBtn, answers) {
        // Disable all options immediately
        const allBtns = document.querySelectorAll('.challenge-option-btn');
        allBtns.forEach(b => b.disabled = true);

        const isCorrect = selectedBtn.dataset.isCorrect === 'true';

        // Visual feedback
        allBtns.forEach(b => {
            if (b.dataset.isCorrect === 'true') b.classList.add('correct');
        });
        if (!isCorrect) selectedBtn.classList.add('wrong');

        // Update score
        if (isCorrect) this._score++;
        this._answersSubmitted++;

        // Push score to Supabase Realtime
        const isLast = this._currentQuestionIndex + 1 >= this._questions.length;
        await MultiplayerService.submitScore(
            this._room.id,
            this._profile.id,
            this._score,
            this._answersSubmitted,
            isLast
        );

        // Move to next question after brief delay
        setTimeout(() => {
            this._currentQuestionIndex++;
            this._renderQuestion();
        }, isCorrect ? 800 : 1200);
    },

    async _finishGame() {
        const gameArea = document.getElementById('challenge-game-area');
        await MultiplayerService.submitScore(this._room.id, this._profile.id, this._score, this._answersSubmitted, true);

        const leaderboard = await MultiplayerService.getLeaderboard(this._room.id);
        const myRank = leaderboard.findIndex(p => p.user_id === this._profile.id) + 1;

        gameArea.innerHTML = `
            <div class="glass card scale-in" style="padding: 2.5rem; border-radius: 24px; text-align: center;">
                <div style="font-size: 3rem; margin-bottom: 0.5rem;">${myRank === 1 ? '🏆' : myRank === 2 ? '🥈' : '🥉'}</div>
                <div style="font-family: 'Outfit'; font-weight: 900; font-size: 2rem; color: var(--text-primary); margin-bottom: 0.25rem;">
                    ${myRank === 1 ? 'You Won!' : `You Ranked #${myRank}`}
                </div>
                <div style="color: var(--text-secondary); margin-bottom: 2rem; font-weight: 500;">
                    Final Score: <strong style="color: var(--accent-primary); font-size: 1.25rem;">${this._score}/${this._questions.length}</strong>
                </div>
                
                <h3 style="font-family: 'Outfit'; font-weight: 800; font-size: 1.1rem; margin-bottom: 1rem; text-align: left; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.75rem;">Final Leaderboard</h3>
                <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 2.5rem;">
                    ${leaderboard.map((p, i) => `
                        <div style="display: flex; align-items: center; gap: 1rem; padding: 0.85rem 1.25rem; background: ${p.user_id === this._profile.id ? 'rgba(37,99,235,0.1)' : 'rgba(255,255,255,0.03)'}; border-radius: 12px; border: 1px solid ${p.user_id === this._profile.id ? 'rgba(37,99,235,0.3)' : 'var(--glass-border)'};">
                            <span style="font-family: 'Outfit'; font-weight: 900; font-size: 1.1rem; color: ${i === 0 ? '#f59e0b' : 'var(--text-secondary)'}; width: 24px;">${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                            <span style="font-weight: 700; color: var(--text-primary); flex: 1;">${p.display_name || 'Player'}</span>
                            <span style="font-weight: 900; color: var(--accent-primary);">${p.score} pts</span>
                        </div>
                    `).join('')}
                </div>
                <button id="challenge-play-again-btn" class="btn-primary" style="width: 100%; height: 52px; font-weight: 900; background: var(--accent-gradient); margin-bottom: 0.75rem;">PLAY AGAIN</button>
                <button id="challenge-exit-btn" class="btn-secondary" style="width: 100%; height: 44px; font-weight: 700;">Exit to Dashboard</button>
            </div>
        `;

        if (window.lucide) window.lucide.createIcons({ root: gameArea });
        MultiplayerService.unsubscribe();

        document.getElementById('challenge-play-again-btn').onclick = () => this.render(this._profile, this._onBack);
        document.getElementById('challenge-exit-btn').onclick = () => this._onBack?.();
    }
};
