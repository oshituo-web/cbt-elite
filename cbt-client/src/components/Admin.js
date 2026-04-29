import { DataService } from '../services/data'
import { SubscriptionService } from '../services/subscriptionService'
import { supabase } from '../utils/supabase'
import Papa from 'papaparse'
import { ModalService } from '../services/ModalService'

export const AdminComponent = {
  render(profile, onBack) {
    // 🔐 Exclusive Authorization (Strict: oshituo@gmail.com only)
    const isAdmin = profile.email === 'oshituo@gmail.com';
    if (!isAdmin) {
        console.error(`CRITICAL: Unauthorized Admin Access Attempt by ${profile.email || 'unknown'} blocked.`);
        if (onBack) onBack();
        return;
    }
    
    const container = document.getElementById('admin-container')
    container.style.display = 'block'
    this._adminProfile = profile // Store for auditing
    container.innerHTML = `
      <div class="admin-elite-wrapper" style="animation: fadeIn 0.4s ease;">
        <header class="glass" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.5rem; padding: 1.5rem 2rem; border-radius: 20px; border-bottom: 2px solid var(--accent-primary); margin-bottom: 2rem;">
          <div style="display: flex; align-items: center; gap: 1rem;">
             <div style="background: var(--accent-gradient); width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 20px rgba(124, 58, 237, 0.3);">
                <i data-lucide="shield-check" style="color: white; width: 24px;"></i>
             </div>
             <div>
                <h1 style="font-family: 'Outfit'; font-size: 1.5rem; font-weight: 900; margin: 0; color: var(--text-primary);">Elite Command Center</h1>
                <p style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin: 0;">System Authorization: ${profile.role}</p>
             </div>
          </div>
          <div style="display: flex; gap: 1rem; align-items: center;">
            <div class="mobile-hide" style="text-align: right; margin-right: 1rem; border-right: 1px solid var(--glass-border); padding-right: 1.5rem;">
               <div style="font-size: 0.7rem; color: var(--text-secondary); font-weight: 700;">ADMINISTRATOR</div>
               <div style="font-size: 0.9rem; font-weight: 800; color: var(--text-primary);">${profile.username}</div>
            </div>
            <button id="admin-back-home" class="btn-secondary" style="height: 48px; padding: 0 1.5rem; font-weight: 700; border-radius: 12px;">
               <i data-lucide="arrow-left" style="width: 18px; margin-right: 0.5rem;"></i> EXIT PANEL
            </button>
          </div>
        </header>

        <div id="admin-grid" class="admin-layout-grid" style="display: grid; gap: 2rem; align-items: start;">
          <nav id="admin-nav" class="glass" style="padding: 1.5rem; border-radius: 24px; display: flex; flex-direction: column; gap: 0.5rem; sticky; top: 2rem;">
            <button class="nav-tab active" data-tab="questions" style="display: flex; align-items: center; gap: 0.75rem;"><i data-lucide="database" style="width: 18px;"></i> Questions</button>
            <button class="nav-tab" data-tab="syllabus" style="display: flex; align-items: center; gap: 0.75rem;"><i data-lucide="book-open" style="width: 18px;"></i> Syllabus</button>
            <button class="nav-tab" data-tab="users" style="display: flex; align-items: center; gap: 0.75rem;"><i data-lucide="users" style="width: 18px;"></i> Users</button>
            <button class="nav-tab" data-tab="reports" style="display: flex; align-items: center; gap: 0.75rem;"><i data-lucide="flag" style="width: 18px;"></i> Reports</button>
            <button class="nav-tab" data-tab="marketing" style="display: flex; align-items: center; gap: 0.75rem;"><i data-lucide="zap" style="width: 18px;"></i> Marketing</button>
            <button class="nav-tab" data-tab="news" style="display: flex; align-items: center; gap: 0.75rem;"><i data-lucide="newspaper" style="width: 18px;"></i> News</button>
            <button class="nav-tab" data-tab="leagues" style="display: flex; align-items: center; gap: 0.75rem; color: var(--accent-secondary);"><i data-lucide="shield-check" style="width: 18px;"></i> Leagues & Clans</button>
            <button class="nav-tab" data-tab="analytics" style="display: flex; align-items: center; gap: 0.75rem; color: var(--accent-primary);"><i data-lucide="bar-chart-3" style="width: 18px;"></i> Analytics</button>
            <button class="nav-tab" data-tab="quality-audit" style="display: flex; align-items: center; gap: 0.75rem; color: var(--success);"><i data-lucide="list-checks" style="width: 18px;"></i> Quality Audit</button>
            <button class="nav-tab" data-tab="lab" style="display: flex; align-items: center; gap: 0.75rem; color: var(--accent-secondary);"><i data-lucide="beaker" style="width: 18px;"></i> AI Question Lab</button>
            <div style="height: 1px; background: var(--glass-border); margin: 0.5rem 0;"></div>
            ${(profile.role === 'admin' || profile.role === 'super-admin') ? `
              <button class="nav-tab" data-tab="audit" style="display: flex; align-items: center; gap: 0.75rem;"><i data-lucide="scroll-text" style="width: 18px;"></i> Audit Logs</button>
              <button class="nav-tab" data-tab="staff" style="display: flex; align-items: center; gap: 0.75rem;"><i data-lucide="user-cog" style="width: 18px;"></i> Staff</button>
            ` : ''}
          </nav>
          
          <main id="admin-main">
          <!-- Leagues & Clans Tab -->
          <div id="admin-leagues-tab" style="display: none;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 2rem;">
              <div>
                <h2 style="font-family: 'Outfit'; font-weight: 800; color: var(--text-primary); margin: 0;">Leagues & Elite Clans</h2>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.2rem;">Managing departmental competitions and promotions</p>
              </div>
              <div style="display: flex; gap: 0.75rem;">
                <button id="run-weekly-reset-btn" class="btn-secondary" style="height: 40px; padding: 0 1.25rem; font-weight: 800; border-radius: 10px; border-color: var(--success); color: var(--success);">
                  <i data-lucide="refresh-ccw" style="width: 16px; margin-right: 0.5rem;"></i> WEEKLY RESET
                </button>
                <button id="process-clash-promotions-btn" class="btn-secondary" style="height: 40px; padding: 0 1.25rem; font-weight: 800; border-radius: 10px; border-color: var(--accent-secondary); color: var(--accent-secondary);">
                  <i data-lucide="trending-up" style="width: 16px; margin-right: 0.5rem;"></i> PROMOTIONS
                </button>
                <button id="generate-clash-seeds-btn" class="btn-primary" style="height: 40px; padding: 0 1.5rem; font-weight: 800; border-radius: 10px; background: var(--accent-gradient);">
                  <i data-lucide="sparkles" style="width: 16px; margin-right: 0.5rem;"></i> GENERATE SEEDS
                </button>
              </div>
            </div>

            <div class="glass card" style="padding: 1.5rem; border-radius: 20px; border-left: 4px solid var(--accent-secondary); margin-bottom: 2rem;">
              <h3 style="font-family: 'Outfit'; font-weight: 700; font-size: 1.1rem; color: var(--text-primary); margin-bottom: 1rem;">Active Schedule</h3>
              <div id="clash-schedule-list" style="display: flex; flex-direction: column; gap: 0.75rem;">
                <!-- Schedule items will be injected here -->
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Loading schedule...</div>
              </div>
            </div>

            <div class="glass card" style="padding: 1.5rem; border-radius: 20px;">
              <h3 style="font-family: 'Outfit'; font-weight: 700; font-size: 1.1rem; color: var(--text-primary); margin-bottom: 1.5rem;">League Management Info</h3>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
                <div class="glass" style="padding: 1.25rem; border-radius: 12px; border: 1px solid var(--glass-border);">
                   <div style="font-size: 0.7rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Promotions</div>
                   <div style="font-size: 1.25rem; font-weight: 900; color: var(--success); margin: 0.25rem 0;">Every Saturday 8PM</div>
                   <p style="font-size: 0.7rem; color: var(--text-secondary); margin: 0;">Top 3 of every Clan Clash promote to Elite League.</p>
                </div>
                <div class="glass" style="padding: 1.25rem; border-radius: 12px; border: 1px solid var(--glass-border);">
                   <div style="font-size: 0.7rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Clan Capacity</div>
                   <div style="font-size: 1.25rem; font-weight: 900; color: var(--accent-primary); margin: 0.25rem 0;">20 Students</div>
                   <p style="font-size: 0.7rem; color: var(--text-secondary); margin: 0;">Automatic group overflow handling.</p>
                </div>
              </div>
            </div>
          </div>

          <div id="admin-analytics-tab" style="display: none;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 2rem;">
              <h2 style="font-family: 'Outfit'; font-weight: 800; color: var(--text-primary); margin: 0;">Platform Analytics</h2>
              <button id="analytics-refresh" class="btn-secondary" style="height: 36px; padding: 0 1rem; font-size: 0.75rem; font-weight: 700; border-radius: 8px;">
                 <i data-lucide="refresh-cw" style="width: 14px; margin-right: 0.4rem;"></i> REFRESH DATA
              </button>
            </div>
            
            <div id="analytics-summary" class="admin-stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.25rem; margin-bottom: 2.5rem;">
              <!-- Quick Stats Cards will be injected here -->
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 2rem;">
               <div class="glass card" style="padding: 2rem; border-radius: 20px;">
                  <h3 style="font-family: 'Outfit'; font-weight: 700; font-size: 1.1rem; margin-bottom: 1.5rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
                     <i data-lucide="bar-chart" style="color: var(--accent-primary); width: 20px;"></i> Global Score Distribution
                  </h3>
                  <canvas id="global-scores-chart" height="280"></canvas>
               </div>
               <div class="glass card" style="padding: 2rem; border-radius: 20px;">
                  <h3 style="font-family: 'Outfit'; font-weight: 700; font-size: 1.1rem; margin-bottom: 1.5rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
                     <i data-lucide="line-chart" style="color: var(--accent-secondary); width: 20px;"></i> Growth Projection (Users)
                  </h3>
                  <canvas id="revenue-growth-chart" height="280"></canvas>
               </div>
            </div>
          </div>
          <!-- Quality Audit Tab -->
          <div id="admin-quality-audit-tab" style="display: none;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 2rem;">
              <div>
                <h2 style="font-family: 'Outfit'; font-weight: 800; color: var(--text-primary); margin: 0;">Quality Audit</h2>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.2rem;">Proactively identifying and repairing content gaps</p>
              </div>
              <button id="audit-refresh" class="btn-secondary" style="height: 36px; padding: 0 1rem; font-size: 0.75rem; font-weight: 700; border-radius: 8px;">
                 <i data-lucide="refresh-cw" style="width: 14px; margin-right: 0.4rem;"></i> RE-SCAN DATABASE
              </button>
            </div>

            <div class="glass card" style="padding: 2rem; border-radius: 24px; border-left: 4px solid var(--success);">
              <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem;">
                 <div style="background: rgba(34, 197, 94, 0.1); width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: var(--success);">
                    <i data-lucide="search-code"></i>
                 </div>
                 <div>
                    <h3 style="font-family: 'Outfit'; margin: 0; font-size: 1.1rem; color: var(--text-primary);">Flagged for Review</h3>
                    <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0;">Items with missing explanations or poor formatting</p>
                 </div>
              </div>
              <div id="quality-audit-list" style="display: flex; flex-direction: column; gap: 1rem;">
                <!-- Audit items injected here -->
              </div>
            </div>
          </div>
          <!-- AI Question Lab Tab -->
          <div id="admin-lab-tab" style="display: none;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 2.5rem;">
              <div>
                <h2 style="font-family: 'Outfit'; font-weight: 900; color: var(--text-primary); margin: 0; font-size: 1.75rem;">Elite AI Question Lab</h2>
                <p style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 500;">Autonomous question generation and batch drafting</p>
              </div>
            </div>

            <div class="glass card" style="padding: 2.5rem; border-radius: 24px; border-left: 4px solid var(--accent-secondary); margin-bottom: 2.5rem;">
               <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; align-items: end;">
                  <div>
                    <label style="font-size: 0.7rem; color: var(--accent-secondary); text-transform: uppercase; font-weight: 800; display: block; margin-bottom: 0.75rem;">Exam Type</label>
                    <select id="lab-exam" class="glass-select" style="width: 100%; height: 50px;"><option value="">Select Exam</option></select>
                  </div>
                  <div>
                    <label style="font-size: 0.7rem; color: var(--accent-secondary); text-transform: uppercase; font-weight: 800; display: block; margin-bottom: 0.75rem;">Subject</label>
                    <select id="lab-subject" class="glass-select" style="width: 100%; height: 50px;"><option value="">Select Subject</option></select>
                  </div>
                  <div>
                    <label style="font-size: 0.7rem; color: var(--accent-secondary); text-transform: uppercase; font-weight: 800; display: block; margin-bottom: 0.75rem;">Topic (optional)</label>
                    <select id="lab-topic" class="glass-select" style="width: 100%; height: 50px;"><option value="">All Topics</option></select>
                  </div>
                  <div>
                    <label style="font-size: 0.7rem; color: var(--accent-secondary); text-transform: uppercase; font-weight: 800; display: block; margin-bottom: 0.75rem;">Batch Size</label>
                    <select id="lab-count" class="glass-select" style="width: 100%; height: 50px;">
                      <option value="5">5 Questions</option>
                      <option value="10">10 Questions</option>
                      <option value="20">20 Questions</option>
                    </select>
                  </div>
                  <button id="generate-lab-btn" class="btn-primary" style="height: 50px; background: var(--accent-gradient); font-weight: 900; border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                    <i data-lucide="sparkles" style="width: 18px;"></i> GENERATE BATCH
                  </button>
               </div>
            </div>

            <div id="lab-results-container" style="display: none;">
               <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                 <h3 style="font-family: 'Outfit'; font-weight: 800; color: var(--text-primary); margin: 0;">Proposed Questions (<span id="lab-result-count">0</span>)</h3>
                 <button id="save-all-lab-btn" class="btn-primary" style="background: var(--success-gradient); height: 44px; padding: 0 1.5rem; font-weight: 800; border-radius: 10px;">
                    <i data-lucide="save" style="width: 16px; margin-right: 0.5rem;"></i> SAVE ALL TO DATABASE
                 </button>
               </div>
               <div id="lab-questions-list" style="display: flex; flex-direction: column; gap: 1.5rem;">
                  <!-- AI Generated cards will appear here -->
               </div>
            </div>
            
            <div id="lab-empty-state" style="text-align: center; padding: 5rem 2rem; color: var(--text-secondary); background: rgba(255,255,255,0.01); border-radius: 24px; border: 1px dashed var(--glass-border);">
               <i data-lucide="beaker" style="width: 48px; height: 48px; margin-bottom: 1.5rem; opacity: 0.3;"></i>
               <p style="font-weight: 600;">The lab is empty. Select a subject and topic to begin autonomous generation.</p>
            </div>
          </div>

          <!-- Questions Tab -->
          <div id="admin-questions-tab">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 2.5rem;">
              <div>
                <h2 style="font-family: 'Outfit'; font-weight: 900; color: var(--text-primary); margin: 0; font-size: 1.75rem;">Question Repository</h2>
                <p style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 500;">Manage exam database and content updates</p>
              </div>
              <div style="display: flex; gap: 0.75rem;">
                <button id="bulk-import-btn" class="btn-secondary" style="height: 48px; padding: 0 1.5rem; font-weight: 700; border-radius: 12px; display: flex; align-items: center; gap: 0.5rem;">
                   <i data-lucide="upload-cloud" style="width: 18px;"></i> BULK IMPORT
                </button>
                <button id="add-question-btn" class="btn-primary" style="height: 48px; padding: 0 1.5rem; font-weight: 800; border-radius: 12px; display: flex; align-items: center; gap: 0.5rem;">
                   <i data-lucide="plus" style="width: 18px;"></i> ADD NEW
                </button>
                <input type="file" id="bulk-import-input" accept=".csv" style="display: none;">
              </div>
            </div>

            <div class="glass card" style="padding: 2rem; margin-bottom: 2.5rem; border-radius: 20px;">
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; align-items: end;">
                <div style="flex: 2;">
                   <label style="font-size: 0.7rem; color: var(--accent-primary); text-transform: uppercase; font-weight: 800; display: block; margin-bottom: 0.75rem; letter-spacing: 0.05em;">Search Database</label>
                   <div style="position: relative;">
                     <i data-lucide="search" style="position: absolute; left: 1rem; top: 12px; width: 18px; color: var(--text-secondary);"></i>
                     <input type="text" id="question-search" placeholder="Filter by text, ID or keywords..." class="glass-input" style="width: 100%; height: 44px; padding-left: 3rem;">
                   </div>
                </div>
                <div>
                   <label style="font-size: 0.7rem; color: var(--accent-primary); text-transform: uppercase; font-weight: 800; display: block; margin-bottom: 0.75rem; letter-spacing: 0.05em;">Exam Type</label>
                   <select id="filter-exam" class="glass-select" style="width: 100%; height: 44px;"><option value="">All Exams</option></select>
                </div>
                <div>
                   <label style="font-size: 0.7rem; color: var(--accent-primary); text-transform: uppercase; font-weight: 800; display: block; margin-bottom: 0.75rem; letter-spacing: 0.05em;">Subject</label>
                   <select id="filter-subject" class="glass-select" style="width: 100%; height: 44px;"><option value="">All Subjects</option></select>
                </div>
                <div>
                   <label style="font-size: 0.7rem; color: var(--accent-primary); text-transform: uppercase; font-weight: 800; display: block; margin-bottom: 0.75rem; letter-spacing: 0.05em;">Topic</label>
                   <select id="filter-topic" class="glass-select" style="width: 100%; height: 44px;"><option value="">All Topics</option></select>
                </div>
              </div>
            </div>

            <div id="pagination-controls-top" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem; background: rgba(255,255,255,0.02); padding: 1rem 1.5rem; border-radius: 12px; border: 1px solid var(--glass-border);">
              <span id="question-count-display" style="font-size: 0.9rem; font-weight: 700; color: var(--text-secondary);"></span>
              <div style="display: flex; gap: 0.75rem; align-items: center;">
                <button id="prev-page-top" class="btn-secondary" style="height: 38px; padding: 0 1rem; font-size: 0.8rem;"><i data-lucide="chevron-left" style="width:16px;"></i></button>
                <span style="font-weight: 800; font-size: 0.9rem; color: var(--text-primary);">Page Controls</span>
                <button id="next-page-top" class="btn-secondary" style="height: 38px; padding: 0 1rem; font-size: 0.8rem;"><i data-lucide="chevron-right" style="width:16px;"></i></button>
              </div>
            </div>
            
            <div id="questions-list" style="display: flex; flex-direction: column; gap: 1.25rem;">
               <div class="loader-spinner" style="margin: 4rem auto;"></div>
            </div>
          </div>

          <!-- Syllabus Tab -->
          <div id="admin-syllabus-tab" style="display: none;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 2rem;">
              <div>
                <h2 style="font-family: 'Outfit'; font-weight: 900; color: var(--text-primary); margin: 0; font-size: 1.75rem;">Exam Syllabus</h2>
                <p style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 500;">Configure subjects and topics for all exam types</p>
              </div>
              <button id="add-syllabus-btn" class="btn-primary" style="height: 48px; padding: 0 1.5rem; font-weight: 800; border-radius: 12px; display: flex; align-items: center; gap: 0.5rem;">
                 <i data-lucide="book-plus" style="width: 18px;"></i> ADD NEW TOPIC
              </button>
            </div>
            <div id="syllabus-list" style="display: flex; flex-direction: column; gap: 1rem;">
               <div class="loader-spinner" style="margin: 3rem auto;"></div>
            </div>
          </div>

          <!-- Users Tab -->
          <div id="admin-users-tab" style="display: none;">
            <div style="margin-bottom: 2.5rem;">
              <h2 style="font-family: 'Outfit'; font-weight: 900; color: var(--text-primary); margin: 0; font-size: 1.75rem;">User Management</h2>
              <p style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 500;">Monitor accounts, subscriptions, and system access</p>
            </div>
            <div id="users-list" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
               <div class="loader-spinner" style="margin: 3rem auto;"></div>
            </div>
          </div>

          <!-- User Reports Tab -->
          <div id="admin-reports-tab" style="display: none;">
            <div style="margin-bottom: 2.5rem;">
              <h2 style="font-family: 'Outfit'; font-weight: 900; color: var(--text-primary); margin: 0; font-size: 1.75rem;">Question Reports</h2>
              <p style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 500;">Address student feedback and content corrections</p>
            </div>
            <div id="reports-list" style="display: flex; flex-direction: column; gap: 1.5rem;">
               <div class="loader-spinner" style="margin: 3rem auto;"></div>
            </div>
          </div>

          <!-- Marketing Tab -->
          <div id="admin-marketing-tab" style="display: none;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 2.5rem;">
              <!-- Promo Codes Section -->
              <section>
                <div style="margin-bottom: 2rem;">
                  <h2 style="font-family: 'Outfit'; font-weight: 900; color: var(--text-primary); margin: 0; font-size: 1.5rem; display: flex; align-items: center; gap: 0.75rem;">
                    <i data-lucide="ticket" style="color: var(--accent-primary);"></i> Promo System
                  </h2>
                  <p style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 500;">Create and manage student discount codes</p>
                </div>

                <div class="glass card" style="padding: 2rem; margin-bottom: 2rem; border-radius: 20px;">
                  <h3 style="font-size: 1rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1.5rem; text-transform: uppercase;">Generate New Code</h3>
                  <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                      <div>
                        <label style="font-size: 0.7rem; color: var(--accent-primary); font-weight: 800; display: block; margin-bottom: 0.5rem;">CODE STRING</label>
                        <input type="text" id="promo-code-input" placeholder="e.g. ELITE50" class="glass-input" style="width: 100%; font-weight: 700;">
                      </div>
                      <div>
                        <label style="font-size: 0.7rem; color: var(--accent-primary); font-weight: 800; display: block; margin-bottom: 0.5rem;">DISCOUNT %</label>
                        <input type="number" id="promo-percent-input" placeholder="Percentage" class="glass-input" style="width: 100%; font-weight: 700;">
                      </div>
                    </div>
                    <div>
                      <label style="font-size: 0.7rem; color: var(--accent-primary); font-weight: 800; display: block; margin-bottom: 0.5rem;">EXPIRATION DATE</label>
                      <input type="date" id="promo-expiry-input" class="glass-input" style="width: 100%;">
                    </div>
                    <button id="add-promo-btn" class="btn-primary" style="height: 50px; font-weight: 900; border-radius: 12px; margin-top: 0.5rem;">
                       <i data-lucide="plus-circle" style="width: 18px; margin-right: 0.5rem;"></i> CREATE PROMO CODE
                    </button>
                  </div>
                </div>
                <div id="promo-codes-list" style="display: flex; flex-direction: column; gap: 1rem;">
                   <div class="loader-spinner" style="margin: 2rem auto;"></div>
                </div>
              </section>
              
              <!-- System Controls Section -->
              <section>
                <div style="margin-bottom: 2rem;">
                  <h2 style="font-family: 'Outfit'; font-weight: 900; color: var(--text-primary); margin: 0; font-size: 1.5rem; display: flex; align-items: center; gap: 0.75rem;">
                    <i data-lucide="settings-2" style="color: var(--accent-secondary);"></i> System Engine
                  </h2>
                  <p style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 500;">Configure global platform feature availability</p>
                </div>
                
                <div class="glass card" style="padding: 2.5rem; border-radius: 20px; border-left: 4px solid var(--accent-secondary);">
                   <h3 style="font-size: 1rem; font-weight: 800; color: var(--text-primary); margin-bottom: 2rem; text-transform: uppercase;">Global Feature Toggles</h3>
                   <div id="system-config-toggles" style="display: flex; flex-direction: column; gap: 1.75rem;">
                      <!-- Explanations Toggle -->
                      <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding-bottom: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <div>
                          <strong style="font-size: 0.95rem; display: block; color: var(--text-primary);">Question Explanations</strong>
                          <span style="font-size: 0.75rem; color: var(--text-secondary);">Allow free users to view AI solutions</span>
                        </div>
                        <button id="toggle-explanations-btn" class="glass" style="padding: 0.6rem 1.25rem; font-size: 0.75rem; font-weight: 800; border-radius: 8px;">Loading...</button>
                      </div>

                      <!-- Mock Exams Toggle -->
                      <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding-bottom: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <div>
                          <strong style="font-size: 0.95rem; display: block; color: var(--text-primary);">Mock Exams</strong>
                          <span style="font-size: 0.75rem; color: var(--text-secondary);">Allow free users to take Full Mocks</span>
                        </div>
                        <button id="toggle-exams-btn" class="glass" style="padding: 0.6rem 1.25rem; font-size: 0.75rem; font-weight: 800; border-radius: 8px;">Loading...</button>
                      </div>

                      <!-- AI Tutor Toggle -->
                      <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                        <div>
                          <strong style="font-size: 0.95rem; display: block; color: var(--text-primary);">AI Tutor Access</strong>
                          <span style="font-size: 0.75rem; color: var(--text-secondary);">Enable Gemini-powered feedback</span>
                        </div>
                        <button id="toggle-ai-tutor-btn" class="glass" style="padding: 0.6rem 1.25rem; font-size: 0.75rem; font-weight: 800; border-radius: 8px;">Loading...</button>
                      </div>
                   </div>
                </div>

                <div class="glass card" style="padding: 2rem; border-radius: 20px; margin-top: 2rem; border-left: 4px solid var(--error);">
                   <h3 style="font-size: 1rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1rem; text-transform: uppercase;">Announcement Banner</h3>
                   <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.5rem;">Visible at the top of all dashboards.</p>
                   <textarea id="broadcast-message-input" class="glass-input" style="width: 100%; min-height: 120px; margin-bottom: 1.25rem; padding: 1rem; font-size: 0.9rem;" placeholder="Enter message..."></textarea>
                    <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                      <button id="save-broadcast-btn" class="btn-primary" style="flex: 2; height: 48px; font-weight: 800; border: none; background: var(--error); color: white !important; border-radius: 12px; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.2);">
                         <i data-lucide="radio" style="width: 18px; margin-right: 0.5rem;"></i> PUSH BROADCAST
                      </button>
                      <button id="clear-broadcast-btn" class="btn-secondary" style="flex: 1; height: 48px; font-weight: 800; border-radius: 12px; border-color: rgba(239, 68, 68, 0.3); color: #ff6b6b;">
                         <i data-lucide="trash-2" style="width: 18px; margin-right: 0.5rem;"></i> CLEAR
                      </button>
                    </div>
                </div>
              </section>

              <!-- Tier Limits & Pricing Section -->
              <section>
                <div style="margin-bottom: 2rem;">
                  <h2 style="font-family: 'Outfit'; font-weight: 900; color: var(--text-primary); margin: 0; font-size: 1.5rem; display: flex; align-items: center; gap: 0.75rem;">
                    <i data-lucide="shield-check" style="color: var(--accent-primary);"></i> Tier Management
                  </h2>
                  <p style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 500;">Set session limits and AI credits for each tier</p>
                </div>

                <div class="glass card" style="padding: 2rem; border-radius: 20px; border-left: 4px solid var(--accent-primary);">
                   <div style="display: grid; gap: 2rem;">
                      <!-- Global Gamification -->
                      <div>
                        <h4 style="font-size: 0.8rem; font-weight: 800; color: var(--success); text-transform: uppercase; margin-bottom: 1rem;">Platform Gamification</h4>
                        <div style="display: grid; grid-template-columns: 1fr; gap: 1rem;">
                           <div>
                             <label style="font-size: 0.65rem; color: var(--text-secondary); display: block; margin-bottom: 0.4rem;">DAILY GOAL TARGET (QUESTIONS)</label>
                             <input type="number" id="cfg-daily-goal" class="glass-input" style="width: 100%;">
                           </div>
                        </div>
                      </div>

                      <!-- Freemium Limits -->
                      <div>
                        <h4 style="font-size: 0.8rem; font-weight: 800; color: var(--accent-primary); text-transform: uppercase; margin-bottom: 1rem;">Freemium (Free Tier)</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                           <div>
                             <label style="font-size: 0.65rem; color: var(--text-secondary); display: block; margin-bottom: 0.4rem;">DAILY PRACTICE LIMIT</label>
                             <input type="number" id="cfg-practice-free" class="glass-input" style="width: 100%;">
                           </div>
                           <div>
                             <label style="font-size: 0.65rem; color: var(--text-secondary); display: block; margin-bottom: 0.4rem;">DAILY EXAM LIMIT</label>
                             <input type="number" id="cfg-exam-free" class="glass-input" style="width: 100%;">
                           </div>
                        </div>
                      </div>

                      <!-- Medium Limits -->
                      <div>
                        <h4 style="font-size: 0.8rem; font-weight: 800; color: var(--accent-secondary); text-transform: uppercase; margin-bottom: 1rem;">Medium (Activated Tier)</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                           <div>
                             <label style="font-size: 0.65rem; color: var(--text-secondary); display: block; margin-bottom: 0.4rem;">DAILY PRACTICE LIMIT</label>
                             <input type="number" id="cfg-practice-med" class="glass-input" style="width: 100%;">
                           </div>
                           <div>
                             <label style="font-size: 0.65rem; color: var(--text-secondary); display: block; margin-bottom: 0.4rem;">DAILY EXAM LIMIT</label>
                             <input type="number" id="cfg-exam-med" class="glass-input" style="width: 100%;">
                           </div>
                        </div>
                        <div style="margin-top: 1rem;">
                           <label style="font-size: 0.65rem; color: var(--text-secondary); display: block; margin-bottom: 0.4rem;">DEFAULT AI CREDITS (On Activation)</label>
                           <input type="number" id="cfg-ai-credits-medium" class="glass-input" style="width: 100%;">
                        </div>
                      </div>

                      <!-- Global Pricing -->
                      <div style="padding-top: 1rem; border-top: 1px solid var(--glass-border);">
                        <h4 style="font-size: 0.8rem; font-weight: 800; color: var(--text-primary); text-transform: uppercase; margin-bottom: 1rem;">Elite Pricing (₦)</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                           <div>
                             <label style="font-size: 0.65rem; color: var(--text-secondary); display: block; margin-bottom: 0.4rem;">LIFETIME ACCESS</label>
                             <input type="number" id="cfg-price-lifetime" class="glass-input" style="width: 100%;">
                           </div>
                           <div>
                             <label style="font-size: 0.65rem; color: var(--text-secondary); display: block; margin-bottom: 0.4rem;">MONTHLY RENEWAL</label>
                             <input type="number" id="cfg-price-monthly" class="glass-input" style="width: 100%;">
                           </div>
                        </div>
                      </div>

                      <button id="save-limits-btn" class="btn-primary" style="width: 100%; height: 50px; font-weight: 900; border-radius: 12px; margin-top: 1rem;">
                         <i data-lucide="save" style="width: 18px; margin-right: 0.5rem;"></i> PERSIST TIER CONFIGURATION
                      </button>
                   </div>
                </div>
              </section>
            </div>
          </div>

          <!-- News Management Tab -->
          <div id="admin-news-tab" style="display: none;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 2.5rem;">
              <div>
                <h2 style="font-family: 'Outfit'; font-weight: 900; color: var(--text-primary); margin: 0; font-size: 1.75rem;">News & Updates</h2>
                <p style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 500;">Draft and publish system-wide announcements</p>
              </div>
              <button id="add-news-btn" class="btn-primary" style="height: 48px; padding: 0 1.5rem; font-weight: 800; border-radius: 12px; display: flex; align-items: center; gap: 0.5rem;">
                 <i data-lucide="plus-circle" style="width: 18px;"></i> ADD ARTICLE
              </button>
            </div>
            <div id="admin-news-list" style="display: flex; flex-direction: column; gap: 1.25rem;">
               <div class="loader-spinner" style="margin: 3rem auto;"></div>
            </div>
          </div>

          <!-- Audit Logs Tab (Super Admin Only) -->
          <div id="admin-audit-tab" style="display: none;">
            <div style="margin-bottom: 2.5rem;">
              <h2 style="font-family: 'Outfit'; font-weight: 900; color: var(--text-primary); margin: 0; font-size: 1.75rem;">System Audit Logs</h2>
              <p style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 500;">Review all administrative actions for transparency</p>
            </div>
            <div class="glass card" style="padding: 1.5rem; border-radius: 20px; font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; height: 500px; overflow-y: auto;">
              <div id="audit-logs-list">Loading logs...</div>
            </div>
          </div>

          <!-- Staff Tab (Super Admin Only) -->
          <div id="admin-staff-tab" style="display: none;">
            <div style="margin-bottom: 2.5rem;">
              <h2 style="font-family: 'Outfit'; font-weight: 900; color: var(--text-primary); margin: 0; font-size: 1.75rem;">Staff Management</h2>
              <p style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 500;">Assign administrative roles and permissions</p>
            </div>
            
            <div class="glass card" style="padding: 2rem; border-radius: 20px; margin-bottom: 2.5rem; border-left: 4px solid var(--accent-primary);">
              <h3 style="font-size: 0.9rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1.5rem; text-transform: uppercase;">Promote / Revoke Privileges</h3>
              <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                <input type="email" id="staff-email-input" placeholder="User email address..." class="glass-input" style="flex: 2; min-width: 250px; height: 50px;">
                <select id="staff-role-select" class="glass-select" style="flex: 1; min-width: 150px; height: 50px;">
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                  <option value="user">Revoke (User)</option>
                </select>
                <button id="assign-staff-btn" class="btn-primary" style="height: 50px; padding: 0 2rem; font-weight: 900; border-radius: 12px;">ASSIGN ROLE</button>
              </div>
            </div>
            <div id="staff-list" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
                <div class="loader-spinner" style="margin: 2rem auto;"></div>
            </div>
          </div>

        </main>
      </div>
    `

    this.setupEvents(onBack)
    this.loadQuestions()
  },

  async setupEvents(onBack) {
    document.getElementById('admin-back-home').onclick = onBack

    // Tab Navigation Logic
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.onclick = () => {
        const target = tab.dataset.tab;
        
        // Remove active class from all tabs
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Toggle Tab Visibility
        if(document.getElementById('admin-news-tab')) document.getElementById('admin-news-tab').style.display = target === 'news' ? 'block' : 'none'
        document.getElementById('admin-analytics-tab').style.display = target === 'analytics' ? 'block' : 'none'
        document.getElementById('admin-quality-audit-tab').style.display = target === 'quality-audit' ? 'block' : 'none'
        document.getElementById('admin-questions-tab').style.display = target === 'questions' ? 'block' : 'none'
        document.getElementById('admin-syllabus-tab').style.display = target === 'syllabus' ? 'block' : 'none'
        document.getElementById('admin-users-tab').style.display = target === 'users' ? 'block' : 'none'
        document.getElementById('admin-reports-tab').style.display = target === 'reports' ? 'block' : 'none'
        document.getElementById('admin-marketing-tab').style.display = target === 'marketing' ? 'block' : 'none'
        if (document.getElementById('admin-leagues-tab')) {
          document.getElementById('admin-leagues-tab').style.display = target === 'leagues' ? 'block' : 'none'
        }
        if (document.getElementById('admin-audit-tab')) {
            document.getElementById('admin-audit-tab').style.display = target === 'audit' ? 'block' : 'none'
        }
        if (document.getElementById('admin-staff-tab')) {
          document.getElementById('admin-staff-tab').style.display = target === 'staff' ? 'block' : 'none'
        }
        if (document.getElementById('admin-lab-tab')) {
          document.getElementById('admin-lab-tab').style.display = target === 'lab' ? 'block' : 'none'
        }

        // Trigger Data Loads
        if (target === 'questions') this.loadQuestions()
        else if (target === 'syllabus') this.loadSyllabus()
        else if (target === 'users') this.loadUsers()
        else if (target === 'reports') this.loadReports()
        else if (target === 'marketing') this.loadMarketing()
        else if (target === 'news') this.loadNews()
        else if (target === 'analytics') this.loadGlobalAnalytics()
        else if (target === 'quality-audit') this.loadQualityAudit()
        else if (target === 'audit') this.loadAuditLogs()
        else if (target === 'staff') this.loadStaff()
        else if (target === 'leagues') this.loadLeagues()
        else if (target === 'lab') this.loadLab()

        if (window.lucide) window.lucide.createIcons()
      }
    })

    document.getElementById('audit-refresh').onclick = () => this.loadQualityAudit()

    document.getElementById('analytics-refresh').onclick = () => this.loadGlobalAnalytics()


    // Question Filters
    const search = document.getElementById('question-search')
    const exFilt = document.getElementById('filter-exam')
    const subFilt = document.getElementById('filter-subject')
    const topFilt = document.getElementById('filter-topic')

    const updateTopics = async () => {
      if (!topFilt) return // Safety check
      topFilt.innerHTML = '<option value="">All Topics</option>'
      if (subFilt.value) {
        // Find subject ID
        const { data: subjects } = await DataService.getSubjects()
        const subId = subjects.find(s => s.subject_name === subFilt.value)?.id
        
        // Find exam ID
        const { data: exams } = await DataService.getExams()
        const examId = exams.find(e => e.exam_name === exFilt.value)?.id

        if (subId) {
          const { data: topics } = await DataService.getTopics(subId, examId)
          topics.forEach(t => {
             const topicName = typeof t === 'string' ? t : t.topic
             topFilt.appendChild(new Option(topicName, topicName))
          })
        }
      }
    }

    const triggerSelectLoad = async () => {
      const { data: exams } = await DataService.getExams()
      const { data: subjects } = await DataService.getSubjects()
      
      exFilt.innerHTML = '<option value="">All Exams</option>'
      subFilt.innerHTML = '<option value="">All Subjects</option>'
      
      exams.forEach(e => exFilt.appendChild(new Option(e.exam_name, e.exam_name)))
      subjects.forEach(s => subFilt.appendChild(new Option(s.subject_name, s.subject_name)))
    }
    triggerSelectLoad()

    const triggerFilter = () => {
      this.loadQuestions({
        search: search.value || undefined,
        exam_type: exFilt.value || undefined,
        subject: subFilt.value || undefined,
        topic: topFilt.value || undefined
      })
    }

    search.oninput = triggerFilter
    exFilt.onchange = async () => {
      await updateTopics()
      triggerFilter()
    }
    subFilt.onchange = async () => {
      await updateTopics()
      triggerFilter()
    }
    topFilt.onchange = triggerFilter

    // Staff Events
    const assignBtn = document.getElementById('assign-staff-btn')
    if (assignBtn) {
      assignBtn.onclick = async () => {
        const email = document.getElementById('staff-email-input').value.trim()
        const role = document.getElementById('staff-role-select').value
        if (!email) return ModalService.alert('Missing Field', 'Enter an email address.', 'warning')
        
        assignBtn.disabled = true
        assignBtn.textContent = 'Updating...'
        const { error } = await DataService.updateUserRole(email, role)
        if (error) {
            ModalService.alert('Assignment Failed', error.message, 'error')
        } else {
            await DataService.logAdminAction(this._adminProfile.email, 'Assign Role', email, role)
            ModalService.showToast(`✅ ${role} role assigned to ${email}`, 'success')
            document.getElementById('staff-email-input').value = ''
            this.loadStaff()
        }
        assignBtn.textContent = 'Assign Role'
        assignBtn.disabled = false
      }
    }

    // Marketing Events
    const saveBroadcastBtn = document.getElementById('save-broadcast-btn')
    const clearBroadcastBtn = document.getElementById('clear-broadcast-btn')
    const broadcastInput = document.getElementById('broadcast-message-input')

    if (saveBroadcastBtn) {
        saveBroadcastBtn.onclick = async () => {
            const msg = broadcastInput.value.trim()
            if (!msg) return ModalService.alert('Empty Message', 'Please enter a message to broadcast.', 'warning')
            
            saveBroadcastBtn.textContent = 'Pushing...'
            saveBroadcastBtn.disabled = true
            const { error } = await DataService.updateSystemConfig('broadcast_message', msg)
            if (error) ModalService.alert('Broadcast Failed', error.message, 'error')
            else {
                await DataService.logAdminAction(this._adminProfile.email, 'Update Broadcast', 'global', msg.substring(0, 50))
                ModalService.showToast('📡 Broadcast pushed to all dashboards!', 'success')
            }
            saveBroadcastBtn.innerHTML = '<i data-lucide="radio" style="width: 18px; margin-right: 0.5rem;"></i> PUSH BROADCAST'
            saveBroadcastBtn.disabled = false
            if (window.lucide) window.lucide.createIcons({ root: saveBroadcastBtn })
        }
    }

    if (clearBroadcastBtn) {
        clearBroadcastBtn.onclick = async () => {
            const confirmed = await ModalService.confirm("Clear Broadcast?", "This will remove the announcement banner from all user dashboards. Continue?");
            if (!confirmed) return;

            clearBroadcastBtn.disabled = true
            clearBroadcastBtn.textContent = 'Clearing...'
            const { error } = await DataService.updateSystemConfig('broadcast_message', '')
            if (error) ModalService.alert('Failed to Clear', error.message, 'error')
            else {
                broadcastInput.value = ''
                await DataService.logAdminAction(this._adminProfile.email, 'Clear Broadcast', 'global', 'Announcement cleared')
                ModalService.showToast('🧹 Broadcast cleared successfully!', 'success')
            }
            clearBroadcastBtn.innerHTML = '<i data-lucide="trash-2" style="width: 18px; margin-right: 0.5rem;"></i> CLEAR'
            clearBroadcastBtn.disabled = false
            if (window.lucide) window.lucide.createIcons({ root: clearBroadcastBtn })
        }
    }

    // News Events
    const addNewsBtn = document.getElementById('add-news-btn')
    if (addNewsBtn) {
        addNewsBtn.onclick = () => this.openNewsEditModal()
    }

    const saveLimitsBtn = document.getElementById('save-limits-btn')
    if (saveLimitsBtn) {
        saveLimitsBtn.onclick = async () => {
            saveLimitsBtn.textContent = 'Saving...'
            saveLimitsBtn.disabled = true
            
            const configs = {
                daily_goal_target: document.getElementById('cfg-daily-goal').value,
                daily_practice_limit_free: document.getElementById('cfg-practice-free').value,
                daily_exam_limit_free: document.getElementById('cfg-exam-free').value,
                daily_practice_limit_medium: document.getElementById('cfg-practice-med').value,
                daily_exam_limit_medium: document.getElementById('cfg-exam-med').value,
                ai_credits_initial_medium: document.getElementById('cfg-ai-credits-medium').value,
                pricing_lifetime: document.getElementById('cfg-price-lifetime').value,
                pricing_monthly: document.getElementById('cfg-price-monthly').value
            }

            let hasError = false
            for (const [key, val] of Object.entries(configs)) {
                if (val) {
                    const { error } = await DataService.updateSystemConfig(key, val)
                    if (error) {
                        ModalService.alert('Config Error', `Error updating ${key}: ${error.message}`, 'error')
                        hasError = true
                        break
                    }
                }
            }

            if (!hasError) {
                await DataService.logAdminAction(this._adminProfile.email, 'Update Limits/Pricing', 'global', 'Multiple keys updated')
                ModalService.showToast('✅ Tier configuration saved successfully!', 'success')
                this.loadMarketing()
            }
            saveLimitsBtn.textContent = 'Persist Tier Configuration'
            saveLimitsBtn.disabled = false
        }
    }

    // Premium Feature Toggles
    const setupToggle = (btnId, configKey, label) => {
        const btn = document.getElementById(btnId)
        if (!btn) return
        btn.onclick = async () => {
            const currentState = btn.dataset.state === 'true'
            const newState = !currentState
            btn.disabled = true
            btn.textContent = 'Updating...'
            
            const { error } = await DataService.updateSystemConfig(configKey, newState)
            if (error) {
                ModalService.alert('Toggle Failed', error.message, 'error')
            } else {
                await DataService.logAdminAction(this._adminProfile.email, `Toggle ${configKey}`, 'global', `New State: ${newState}`)
                ModalService.showToast(`${label} ${newState ? '✅ ENABLED' : '🔒 DISABLED'} for all users`, newState ? 'success' : 'info')
                this.loadMarketing()
            }
            btn.disabled = false
        }
    }

    setupToggle('toggle-explanations-btn', 'explanations_free_access', 'Explanations')
    setupToggle('toggle-exams-btn', 'exams_free_access', 'Mock Exams')
    setupToggle('toggle-ai-tutor-btn', 'ai_tutor_free_access', 'AI Tutor')

    const addPromoBtn = document.getElementById('add-promo-btn')
    if (addPromoBtn) {
        addPromoBtn.onclick = async () => {
            const code = document.getElementById('promo-code-input').value.trim().toUpperCase()
            const percent = parseInt(document.getElementById('promo-percent-input').value)
            const expiry = document.getElementById('promo-expiry-input').value
            
            if (!code || isNaN(percent)) return ModalService.alert('Missing Fields', 'Enter a code string and a valid percentage.', 'warning')
            
            addPromoBtn.textContent = 'Creating...'
            addPromoBtn.disabled = true
            const { error } = await DataService.addPromoCode(code, percent, expiry)
            if (error) ModalService.alert('Promo Error', error.message, 'error')
            else {
                await DataService.logAdminAction(this._adminProfile.email, 'Create Promo', code, `${percent}% off`)
                ModalService.showToast(`🎟️ Promo code ${code} created!`, 'success')
                document.getElementById('promo-code-input').value = ''
                document.getElementById('promo-percent-input').value = ''
                this.loadMarketing()
            }
            addPromoBtn.textContent = 'Create Promo Code'
            addPromoBtn.disabled = false
        }
      }

    // Question Management Buttons
    document.getElementById('add-question-btn').onclick = () => this.openEditModal({})

    // Lab Logic
    const genLabBtn = document.getElementById('generate-lab-btn')
    if (genLabBtn) {
      genLabBtn.onclick = () => this.handleAiGenerate()
    }

    const saveLabBtn = document.getElementById('save-all-lab-btn')
    if (saveLabBtn) {
      saveLabBtn.onclick = () => this.saveGeneratedQuestions()
    }

    // Bulk Import Logic
    const bulkBtn = document.getElementById('bulk-import-btn')
    const bulkInput = document.getElementById('bulk-import-input')
    if (bulkBtn && bulkInput) {
      bulkBtn.onclick = () => bulkInput.click()
      bulkInput.onchange = (e) => {
        const file = e.target.files[0]
        if (file) this.handleBulkUpload(file)
      }
    }
  },

  // --- AI QUESTION LAB ---

  async loadLab() {
    const examSelect = document.getElementById('lab-exam');
    const subSelect = document.getElementById('lab-subject');
    const topicSelect = document.getElementById('lab-topic');

    if (examSelect.options.length <= 1) {
      const { data: exams } = await DataService.getExams();
      if (exams) exams.forEach(e => examSelect.appendChild(new Option(e.exam_name, e.exam_name)));
    }

    if (subSelect.options.length <= 1) {
      const { data: subjects } = await DataService.getSubjects();
      if (subjects) subjects.forEach(s => subSelect.appendChild(new Option(s.subject_name, s.subject_name)));
    }

    const updateLabTopics = async () => {
        topicSelect.innerHTML = '<option value="">All Topics</option>';
        if (subSelect.value) {
            const { data: subjects } = await DataService.getSubjects();
            const subId = subjects.find(s => s.subject_name === subSelect.value)?.id;
            
            const { data: exams } = await DataService.getExams();
            const examId = exams.find(e => e.exam_name === examSelect.value)?.id;

            if (subId) {
                const { data: topics } = await DataService.getTopics(subId, examId);
                topics.forEach(t => {
                    const topicName = typeof t === 'string' ? t : t.topic;
                    topicSelect.appendChild(new Option(topicName, topicName));
                });
            }
        }
    };

    examSelect.onchange = updateLabTopics;
    subSelect.onchange = updateLabTopics;

    if (window.lucide) window.lucide.createIcons({ root: document.getElementById('admin-lab-tab') });
  },

  async handleAiGenerate() {
    const exam = document.getElementById('lab-exam').value;
    const subject = document.getElementById('lab-subject').value;
    const topic = document.getElementById('lab-topic').value;
    const count = parseInt(document.getElementById('lab-count').value);
    
    if (!subject) return ModalService.alert("Subject Required", "Please select a subject to guide the AI.", 'warning');

    const btn = document.getElementById('generate-lab-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="pulse">⏳ AI Thinking...</span>';

    const emptyState = document.getElementById('lab-empty-state');
    const resultsContainer = document.getElementById('lab-results-container');
    const list = document.getElementById('lab-questions-list');
    const counter = document.getElementById('lab-result-count');

    try {
      const { AiService } = await import('../services/aiService');
      const questions = await AiService.generateQuestions(exam, subject, topic, count);
      
      this._labDrafts = questions; 
      
      emptyState.style.display = 'none';
      resultsContainer.style.display = 'block';
      counter.textContent = questions.length;
      
      list.innerHTML = questions.map((q, idx) => `
        <div class="glass card scale-in" style="padding: 1.5rem; border-left: 4px solid var(--accent-secondary); background: rgba(255,255,255,0.01);">
          <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
             <span style="font-size: 0.7rem; font-weight: 800; color: var(--accent-secondary); text-transform: uppercase;">Draft #${idx + 1}</span>
             <span style="font-size: 0.7rem; font-weight: 800; color: var(--success);">CORRECT: ${q.correct_option}</span>
          </div>
          <p style="font-size: 1rem; font-weight: 600; line-height: 1.6; margin-bottom: 1rem; color: var(--text-primary);">${q.question_text}</p>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem; opacity: 0.8;">
             <div style="font-size: 0.85rem; padding: 0.5rem; background: rgba(0,0,0,0.2); border-radius: 8px;">A: ${q.option_a}</div>
             <div style="font-size: 0.85rem; padding: 0.5rem; background: rgba(0,0,0,0.2); border-radius: 8px;">B: ${q.option_b}</div>
             <div style="font-size: 0.85rem; padding: 0.5rem; background: rgba(0,0,0,0.2); border-radius: 8px;">C: ${q.option_c}</div>
             <div style="font-size: 0.85rem; padding: 0.5rem; background: rgba(0,0,0,0.2); border-radius: 8px;">D: ${q.option_d}</div>
          </div>
          <div style="font-size: 0.8rem; color: var(--text-secondary); padding: 1rem; background: rgba(0,0,0,0.15); border-radius: 10px;">
             <strong>Explanation:</strong> ${q.explanation}
          </div>
        </div>
      `).join('');

      if (window.renderMathInElement) {
        window.renderMathInElement(list, {
          delimiters: [
            {left: "$$", right: "$$", display: true},
            {left: "$", right: "$", display: false}
          ],
          throwOnError: false
        });
      }

    } catch (err) {
      ModalService.alert("Generation Failed", err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="sparkles" style="width: 18px;"></i> GENERATE BATCH';
      if (window.lucide) window.lucide.createIcons({ root: btn });
    }
  },

  async saveGeneratedQuestions() {
    if (!this._labDrafts || this._labDrafts.length === 0) return;

    const btn = document.getElementById('save-all-lab-btn');
    btn.disabled = true;
    btn.textContent = 'Saving Batch...';

    try {
      const examVal = document.getElementById('lab-exam').value || 'JAMB';
      const formatted = this._labDrafts.map(q => ({
        question_text: q.question_text,
        exam_type: examVal,
        subject: q.subject,
        topic: q.topic,
        explanation: q.explanation,
        answers: [
          { text: q.option_a, is_correct: q.correct_option === 'A' },
          { text: q.option_b, is_correct: q.correct_option === 'B' },
          { text: q.option_c, is_correct: q.correct_option === 'C' },
          { text: q.option_d, is_correct: q.correct_option === 'D' }
        ]
      }));

      const { count, failed } = await DataService.bulkAddQuestions(formatted);
      await DataService.logAdminAction(this._adminProfile.email, 'AI Lab Save', 'questions', `Generated and saved ${count} questions. Failed: ${failed}`);
      ModalService.alert("Batch Saved", `🚀 ${count} questions have been deployed to production.`, 'success');
      
      document.getElementById('lab-results-container').style.display = 'none';
      document.getElementById('lab-empty-state').style.display = 'block';
      this._labDrafts = [];
    } catch (err) {
      ModalService.alert("Save Failed", err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="save" style="width: 16px; margin-right: 0.5rem;"></i> SAVE ALL TO DATABASE';
      if (window.lucide) window.lucide.createIcons({ root: btn });
    }
  },

  handleBulkUpload(file) {
    const btn = document.getElementById('bulk-import-btn')
    btn.textContent = '⏳ Processing...'
    btn.disabled = true

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data
        if (rows.length === 0) {
            btn.textContent = '📦 Bulk Import (.csv)'
            btn.disabled = false
            return ModalService.alert('Import Error', 'CSV is empty or has no valid rows.', 'warning')
        }

        const questions = rows.map(row => ({
          question_text: row.question_text || row.question,
          exam_type: row.exam_type || 'JAMB',
          subject: row.subject || 'General',
          topic: row.topic || '',
          explanation: row.explanation || '',
          diagram_url: row.diagram_url || null,
          answers: [
            { text: row.option_a, is_correct: String(row.correct_option).trim().toUpperCase() === 'A' },
            { text: row.option_b, is_correct: String(row.correct_option).trim().toUpperCase() === 'B' },
            { text: row.option_c, is_correct: String(row.correct_option).trim().toUpperCase() === 'C' },
            { text: row.option_d, is_correct: String(row.correct_option).trim().toUpperCase() === 'D' }
          ].filter(a => a.text)
        })).filter(q => q.question_text)

        if (questions.length === 0) {
            btn.textContent = '📦 Bulk Import (.csv)'
            btn.disabled = false
            return ModalService.alert('Import Error', 'No valid questions found in CSV. Check column names.', 'warning')
        }

        const { error, count, failed, errors: importErrors } = await DataService.bulkAddQuestions(questions)
        if (error) ModalService.alert('Import Error', String(error), 'error')
        else {
            await DataService.logAdminAction(this._adminProfile.email, 'Bulk Import', 'questions', `Imported ${count} questions. Failed: ${failed}`)
            if (failed > 0) {
              ModalService.alert('Import Complete (with errors)', `Imported ${count} questions. ${failed} questions failed due to missing correct answers.`, 'warning')
            } else {
              ModalService.showToast(`✅ Successfully imported ${count} questions!`, 'success')
            }
        }
        
        btn.textContent = '📦 Bulk Import (.csv)'
        btn.disabled = false
        this.loadQuestions()
      }
    })
  },



  async loadQuestions(filters = {}, offset = 0) {
    const list = document.getElementById('questions-list')
    const counter = document.getElementById('question-count-display')
    list.innerHTML = 'Loading questions...'
    
    const { data: questions, count, error } = await DataService.getQuestions({ ...filters, offset, limit: 20 })
    
    if (error) {
      list.innerHTML = `<div style="color: var(--error);">Failed to load questions: ${error.message || error}</div>`
      counter.textContent = "Error loading"
      return
    }

    if (!questions || questions.length === 0) {
      list.innerHTML = '<div style="color: #888; text-align: center; padding: 2rem;">No questions found.</div>'
      counter.innerHTML = `<span style="font-size: 1.1rem; font-weight: 700; color: var(--accent-primary);">Total Questions: 0</span>`
      return
    }

    counter.innerHTML = `
      <div style="background: rgba(59, 130, 246, 0.1); padding: 0.5rem 1rem; border-radius: 8px; border-left: 4px solid var(--accent-primary);">
        <span style="font-size: 1.1rem; font-weight: 800; color: var(--text-primary);">Total Questions: ${count || 0}</span>
        <span style="font-size: 0.8rem; color: var(--text-primary); margin-left: 1rem;">(Showing 20)</span>
      </div>
    `
    
    list.innerHTML = questions.map(q => `
      <div class="glass q-item" style="padding: 1.25rem; display: flex; justify-content: space-between; align-items: center; gap: 1.5rem; border-left: 4px solid var(--accent-primary); margin-bottom: 1rem; border-radius: 12px; transition: transform 0.2s;">
        
        <div style="display: flex; align-items: center; gap: 1.25rem; flex: 1; min-width: 0;">
          ${q.diagram_url ? `
            <div style="width: 50px; height: 50px; border-radius: 8px; overflow: hidden; background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); flex-shrink: 0;">
              <img src="${q.diagram_url}" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
          ` : `
            <div style="width: 50px; height: 50px; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px dashed var(--glass-border); flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">
              <i data-lucide="image" style="width: 18px; opacity: 0.3;"></i>
            </div>
          `}
          
          <div style="flex: 1; min-width: 0;">
            <div style="font-family: 'Outfit'; font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${(q.question_text || '').replace(/<[^>]*>?/gm, '').substring(0, 100)}...
            </div>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <span style="font-size: 0.65rem; background: var(--accent-gradient); color: white; padding: 2px 8px; border-radius: 4px; font-weight: 800; text-transform: uppercase;">${q.exam_type}</span>
              <span style="font-size: 0.65rem; background: rgba(255,255,255,0.05); color: var(--accent-secondary); border: 1px solid rgba(124, 58, 237, 0.2); padding: 2px 8px; border-radius: 4px; font-weight: 700;">${q.subject}</span>
              ${q.topic ? `<span style="font-size: 0.65rem; color: var(--text-secondary); font-weight: 500;">• ${q.topic}</span>` : ''}
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 0.75rem; flex-shrink: 0;">
          <button class="btn-secondary edit-q-btn" data-id="${q.id}" style="height: 38px; padding: 0 1rem; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 0.75rem; font-weight: 700; gap: 0.5rem;" title="Edit Question">
            <i data-lucide="edit-3" style="width: 14px;"></i> Edit
          </button>
          <button class="btn-secondary delete-q-btn" data-id="${q.id}" style="height: 38px; padding: 0 1rem; display: flex; align-items: center; justify-content: center; border-radius: 8px; color: #ef4444; border-color: rgba(239, 68, 68, 0.2); font-size: 0.75rem; font-weight: 700; gap: 0.5rem;" title="Delete Question">
            <i data-lucide="trash-2" style="width: 14px;"></i> Delete
          </button>
        </div>
      </div>
    `).join('')

    // Attach Listeners
    document.querySelectorAll('.delete-q-btn').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id')
        const row = btn.closest('.q-item')
        
        row.style.opacity = '0.3'
        row.style.pointerEvents = 'none'
        
        // Create floating undo toast
        const toast = document.createElement('div')
        toast.className = 'glass card scale-in'
        toast.style.position = 'fixed'
        toast.style.bottom = '80px'
        toast.style.right = '2rem'
        toast.style.zIndex = '99999'
        toast.style.padding = '1rem 1.5rem'
        toast.style.display = 'flex'
        toast.style.alignItems = 'center'
        toast.style.gap = '1rem'
        toast.style.backgroundColor = 'var(--surface-color)'
        toast.style.border = '1px solid var(--warning)'
        toast.innerHTML = `
           <div>
             <div style="font-weight: 800; color: var(--text-primary); font-size: 0.9rem;">Question Queued</div>
             <div style="font-size: 0.75rem; color: var(--text-secondary);">Deactivating in 30 seconds...</div>
           </div>
           <button class="btn-primary" style="background: var(--warning); border: none; padding: 0.5rem 1rem;">UNDO</button>
        `
        document.body.appendChild(toast)
        
        const timeoutId = setTimeout(async () => {
            if(document.body.contains(toast)) document.body.removeChild(toast)
            const { error } = await DataService.deactivateQuestion(id)
            if (error) {
                row.style.opacity = '1'
                row.style.pointerEvents = 'auto'
                ModalService.alert("Deployment Failed", error.message, 'error');
            } else {
                if(row) row.remove()
                await DataService.logAdminAction(this._adminProfile.email, 'Delete Question', id, 'Soft deletion via UI')
            }
        }, 30000)

        toast.querySelector('button').onclick = () => {
             clearTimeout(timeoutId)
             row.style.opacity = '1'
             row.style.pointerEvents = 'auto'
             document.body.removeChild(toast)
        }
      }
    })

    document.querySelectorAll('.edit-q-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id')
        const question = questions.find(q => q.id === id)
        this.openEditModal(question)
      }
    })

    // Phase 2: Render LaTeX Math (KaTeX)
    if (window.renderMathInElement) {
        window.renderMathInElement(list, {
            delimiters: [
                {left: "$$", right: "$$", display: true},
                {left: "$", right: "$", display: false},
                {left: "\\(", right: "\\)", display: false},
                {left: "\\[", right: "\\]", display: true}
            ],
            throwOnError: false
        });
    }
  },

  openEditModal(question) {
    this._openEditModalLogic(question)
  },




  _openEditModalLogic(question) {
    // Determine options based on how data is laid out (from AI report fetch or getQuestions fetch)
    const qa = (question.question_answers && Array.isArray(question.question_answers)) 
                ? question.question_answers[0] 
                : (question.question_answers || {});
                
    // Try to pull correctly from the formatted answers array if question_answers table is empty in the object
    const pullOpt = (letter) => {
        if (qa[`option_${letter.toLowerCase()}`]) return qa[`option_${letter.toLowerCase()}`];
        if (qa[`option_${letter}`]) return qa[`option_${letter}`];
        if (question.answers && Array.isArray(question.answers)) {
            const ans = question.answers.find(a => a.id === letter || a.option_letter === letter);
            return ans ? ans.option_text : '';
        }
        return '';
    };

    const optA = pullOpt('A');
    const optB = pullOpt('B');
    const optC = pullOpt('C');
    const optD = pullOpt('D');
    
    let correctOpt = (qa.correct_option || '').toUpperCase();
    if (!correctOpt && question.answers) {
        const correctAns = question.answers.find(a => a.is_correct);
        if (correctAns) correctOpt = (correctAns.id || correctAns.option_letter || '');
    }

    const explanation = qa.explanation || question.explanation || '';

    const modalHtml = `
      <div id="q-edit-overlay" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.85); z-index:9999; display:flex; justify-content:center; align-items:center; padding:1.5rem; backdrop-filter: blur(8px);">
        <div class="glass card scale-in" style="width: 100%; max-width: 850px; max-height: 90vh; overflow-y: auto; padding: 0; border: 1.5px solid var(--accent-primary); border-radius: 24px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
          
          <div style="padding: 1.5rem 2.5rem; border-bottom: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02);">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
               <div style="width: 40px; height: 40px; border-radius: 10px; background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; color: white;">
                 <i data-lucide="edit-3" style="width: 20px;"></i>
               </div>
               <h3 style="margin: 0; font-family: 'Outfit'; font-weight: 800; font-size: 1.4rem;">Edit Question</h3>
            </div>
            <button id="cancel-q-edit-x" style="background: rgba(239, 68, 68, 0.1); border: none; color: #ef4444; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
               <i data-lucide="x" style="width: 20px;"></i>
            </button>
          </div>
          
          <div style="padding: 2.5rem; display: flex; flex-direction: column; gap: 2rem;">
            <div>
              <label style="font-size: 0.75rem; color: var(--accent-primary); margin-bottom: 0.75rem; display: block; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Question Formulation</label>
              <textarea id="edit-q-text" class="glass-input" style="width: 100%; min-height: 120px; font-size: 1rem; line-height: 1.6; padding: 1.25rem;">${question.question_text || ''}</textarea>
            </div>
            
            <div style="background: rgba(0,0,0,0.2); padding: 1.5rem; border-radius: 16px; border: 1px solid var(--glass-border);">
              <label style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 1.25rem; display: block; font-weight: 800; text-transform: uppercase;">Options Configuration</label>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;">
                <div>
                  <label style="font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 0.4rem; display: block; font-weight: 700;">Option A</label>
                  <input type="text" id="edit-opt-a" class="glass-input" style="width: 100%; font-size: 0.9rem;" value="${optA.replace(/"/g, '&quot;')}">
                </div>
                <div>
                  <label style="font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 0.4rem; display: block; font-weight: 700;">Option B</label>
                  <input type="text" id="edit-opt-b" class="glass-input" style="width: 100%; font-size: 0.9rem;" value="${optB.replace(/"/g, '&quot;')}">
                </div>
                <div>
                  <label style="font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 0.4rem; display: block; font-weight: 700;">Option C</label>
                  <input type="text" id="edit-opt-c" class="glass-input" style="width: 100%; font-size: 0.9rem;" value="${optC.replace(/"/g, '&quot;')}">
                </div>
                <div>
                  <label style="font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 0.4rem; display: block; font-weight: 700;">Option D</label>
                  <input type="text" id="edit-opt-d" class="glass-input" style="width: 100%; font-size: 0.9rem;" value="${optD.replace(/"/g, '&quot;')}">
                </div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 2rem;">
              <div>
                <label style="font-size: 0.75rem; color: var(--accent-primary); margin-bottom: 0.75rem; display: block; font-weight: 800; text-transform: uppercase;">Key / Correct Answer</label>
                <select id="edit-correct" class="glass-select" style="width: 100%; height: 50px;">
                  <option value="A" ${correctOpt === 'A' ? 'selected' : ''}>Option A (Primary)</option>
                  <option value="B" ${correctOpt === 'B' ? 'selected' : ''}>Option B</option>
                  <option value="C" ${correctOpt === 'C' ? 'selected' : ''}>Option C</option>
                  <option value="D" ${correctOpt === 'D' ? 'selected' : ''}>Option D</option>
                </select>
              </div>
              <div>
                <label style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.75rem; display: block; font-weight: 800; text-transform: uppercase;">Solution Explanation</label>
                <textarea id="edit-explanation" class="glass-input" style="width: 100%; min-height: 50px; padding: 0.75rem; font-size: 0.9rem;">${explanation}</textarea>
              </div>
            </div>
          </div>

          <div style="padding: 1.5rem 2.5rem; border-top: 1px solid var(--glass-border); background: rgba(0,0,0,0.2); display: flex; gap: 1rem;">
            <button id="save-q-edit" class="btn-primary" style="flex:2; height: 54px; font-weight: 900; font-family: 'Outfit'; font-size: 1.1rem; border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 0.75rem;">
               <i data-lucide="save" style="width: 20px;"></i> PERSIST CHANGES
            </button>
            <button id="cancel-q-edit-btn" class="btn-secondary" style="flex:1; height: 54px; font-weight: 800; border-radius: 12px;">Discard</button>
          </div>
        </div>
      </div>
    `
    document.body.insertAdjacentHTML('beforeend', modalHtml)
    
    const closeModal = () => document.getElementById('q-edit-overlay').remove();
    document.getElementById('cancel-q-edit-btn').onclick = closeModal;
    document.getElementById('cancel-q-edit-x').onclick = closeModal;
    
    document.getElementById('save-q-edit').onclick = async () => {
      const newText = document.getElementById('edit-q-text').value;
      if (!newText.trim()) return ModalService.alert('Validation Error', 'Question text cannot be empty.', 'warning');
      
      const updatedOpts = {
          option_a: document.getElementById('edit-opt-a').value,
          option_b: document.getElementById('edit-opt-b').value,
          option_c: document.getElementById('edit-opt-c').value,
          option_d: document.getElementById('edit-opt-d').value,
          correct_option: document.getElementById('edit-correct').value,
          explanation: document.getElementById('edit-explanation').value
      };
      
      const saveBtn = document.getElementById('save-q-edit');
      saveBtn.innerHTML = '<span class="pulse">Saving to Database...</span>';
      saveBtn.disabled = true;
      
      // Update Base Question
      const { error: baseError } = await DataService.updateQuestion(question.id, { question_text: newText });
      
      if (baseError) {
        ModalService.alert('Save Error', 'Error updating question text: ' + baseError.message, 'error');
        saveBtn.textContent = '✅ Save All Changes';
        saveBtn.disabled = false;
        return;
      }
      
      // Update Question Answers (if objective and has answers)
      if (question.question_type !== 'theory') {
          const { error: ansError } = await DataService.updateQuestionAnswers(question.id, updatedOpts);
          if (ansError) {
              console.error("Warning: Failed to update answers table. It might not exist for this old question.", ansError);
              // Fallback for very old questions without 'question_answers' relation?
              // Let's assume most questions have this, or it will just fail silently.
          }
      }
      
      document.getElementById('q-edit-overlay').remove();
      this.loadQuestions(); // Reload list
    };
    // Phase 2: Render LaTeX Math (KaTeX) in Modal
    if (window.renderMathInElement) {
        window.renderMathInElement(document.getElementById('q-edit-overlay'), {
            delimiters: [
                {left: "$$", right: "$$", display: true},
                {left: "$", right: "$", display: false}
            ],
            throwOnError: false
        });
    }
  },

  async loadUsers() {
    const list = document.getElementById('users-list')
    list.innerHTML = 'Loading users...'
    const { data: users, error } = await DataService.getAllUsers()
    
    if (error) {
      list.innerHTML = `<div style="color: var(--error);">Error: ${error.message || error}</div>`
      return
    }
    
    if (!users || users.length === 0) {
      list.innerHTML = '<div style="color: var(--text-primary);">No users found.</div>'
      return
    }

    list.innerHTML = users.map(u => {
      const tier = SubscriptionService.resolveUserTier(u);
      const tierColor = tier === 'premium' ? 'var(--accent-secondary)' : (tier === 'medium' ? 'var(--accent-primary)' : '#666');
      const lastSeen = u.last_seen ? new Date(u.last_seen).toLocaleDateString() : 'N/A';
      
      return `
        <div class="glass card user-card" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; border-top: 3px solid ${tierColor}; border-radius: 16px; transition: transform 0.2s; position: relative; overflow: hidden;">
          
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
               <div style="width: 40px; height: 40px; border-radius: 10px; background: ${tierColor}20; color: ${tierColor}; display: flex; align-items: center; justify-content: center;">
                 <i data-lucide="user" style="width: 20px;"></i>
               </div>
               <div>
                 <div style="font-family: 'Outfit'; font-weight: 800; color: var(--text-primary); font-size: 1rem; line-height: 1.2;">${u.username || 'Unknown'}</div>
                 <div style="font-size: 0.75rem; color: var(--text-secondary);">${u.email}</div>
               </div>
            </div>
            <button class="btn-secondary edit-user-btn" data-id="${u.id}" style="height: 32px; padding: 0 0.75rem; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 0.7rem; font-weight: 800; gap: 0.4rem;">
               <i data-lucide="settings" style="width: 12px;"></i> EDIT USER
            </button>
          </div>

          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <span style="font-size: 0.6rem; background: ${tierColor}; color: white; padding: 2px 8px; border-radius: 4px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em;">${tier}</span>
            ${u.is_activated ? '<span style="font-size: 0.6rem; background: var(--success); color: white; padding: 2px 8px; border-radius: 4px; font-weight: 900; text-transform: uppercase;">LIFETIME</span>' : ''}
            <span style="font-size: 0.65rem; background: rgba(255,255,255,0.05); color: var(--text-secondary); padding: 2px 8px; border-radius: 4px; font-weight: 600;">${u.role || 'user'}</span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 12px; border: 1px solid var(--glass-border);">
            <div>
              <div style="font-size: 0.6rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 800; margin-bottom: 0.25rem;">AI Credits</div>
              <div style="font-family: 'Outfit'; font-weight: 800; color: var(--accent-primary); font-size: 1.1rem;">${u.ai_credits || 0}</div>
            </div>
            <div>
              <div style="font-size: 0.6rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 800; margin-bottom: 0.25rem;">Last Seen</div>
              <div style="font-family: 'Outfit'; font-weight: 700; color: var(--text-primary); font-size: 0.9rem;">${lastSeen}</div>
            </div>
          </div>

          <div style="font-size: 0.75rem; color: var(--text-secondary); display: flex; align-items: center; gap: 0.4rem;">
            <i data-lucide="calendar" style="width: 12px;"></i>
            Joined ${new Date(u.created_at).toLocaleDateString()}
          </div>
        </div>
      `;
    }).join('')

    // Attach User Edit Listeners
    document.querySelectorAll('.edit-user-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id')
        const user = users.find(u => u.id === id)
        if (user) this.openUserEditModal(user)
      }
    })
  },

  openUserEditModal(user) {
    const lastSeen = user.last_seen ? new Date(user.last_seen).toLocaleDateString() : 'Never';
    const modalHtml = `
      <div id="user-edit-overlay" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.85); z-index:9999; display:flex; justify-content:center; align-items:center; padding:1.5rem; backdrop-filter: blur(8px);">
        <div class="glass card scale-in" style="width: 100%; max-width: 550px; padding: 0; border: 1.5px solid var(--accent-primary); border-radius: 24px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); overflow: hidden;">
          
          <div style="padding: 1.5rem 2rem; border-bottom: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02);">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
               <div style="width: 36px; height: 36px; border-radius: 10px; background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; color: white;">
                 <i data-lucide="user-cog" style="width: 18px;"></i>
               </div>
               <h3 style="margin: 0; font-family: 'Outfit'; font-weight: 800; font-size: 1.25rem;">Member Settings</h3>
            </div>
            <button id="close-user-x" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; transition: color 0.2s;">
               <i data-lucide="x" style="width: 20px;"></i>
            </button>
          </div>

          <div style="padding: 2rem; display: flex; flex-direction: column; gap: 1.5rem;">
            
            <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 16px; border: 1px solid var(--glass-border);">
               <div style="width: 50px; height: 50px; border-radius: 50%; background: var(--accent-primary); display: flex; align-items: center; justify-content: center; font-family: 'Outfit'; font-weight: 900; font-size: 1.5rem; color: white; text-transform: uppercase;">
                 ${(user.username || user.email || '?').charAt(0)}
               </div>
               <div>
                 <div style="font-family: 'Outfit'; font-weight: 800; color: var(--text-primary); font-size: 1.1rem;">${user.username || 'System Member'}</div>
                 <div style="font-size: 0.75rem; color: var(--text-secondary);">${user.email}</div>
               </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;">
              <div>
                <label style="font-size: 0.7rem; color: var(--accent-primary); font-weight: 800; text-transform: uppercase; display: block; margin-bottom: 0.5rem; letter-spacing: 0.05em;">Tier (Access Level)</label>
                <select id="edit-user-tier" class="glass-select" style="width: 100%;">
                  <option value="freemium" ${user.tier === 'freemium' ? 'selected' : ''}>Freemium (Free)</option>
                  <option value="medium" ${user.tier === 'medium' ? 'selected' : ''}>Medium (Activated Standard)</option>
                  <option value="premium" ${user.tier === 'premium' ? 'selected' : ''}>Premium (Elite Pro Active)</option>
                </select>
              </div>

              <div>
                <label style="font-size: 0.7rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase; display: block; margin-bottom: 0.5rem; letter-spacing: 0.05em;">Account Status</label>
                <div style="display: flex; align-items: center; gap: 0.75rem; height: 44px;">
                   <input type="checkbox" id="edit-user-activated" ${user.is_activated ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--success);">
                   <label for="edit-user-activated" style="font-size: 0.85rem; color: var(--text-primary); cursor: pointer; font-weight: 600;">Lifetime Paid</label>
                </div>
              </div>
            </div>

            <div>
              <label style="font-size: 0.7rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase; display: block; margin-bottom: 0.5rem;">Manual Expiry Override</label>
              <div style="position: relative;">
                <input type="datetime-local" id="edit-user-expiry" class="glass-input" value="${user.subscription_expiry ? new Date(user.subscription_expiry).toISOString().slice(0, 16) : ''}" style="width: 100%; padding-left: 1rem;">
              </div>
              <p style="font-size: 0.65rem; color: var(--text-secondary); margin-top: 0.4rem;">Select "Premium" above to auto-set 30 days, or override here.</p>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;">
              <div>
                <label style="font-size: 0.7rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase; display: block; margin-bottom: 0.5rem;">AI Credits Bank</label>
                <input type="number" id="edit-user-credits" class="glass-input" value="${user.ai_credits || 0}" style="width: 100%;">
              </div>
              <div>
                <label style="font-size: 0.7rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase; display: block; margin-bottom: 0.5rem;">Daily AI Burn</label>
                <input type="number" id="edit-user-ai-usage" class="glass-input" value="${user.ai_daily_usage || 0}" style="width: 100%;">
              </div>
            </div>

            <div style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.75rem;">
               <div style="display: flex; gap: 1rem;">
                 <button id="save-user-edit" class="btn-primary" style="flex:2; height: 50px; font-weight: 800; font-family: 'Outfit';">COMMIT UPDATES</button>
                 <button id="cancel-user-edit" class="btn-secondary" style="flex:1; height: 50px; font-weight: 700;">CANCEL</button>
               </div>
               <button id="flag-user-btn" style="width: 100%; height: 44px; background: rgba(239, 68, 68, 0.05); border: 1px dashed rgba(239, 68, 68, 0.3); color: #ef4444; border-radius: 10px; font-weight: 800; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s;">
                  <i data-lucide="flag" style="width: 14px;"></i> FLAG FOR SUSPICIOUS ACTIVITY
               </button>
            </div>
          </div>
        </div>
      `;
    document.body.insertAdjacentHTML('beforeend', modalHtml)
    if (window.lucide) window.lucide.createIcons({ root: document.getElementById('user-edit-overlay') })

    document.getElementById('close-user-x').onclick = () => document.getElementById('user-edit-overlay').remove()
    
    const tierSelect = document.getElementById('edit-user-tier')
    const expiryInput = document.getElementById('edit-user-expiry')
    
    // Tier Change Helper Logic
    tierSelect.onchange = () => {
      const tier = tierSelect.value
      if (tier === 'premium') {
          const nextMonth = new Date()
          nextMonth.setDate(nextMonth.getDate() + 30)
          expiryInput.value = nextMonth.toISOString().slice(0, 16)
      } else if (tier === 'medium') {
          const yesterday = new Date()
          yesterday.setDate(yesterday.getDate() - 1)
          expiryInput.value = yesterday.toISOString().slice(0, 16)
      } else {
          expiryInput.value = ''
      }
    }

    document.getElementById('save-user-edit').onclick = async () => {
      const updates = {
        tier: tierSelect.value,
        activation_status: tierSelect.value !== 'freemium',
        subscription_expiry: expiryInput.value || null,
        ai_credits: parseInt(document.getElementById('edit-user-credits').value) || 0,
        ai_daily_usage: parseInt(document.getElementById('edit-user-ai-usage').value) || 0
      }
      
      const saveBtn = document.getElementById('save-user-edit')
      saveBtn.textContent = 'Saving...'
      saveBtn.disabled = true
      
      const { error } = await DataService.updateUser(user.id, updates)
      if (error) {
        ModalService.alert('Save Error', error.message, 'error')
        saveBtn.textContent = 'Commit Updates'
        saveBtn.disabled = false
      } else {
        // Log Action
        await DataService.logAdminAction(this._adminProfile.email, 'Update User', user.id, `Tier: ${updates.tier}, Credits: ${updates.ai_credits}`)
        document.getElementById('user-edit-overlay').remove()
        this.loadUsers()
      }
    }

    document.getElementById('flag-user-btn').onclick = async () => {
        const reason = window.prompt('Reason for flagging (e.g. "Cheating - high scores"):')
        if (!reason) return
        const btn = document.getElementById('flag-user-btn')
        btn.disabled = true
        btn.textContent = 'Flagging...'
        const { error } = await DataService.flagUser(user.id, reason)
        if (error) ModalService.alert('Flag Error', error.message, 'error')
        else {
            await DataService.logAdminAction(this._adminProfile.email, 'Flag User', user.id, reason)
            ModalService.showToast('⚠️ User has been flagged for review.', 'info')
            document.getElementById('user-edit-overlay').remove()
            this.loadUsers()
        }
    }
  },

  async loadSyllabus() {
    const list = document.getElementById('syllabus-list')
    if (!list) return
    list.innerHTML = '<div class="loader-spinner" style="margin: 3rem auto;"></div>'
    
    try {
      const { data: fullSyllabus, error } = await DataService.getFullSyllabus()
      if (error) throw error

      const hierarchy = {}
      fullSyllabus.forEach(item => {
        const examName = item.exams?.exam_name || 'Uncategorized'
        const subjectName = item.subjects?.subject_name || 'Generic'
        
        if (!hierarchy[examName]) hierarchy[examName] = {}
        if (!hierarchy[examName][subjectName]) hierarchy[examName][subjectName] = []
        
        hierarchy[examName][subjectName].push({ 
          id: item.id, 
          topic: item.topic,
          importance: item.importance || 1 
        })
      })

      list.innerHTML = Object.entries(hierarchy).map(([examName, subjects]) => `
        <div class="exam-group" style="margin-bottom: 1.25rem;">
          <div class="glass syllabus-header exam-toggle" style="padding: 1.25rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; background: rgba(59, 130, 246, 0.08); border-left: 4px solid var(--accent-primary); border-radius: 12px; transition: background 0.2s;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
               <div style="width: 32px; height: 32px; border-radius: 8px; background: var(--accent-primary); display: flex; align-items: center; justify-content: center; color: white;">
                 <i data-lucide="graduation-cap" style="width: 16px;"></i>
               </div>
               <strong style="font-family: 'Outfit'; font-size: 1.1rem; color: var(--text-primary);">${examName}</strong>
            </div>
            <i data-lucide="chevron-down" class="toggle-icon" style="width: 20px; color: var(--text-secondary); transition: transform 0.3s;"></i>
          </div>
          <div class="subjects-container" style="display: none; padding-left: 1.5rem; margin-top: 0.75rem; border-left: 2px solid var(--glass-border); margin-left: 1rem;">
            ${Object.entries(subjects).map(([subName, topics]) => `
              <div class="subject-group" style="margin-bottom: 0.75rem;">
                <div class="glass syllabus-header subject-toggle" style="padding: 1rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; background: rgba(255, 255, 255, 0.02); border-radius: 10px; border: 1px solid var(--glass-border);">
                  <div style="display: flex; align-items: center; gap: 0.6rem;">
                    <i data-lucide="book" style="width: 14px; color: var(--accent-secondary);"></i>
                    <span style="font-weight: 700; font-family: 'Outfit';">${subName}</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600;">${topics.length} Topics</span>
                    <i data-lucide="chevron-down" class="toggle-icon" style="width: 16px; color: var(--text-secondary);"></i>
                  </div>
                </div>
                <div class="topics-container" style="display: none; padding: 1rem; background: rgba(0,0,0,0.1); border-radius: 10px; margin-top: 0.5rem; border: 1px dashed var(--glass-border);">
                  <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem;">
                    <div style="position: relative; flex: 1; min-width: 200px;">
                      <i data-lucide="plus-circle" style="position: absolute; left: 0.75rem; top: 11px; width: 14px; color: var(--text-secondary);"></i>
                      <input type="text" placeholder="New topic name..." class="glass-input add-topic-input" style="width: 100%; padding: 0.5rem 0.5rem 0.5rem 2.25rem; font-size: 0.85rem; height: 38px;">
                    </div>
                    <button class="btn-primary add-topic-btn" data-exam="${examName}" data-subject="${subName}" style="padding: 0 1.25rem; font-size: 0.8rem; height: 38px; font-weight: 800; border-radius: 8px;">ADD TOPIC</button>
                  </div>
                  ${topics.map(t => `
                    <div class="topic-item" style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 1rem; margin-bottom: 4px; background: rgba(255,255,255,0.015); border-radius: 8px; font-size: 0.9rem; border: 1px solid transparent; transition: border 0.2s;">
                      <div style="display: flex; align-items: center; gap: 1rem; flex: 1;">
                        <span title="Weighting / Importance">
                            <select class="glass-select topic-weight-select" data-id="${t.id}" style="padding: 2px 6px; font-size: 0.7rem; width: auto; height: 28px; background: rgba(0,0,0,0.3);">
                                ${[1,2,3,4,5].map(w => `<option value="${w}" ${t.importance == w ? 'selected' : ''}>${w} ★</option>`).join('')}
                            </select>
                        </span>
                        <span style="font-weight: 500;">${t.topic}</span>
                      </div>
                      <button class="delete-topic-btn" data-id="${t.id}" style="width: 32px; height: 32px; background: none; border: none; color: var(--error); cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 0.4; transition: opacity 0.2s;">
                        <i data-lucide="trash-2" style="width: 14px;"></i>
                      </button>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')

      this.setupSyllabusListeners()
      if (window.lucide) window.lucide.createIcons({ root: list })
    } catch (err) {
      list.innerHTML = `<div style="padding: 2rem; color: var(--error); text-align: center;">Error: ${err.message}</div>`
    }
  },

  setupSyllabusListeners() {
    // Exam toggles
    document.querySelectorAll('.exam-toggle').forEach(el => {
      el.onclick = () => {
        const next = el.nextElementSibling
        const icon = el.querySelector('.toggle-icon')
        const isOpen = next.style.display === 'block'
        next.style.display = isOpen ? 'none' : 'block'
        if (icon) icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)'
        el.style.background = isOpen ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.15)'
      }
    })

    // Subject toggles
    document.querySelectorAll('.subject-toggle').forEach(el => {
      el.onclick = () => {
        const next = el.nextElementSibling
        const icon = el.querySelector('.toggle-icon')
        const isOpen = next.style.display === 'block'
        next.style.display = isOpen ? 'none' : 'block'
        if (icon) icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)'
      }
    })

    // Delete topic
    document.querySelectorAll('.delete-topic-btn').forEach(btn => {
      btn.onclick = async () => {
        const confirmed = await ModalService.confirm('Delete Topic', 'Permanently delete this syllabus topic?')
        if (!confirmed) return
        const id = btn.getAttribute('data-id')
        btn.disabled = true
        const { error } = await DataService.deleteSyllabusTopic(id)
        if (error) ModalService.alert('Delete Error', error.message, 'error')
        else this.loadSyllabus()
      }
    })

    // Update topic weight
    document.querySelectorAll('.topic-weight-select').forEach(sel => {
        sel.onchange = async () => {
            const id = sel.getAttribute('data-id')
            const weight = parseInt(sel.value)
            sel.disabled = true
            const { error } = await DataService.updateSyllabusTopic(id, { importance: weight })
            if (error) {
                ModalService.alert('Weight Error', 'Error updating weight: ' + error.message, 'error')
                sel.disabled = false
            } else {
                sel.disabled = false
            }
        }
    })

    // Add topic
    document.querySelectorAll('.add-topic-btn').forEach(btn => {
      btn.onclick = async (e) => {
        const wrapper = btn.previousElementSibling
        const input = wrapper.querySelector('input')
        const topicName = input.value.trim()
        if (!topicName) return
        
        const examName = btn.getAttribute('data-exam')
        const subjectName = btn.getAttribute('data-subject')
        
        // Find IDs
        const { data: exams } = await DataService.getExams()
        const { data: subjects } = await DataService.getSubjects()
        
        const examId = exams.find(e => e.exam_name === examName)?.id
        const subjectId = subjects.find(s => s.subject_name === subjectName)?.id
        
        if (!examId || !subjectId) {
          ModalService.alert('Lookup Error', 'Exam or Subject ID not found.', 'error')
          return
        }

        const { error } = await DataService.addSyllabusTopic(examId, subjectId, topicName)
        if (error) ModalService.alert('Topic Error', 'Error adding topic: ' + error.message, 'error')
        else this.loadSyllabus()
      }
    })
  },

  async loadReports() {
    const list = document.getElementById('reports-list')
    if (!list) return
    list.innerHTML = 'Loading reports...'
    const { data } = await DataService.getQuestionReports()
    
    if (!data || data.length === 0) {
      list.innerHTML = '<div style="padding: 2rem; text-align: center; color: #888;">No question reports found.</div>'
      return
    }
    
    list.innerHTML = data.map(r => {
      const isResolved = r.status?.includes('resolved');
      const isDismissed = r.status === 'dismissed';
      const statusColor = isResolved ? 'var(--success)' : (isDismissed ? 'var(--text-secondary)' : 'var(--error)');
      
      return `
        <div class="glass card report-card" style="padding: 1.75rem; border-radius: 20px; border-left: 5px solid ${statusColor}; margin-bottom: 1.5rem; transition: transform 0.2s;">
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="background: ${statusColor}20; color: ${statusColor}; width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                <i data-lucide="${isResolved ? 'check-circle' : 'alert-circle'}" style="width: 20px;"></i>
              </div>
              <div>
                <div style="font-family: 'Outfit'; font-weight: 800; color: var(--text-primary); font-size: 1.1rem; text-transform: capitalize;">${r.reason}</div>
                <div style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em;">Status: ${r.status || 'pending'}</div>
              </div>
            </div>
            <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); background: rgba(255,255,255,0.03); padding: 4px 10px; border-radius: 20px;">
              <i data-lucide="clock" style="width: 12px; vertical-align: middle; margin-right: 4px;"></i>
              ${new Date(r.created_at).toLocaleDateString()}
            </span>
          </div>

          <div style="background: rgba(0,0,0,0.2); padding: 1.25rem; border-radius: 12px; border: 1px solid var(--glass-border); margin-bottom: 1.25rem;">
            <div style="font-size: 0.65rem; color: var(--accent-primary); text-transform: uppercase; font-weight: 800; margin-bottom: 0.5rem; letter-spacing: 0.1em;">Student Feedback</div>
            <p style="font-size: 1rem; color: var(--text-primary); margin: 0; line-height: 1.5; font-weight: 500;">"${r.details || 'No details provided.'}"</p>
          </div>

          <div style="background: rgba(255,255,255,0.02); padding: 1.25rem; border-radius: 12px; border: 1px dashed var(--glass-border); margin-bottom: 1.75rem;">
            <div style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 800; margin-bottom: 0.75rem;">Target Question Reference</div>
            <div style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.6; font-style: italic;">
              ${r.questions?.question_text || 'Scale reference unavailable.'}
            </div>
          </div>

          ${(!r.status || r.status === 'pending') ? `
            <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center;">
              <button class="btn-primary ai-fix-btn" data-qid="${r.questions?.id}" data-rid="${r.id}" data-reason="${r.reason}" data-details="${r.details || ''}" style="height: 42px; padding: 0 1.25rem; font-size: 0.85rem; font-weight: 800; border-radius: 10px;">
                 <i data-lucide="sparkles" style="width: 16px; margin-right: 6px;"></i> AI REPAIR
              </button>
              <button class="btn-secondary edit-report-q-btn" data-qid="${r.questions?.id}" style="height: 42px; padding: 0 1.25rem; font-size: 0.85rem; font-weight: 700; border-radius: 10px;">
                 <i data-lucide="edit-2" style="width: 16px; margin-right: 6px;"></i> MANUAL EDIT
              </button>
              <div style="width: 1px; height: 24px; background: var(--glass-border); margin: 0 0.5rem;"></div>
              <button class="btn-secondary resolve-report-btn" data-id="${r.id}" style="height: 42px; padding: 0 1rem; font-size: 0.8rem; font-weight: 700; border-radius: 10px;">
                 RESOLVE
              </button>
              <button class="btn-secondary deactivate-question-btn" data-qid="${r.questions?.id}" data-rid="${r.id}" style="height: 42px; padding: 0 1rem; font-size: 0.8rem; font-weight: 700; border-radius: 10px; color: var(--error); border-color: rgba(239, 68, 68, 0.2);">
                 DEACTIVATE
              </button>
              <button class="btn-secondary dismiss-report-btn" data-id="${r.id}" style="height: 42px; padding: 0 1rem; font-size: 0.8rem; font-weight: 700; border-radius: 10px;">
                 DISMISS
              </button>
            </div>
          ` : `
            <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--success); font-weight: 800; font-size: 0.85rem; background: rgba(34, 197, 94, 0.1); padding: 0.75rem 1.25rem; border-radius: 10px; border: 1px solid rgba(34, 197, 94, 0.2);">
               <i data-lucide="check-circle-2" style="width: 18px;"></i>
               ACTION TAKEN: ${r.status.toUpperCase()}
            </div>
          `}
        </div>
      `;
    }).join('')

    // Attach Listeners
    document.querySelectorAll('.edit-report-q-btn').forEach(btn => {
      btn.onclick = async () => {
        const qid = btn.getAttribute('data-qid')
        const { data: q } = await supabase.from('questions').select(`
          *,
          question_groups (*),
          question_answers (*),
          answers (*)
        `).eq('id', qid).single()
        
        if (q) this.openEditModal(q)
        else ModalService.alert('Load Error', 'Could not load question details.', 'error')
      }
    })

    document.querySelectorAll('.ai-fix-btn').forEach(btn => {
      btn.onclick = () => this.handleAiFix(btn)
    })

    document.querySelectorAll('.resolve-report-btn').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id')
        btn.textContent = '...'
        await DataService.updateReportStatus(id, 'resolved')
        this.loadReports()
      }
    })

    document.querySelectorAll('.dismiss-report-btn').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id')
        btn.textContent = '...'
        await DataService.updateReportStatus(id, 'dismissed')
        this.loadReports()
      }
    })

    document.querySelectorAll('.deactivate-question-btn').forEach(btn => {
      btn.onclick = async () => {
        const confirmed = await ModalService.confirm('Deactivate Question', 'Are you sure? This question will no longer appear in exams.')
        if (!confirmed) return
        const qid = btn.getAttribute('data-qid')
        const rid = btn.getAttribute('data-rid')
        btn.textContent = '...'
        await DataService.deactivateQuestion(qid)
        await DataService.updateReportStatus(rid, 'resolved (question deactivated)')
        this.loadReports()
      }
    })
  },

  async handleAiFix(btn) {
    const qid = btn.dataset.qid
    const rid = btn.dataset.rid
    const reason = btn.dataset.reason
    const details = btn.dataset.details

    btn.disabled = true
    btn.innerHTML = '<span class="pulse">⏳ AI Thinking...</span>'

    const { data: fix, error } = await DataService.aiRegenerateQuestion(qid, reason, details)

    if (error) {
      ModalService.alert('AI Repair Failed', String(error), 'error')
      btn.disabled = false
      btn.textContent = "🪄 AI Fix"
      return
    }

    // Show Comparison Modal
    const modalHtml = `
      <div id="ai-fix-overlay" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.85); z-index:9999; display:flex; justify-content:center; align-items:center; padding:1.5rem; backdrop-filter: blur(8px);">
        <div class="glass card scale-in" style="width: 100%; max-width: 950px; max-height: 90vh; overflow-y: auto; padding: 0; border: 1.5px solid var(--accent-primary); border-radius: 24px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
          
          <div style="padding: 1.5rem 2.5rem; border-bottom: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02);">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
               <div style="width: 40px; height: 40px; border-radius: 10px; background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; color: white;">
                 <i data-lucide="sparkles" style="width: 20px;"></i>
               </div>
               <h3 style="margin: 0; font-family: 'Outfit'; font-weight: 800; font-size: 1.4rem;">AI Proposed Correction</h3>
            </div>
            <button id="reject-ai-fix-x" style="background: rgba(239, 68, 68, 0.1); border: none; color: #ef4444; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
               <i data-lucide="x" style="width: 20px;"></i>
            </button>
          </div>

          <div style="padding: 2.5rem; display: flex; flex-direction: column; gap: 2.5rem;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2.5rem;">
              <div>
                <div style="font-size: 0.7rem; color: #ef4444; text-transform: uppercase; font-weight: 800; margin-bottom: 1rem; letter-spacing: 0.1em; display: flex; align-items: center; gap: 0.5rem;">
                  <i data-lucide="alert-triangle" style="width: 14px;"></i> Current Reported Version
                </div>
                <div class="glass" style="padding: 1.5rem; border-radius: 16px; font-size: 1rem; line-height: 1.6; border-color: rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.02);">
                  <div style="color: var(--text-secondary); font-size: 0.8rem; margin-bottom: 0.5rem; font-weight: 600;">Question Text:</div>
                  <p style="margin: 0;">${btn.closest('.glass').querySelector('div[style*="italic"]').textContent}</p>
                </div>
              </div>
              
              <div>
                <div style="font-size: 0.7rem; color: var(--success); text-transform: uppercase; font-weight: 800; margin-bottom: 1rem; letter-spacing: 0.1em; display: flex; align-items: center; gap: 0.5rem;">
                  <i data-lucide="check-circle" style="width: 14px;"></i> Elite AI Revised Version
                </div>
                <div class="glass" style="padding: 1.5rem; border-radius: 16px; font-size: 1rem; line-height: 1.6; border-color: var(--success); background: rgba(34, 197, 94, 0.05); border-width: 1.5px;">
                  <div style="color: var(--success); font-size: 0.8rem; margin-bottom: 0.5rem; font-weight: 600;">Regenerated Content:</div>
                  <p style="margin-bottom: 1.5rem; font-weight: 500;">${fix.question_text}</p>
                  
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.5rem;">
                    <div style="padding: 0.75rem; border: 1.5px solid ${fix.correct_option === 'A' ? 'var(--success)' : 'var(--glass-border)'}; border-radius: 10px; font-size: 0.85rem; background: ${fix.correct_option === 'A' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.02)'};"><span style="font-weight: 800; margin-right: 0.5rem;">A:</span> ${fix.option_a}</div>
                    <div style="padding: 0.75rem; border: 1.5px solid ${fix.correct_option === 'B' ? 'var(--success)' : 'var(--glass-border)'}; border-radius: 10px; font-size: 0.85rem; background: ${fix.correct_option === 'B' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.02)'};"><span style="font-weight: 800; margin-right: 0.5rem;">B:</span> ${fix.option_b}</div>
                    <div style="padding: 0.75rem; border: 1.5px solid ${fix.correct_option === 'C' ? 'var(--success)' : 'var(--glass-border)'}; border-radius: 10px; font-size: 0.85rem; background: ${fix.correct_option === 'C' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.02)'};"><span style="font-weight: 800; margin-right: 0.5rem;">C:</span> ${fix.option_c}</div>
                    <div style="padding: 0.75rem; border: 1.5px solid ${fix.correct_option === 'D' ? 'var(--success)' : 'var(--glass-border)'}; border-radius: 10px; font-size: 0.85rem; background: ${fix.correct_option === 'D' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.02)'};"><span style="font-weight: 800; margin-right: 0.5rem;">D:</span> ${fix.option_d}</div>
                  </div>

                  <div style="background: rgba(34, 197, 94, 0.08); padding: 1rem; border-radius: 12px; border: 1px dashed var(--success);">
                    <div style="font-size: 0.65rem; color: var(--success); font-weight: 800; text-transform: uppercase; margin-bottom: 0.5rem; letter-spacing: 0.05em;">Intelligent Explanation:</div>
                    <p style="font-size: 0.85rem; margin: 0; line-height: 1.5;">${fix.explanation}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style="padding: 1.5rem 2.5rem; border-top: 1px solid var(--glass-border); background: rgba(0,0,0,0.2); display: flex; gap: 1rem;">
            <button id="approve-ai-fix" class="btn-primary" style="flex:2; height: 54px; font-weight: 900; font-family: 'Outfit'; font-size: 1.1rem; border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 0.75rem;">
               <i data-lucide="check-circle" style="width: 20px;"></i> COMMIT AI REPAIR
            </button>
            <button id="reject-ai-fix" class="btn-secondary" style="flex:1; height: 54px; font-weight: 800; border-radius: 12px;">Discard</button>
          </div>
        </div>
      </div>
    `
    document.body.insertAdjacentHTML('beforeend', modalHtml)
    if (window.lucide) window.lucide.createIcons({ root: document.getElementById('ai-fix-overlay') })

    const closeModal = () => {
      document.getElementById('ai-fix-overlay').remove()
      btn.disabled = false
      btn.textContent = "🪄 AI Fix"
    }

    document.getElementById('reject-ai-fix').onclick = closeModal
    document.getElementById('reject-ai-fix-x').onclick = closeModal

    document.getElementById('approve-ai-fix').onclick = async () => {
      const saveBtn = document.getElementById('approve-ai-fix')
      saveBtn.disabled = true
      saveBtn.textContent = "Syncing..."

      // Perform updates
      await DataService.updateQuestion(qid, { question_text: fix.question_text })
      await DataService.updateQuestionAnswers(qid, {
        option_a: fix.option_a,
        option_b: fix.option_b,
        option_c: fix.option_c,
        option_d: fix.option_d,
        correct_option: fix.correct_option,
        explanation: fix.explanation
      })

      await DataService.updateReportStatus(rid, 'resolved (AI fix applied)')
      
      document.getElementById('ai-fix-overlay').remove()
      this.loadReports()
      ModalService.showToast('🚀 Question repaired and synced across platform!', 'success')
    }
  },

  async loadGlobalAnalytics() {
    const summary = document.getElementById('analytics-summary')
    const chartContainer = document.getElementById('global-scores-chart')
    summary.innerHTML = 'Loading platform data...'

    const { stats, sessions, error } = await DataService.getGlobalAnalytics()
    if (error) {
      summary.innerHTML = `<div style="color: var(--error);">Error: ${error}</div>`
      return
    }

    summary.innerHTML = `
      <div class="glass card stat-card" style="padding: 1.5rem; display: flex; align-items: center; gap: 1.25rem; border-top: 4px solid var(--accent-primary); border-radius: 16px; transition: transform 0.2s;">
        <div style="background: rgba(124, 58, 237, 0.1); width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--accent-primary); border: 1px solid rgba(124, 58, 237, 0.2);">
          <i data-lucide="users" style="width: 24px;"></i>
        </div>
        <div>
          <div style="font-size: 0.65rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.2rem;">Total Students</div>
          <div style="font-family: 'Outfit'; font-size: 1.6rem; font-weight: 900; color: var(--text-primary); line-height: 1;">${stats.totalUsers}</div>
        </div>
      </div>

      <div class="glass card stat-card" style="padding: 1.5rem; display: flex; align-items: center; gap: 1.25rem; border-top: 4px solid var(--success); border-radius: 16px; transition: transform 0.2s;">
        <div style="background: rgba(34, 197, 94, 0.1); width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--success); border: 1px solid rgba(34, 197, 94, 0.2);">
          <i data-lucide="database" style="width: 24px;"></i>
        </div>
        <div>
          <div style="font-size: 0.65rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.2rem;">Question Bank</div>
          <div style="font-family: 'Outfit'; font-size: 1.6rem; font-weight: 900; color: var(--text-primary); line-height: 1;">${stats.totalQuestions}</div>
        </div>
      </div>

      <div class="glass card stat-card" style="padding: 1.5rem; display: flex; align-items: center; gap: 1.25rem; border-top: 4px solid #facc15; border-radius: 16px; transition: transform 0.2s;">
        <div style="background: rgba(250, 204, 21, 0.1); width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #facc15; border: 1px solid rgba(250, 204, 21, 0.2);">
          <i data-lucide="award" style="width: 24px;"></i>
        </div>
        <div>
          <div style="font-size: 0.65rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.2rem;">Avg Performance</div>
          <div style="font-family: 'Outfit'; font-size: 1.6rem; font-weight: 900; color: var(--text-primary); line-height: 1;">${stats.averagePerformance}%</div>
        </div>
      </div>
    `
    if (window.lucide) window.lucide.createIcons({ root: summary })

    // Process distribution (0-10, 11-20...)
    const brackets = new Array(10).fill(0)
    sessions.forEach(s => {
      const idx = Math.min(Math.floor(s.score_percentage / 10), 9)
      brackets[idx]++
    })

    if (this._globalChart) this._globalChart.destroy()
    this._globalChart = new Chart(chartContainer.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['0-10%', '11-20%', '21-30%', '31-40%', '41-50%', '51-60%', '61-70%', '71-80%', '81-90%', '91-100%'],
        datasets: [{
          label: 'Number of Students',
          data: brackets,
          backgroundColor: 'rgba(77, 182, 172, 0.4)',
          borderColor: '#4db6ac',
          borderWidth: 2,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        plugins: { 
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            titleFont: { family: 'Outfit', weight: 'bold' },
            bodyFont: { family: 'Inter' }
          }
        },
        scales: {
          y: { 
            beginAtZero: true, 
            grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
            ticks: { color: 'rgba(255,255,255,0.5)', font: { family: 'Inter', size: 10 } }
          },
          x: { 
            grid: { display: false },
            ticks: { color: 'rgba(255,255,255,0.5)', font: { family: 'Inter', size: 10 } }
          }
        }
      }
    })

    // Phase 5: Daily Signups Time-Series Chart
    const revenueContainer = document.getElementById('revenue-growth-chart')
    if (revenueContainer) {
        const { data: users } = await DataService.getRevenueStats()
        
        // Group users by creation date (YYYY-MM-DD)
        const signupsByDate = {}
        users.forEach(u => {
            if (u.created_at) {
               const dateStr = new Date(u.created_at).toISOString().split('T')[0]
               signupsByDate[dateStr] = (signupsByDate[dateStr] || 0) + 1
            }
        })
        
        // Sort dates chronologically
        const sortedDates = Object.keys(signupsByDate).sort()
        const signupCounts = sortedDates.map(date => signupsByDate[date])
        
        // Format dates for display (e.g., 'Apr 15')
        const displayLabels = sortedDates.map(d => {
            const dt = new Date(d);
            return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        })

        if (this._revenueChart) this._revenueChart.destroy()
        this._revenueChart = new Chart(revenueContainer.getContext('2d'), {
            type: 'line',
            data: {
                labels: displayLabels,
                datasets: [{
                    label: 'Daily Signups',
                    data: signupCounts,
                    borderColor: 'rgba(124, 58, 237, 0.8)',
                    backgroundColor: 'rgba(124, 58, 237, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: 'rgba(124, 58, 237, 1)',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                plugins: { 
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleFont: { family: 'Outfit', weight: 'bold' },
                    bodyFont: { family: 'Inter' }
                  }
                },
                scales: {
                  y: { 
                    beginAtZero: true, 
                    grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
                    ticks: { color: 'rgba(255,255,255,0.5)', font: { family: 'Inter', size: 10 } }
                  },
                  x: { 
                    grid: { display: false },
                    ticks: { color: 'rgba(255,255,255,0.5)', font: { family: 'Inter', size: 10 } }
                  }
                }
            }
        })
    }
  },

  async loadAuditLogs() {
    const list = document.getElementById('audit-logs-list')
    if (!list) return
    list.innerHTML = '<div class="loader-spinner" style="margin: 2rem auto;"></div>'
    const { data, error } = await DataService.getAuditLogs()
    
    if (error) {
        list.innerHTML = `<div style="padding: 2rem; color: var(--error); text-align: center;">Error loading logs: ${error.message}</div>`
        return
    }

    if (!data || data.length === 0) {
        list.innerHTML = `
          <div style="text-align: center; padding: 3rem; color: var(--text-secondary); opacity: 0.5;">
            <i data-lucide="activity" style="width: 40px; margin-bottom: 1rem; display: block; margin-left: auto; margin-right: auto;"></i>
            <p>No administrative activities recorded yet.</p>
          </div>
        `
    } else {
        list.innerHTML = data.map(log => {
          const isSecurity = log.action?.toLowerCase().includes('delete') || log.action?.toLowerCase().includes('flag');
          const statusColor = isSecurity ? 'var(--error)' : 'var(--accent-primary)';
          
          return `
            <div class="glass card audit-row" style="padding: 1.25rem; margin-bottom: 1rem; border-radius: 12px; border-left: 4px solid ${statusColor}; transition: background 0.2s; display: flex; gap: 1.25rem; align-items: center;">
                <div style="background: rgba(255,255,255,0.03); width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid var(--glass-border);">
                  <i data-lucide="${isSecurity ? 'shield-alert' : 'terminal'}" style="width: 18px; color: ${statusColor};"></i>
                </div>
                <div style="flex: 1;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                    <span style="font-family: 'Outfit'; font-weight: 800; color: var(--text-primary); font-size: 0.95rem;">${log.action}</span>
                    <span style="font-size: 0.7rem; color: var(--text-secondary); font-weight: 600; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 10px;">
                      ${new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4;">
                    <span style="color: var(--accent-secondary); font-weight: 700;">${log.admin_email}</span> — ${log.details}
                  </div>
                </div>
            </div>
          `;
        }).join('')
    }
    if (window.lucide) window.lucide.createIcons({ root: list })
  },

  async loadStaff() {
    const list = document.getElementById('staff-list')
    if (!list) return
    list.innerHTML = 'Loading staff list...'
    const { data: users } = await DataService.getAllUsers()
    
    // Filter for anyone with a role or the super admin
    const staff = users.filter(u => 
      (u.role && u.role !== 'user') || 
      u.email === 'oshituo@gmail.com'
    )
    
    list.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem;">
        <i data-lucide="shield-check" style="width: 20px; color: var(--accent-primary);"></i>
        <h3 style="margin: 0; font-family: 'Outfit'; font-size: 1.1rem; font-weight: 800; color: var(--text-primary);">Active Personnel</h3>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.25rem;">
        ${staff.map(s => {
          const isOwner = s.email === 'oshituo@gmail.com';
          const role = s.role || (isOwner ? 'super-admin' : 'user');
          const roleColor = isOwner ? 'var(--accent-secondary)' : 'var(--accent-primary)';
          
          return `
            <div class="glass card staff-card" style="padding: 1.5rem; border-radius: 16px; border-top: 3px solid ${roleColor}; transition: transform 0.2s; position: relative; overflow: hidden;">
              
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <div style="width: 44px; height: 44px; border-radius: 12px; background: ${roleColor}20; color: ${roleColor}; display: flex; align-items: center; justify-content: center;">
                    <i data-lucide="${isOwner ? 'crown' : 'shield'}" style="width: 20px;"></i>
                  </div>
                  <div>
                    <div style="font-family: 'Outfit'; font-weight: 800; color: var(--text-primary); font-size: 1rem; line-height: 1.2;">${s.username || 'Staff Member'}</div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">${s.email}</div>
                  </div>
                </div>
              </div>

              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem;">
                <span style="font-size: 0.6rem; background: ${roleColor}; color: white; padding: 2px 8px; border-radius: 4px; font-weight: 900; text-transform: uppercase;">${role}</span>
                ${isOwner ? '<span style="font-size: 0.6rem; background: rgba(255,255,255,0.05); color: var(--accent-secondary); border: 1px solid var(--accent-secondary); padding: 2px 8px; border-radius: 4px; font-weight: 800;">OWNER</span>' : ''}
              </div>

              <div style="padding-top: 1rem; border-top: 1px solid var(--glass-border); font-size: 0.75rem; color: var(--text-secondary); display: flex; align-items: center; gap: 0.5rem;">
                ${isOwner ? `
                  <i data-lucide="info" style="width: 14px; color: var(--accent-secondary);"></i>
                  <span>System Owner: All permissions granted.</span>
                ` : `
                  <i data-lucide="settings-2" style="width: 14px;"></i>
                  <span>Use form above to re-assign role.</span>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `
    if (window.lucide) window.lucide.createIcons({ root: list })
  },

  async loadLeagues() {
    const scheduleList = document.getElementById('clash-schedule-list')
    if (!scheduleList) return

    scheduleList.innerHTML = '<div class="loader-spinner" style="margin: 2rem auto;"></div>'

    try {
      const { data: clashes, error } = await supabase
        .from('scheduled_clashes')
        .select('*')
        .order('week_date', { ascending: false })
        .limit(20)

      if (error) throw error

      if (!clashes || clashes.length === 0) {
        scheduleList.innerHTML = `
          <div style="text-align: center; padding: 3rem; color: var(--text-secondary); opacity: 0.6;">
            <i data-lucide="calendar-off" style="width: 40px; height: 40px; margin-bottom: 1rem; display: block; margin-left: auto; margin-right: auto;"></i>
            <p style="font-size: 0.95rem; margin: 0;">No clash schedules found. Use "Generate Weekly Seeds" to create this week's competitions.</p>
          </div>
        `
      } else {
        scheduleList.innerHTML = clashes.map(clash => {
          const typeColor = clash.type === 'Super' ? 'var(--accent-secondary)' : 'var(--accent-primary)'
          const qCount = Array.isArray(clash.questions_json) ? clash.questions_json.length : 0
          return `
            <div class="glass" style="padding: 1rem 1.25rem; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--glass-border); border-left: 4px solid ${typeColor};">
              <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="width: 36px; height: 36px; border-radius: 8px; background: ${typeColor}20; color: ${typeColor}; display: flex; align-items: center; justify-content: center;">
                  <i data-lucide="${clash.type === 'Super' ? 'crown' : 'swords'}" style="width: 18px;"></i>
                </div>
                <div>
                  <div style="font-family: 'Outfit'; font-weight: 800; font-size: 0.95rem; color: var(--text-primary);">${clash.department || 'General'}</div>
                  <div style="font-size: 0.7rem; color: var(--text-secondary); font-weight: 600;">Week: ${clash.week_date} · ${qCount} questions · ${clash.duration_minutes || 20}min</div>
                </div>
              </div>
              <span style="font-size: 0.65rem; background: ${typeColor}; color: white; padding: 3px 10px; border-radius: 6px; font-weight: 900; text-transform: uppercase;">${clash.type || 'Normal'}</span>
            </div>
          `
        }).join('')
      }

      if (window.lucide) window.lucide.createIcons({ root: scheduleList })
    } catch (err) {
      scheduleList.innerHTML = `<div style="color: var(--error); text-align: center; padding: 2rem;">Error loading schedule: ${err.message}</div>`
    }

    // Wire up action buttons
    const resetBtn = document.getElementById('run-weekly-reset-btn')
    if (resetBtn) {
      resetBtn.onclick = async () => {
        const confirmed = await ModalService.confirm('Weekly Reset', 'This will process league promotions/demotions and reset weekly XP. Proceed?')
        if (!confirmed) return
        resetBtn.disabled = true
        resetBtn.innerHTML = '<span class="pulse">Processing...</span>'
        try {
          const { error } = await DataService.runWeeklyLeagueReset()
          if (error) throw error
          ModalService.showToast('✅ Weekly league reset completed!', 'success')
          this.loadLeagues()
        } catch (err) {
          ModalService.alert('Reset Failed', err.message || 'Unknown error', 'error')
        }
        resetBtn.disabled = false
        resetBtn.innerHTML = '<i data-lucide="refresh-ccw" style="width: 16px; margin-right: 0.5rem;"></i> RUN WEEKLY RESET'
        if (window.lucide) window.lucide.createIcons({ root: resetBtn })
      }
    }

    const seedBtn = document.getElementById('generate-clash-seeds-btn')
    if (seedBtn) {
      seedBtn.onclick = async () => {
        const confirmed = await ModalService.confirm('Generate Seeds', 'This will create clash competition entries for all departments this week. Proceed?')
        if (!confirmed) return
        seedBtn.disabled = true
        seedBtn.innerHTML = '<span class="pulse">Generating...</span>'
        try {
          const { error } = await DataService.generateWeeklyClashSeeds()
          if (error) throw error
          await DataService.logAdminAction(this._adminProfile.email, 'Generate Clash Seeds', 'global', 'Weekly seeds generated')
          ModalService.showToast('🎯 Weekly clash seeds generated for all departments!', 'success')
          this.loadLeagues()
        } catch (err) {
          ModalService.alert('Seed Generation Failed', err.message || 'Unknown error', 'error')
        }
        seedBtn.disabled = false
        seedBtn.innerHTML = '<i data-lucide="sparkles" style="width: 16px; margin-right: 0.5rem;"></i> GENERATE SEEDS'
        if (window.lucide) window.lucide.createIcons({ root: seedBtn })
      }
    }

    const promoteBtn = document.getElementById('process-clash-promotions-btn')
    if (promoteBtn) {
      promoteBtn.onclick = async () => {
        const confirmed = await ModalService.confirm('Process Promotions', 'This will identify Top 3 from Saturday Clashes and promote them to Elite. Proceed?')
        if (!confirmed) return
        promoteBtn.disabled = true
        promoteBtn.innerHTML = '<span class="pulse">Promoting...</span>'
        try {
          const { data, error } = await DataService.processClashPromotions()
          if (error) throw error
          const count = (data && data.length > 0) ? data[0].promoted_count : 0
          await DataService.logAdminAction(this._adminProfile.email, 'Process Clash Promotions', 'global', `${count} users promoted`)
          ModalService.showToast(`✅ ${count} users promoted to Elite League!`, 'success')
          this.loadLeagues()
        } catch (err) {
          ModalService.alert('Promotion Failed', err.message || 'Unknown error', 'error')
        }
        promoteBtn.disabled = false
        promoteBtn.innerHTML = '<i data-lucide="trending-up" style="width: 16px; margin-right: 0.5rem;"></i> PROMOTIONS'
        if (window.lucide) window.lucide.createIcons({ root: promoteBtn })
      }
    }
  },

  async loadQualityAudit() {
    const list = document.getElementById('quality-audit-list')
    if (!list) return
    list.innerHTML = `
      <div style="text-align: center; padding: 4rem;">
        <div class="loader-spinner" style="margin-bottom: 2rem;"></div>
        <div style="font-family: 'Outfit'; font-weight: 800; color: var(--text-primary); font-size: 1.2rem;">Elite AI is Scanning...</div>
        <div style="color: var(--text-secondary); margin-top: 0.5rem; font-size: 0.85rem;">Fast Database Integrity Scan (Batch Size: 50)</div>
      </div>
    `
    
    try {
      const { data: rawQuestions, error } = await DataService.getAuditQuestions({ limit: 50 })
      if (error) throw error

      if (!rawQuestions || rawQuestions.length === 0) {
        list.innerHTML = `
          <div style="text-align: center; padding: 4rem; color: var(--success); opacity: 0.8;">
            <i data-lucide="check-circle" style="width: 64px; height: 64px; margin-bottom: 1.5rem;"></i>
            <h3 style="font-family: 'Outfit'; margin: 0; font-size: 1.5rem; font-weight: 900;">CONTENT OPTIMAL</h3>
            <p style="font-size: 0.95rem; opacity: 0.7;">Your current database meets all Elite Quality Standards.</p>
          </div>
        `
        return
      }

      // Step 2: Deterministic Rules Engine (Replacing AI batch to save tokens and load instantly)
      const auditedBatch = rawQuestions.map(q => {
          let score = 100;
          let status = 'HEALTHY';
          let reason = 'Optimal';

          if (q.audit_reason === 'User Reported') {
              score = 50;
              status = 'USER FLAGGED';
              reason = 'Flagged by a student for review';
          } else if (q.audit_reason === 'Structural Gap') {
              score = 60;
              status = 'INCOMPLETE';
              reason = 'Missing explanation or formatting issues';
          } else if (q.audit_reason === 'Missing Correct Answer') {
              score = 0;
              status = 'CRITICAL ERROR';
              reason = 'No correct answer defined';
          }

          return { ...q, audit: { score, status, reason } };
      });

      // Render Dashboard & List
      const healthyRange = auditedBatch.filter(q => q.audit.score >= 90).length;
      const criticalRange = auditedBatch.filter(q => q.audit.score < 60).length;

      list.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 2.5rem;">
           <div class="glass" style="padding: 1.5rem; border-radius: 20px; border-bottom: 4px solid var(--success);">
              <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Optimal Health</div>
              <div style="font-size: 2rem; font-weight: 900; color: var(--success);">${healthyRange}</div>
              <div style="font-size: 0.7rem; color: var(--text-secondary);">Ready for Production</div>
           </div>
           <div class="glass" style="padding: 1.5rem; border-radius: 20px; border-bottom: 4px solid var(--warning);">
              <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Needs Review</div>
              <div style="font-size: 2rem; font-weight: 900; color: var(--warning);">${auditedBatch.length - healthyRange - criticalRange}</div>
              <div style="font-size: 0.7rem; color: var(--text-secondary);">Minor issues detected</div>
           </div>
           <div class="glass" style="padding: 1.5rem; border-radius: 20px; border-bottom: 4px solid var(--error);">
              <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Critical Gaps</div>
              <div style="font-size: 2rem; font-weight: 900; color: var(--error);">${criticalRange}</div>
              <div style="font-size: 0.7rem; color: var(--text-secondary);">Fact errors or broken data</div>
           </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 1rem;">
          ${auditedBatch.map(q => `
            <div class="glass audit-item scale-in" style="padding: 1.5rem; border-radius: 20px; display: flex; justify-content: space-between; align-items: center; border: 1.5px solid ${q.audit.score < 70 ? 'rgba(239, 68, 68, 0.2)' : 'var(--glass-border)'}; background: rgba(255,255,255,0.01);">
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 0.75rem;">
                   <div style="font-family: 'Outfit'; font-weight: 900; font-size: 1.1rem; color: ${q.audit.score < 70 ? 'var(--error)' : 'var(--success)'};">${q.audit.score}%</div>
                   <div style="height: 14px; width: 1px; background: var(--glass-border);"></div>
                   <span style="font-size: 0.7rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase;">${q.audit.status}</span>
                </div>
                <div style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${q.question_text.replace(/<[^>]*>?/gm, '')}
                </div>
                <div style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 500;">
                  Detection: <span style="color: var(--accent-secondary); font-weight: 700;">${q.audit.reason}</span>
                </div>
              </div>
              <button class="btn-primary open-repair-lab" data-id="${q.id}" style="height: 48px; min-width: 140px; font-weight: 800; border-radius: 12px; background: ${q.audit.score < 70 ? 'var(--accent-gradient)' : 'var(--surface-color)'};">
                ${q.audit.score < 100 ? 'REPAIR LAB' : 'PREVIEW'}
              </button>
            </div>
          `).join('')}
        </div>
      `

      if (window.lucide) window.lucide.createIcons({ root: list })

      document.querySelectorAll('.open-repair-lab').forEach(btn => {
        btn.onclick = () => {
          const q = auditedBatch.find(item => item.id === btn.dataset.id);
          this.openRepairLab(q);
        }
      })

    } catch (err) {
      console.error("Audit Scan Error:", err)
      list.innerHTML = `<div class="glass" style="padding: 2rem; color: var(--error); border: 1px solid var(--error); border-radius: 12px;">Scan Interrupted: ${err.message}</div>`
    }
  },

  async openRepairLab(question) {
    const overlay = document.createElement('div')
    overlay.style = "position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.9); z-index:999999; display:flex; padding:2rem; backdrop-filter:blur(10px);"
    
    overlay.innerHTML = `
      <div class="glass card scale-in" style="width:100%; max-width:1300px; margin:auto; height: 90vh; display:flex; flex-direction:column; overflow:hidden; border-radius: 30px; border: 2px solid var(--accent-primary);">
        <header style="padding: 1.5rem 2rem; border-bottom: 1px solid var(--glass-border); display:flex; justify-content:space-between; align-items:center; background: rgba(124, 58, 237, 0.05);">
           <div style="display:flex; align-items:center; gap: 1rem;">
              <div style="background: var(--accent-gradient); width: 44px; height: 44px; border-radius: 12px; display:flex; align-items:center; justify-content:center; color:white;">
                 <i data-lucide="flask-conical"></i>
              </div>
              <div>
                <h3 style="margin:0; font-family:'Outfit'; font-weight:900; font-size:1.3rem;">Elite AI Repair Lab</h3>
                <p style="margin:0; font-size:0.75rem; color:var(--text-secondary);">Syallabus Compliance & Fact-Check Protocol active.</p>
              </div>
           </div>
           <button id="close-lab" class="btn-secondary" style="width: 40px; height:40px; border-radius: 50%; display:flex; align-items:center; justify-content:center; color:var(--error);">
              <i data-lucide="x"></i>
           </button>
        </header>

        <div style="flex:1; display:grid; grid-template-columns: 1fr 1fr; gap: 2px; background: var(--glass-border); overflow:hidden;">
           <!-- LEFT: Original -->
           <div style="background: var(--surface-color); padding: 2.5rem; overflow-y:auto;">
              <div style="font-size:0.7rem; font-weight:900; color:var(--text-secondary); text-transform:uppercase; margin-bottom: 1.5rem; letter-spacing:0.1em;">Current Production State</div>
              <div style="background:rgba(255,255,255,0.02); padding: 1.5rem; border-radius:16px; border: 1px solid var(--glass-border); margin-bottom: 2rem;">
                 <p style="font-size: 1.1rem; line-height:1.6; font-weight:600; color:var(--text-primary);">${question.question_text}</p>
                 <div style="margin-top: 1.5rem; display:grid; gap: 0.75rem;">
                    <div style="padding:0.75rem; background:rgba(0,0,0,0.2); border-radius:8px; font-size:0.9rem;">A: ${question.question_answers?.option_a || question.option_a}</div>
                    <div style="padding:0.75rem; background:rgba(0,0,0,0.2); border-radius:8px; font-size:0.9rem;">B: ${question.question_answers?.option_b || question.option_b}</div>
                    <div style="padding:0.75rem; background:rgba(0,0,0,0.2); border-radius:8px; font-size:0.9rem;">C: ${question.question_answers?.option_c || question.option_c}</div>
                    <div style="padding:0.75rem; background:rgba(0,0,0,0.2); border-radius:8px; font-size:0.9rem;">D: ${question.question_answers?.option_d || question.option_d}</div>
                 </div>
                 <div style="margin-top: 1rem; color:var(--success); font-weight:900;">Correct: ${question.question_answers?.correct_option || question.correct_option}</div>
              </div>
              <div style="font-size:0.75rem; color:var(--text-secondary); line-height:1.5;">
                 <strong>Explanation:</strong><br>${question.question_answers?.explanation || question.explanation || 'None provided.'}
              </div>
           </div>

           <!-- RIGHT: AI Proposed -->
           <div id="lab-proposed-pane" style="background: var(--surface-color); padding: 2.5rem; overflow-y:auto; position:relative;">
              <div style="text-align:center; padding-top: 10rem;" id="lab-loading">
                 <div class="loader-spinner" style="margin-bottom: 1rem;"></div>
                 <div style="font-weight:700; color:var(--accent-primary);">AI is Drafting Repair...</div>
              </div>
           </div>
        </div>

        <footer style="padding: 1.5rem 2rem; border-top:1px solid var(--glass-border); display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2);">
           <div style="color:var(--text-secondary); font-size:0.85rem;">Status: <span id="lab-status-text">Drafting Proposed Fix...</span></div>
           <div style="display:flex; gap:1rem;">
              <button id="lab-skip" class="btn-secondary" style="height:48px; padding:0 1.5rem; font-weight:700;">SKIP</button>
              <button id="lab-approve" disabled class="btn-primary" style="height:48px; padding:0 2rem; font-weight:900; background:var(--success-gradient);">APPROVE & DEPLOY</button>
           </div>
        </footer>
      </div>
    `
    document.body.appendChild(overlay)
    if (window.lucide) window.lucide.createIcons({ root: overlay })

    document.getElementById('close-lab').onclick = () => overlay.remove()
    document.getElementById('lab-skip').onclick = () => overlay.remove()

    // Step 2: Generate Repair via AI
    try {
      const { AiService } = await import('../services/aiService')
      const fix = await AiService.repairQuestion(question.question_text, question.audit?.reason || 'Structural Audit', 'Elite AI detected quality gaps.')
      
      const pane = document.getElementById('lab-proposed-pane')
      pane.innerHTML = `
        <div style="font-size:0.7rem; font-weight:900; color:var(--success); text-transform:uppercase; margin-bottom: 1.5rem; letter-spacing:0.1em;">AI Proposed Standard</div>
        <div class="scale-in" style="background:rgba(34, 197, 94, 0.05); padding: 1.5rem; border-radius:16px; border: 1.5px dashed var(--success); margin-bottom: 2rem;">
           <p style="font-size: 1.1rem; line-height:1.6; font-weight:700; color:var(--text-primary);">${fix.question_text}</p>
           <div style="margin-top: 1.5rem; display:grid; gap: 0.75rem;">
              <div style="padding:0.75rem; background:rgba(34,197,94,0.1); border-radius:8px; font-size:0.9rem; font-weight:700;">A: ${fix.option_a}</div>
              <div style="padding:0.75rem; background:rgba(34,197,94,0.1); border-radius:8px; font-size:0.9rem; font-weight:700;">B: ${fix.option_b}</div>
              <div style="padding:0.75rem; background:rgba(34,197,94,0.1); border-radius:8px; font-size:0.9rem; font-weight:700;">C: ${fix.option_c}</div>
              <div style="padding:0.75rem; background:rgba(34,197,94,0.1); border-radius:8px; font-size:0.9rem; font-weight:700;">D: ${fix.option_d}</div>
           </div>
           <div style="margin-top: 1rem; color:var(--success); font-weight:900; font-size:1.1rem;">Verified Correct: ${fix.correct_option}</div>
        </div>
        <div style="background: rgba(124, 58, 237, 0.05); padding: 1.25rem; border-radius: 12px; border: 1px solid rgba(124, 58, 237, 0.2);">
           <div style="font-size:0.7rem; font-weight:900; color:var(--accent-primary); margin-bottom:0.5rem;">PEDAGOGICAL EXPLANATION</div>
           <div style="font-size:0.85rem; color:var(--text-primary); line-height:1.6;">${fix.explanation}</div>
        </div>
      `
      
      const approveBtn = document.getElementById('lab-approve')
      approveBtn.disabled = false
      document.getElementById('lab-status-text').textContent = 'Repair Proposed - Review & Approve.'
      
      approveBtn.onclick = async () => {
         approveBtn.disabled = true;
         approveBtn.textContent = 'DEPLOYING...';
         try {
            const { error } = await DataService.commitRepair(question.id, fix);
            if (error) throw error;
            overlay.remove();
            ModalService.alert("Repair Deployed", "🚀 REPAIR DEPLOYED SUCCESSFULLY!", 'success');
            this.loadQualityAudit();
         } catch (err) {
            ModalService.alert("Deployment Failed", err.message, 'error');
            approveBtn.disabled = false;
            approveBtn.textContent = 'APPROVE & DEPLOY';
         }
      }

    } catch (err) {
      document.getElementById('lab-proposed-pane').innerHTML = `<div style="color:var(--error); padding:4rem; text-align:center;">AI Repair Failed: ${err.message}</div>`
      document.getElementById('lab-status-text').textContent = 'Autonomous Repair Failed.'
    }
  },

  async handleBulkAiRepair(questions) {
    const confirmed = await ModalService.confirm("Bulk AI Repair", `This will attempt to auto-repair ${questions.length} questions using AI. Gemini credits will be consumed per question. Proceed?`);
    if (!confirmed) return;
    
    const repairBtn = document.getElementById('repair-all-btn')
    repairBtn.disabled = true
    repairBtn.textContent = 'Repairing...'

    let success = 0
    let failed = 0

    for (const q of questions) {
      try {
        const { data: fix, error } = await DataService.aiRegenerateQuestion(q.id, 'Missing explanation', 'Auto-repair initiated by quality audit.')
        if (error) throw error
        
        await DataService.updateQuestion(q.id, { question_text: fix.question_text })
        await DataService.updateQuestionAnswers(q.id, {
          option_a: fix.option_a,
          option_b: fix.option_b,
          option_c: fix.option_c,
          option_d: fix.option_d,
          correct_option: fix.correct_option,
          explanation: fix.explanation
        })
        success++
      } catch (err) {
        console.error(`Repair failed for ${q.id}:`, err)
        failed++
      }
      repairBtn.textContent = `Repairing (${success + failed}/${questions.length})...`
    }

    ModalService.alert("Bulk Repair Complete", `Success: ${success}\nFailed: ${failed}`, success > 0 ? 'success' : 'info');
    this.loadQualityAudit()
  },

  openNewsEditModal(news = null) {
    const isEditing = !!news
    const modalHtml = `
      <div id="news-edit-overlay" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.85); z-index:99999; display:flex; justify-content:center; align-items:center; padding:1.5rem; backdrop-filter: blur(8px);">
        <div class="glass card scale-in" style="width: 100%; max-width: 800px; height: auto; max-height: 95vh; display: flex; flex-direction: column; padding: 0; overflow: hidden; border: 1.5px solid var(--accent-primary); border-radius: 24px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
          
          <!-- Modal Header -->
          <div style="padding: 1.5rem 2.5rem; border-bottom: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02);">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
               <div style="width: 40px; height: 40px; border-radius: 10px; background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; color: white;">
                 <i data-lucide="newspaper" style="width: 20px;"></i>
               </div>
               <h3 style="margin: 0; font-family: 'Outfit'; font-weight: 800; font-size: 1.4rem;">${isEditing ? 'Modernize Article' : 'Draft Elite News'}</h3>
            </div>
            <button id="close-news-x" style="background: rgba(239, 68, 68, 0.1); border: none; color: #ef4444; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
               <i data-lucide="x" style="width: 20px;"></i>
            </button>
          </div>

          <!-- Modal Body (Scrollable) -->
          <div style="padding: 2rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 1.5rem;">
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
              <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                 <label style="font-size: 0.8rem; color: var(--accent-primary); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Article Title</label>
                 <input type="text" id="edit-news-title" class="glass-input" value="${news ? news.title.replace(/"/g, '&quot;') : ''}" placeholder="e.g. JAMB 2026 Registration Begins" style="width: 100%; height: 50px; font-weight: 600;">
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                 <label style="font-size: 0.8rem; color: var(--accent-primary); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Category</label>
                 <select id="edit-news-category" class="glass-select" style="width: 100%; height: 50px; font-weight: 600;">
                   <option value="JAMB" ${news && news.category === 'JAMB' ? 'selected' : ''}>JAMB</option>
                   <option value="WAEC" ${news && news.category === 'WAEC' ? 'selected' : ''}>WAEC</option>
                   <option value="NECO" ${news && news.category === 'NECO' ? 'selected' : ''}>NECO</option>
                   <option value="Admission" ${news && news.category === 'Admission' ? 'selected' : ''}>Admission</option>
                   <option value="Trending" ${news && news.category === 'Trending' ? 'selected' : ''}>Trending / Tech</option>
                   <option value="General" ${news && news.category === 'General' ? 'selected' : ''}>General</option>
                 </select>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              <label style="font-size: 0.8rem; color: var(--accent-primary); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Short Summary</label>
              <textarea id="edit-news-summary" class="glass-input" placeholder="A brief hook visible on the dashboard cards..." style="width: 100%; min-height: 80px; font-size: 0.95rem; line-height: 1.5; padding: 1rem;">${news ? news.summary : ''}</textarea>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              <label style="font-size: 0.8rem; color: var(--accent-primary); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Full Article Content</label>
              <textarea id="edit-news-content" class="glass-input" placeholder="Write the complete article body here. Supports simple spacing..." style="width: 100%; min-height: 250px; font-size: 0.95rem; line-height: 1.6; padding: 1rem;">${news ? news.content : ''}</textarea>
            </div>

            <div style="background: rgba(0,0,0,0.15); padding: 1.5rem; border-radius: 12px; border: 1px dashed var(--glass-border);">
              <label style="display: block; font-size: 0.8rem; color: var(--text-primary); margin-bottom: 0.75rem; font-weight: 700;">📎 PDF Attachment (Optional)</label>
              ${news && news.attachment_url ? `<div style="font-size: 0.8rem; margin-bottom: 1rem; color: var(--accent-secondary); font-weight: 600;">Current: <a href="${news.attachment_url}" target="_blank" style="color: #60a5fa; text-decoration: underline;">${news.attachment_name || 'View File'}</a></div>` : ''}
              <input type="file" id="edit-news-attachment" accept=".pdf" class="glass-input" style="width: 100%; font-size: 0.85rem; padding: 0.6rem;">
            </div>
          </div>

          <!-- Modal Footer (Sticky) -->
          <div style="padding: 1.5rem 2rem; border-top: 1px solid var(--glass-border); background: rgba(0,0,0,0.2); display: flex; gap: 1.25rem;">
            <button id="cancel-news-edit" class="btn-secondary" style="flex:1; height: 54px; font-weight: 800; font-family: 'Outfit'; cursor: pointer; border-radius: 12px; font-size: 1rem;">Cancel</button>
            <button id="save-news-edit" class="btn-primary" style="flex:2; height: 54px; font-weight: 900; font-family: 'Outfit'; cursor: pointer; border: none; background: var(--accent-gradient); color: white !important; border-radius: 12px; font-size: 1.1rem; box-shadow: 0 4px 15px rgba(0,0,0,0.3); transition: transform 0.2s;">
              ${isEditing ? 'Save Changes' : 'Publish Article'}
            </button>
          </div>
        </div>
      </div>
    `
    document.body.insertAdjacentHTML('beforeend', modalHtml)
    
    document.getElementById('close-news-x').onclick = () => document.getElementById('news-edit-overlay').remove()
    document.getElementById('cancel-news-edit').onclick = () => document.getElementById('news-edit-overlay').remove()
    
    document.getElementById('save-news-edit').onclick = async () => {
      const title = document.getElementById('edit-news-title').value.trim()
      const category = document.getElementById('edit-news-category').value
      const summary = document.getElementById('edit-news-summary').value.trim()
      const content = document.getElementById('edit-news-content').value.trim()
      
      if (!title || !summary || !content) {
        ModalService.alert("Required Fields", "All fields (Title, Summary, Content) must be filled.", 'warning');
        return;
      }
      
      const fileInput = document.getElementById('edit-news-attachment')
      const file = fileInput.files[0]

      const saveBtn = document.getElementById('save-news-edit')
      const originalText = isEditing ? 'Save Changes' : 'Publish Article'
      
      saveBtn.textContent = file ? 'Uploading...' : 'Processing...'
      saveBtn.disabled = true
      
      let attachment_url = news ? news.attachment_url : null
      let attachment_name = news ? news.attachment_name : null

      if (file) {
        if (file.type !== 'application/pdf') {
            await ModalService.alert("Invalid File", "Only PDF files are allowed for attachments.", 'error');
            saveBtn.textContent = originalText
            saveBtn.disabled = false
            return
        }
        const { url, error } = await DataService.adminUploadNewsAttachment(file)
        if (error) {
            await ModalService.alert("Upload Failed", 'File Upload failed: ' + error.message, 'error')
            saveBtn.textContent = originalText
            saveBtn.disabled = false
            return
        }
        attachment_url = url
        attachment_name = file.name
      }
      
      saveBtn.textContent = isEditing ? 'Updating...' : 'Publishing...'

      let res;
      if (isEditing) {
         res = await DataService.adminUpdateNews(news.id, { title, category, summary, content, attachment_url, attachment_name })
      } else {
         res = await DataService.adminCreateNews({ title, category, summary, content, attachment_url, attachment_name })
      }

      if (res.error) {
        await ModalService.alert("Save Error", 'Error saving news: ' + res.error.message, 'error')
        saveBtn.textContent = isEditing ? 'Save Changes' : 'Publish Article'
        saveBtn.disabled = false
      } else {
        document.getElementById('news-edit-overlay').remove()
        this.loadNews()
      }
    }
  },

  async loadNews() {
    const list = document.getElementById('admin-news-list')
    if (!list) return
    list.innerHTML = '<div class="loader-spinner" style="margin: 3rem auto;"></div>'
    
    try {
      const { data, error } = await DataService.getNewsUpdates(50)
      if (error) throw error
      
      if (!data || data.length === 0) {
        list.innerHTML = `
          <div style="text-align: center; padding: 4rem 2rem; background: rgba(255,255,255,0.02); border-radius: 20px; border: 1px dashed var(--glass-border);">
            <i data-lucide="newspaper" style="width: 48px; height: 48px; color: var(--text-secondary); opacity: 0.2; margin-bottom: 1rem;"></i>
            <p style="color: var(--text-secondary); font-weight: 600;">No articles published yet.</p>
            <button class="btn-primary" style="margin-top: 1.5rem; height: 40px;" onclick="document.getElementById('add-news-btn').click()">Create First Article</button>
          </div>
        `
        if (window.lucide) window.lucide.createIcons({ root: list })
        return
      }

      list.innerHTML = data.map(news => `
        <div class="glass card scale-in" style="padding: 1.5rem; display: flex; justify-content: space-between; align-items: center; gap: 1.5rem; border-left: 4px solid var(--accent-primary); background: rgba(255,255,255,0.02);">
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
               <span class="badge" style="background: rgba(124, 58, 237, 0.1); color: var(--accent-primary); font-size: 0.65rem; font-weight: 800;">${news.category || 'GENERAL'}</span>
               <span style="font-size: 0.7rem; color: var(--text-secondary); font-weight: 600;">${new Date(news.created_at).toLocaleDateString()}</span>
            </div>
            <h4 style="margin: 0; font-family: 'Outfit'; font-weight: 800; color: var(--text-primary); font-size: 1.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${news.title}</h4>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${news.summary || ''}</p>
          </div>
          <div style="display: flex; gap: 0.75rem; flex-shrink: 0;">
            <button class="edit-news-btn btn-secondary" data-id="${news.id}" style="height: 40px; width: 40px; padding: 0; border-radius: 10px; display: flex; align-items: center; justify-content: center;" title="Edit Article">
              <i data-lucide="edit-3" style="width: 18px;"></i>
            </button>
            <button class="delete-news-btn btn-secondary" data-id="${news.id}" style="height: 40px; width: 40px; padding: 0; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #ef4444; border-color: rgba(239, 68, 68, 0.2);" title="Delete Article">
              <i data-lucide="trash-2" style="width: 18px;"></i>
            </button>
          </div>
        </div>
      `).join('')

      // Attach events
      list.querySelectorAll('.edit-news-btn').forEach(btn => {
        btn.onclick = () => {
          const news = data.find(n => n.id === btn.dataset.id)
          this.openNewsEditModal(news)
        }
      })

      list.querySelectorAll('.delete-news-btn').forEach(btn => {
        btn.onclick = () => this.deleteNews(btn.dataset.id)
      })

      if (window.lucide) window.lucide.createIcons({ root: list })

    } catch (err) {
      list.innerHTML = `<div style="color: var(--error); text-align: center; padding: 2rem;">Error loading news: ${err.message}</div>`
    }
  },

  async deleteNews(id) {
    const confirmed = await ModalService.confirm("Delete Article?", "Are you sure you want to permanently delete this news article? This action cannot be undone.");
    if (!confirmed) return;

    try {
      const { error } = await DataService.adminDeleteNews(id);
      if (error) throw error;
      
      ModalService.showToast("Article deleted successfully", "success");
      await DataService.logAdminAction(this._adminProfile.email, 'Delete News', id, 'Permanently deleted article');
      this.loadNews();
    } catch (err) {
      ModalService.alert("Delete Failed", err.message, 'error');
    }
  },

  async loadMarketing() {
    const codeList = document.getElementById('promo-codes-list')
    if (codeList) {
        codeList.innerHTML = '<div class="loader-spinner" style="margin: 2rem auto;"></div>'
        const { data } = await DataService.getPromoCodes()
        if (!data || data.length === 0) {
            codeList.innerHTML = `
              <div style="text-align: center; padding: 2rem; opacity: 0.5;">
                <i data-lucide="ticket" style="width: 32px; margin-bottom: 0.5rem; display: block; margin-left: auto; margin-right: auto;"></i>
                <p style="font-size: 0.85rem;">No active promo codes</p>
              </div>
            `
        } else {
            codeList.innerHTML = data.map(c => `
                <div class="glass card promo-item" style="padding: 1rem 1.25rem; background: rgba(255,255,255,0.03); margin-bottom: 0.75rem; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--glass-border);">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                      <div style="background: var(--accent-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-family: 'Outfit'; font-weight: 900; font-size: 1.1rem; letter-spacing: 0.05em;">${c.code}</div>
                      <div style="font-size: 0.75rem; color: var(--success); font-weight: 800; background: rgba(34, 197, 94, 0.1); padding: 2px 8px; border-radius: 4px;">-${c.percent}%</div>
                    </div>
                    <button class="delete-promo-btn" data-id="${c.id}" style="height: 32px; padding: 0 0.75rem; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #ef4444; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; font-size: 0.7rem; font-weight: 800; gap: 0.4rem;">
                        <i data-lucide="trash-2" style="width: 12px;"></i> REVOKE
                    </button>
                </div>
            `).join('')
            
            document.querySelectorAll('.delete-promo-btn').forEach(btn => {
                btn.onclick = async () => {
                    const codeLabel = btn.closest('.promo-item').querySelector('[style*="transparent"]').textContent;
                    const confirmed = await ModalService.confirm("Revoke Promo?", `This will deactivate the promo code ${codeLabel}. Continue?`);
                    if (!confirmed) return;
                    
                    btn.disabled = true
                    btn.innerHTML = '...'
                    await DataService.deletePromoCode(btn.dataset.id)
                    this.loadMarketing()
                }
            })
        }
        if (window.lucide) window.lucide.createIcons({ root: codeList })
    }

    const broadcastInput = document.getElementById('broadcast-message-input')
    if (broadcastInput) {
        const { data } = await DataService.getSystemConfig('broadcast_message')
        if (data) broadcastInput.value = data.value || ''
    }

    const updateBtn = async (btnId, key) => {
        const btn = document.getElementById(btnId)
        if (!btn) return
        const { data } = await DataService.getSystemConfig(key)
        const isActive = data?.value === true || data?.value === 'true'
        btn.dataset.state = isActive
        
        btn.innerHTML = isActive 
          ? `<i data-lucide="unlock" style="width: 14px;"></i> ENABLED`
          : `<i data-lucide="lock" style="width: 14px;"></i> DISABLED`
        
        btn.className = isActive ? 'btn-primary' : 'btn-secondary'
        btn.style.width = '140px'
        btn.style.justifyContent = 'center'
        btn.style.gap = '0.5rem'
        btn.style.display = 'flex'
        btn.style.alignItems = 'center'
        btn.style.fontSize = '0.75rem'

        if (window.lucide) window.lucide.createIcons({ root: btn })
    }

    await updateBtn('toggle-explanations-btn', 'explanations_free_access')
    await updateBtn('toggle-exams-btn', 'exams_free_access')
    await updateBtn('toggle-ai-tutor-btn', 'ai_tutor_free_access')

    // Populated Numeric/String configs
    const configsToLoad = [
        { id: 'cfg-daily-goal', key: 'daily_goal_target' },
        { id: 'cfg-practice-free', key: 'daily_practice_limit_free' },
        { id: 'cfg-exam-free', key: 'daily_exam_limit_free' },
        { id: 'cfg-practice-med', key: 'daily_practice_limit_medium' },
        { id: 'cfg-exam-med', key: 'daily_exam_limit_medium' },
        { id: 'cfg-ai-credits-medium', key: 'ai_credits_initial_medium' },
        { id: 'cfg-price-lifetime', key: 'pricing_lifetime' },
        { id: 'cfg-price-monthly', key: 'pricing_monthly' }
    ]

    for (const item of configsToLoad) {
        const el = document.getElementById(item.id)
        if (el) {
            const { data } = await DataService.getSystemConfig(item.key)
            if (data) el.value = data.value || ''
        }
    }
  }
}

