import { DataService } from '../services/data'
import { AuthService } from '../services/auth'
import { WeeklyRecapComponent } from './WeeklyRecap'

export const DashboardComponent = {
  profile: null,
  onStartExam: null,

  async render(profile, onStartExam, onOpenAdmin) {
    this.profile = profile
    this.onStartExam = onStartExam
    this.onOpenAdmin = onOpenAdmin
    const container = document.getElementById('dashboard-container')
    container.style.display = 'block'
    
    container.innerHTML = `
      <header class="flex-between" style="padding: 1.5rem 0; border-bottom: 1px solid var(--glass-border);">
        <h1 style="font-family: 'Outfit'; font-size: 1.5rem; color: var(--accent-primary);">CBT Elite</h1>

        <div style="display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 1rem;">
          <button id="help-guide-btn" class="glass" style="padding: 0; font-size: 1.25rem; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--accent-secondary); color: var(--accent-secondary);">❔</button>
          <button id="theme-toggle" class="glass" style="padding: 0; font-size: 1.25rem; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">🌓</button>
          ${(profile.role !== 'student' || profile.username === 'tester') ? '<button id="admin-panel-btn" class="btn-admin">Admin Control</button>' : ''}
          <div style="display: flex; gap: 1rem; align-items: center;">
            <div id="user-tier-badge" style="padding: 0.25rem 0.6rem; border-radius: 4px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; background: ${profile.tier === 'premium' ? 'var(--accent-secondary)' : 'var(--border-color)'}; color: white;">
              ${profile.tier || 'FREE'}
            </div>
            <span style="font-size: 0.875rem;">Welcome, <strong>${profile.username}</strong></span>
            ${profile.tier !== 'premium' ? '<button id="upgrade-btn" class="primary" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; border-radius: 6px;">✨ Upgrade</button>' : ''}
            <button id="logout-btn" class="btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.875rem;">Logout</button>
          </div>
        </div>
      </header>

      <div id="dashboard-content" style="margin-top: 2rem;">
        
        <!-- Feature Carousel -->
        <div id="feature-carousel" class="glass card" style="position: relative; overflow: hidden; margin-bottom: 2rem; height: 180px; border: none; padding: 0;">
          <div id="carousel-slides" style="display: flex; height: 100%; transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);">
             <div class="carousel-slide" style="min-width: 100%; position: relative;">
                <img src="/img/app_tour_analysis.png" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.4;">
                <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 1.5rem; background: linear-gradient(transparent, rgba(0,0,0,0.8));">
                  <h3 style="font-family: 'Outfit'; color: #fff; margin-bottom: 0.25rem;">Topic-Based Analysis</h3>
                  <p style="color: #e2e8f0; font-size: 0.8rem;">Master every subject with granular performance tracking.</p>
                </div>
             </div>
             <div class="carousel-slide" style="min-width: 100%; position: relative;">
                <img src="/img/app_tour_ai_tutor.png" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.4;">
                <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 1.5rem; background: linear-gradient(transparent, rgba(0,0,0,0.8));">
                  <h3 style="font-family: 'Outfit'; color: #fff; margin-bottom: 0.25rem;">AI-Powered Insights</h3>
                  <p style="color: #e2e8f0; font-size: 0.8rem;">Located in 'Performance Insights' – get deep analysis on weak points.</p>
                </div>
             </div>
             <div class="carousel-slide" style="min-width: 100%; position: relative;">
                <img src="/img/testimonial_avatars.png" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.4;">
                <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 1.5rem; background: linear-gradient(transparent, rgba(0,0,0,0.8));">
                  <h3 style="font-family: 'Outfit'; color: #fff; margin-bottom: 0.25rem;">Success Stories</h3>
                  <p style="color: #e2e8f0; font-size: 0.8rem;">Join thousands of students who aced JAMB & WAEC with CBT Elite.</p>
                </div>
             </div>
             <div class="carousel-slide" style="min-width: 100%; position: relative;">
                <img src="/img/app_tour_exam_setup.png" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.4;">
                <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 1.5rem; background: linear-gradient(transparent, rgba(0,0,0,0.8));">
                  <h3 style="font-family: 'Outfit'; color: #fff; margin-bottom: 0.25rem;">Guided Professional Prep</h3>
                  <p style="color: #e2e8f0; font-size: 0.8rem;">Captions and snapshots to help you navigate the app effortlessly.</p>
                </div>
             </div>
          </div>
          <div style="position: absolute; top: 50%; transform: translateY(-50%); width: 100%; display: flex; justify-content: space-between; padding: 0 0.5rem; pointer-events: none;">
            <button id="prev-slide" class="glass" style="width: 32px; height: 32px; border-radius: 50%; pointer-events: auto; cursor: pointer; border: 1px solid var(--glass-border); font-size: 0.8rem;">←</button>
            <button id="next-slide" class="glass" style="width: 32px; height: 32px; border-radius: 50%; pointer-events: auto; cursor: pointer; border: 1px solid var(--glass-border); font-size: 0.8rem;">→</button>
          </div>
        </div>

        <!-- News Section -->
        <div class="glass card" style="margin-bottom: 2rem; padding: 1.25rem; overflow: hidden; background: var(--bg-secondary)4D;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <h3 style="font-family: 'Outfit'; display: flex; align-items: center; gap: 0.5rem; font-size: 1rem;">
              🔔 Latest Exam News
            </h3>
            <span style="font-size: 0.6rem; text-transform: uppercase; color: var(--accent-primary); font-weight: 800; letter-spacing: 0.05em;">Auto-updating</span>
          </div>
          <div id="news-ticker-container" style="height: 60px; position: relative;">
            <div id="news-ticker" style="position: absolute; width: 100%; transition: top 0.5s ease-in-out; top: 0;">
              <div class="news-item" style="padding: 0.75rem; border-radius: 8px; background: var(--bg-secondary); margin-bottom: 0.5rem; border-left: 4px solid var(--accent-primary); cursor: pointer;">
                <p style="font-size: 0.75rem; margin-top: 0.25rem;"><strong style="color: var(--accent-primary);">JAMB 2026:</strong> Registration starts Jan 15th. Ensure NIN has been updated for verification.</p>
              </div>
              <div class="news-item" style="padding: 0.75rem; border-radius: 8px; background: var(--bg-secondary); margin-bottom: 0.5rem; border-left: 4px solid var(--accent-secondary); cursor: pointer;">
                <p style="font-size: 0.75rem; margin-top: 0.25rem;"><strong style="color: var(--accent-secondary);">WAEC Timetable:</strong> Official Timetable available. Practice kicks off early April.</p>
              </div>
              <div class="news-item" style="padding: 0.75rem; border-radius: 8px; background: var(--bg-secondary); margin-bottom: 0.5rem; border-left: 4px solid var(--success); cursor: pointer;">
                <p style="font-size: 0.75rem; margin-top: 0.25rem;"><strong style="color: var(--success);">NECO Registration:</strong> Schools to upload data before March 30th deadline.</p>
              </div>
            </div>
          </div>
        </div>
        <div class="dashboard-tabs" style="display: flex; gap: 1rem; margin-bottom: 2rem;">
          <button id="view-practice" class="nav-tab active" style="flex: 1;">🎯 Practice Mode</button>
          <button id="view-exam" class="nav-tab" style="flex: 1;">🏆 Exam Mode</button>
        </div>

        <div id="resume-container" style="display: none; margin-bottom: 2rem;">
          <div class="glass card" style="border-left: 4px solid var(--accent-secondary); background: var(--bg-secondary); display: flex; justify-content: space-between; align-items: center; padding: 1.5rem;">
            <div>
              <h3 style="margin-bottom: 0.25rem;">Resume Unfinished Session</h3>
              <p id="resume-info" style="font-size: 0.85rem; color: var(--text-secondary);">You have a pending exam from 2 minutes ago.</p>
            </div>
            <div style="display: flex; gap: 0.75rem;">
              <button id="discard-resume" class="btn-secondary" style="font-size: 0.8rem;">Discard</button>
              <button id="confirm-resume" class="btn-primary">Resume Now</button>
            </div>
          </div>
        </div>

        <!-- Practice Mode Section -->
        <div id="practice-section">
          <h2 style="font-family: 'Outfit'; font-size: 1.25rem; margin-bottom: 1rem;">Choose Your Exam Type</h2>
          <div class="dashboard-grid">

            <div class="glass card practice-tier" data-exam="JAMB" style="border-top: 4px solid var(--accent-primary); cursor: pointer;">

              <h3>JAMB Practice</h3>
              <p style="font-size: 0.875rem;">Topic-based objective practice</p>
            </div>
            <div class="glass card practice-tier" data-exam="WAEC" style="border-top: 4px solid var(--accent-secondary); cursor: pointer;">
              <h3>WAEC Practice</h3>
              <p style="font-size: 0.875rem;">Objective & Theory support</p>
            </div>
            <div class="glass card practice-tier" data-exam="NECO" style="border-top: 4px solid var(--success); cursor: pointer;">
              <h3>NECO Practice</h3>
              <p style="font-size: 0.875rem;">Objective & Theory support</p>
            </div>
          </div>

          <!-- Practice Config (hidden initially) -->
          <div id="practice-config" class="glass card" style="display: none; margin-top: 2rem; padding: 2rem;">
            <h3 id="practice-title" style="margin-bottom: 1.5rem;">Configure Practice</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
              <div>
                <label style="display: block; font-size: 0.875rem; margin-bottom: 0.5rem;">Subject</label>
                <select id="p-subject" class="glass-select" style="width: 100%;"></select>
              </div>
              <div id="p-topic-wrapper">
                <label style="display: block; font-size: 0.875rem; margin-bottom: 0.5rem;">Topic</label>
                <select id="p-topic" class="glass-select" style="width: 100%;">
                  <option value="">All Topics</option>
                </select>
              </div>
              <div id="p-type-wrapper" style="display: none;">
                <label style="display: block; font-size: 0.875rem; margin-bottom: 0.5rem;">Question Type</label>
                <select id="p-type" class="glass-select" style="width: 100%;">
                  <option value="objective">Objective</option>
                  <option value="theory">Theory</option>
                </select>
              </div>
            </div>
            <button id="p-start-btn" class="primary" style="margin-top: 2rem; width: 100%;">Start Practice Session</button>
          </div>
        </div>

        <!-- Exam Mode Section -->
        <div id="exam-section" style="display: none;">
          <h2 style="font-family: 'Outfit'; font-size: 1.25rem; margin-bottom: 1rem;">Structured Mock Exams</h2>
          <div class="dashboard-grid">
            <div class="glass card exam-tier" data-exam="JAMB" style="border-top: 4px solid var(--primary); cursor: pointer;">
              <h3>JAMB Mock</h3>
              <p style="font-size: 0.875rem; color: var(--text-primary);">180 Questions | 120 Mins</p>
            </div>
            <div class="glass card exam-tier" data-exam="WAEC" style="border-top: 4px solid var(--accent-secondary); cursor: pointer;">
              <h3>WAEC Mock</h3>
              <p style="font-size: 0.875rem; color: var(--text-primary);">Standard Full Exam</p>
            </div>
            <div class="glass card exam-tier" data-exam="NECO" style="border-top: 4px solid var(--success); cursor: pointer;">
              <h3>NECO Mock</h3>
              <p style="font-size: 0.875rem; color: var(--text-primary);">Standard Full Exam</p>
            </div>
          </div>

          <!-- Exam Config -->
          <div id="exam-config" class="glass card" style="display: none; margin-top: 2rem; padding: 2rem;">
            <h3 id="exam-title" style="margin-bottom: 1.5rem;">Setup Mock Exam</h3>
            
            <div id="jamb-exam-config" style="display: none;">
                <p style="margin-bottom: 1rem; color: var(--primary);">English is mandatory. Select 3 additional subjects.</p>
                <div id="jamb-sub-list" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; max-height: 200px; overflow-y: auto; padding: 1rem; background: var(--bg-color); border-radius: 8px;">
                    <!-- Checkboxes for subjects -->
                </div>
            </div>

            <div id="waec-neco-exam-config" style="display: none;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                    <div>
                        <label style="display: block; font-size: 0.875rem; margin-bottom: 0.5rem; color: var(--text-primary);">Subject</label>
                        <select id="e-subject" class="glass-select" style="width: 100%;"></select>
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.875rem; margin-bottom: 0.5rem; color: var(--text-primary);">Type</label>
                        <select id="e-type" class="glass-select" style="width: 100%;">
                            <option value="objective">Objective</option>
                            <option value="theory">Theory</option>
                        </select>
                    </div>
                </div>
            </div>

            <button id="e-start-btn" class="primary" style="margin-top: 2rem; width: 100%;">Begin Mock Exam</button>
          </div>
        </div>

        <!-- Saved & Rankings -->
        <div class="dashboard-grid" style="margin-top: 3rem;">
          <div class="glass card" style="border-left: 4px solid var(--primary);">
            <h3 style="color: var(--text-primary);">Save Questions</h3>
            <div id="bookmark-count" style="font-size: 1.5rem; font-weight: bold; margin: 1rem 0; color: var(--text-primary);">0</div>
            <button class="btn-secondary" id="start-saved" disabled>Review Question</button>
          </div>
          <div class="glass card" style="border-left: 4px solid var(--success);">
            <h3>Leadership</h3>
            <p style="margin: 1rem 0; font-size: 0.875rem; color: var(--text-primary);">See how you rank globally</p>
            <button class="btn-secondary" id="view-leaderboard">View Ranking</button>
          </div>
        </div>

        <!-- Phase 3: Analytics Section -->
        <div id="analytics-section" style="margin-top: 3rem;">
          <h2 style="font-family: 'Outfit'; font-size: 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
            📊 Performance Insights
          </h2>
          <div class="analytics-grid">
            <div class="glass card" style="padding: 1.5rem;">
              <h4 style="margin-bottom: 1rem; color: var(--accent-primary);">Score History (Last 20 Sessions)</h4>
              <canvas id="score-history-chart" height="250"></canvas>
            </div>
            <div class="glass card" style="padding: 1.5rem;">
              <h4 style="margin-bottom: 1rem; color: var(--success);">Subject Mastery (%)</h4>
              <canvas id="subject-mastery-chart" height="250"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Leaderboard Modal -->
      <div id="leaderboard-modal" class="modal-overlay" style="display: none; align-items: center; justify-content: center; padding: 1rem;">
        <div class="modal-content glass" style="max-width: 500px; width: 100%; position: relative; padding: 2rem;">
          <button id="close-leaderboard" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-primary);">&times;</button>
          <h2 style="font-family: 'Outfit'; margin-bottom: 1.5rem; text-align: center; color: var(--accent-primary);">🏆 Global Rankings</h2>
          <div id="leaderboard-list" style="margin-top: 1rem;">
            <!-- Leaderboard items will be injected here -->
            <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Loading rankings...</div>
          </div>
        </div>
      </div>

      <!-- Upgrade Modal -->
      <div id="upgrade-modal" class="modal-overlay" style="display: none; align-items: center; justify-content: center; padding: 1rem;">
        <div class="modal-content glass" style="max-width: 450px; width: 100%; position: relative; padding: 2.5rem; text-align: center;">
          <button id="close-upgrade" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-primary);">&times;</button>
          <div style="font-size: 3rem; margin-bottom: 1rem;">🚀</div>
          <h2 style="font-family: 'Outfit'; margin-bottom: 0.5rem; color: var(--accent-secondary);">Go Premium</h2>
          <p style="color: var(--text-secondary); margin-bottom: 2rem; font-size: 0.95rem;">Unlock the complete curriculum, unlimited AI explanations, and theory grading.</p>
          
          <div class="glass" style="padding: 1.5rem; border: 2px solid var(--accent-secondary); border-radius: 12px; margin-bottom: 2rem; background: var(--accent-secondary)0D;">
             <div style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">BEST VALUE</div>
             <div style="font-size: 2rem; font-weight: 800; font-family: 'Outfit';">₦2,500 <span style="font-size: 1rem; font-weight: 400; opacity: 0.7;">/ lifetime</span></div>
             <ul style="text-align: left; margin: 1rem 0; font-size: 0.85rem; padding-left: 1rem;">
               <li>📌 Full Access to JAMB/WAEC/NECO</li>
               <li>🤖 500 AI Assistant Credits</li>
               <li>📈 Advanced Mastery Analytics</li>
             </ul>
          </div>
          
          <button id="paystack-btn" class="primary" style="width: 100%; padding: 1rem; font-size: 1rem;">Secure Upgrade with Paystack</button>
          <p style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 1rem;">Instant activation upon successful payment.</p>
        </div>
      </div>

      <!-- Help & Guide Modal -->
      <div id="help-modal" class="modal-overlay" style="display: none; align-items: center; justify-content: center; padding: 1rem; z-index: 1000;">
        <div class="modal-content glass" style="max-width: 500px; width: 100%; position: relative; padding: 2.5rem; max-height: 85vh; overflow-y: auto;">
          <button id="close-help" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-primary);">&times;</button>
          <h2 style="font-family: 'Outfit'; margin-bottom: 2rem; text-align: center; color: var(--accent-primary);">📖 How to Use CBT Elite</h2>
          
          <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            <div style="display: grid; grid-template-columns: 80px 1fr; gap: 1rem; align-items: center; background: var(--bg-secondary)33; padding: 1rem; border-radius: 12px; border: 1px solid var(--glass-border);">
               <img src="src/img/app_tour_exam_setup.png" style="width: 100%; height: 60px; object-fit: cover; border-radius: 6px;">
               <div>
                  <h4 style="color: var(--accent-secondary); margin-bottom: 0.25rem; font-size: 0.9rem;">🎯 Start Practice</h4>
                  <p style="font-size: 0.75rem; opacity: 0.8;">Choose a subject, select a specific topic, and focus on mastering concepts.</p>
               </div>
            </div>

            <div style="display: grid; grid-template-columns: 80px 1fr; gap: 1rem; align-items: center; background: var(--bg-secondary)33; padding: 1rem; border-radius: 12px; border: 1px solid var(--glass-border);">
               <img src="src/img/app_tour_ai_tutor.png" style="width: 100%; height: 60px; object-fit: cover; border-radius: 6px;">
               <div>
                  <h4 style="color: var(--primary); margin-bottom: 0.25rem; font-size: 0.9rem;">🏆 Mock Exams</h4>
                  <p style="font-size: 0.75rem; opacity: 0.8;">Simulate real conditions. JAMB mocks include English and 3 chosen subjects.</p>
               </div>
            </div>

            <div style="display: grid; grid-template-columns: 80px 1fr; gap: 1rem; align-items: center; background: var(--bg-secondary)33; padding: 1rem; border-radius: 12px; border: 1px solid var(--glass-border);">
               <img src="src/img/app_tour_analysis.png" style="width: 100%; height: 60px; object-fit: cover; border-radius: 6px;">
               <div>
                  <h4 style="color: var(--success); margin-bottom: 0.25rem; font-size: 0.9rem;">📈 Performance</h4>
                  <p style="font-size: 0.75rem; opacity: 0.8;">Track subject mastery via the radar chart and score growth via the line chart below.</p>
               </div>
            </div>

            <div style="background: var(--accent-secondary)1A; padding: 1.25rem; border-radius: 12px; border: 1px dashed var(--accent-secondary);">
               <h4 style="font-size: 0.85rem; margin-bottom: 0.5rem; color: var(--accent-secondary);">💡 Pro Tip: AI Explanations</h4>
               <p style="font-size: 0.75rem; opacity: 0.8; line-height: 1.4;">During any practice session, click the AI icon for a detailed step-by-step breakdown of the solution!</p>
            </div>
          </div>
        </div>
      </div>
    `


    // Siding Tabs Setup
    const pSec = document.getElementById('practice-section')
    const eSec = document.getElementById('exam-section')
    const pTab = document.getElementById('view-practice')
    const eTab = document.getElementById('view-exam')

    pTab.onclick = () => {
        pTab.classList.add('active'); eTab.classList.remove('active')
        pSec.style.display = 'block'; eSec.style.display = 'none'
    }

    eTab.onclick = () => {
        eTab.classList.add('active'); pTab.classList.remove('active')
        eSec.style.display = 'block'; pSec.style.display = 'none'
    }

    // Generic UI listeners
    document.getElementById('theme-toggle').onclick = () => {
      document.body.classList.toggle('light-mode')
      localStorage.setItem('theme', document.body.classList.contains('light-mode') ? 'light' : 'dark')
    }

    document.getElementById('logout-btn').onclick = async () => {
      await AuthService.signOut()
      location.reload()
    }

    if (document.getElementById('admin-panel-btn')) {
      document.getElementById('admin-panel-btn').onclick = () => this.onOpenAdmin()
    }

    const upgradeBtn = document.getElementById('upgrade-btn')
    const upgradeModal = document.getElementById('upgrade-modal')
    const closeUpgrade = document.getElementById('close-upgrade')
    const payBtn = document.getElementById('paystack-btn')

    if (upgradeBtn) {
       upgradeBtn.onclick = () => upgradeModal.style.display = 'flex'
    }
    if (closeUpgrade) {
       closeUpgrade.onclick = () => upgradeModal.style.display = 'none'
    }

    if (payBtn) {
      payBtn.onclick = () => {
        // IMPORTANT: USER should update this KEY in settings or env
        const PAYSTACK_PUBLIC_KEY = 'pk_test_placeholder_key_replace_me' 
        
        const handler = PaystackPop.setup({
          key: PAYSTACK_PUBLIC_KEY,
          email: profile.email,
          amount: 250000, // 2500 Naira
          currency: 'NGN',
          callback: async (response) => {
            payBtn.disabled = true
            payBtn.textContent = 'Verifying Transaction...'
            
            // Logic: Upgrade user upon success
            const { error } = await DataService.upgradeUserTier(profile.id, 'premium', 500)
            if (!error) {
               alert("✨ Congratulations! Your account has been upgraded to PREMIUM.")
               location.reload()
            } else {
               alert("Upgrade synchronization failed. Please contact support with ref: " + response.reference)
            }
          },
          onClose: () => {
            alert('Transaction cancelled. Your practice session remains free tier.')
          }
        });
        handler.openIframe();
      }
    }

    // State for selections
    let selectedPracticeExam = null
    let selectedExamExam = null
    let allSubjects = []
    let allExams = []

    // Practice Config Toggling
    const pConfig = document.getElementById('practice-config')

    document.querySelectorAll('.practice-tier').forEach(tier => {

        tier.onclick = () => {
            selectedPracticeExam = tier.dataset.exam
            pConfig.style.display = 'block'
            document.getElementById('practice-title').textContent = `Structured ${selectedPracticeExam} Practice`
            document.getElementById('p-type-wrapper').style.display = (selectedPracticeExam === 'JAMB') ? 'none' : 'block'
            document.getElementById('p-topic-wrapper').style.display = 'block'
            pConfig.scrollIntoView({ behavior: 'smooth' })
        }
    })

    // Exam Config Toggling
    const eConfig = document.getElementById('exam-config')
    document.querySelectorAll('.exam-tier').forEach(tier => {
        tier.onclick = () => {
            selectedExamExam = tier.dataset.exam
            eConfig.style.display = 'block'
            document.getElementById('exam-title').textContent = `${selectedExamExam} Mock Exam Setup`
            document.getElementById('jamb-exam-config').style.display = (selectedExamExam === 'JAMB') ? 'block' : 'none'
            document.getElementById('waec-neco-exam-config').style.display = (selectedExamExam === 'JAMB') ? 'none' : 'block'
            eConfig.scrollIntoView({ behavior: 'smooth' })
        }
    })

    // Fetch dynamic data
    const initData = async () => {
      try {
        const { data: examsRes } = await DataService.getExams()
        const { data: subjectsRes } = await DataService.getSubjects()
        allExams = examsRes || []
        allSubjects = subjectsRes || []

        const pSub = document.getElementById('p-subject')
        const eSub = document.getElementById('e-subject')
        const jambList = document.getElementById('jamb-sub-list')

        allSubjects.forEach(s => {
            const opt = new Option(s.subject_name, s.id)
            pSub.appendChild(opt.cloneNode(true))
            eSub.appendChild(opt)

            if (s.subject_name.toLowerCase() !== 'english') {
                const label = document.createElement('label')
                label.style.display = 'flex'; label.style.alignItems = 'center'; label.style.gap = '0.5rem'; label.style.fontSize = '0.8rem';
                label.innerHTML = `<input type="checkbox" class="jamb-sub-check" value="${s.id}" data-name="${s.subject_name}"> ${s.subject_name}`
                jambList.appendChild(label)
            }
        })

        // Topic loader for JAMB Practice
        pSub.onchange = async () => {
            const { data: topics } = await DataService.getTopics(pSub.value)
            const pTopic = document.getElementById('p-topic')
            if (pTopic) {
                pTopic.innerHTML = '<option value="">All Topics</option>'
                if (topics) topics.forEach(t => pTopic.appendChild(new Option(t, t)))
            }
        }

        // Start Practice
        document.getElementById('p-start-btn').onclick = async () => {
            const subjectId = pSub.value
            const type = document.getElementById('p-type').value
            const topic = document.getElementById('p-topic').value
            if (!subjectId) return alert("Select a subject first")

            // Phase 17: Practice sessions
            const limit = type === 'theory' ? 3 : 25 
            const btn = document.getElementById('p-start-btn')
            btn.textContent = 'Preparing Session...'

            try {
                const { data: questions, error } = await DataService.getQuestions({
                    subject_id: subjectId,
                    exam_type: selectedPracticeExam,
                    topic: topic || undefined,
                    question_type: type,
                    limit: limit,
                    randomize: true
                })

                if (error) throw error

                btn.textContent = 'Start Practice Session'
                if (questions && questions.length > 0) {
                    this.onStartExam(questions, 'practice', pSub.options[pSub.selectedIndex].text, selectedPracticeExam)
                } else {
                    alert("No questions found for this selection.")
                }
            } catch (err) {
                console.error("Practice Start Error:", err)
                btn.textContent = 'Start Practice Session'
                alert("An error occurred while preparing the session. Please try again.")
            }
        }

        // Start Mock Exam
        document.getElementById('e-start-btn').onclick = async () => {
            const btn = document.getElementById('e-start-btn')
            btn.textContent = 'Constructing Mock...'

            if (selectedExamExam === 'JAMB') {
                const checks = document.querySelectorAll('.jamb-sub-check:checked')
                if (checks.length !== 3) return alert("Please select exactly 3 additional subjects for JAMB.")
                
                const english = allSubjects.find(s => s.subject_name.toLowerCase() === 'english')
                const subjects = [{ id: english.id, name: 'English', limit: 60 }]
                checks.forEach(c => subjects.push({ id: c.value, name: c.dataset.name, limit: 40 }))

                try {
                    let allQ = []
                    for (const sub of subjects) {
                        const { data, error } = await DataService.getQuestions({ subject_id: sub.id, exam_type: 'JAMB', limit: sub.limit, randomize: true })
                        if (error) throw error
                        if (data) allQ = [...allQ, ...data]
                    }
                    
                    btn.textContent = 'Begin Mock Exam'
                    if (allQ.length > 0) this.onStartExam(allQ, 'exam', 'Full Mock', 'JAMB')
                    else alert("Could not fetch exam questions.")
                } catch (err) {
                    console.error("JAMB Start Error:", err)
                    btn.textContent = 'Begin Mock Exam'
                    alert("Failed to construct the mock exam. Please verify your connection.")
                }

            } else {
                // WAEC / NECO
                const subId = eSub.value
                const type = document.getElementById('e-type').value
                if (!subId) return alert("Select a subject")

                // Phase 17: WAEC / NECO Exam sessions
                const limit = type === 'theory' ? 5 : 40 
                try {
                    const { data: questions, error } = await DataService.getQuestions({
                        subject_id: subId,
                        exam_type: selectedExamExam,
                        question_type: type,
                        limit: limit,
                        randomize: true
                    })

                    if (error) throw error

                    btn.textContent = 'Begin Mock Exam'
                    if (questions && questions.length > 0) {
                        this.onStartExam(questions, 'exam', eSub.options[eSub.selectedIndex].text, selectedExamExam)
                    } else {
                        alert("No questions found.")
                    }
                } catch (err) {
                    console.error("Mock Start Error:", err)
                    btn.textContent = 'Begin Mock Exam'
                    alert("Failed to prepare the mock exam. Please verify your connection.")
                }
            }
        }

        // Bookmarks
        const { count: bCount } = await DataService.getBookmarkCount(profile.id)
        if (document.getElementById('bookmark-count')) document.getElementById('bookmark-count').textContent = bCount || 0
        if (bCount > 0) {
            const bBtn = document.getElementById('start-saved')
            bBtn.disabled = false
            bBtn.onclick = async () => {
                const { data } = await DataService.getBookmarks(profile.id)
                if (data) this.onStartExam(data, 'saved', 'Saved Questions', 'Collection')
            }
        }

        // Leaderboard
        const leaderboardBtn = document.getElementById('view-leaderboard')
        const leaderboardModal = document.getElementById('leaderboard-modal')
        const leaderboardList = document.getElementById('leaderboard-list')
        const closeLeaderboard = document.getElementById('close-leaderboard')

        // Resume Session Logic
        const resumeContainer = document.getElementById('resume-container')
        const savedStateJson = localStorage.getItem('cbt_active_exam')
        if (savedStateJson) {
           try {
             const state = JSON.parse(savedStateJson)
             // Only show if it's less than 24 hours old
             if (Date.now() - state.timestamp < 24 * 60 * 60 * 1000) {
                resumeContainer.style.display = 'block'
                const timeAgo = Math.round((Date.now() - state.timestamp) / 60000)
                document.getElementById('resume-info').textContent = `${state.examType} ${state.mode}: Last activity ${timeAgo}m ago.`
                
                document.getElementById('confirm-resume').onclick = () => {
                  this.onStartExam(state.questions, state.mode, state.subject, state.examType, state, false)
                }
                
                document.getElementById('discard-resume').onclick = () => {
                   localStorage.removeItem('cbt_active_exam')
                   resumeContainer.style.display = 'none'
                }
             } else {
               localStorage.removeItem('cbt_active_exam')
             }
           } catch(e) { 
             localStorage.removeItem('cbt_active_exam')
           }
        }

        leaderboardBtn.onclick = async () => {
          leaderboardModal.style.display = 'flex'
          leaderboardList.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Loading rankings...</div>'
          
          const { data, error } = await DataService.getLeaderboard()
          if (error || !data || data.length === 0) {
            leaderboardList.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No rankings available yet. Be the first!</div>'
            return
          }

          leaderboardList.innerHTML = `
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 2px solid var(--glass-border); text-align: left; color: var(--text-secondary); font-size: 0.8rem;">
                  <th style="padding: 0.75rem;">RANK</th>
                  <th style="padding: 0.75rem;">USER</th>
                  <th style="padding: 0.75rem; text-align: right;">QUESTIONS</th>
                </tr>
              </thead>
              <tbody>
                ${data.map((entry, i) => `
                  <tr style="border-bottom: 1px solid var(--glass-border); ${entry.users?.username === profile.username ? 'background: var(--primary)1A;' : ''}">
                    <td style="padding: 1rem; font-weight: 700;">#${i + 1}</td>
                    <td style="padding: 1rem; display: flex; align-items: center; gap: 0.75rem;">
                      <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--accent-secondary); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold;">
                        ${(entry.users?.username || 'U').substring(0, 1).toUpperCase()}
                      </div>
                      <span style="font-weight: 500;">${entry.users?.username || 'Unknown User'}</span>
                    </td>
                    <td style="padding: 1rem; text-align: right; font-weight: 600;">${entry.total_questions_answered.toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `
        }

        closeLeaderboard.onclick = () => {
          leaderboardModal.style.display = 'none'
        }
        
        window.onclick = (e) => {
          if (e.target === leaderboardModal) leaderboardModal.style.display = 'none'
        }

        // Phase 3: Charts
        this.renderCharts(profile.id)

      } catch (err) {
        console.error("Dashboard init error:", err)
      }
    }

    // Help Modal Logic
    const helpBtn = document.getElementById('help-guide-btn')
    const helpModal = document.getElementById('help-modal')
    const helpClose = document.getElementById('close-help')
    if (helpBtn) helpBtn.onclick = () => helpModal.style.display = 'flex'
    if (helpClose) helpClose.onclick = () => helpModal.style.display = 'none'

    // Feature Carousel Logic
    const carouselSlides = document.getElementById('carousel-slides')
    const slides = document.querySelectorAll('.carousel-slide')
    const nextBtn = document.getElementById('next-slide')
    const prevBtn = document.getElementById('prev-slide')
    let currentSlide = 0

    const updateCarousel = () => {
      if (!carouselSlides) return
      carouselSlides.style.transform = `translateX(-${currentSlide * 100}%)`
    }

    if (nextBtn) {
      nextBtn.onclick = () => {
        currentSlide = (currentSlide + 1) % slides.length
        updateCarousel()
      }
    }
    if (prevBtn) {
      prevBtn.onclick = () => {
        currentSlide = (currentSlide - 1 + slides.length) % slides.length
        updateCarousel()
      }
    }

    // Auto-slide carousel
    const carouselInterval = setInterval(() => {
      currentSlide = (currentSlide + 1) % slides.length
      updateCarousel()
    }, 5000)

    // News Ticker Logic
    const ticker = document.getElementById('news-ticker')
    const newsItems = document.querySelectorAll('.news-item')
    let currentNews = 0

    const updateTicker = () => {
      if (!ticker) return
      ticker.style.top = `-${currentNews * 65}px` // ~65px height step
      currentNews = (currentNews + 1) % newsItems.length
    }

    const tickerInterval = setInterval(updateTicker, 4000)

    // Logic for news item clicks
    newsItems.forEach(item => {
      item.onclick = () => {
        alert("Exam News Detail: " + item.innerText)
      }
    })

    // Store intervals for cleanup if necessary (though Dashboard is mostly persistent)
    this.activeIntervals = [carouselInterval, tickerInterval]

    initData()
  },

  async renderCharts(userId) {
    const { history, mastery, error } = await DataService.getUserAnalytics(userId)
    if (error || (!history.length && !mastery.length)) {
      // Show empty state if no data
      document.getElementById('analytics-section').style.opacity = '0.5'
      return
    }
    document.getElementById('analytics-section').style.opacity = '1'

    // Get current theme colors
    const style = getComputedStyle(document.body)
    const isLightMode = document.body.classList.contains('light-mode')
    
    const textPrimary = style.getPropertyValue('--text-primary').trim() || '#F9FAFB'
    const successColor = style.getPropertyValue('--success').trim() || '#10B981'
    const primaryColor = style.getPropertyValue('--primary').trim() || '#2563EB'
    const borderColor = style.getPropertyValue('--border-color').trim() || '#334155'
    
    // Grid color logic for better contrast in light mode
    const chartGridColor = isLightMode ? 'rgba(0,0,0,0.15)' : borderColor + '4D'

    // 1. Score History Chart
    const historyCtx = document.getElementById('score-history-chart').getContext('2d')
    new Chart(historyCtx, {
      type: 'line',
      data: {
        labels: history.map((_, i) => i + 1),
        datasets: [{
          label: 'Score %',
          data: history.map(h => h.score_percentage),
          borderColor: successColor,
          backgroundColor: isLightMode ? successColor + '33' : successColor + '1A', 
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 4,
          pointBackgroundColor: isLightMode ? successColor : '#fff'
        }]
      },
      options: {
        responsive: true,
        plugins: { 
          legend: { display: false },
          tooltip: {
            backgroundColor: isLightMode ? '#fff' : '#1E293B',
            titleColor: isLightMode ? '#111827' : '#F9FAFB',
            bodyColor: isLightMode ? '#4B5563' : '#CBD5F5',
            borderColor: isLightMode ? '#E5E7EB' : 'transparent',
            borderWidth: 1
          }
        },
        scales: {
          y: { 
            beginAtZero: true, 
            max: 100, 
            grid: { color: chartGridColor }, 
            ticks: { color: textPrimary, font: { weight: 'bold' } }
          },
          x: { 
            grid: { display: false }, 
            ticks: { color: textPrimary }
          }
        }
      }
    })

    // 2. Subject Mastery Chart
    const masteryCtx = document.getElementById('subject-mastery-chart').getContext('2d')
    new Chart(masteryCtx, {
      type: 'radar',
      data: {
        labels: mastery.map(m => m.subject),
        datasets: [{
          label: 'Mastery %',
          data: mastery.map(m => m.average),
          backgroundColor: isLightMode ? primaryColor + '4D' : primaryColor + '33', // 30% vs 20%
          borderColor: primaryColor,
          borderWidth: 3,
          pointBackgroundColor: primaryColor,
          pointBorderColor: '#fff',
          pointBorderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            angleLines: { color: chartGridColor },
            grid: { color: chartGridColor },
            pointLabels: { 
              color: textPrimary, 
              font: { size: 12, weight: 'bold' },
              padding: 10
            },
            ticks: { display: false },
            suggestedMin: 0,
            suggestedMax: 100
          }
        }
      }
    })
  },

  hide() {
    document.getElementById('dashboard-container').style.display = 'none'
  }
}


