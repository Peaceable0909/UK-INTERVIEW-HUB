// ===== CONFIG =====
const SUPABASE_URL = 'https://okshteetxmmphgjgvrwt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rc2h0ZWV0eG1tcGhnamd2cnd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MjgwNjgsImV4cCI6MjA5MTMwNDA2OH0.YN3vYBZ_3iESod6t8P2KIYfVkuazXitceMw17xtdgu8';
const EMAILJS_PUBLIC_KEY = 'WQ9ZIq9xkFVWQkFRM';
const EMAILJS_SERVICE_ID = 'service_v6wame2';
const EMAILJS_TEMPLATE_ID = 'template_6lh9ond';

// ===== INIT =====
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabaseClient = supabaseClient;
emailjs.init(EMAILJS_PUBLIC_KEY);

let _sessionReadyResolve;
window.sessionReady = new Promise(resolve => { _sessionReadyResolve = resolve; });

// ===== DOM ELEMENTS =====
const loginModal = document.getElementById('loginModal');
const loginBtn = document.getElementById('loginBtn');
const modalClose = document.getElementById('modalClose');
const googleSignInBtn = document.getElementById('googleSignInBtn');
const authError = document.getElementById('authError');
const authSuccess = document.getElementById('authSuccess');
const studentNameDisplay = document.getElementById('studentNameDisplay');
const userMenu = document.getElementById('userMenu');
const userNameDisplay = document.getElementById('userNameDisplay');
const userAvatar = document.getElementById('userAvatar');
const logoutBtn = document.getElementById('logoutBtn');
const tabLogin = document.getElementById('tabLogin');
const tabSignup = document.getElementById('tabSignup');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');

// ===== CHECK SESSION ON LOAD =====
async function checkSession() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user) {
      await loadStudentProfile(session.user);
      await checkStudentId(session.user);
      showAuthenticatedUI(session.user);
    } else {
      setTimeout(() => {
        if (loginModal) loginModal.style.display = 'flex';
      }, 1000);
    }
  } catch (err) {
    console.error('checkSession error:', err);
  } finally {
    _sessionReadyResolve();
  }
}

// ===== LOAD/SAVE STUDENT PROFILE =====
async function loadStudentProfile(user) {
  try {
    let { data: profile } = await supabaseClient
      .from('student_progress')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      const { data: newProfile, error } = await supabaseClient
        .from('student_progress')
        .insert({
          user_id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Student',
          student_id: user.user_metadata?.student_id || '',
          email: user.email
        })
        .select()
        .single();
      if (error) { console.error('Profile creation error:', error); return null; }
      profile = newProfile;
    }

    localStorage.setItem('student', JSON.stringify({
      id: profile.user_id,
      name: profile.full_name,
      student_id: profile.student_id || '',
      email: profile.email
    }));
    return profile;
  } catch (err) {
    console.error('loadStudentProfile error:', err);
    return null;
  }
}

// ===== CHECK & PROMPT FOR STUDENT ID =====
async function checkStudentId(user) {
  try {
    const student = JSON.parse(localStorage.getItem('student'));
    if (student && student.student_id && student.student_id !== '') return true;

    const modal = document.getElementById('studentIdModal');
    const input = document.getElementById('studentIdInput');
    const saveBtn = document.getElementById('saveStudentIdBtn');
    const errorDiv = document.getElementById('studentIdError');

    if (!modal || !input || !saveBtn) return true;

    modal.style.display = 'flex';

    return new Promise((resolve) => {
      saveBtn.onclick = async () => {
        const studentId = input.value.trim();
        if (!studentId) {
          if (errorDiv) errorDiv.textContent = 'Please enter a valid Student ID.';
          return;
        }
        const { error } = await supabaseClient
          .from('student_progress')
          .update({ student_id: studentId })
          .eq('user_id', user.id);
        if (error) {
          if (errorDiv) errorDiv.textContent = error.message;
          return;
        }
        const updatedStudent = { ...student, student_id: studentId };
        localStorage.setItem('student', JSON.stringify(updatedStudent));
        modal.style.display = 'none';
        resolve(true);
      };
    });
  } catch (err) {
    console.error('checkStudentId error:', err);
    return true;
  }
}

// ===== SHOW AUTHENTICATED UI =====
function showAuthenticatedUI(user) {
  try {
    const student = JSON.parse(localStorage.getItem('student'));
    if (!student) return;
    if (loginModal) loginModal.style.display = 'none';
    if (studentNameDisplay) studentNameDisplay.textContent = student.name?.split(' ')[0] || 'Student';
    if (authSuccess) authSuccess.style.display = 'flex';
    setTimeout(() => {
      if (authSuccess) authSuccess.style.display = 'none';
      if (loginBtn) loginBtn.style.display = 'none';
      if (userMenu) userMenu.style.display = 'flex';
      if (userNameDisplay) userNameDisplay.textContent = student.name?.split(' ')[0] || 'Student';
      if (userAvatar) {
        const initials = (student.name || 'S').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        userAvatar.textContent = initials;
      }
    }, 1500);
  } catch (err) {
    console.error('showAuthenticatedUI error:', err);
  }
}

// ===== TAB SWITCHING =====
function setupTabSwitching() {
  if (!tabLogin || !tabSignup || !loginForm || !signupForm) return;
  tabLogin.addEventListener('click', () => {
    loginForm.style.display = 'block'; signupForm.style.display = 'none';
    tabLogin.style.cssText = 'background:var(--white);color:var(--navy);font-weight:600;box-shadow:var(--shadow-sm);';
    tabSignup.style.cssText = 'background:transparent;color:var(--gray-600);font-weight:500;box-shadow:none;';
    if (authError) authError.textContent = '';
  });
  tabSignup.addEventListener('click', () => {
    signupForm.style.display = 'block'; loginForm.style.display = 'none';
    tabSignup.style.cssText = 'background:var(--white);color:var(--navy);font-weight:600;box-shadow:var(--shadow-sm);';
    tabLogin.style.cssText = 'background:transparent;color:var(--gray-600);font-weight:500;box-shadow:none;';
    if (authError) authError.textContent = '';
  });
}

// ===== GOOGLE SIGN-IN =====
function setupGoogleSignIn() {
  if (!googleSignInBtn) return;
  googleSignInBtn.addEventListener('click', async () => {
    if (authError) authError.textContent = '';
    googleSignInBtn.disabled = true;
    googleSignInBtn.textContent = 'Connecting...';
    try {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/UK-INTERVIEW-HUB/index.html' }
      });
      if (error) throw error;
    } catch (err) {
      if (authError) authError.textContent = err.message || 'Sign-in failed.';
      googleSignInBtn.disabled = false;
      googleSignInBtn.innerHTML = '<i class="fab fa-google" style="color:#DB4437;"></i> Continue with Google';
    }
  });
}

// ===== EMAIL SIGNUP =====
function setupEmailSignup() {
  if (!signupForm) return;
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (authError) authError.textContent = '';
    const submitBtn = signupForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    const name = document.getElementById('signupName')?.value.trim();
    const student_id = document.getElementById('signupStudentId')?.value.trim();
    const email = document.getElementById('signupEmail')?.value.trim();
    const password = document.getElementById('signupPassword')?.value;
    if (!name || !student_id || !email || !password) {
      if (authError) authError.textContent = 'Please fill in all fields.'; return;
    }
    submitBtn.disabled = true; submitBtn.textContent = 'Creating...';
    try {
      const { data: authData, error: authErrorObj } = await supabaseClient.auth.signUp({
        email, password, options: { data: { full_name: name, student_id } }
      });
      if (authErrorObj) {
        if (authError) authError.textContent = authErrorObj.message;
        submitBtn.disabled = false; submitBtn.innerHTML = originalBtnText; return;
      }
      if (authData?.user) {
        const { error: dbError } = await supabaseClient
          .from('student_progress')
          .insert({ user_id: authData.user.id, full_name: name, student_id, email });
        if (dbError) {
          if (authError) authError.textContent = dbError.message;
          submitBtn.disabled = false; submitBtn.innerHTML = originalBtnText; return;
        }
        localStorage.setItem('student', JSON.stringify({ id: authData.user.id, name, student_id, email }));
        if (signupForm) signupForm.style.display = 'none';
        if (studentNameDisplay) studentNameDisplay.textContent = name.split(' ')[0];
        if (authSuccess) authSuccess.style.display = 'flex';
        setTimeout(() => {
          if (authSuccess) authSuccess.style.display = 'none';
          if (loginModal) loginModal.style.display = 'none';
          if (loginBtn) loginBtn.style.display = 'none';
          if (userMenu) userMenu.style.display = 'flex';
          if (userNameDisplay) userNameDisplay.textContent = name.split(' ')[0];
          if (userAvatar) userAvatar.textContent = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        }, 1500);
      }
    } catch (err) {
      if (authError) authError.textContent = err.message || 'An unexpected error occurred.';
      submitBtn.disabled = false; submitBtn.innerHTML = originalBtnText;
    }
  });
}

// ===== EMAIL LOGIN =====
function setupEmailLogin() {
  if (!loginForm) return;
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (authError) authError.textContent = '';
    const email = document.getElementById('loginEmail')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;
    if (!email || !password) {
      if (authError) authError.textContent = 'Please enter email and password.'; return;
    }
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) { if (authError) authError.textContent = error.message; return; }
    const { data: profile } = await supabaseClient
      .from('student_progress').select('*').eq('user_id', data.user.id).single();
    if (profile) {
      localStorage.setItem('student', JSON.stringify({
        id: profile.user_id, name: profile.full_name, student_id: profile.student_id, email: profile.email
      }));
      if (loginForm) loginForm.style.display = 'none';
      if (studentNameDisplay) studentNameDisplay.textContent = profile.full_name.split(' ')[0];
      if (authSuccess) authSuccess.style.display = 'flex';
      setTimeout(() => {
        if (authSuccess) authSuccess.style.display = 'none';
        if (loginModal) loginModal.style.display = 'none';
        if (loginBtn) loginBtn.style.display = 'none';
        if (userMenu) userMenu.style.display = 'flex';
        if (userNameDisplay) userNameDisplay.textContent = profile.full_name.split(' ')[0];
        if (userAvatar) userAvatar.textContent = profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      }, 1500);
    }
  });
}

// ===== LOGOUT =====
function setupLogout() {
  if (!logoutBtn) return;
  logoutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    localStorage.removeItem('student');
    localStorage.removeItem('selected_university');
    location.reload();
  });
}

// ===== MODAL CONTROLS =====
function setupModalControls() {
  if (loginBtn) loginBtn.addEventListener('click', () => { if (loginModal) loginModal.style.display = 'flex'; });
  if (modalClose) modalClose.addEventListener('click', () => { if (loginModal) loginModal.style.display = 'none'; });
  if (loginModal) loginModal.addEventListener('click', (e) => { if (e.target === loginModal) loginModal.style.display = 'none'; });
}

// ===== UNIVERSITY TRACKING =====
function setupUniversityTracking() {
  document.querySelectorAll('.start-training').forEach(btn => {
    btn.addEventListener('click', () => {
      const uni = btn.getAttribute('data-university');
      if (localStorage.getItem('student') && uni) {
        localStorage.setItem('selected_university', uni);
        // Also save to Supabase immediately
        saveUniversityToDB(uni);
      }
    });
  });
}

// Auto-detect school from ai_scores or checklist_status keys
function detectSchoolFromProgress(progress) {
  const schoolMap = {
    'BPP_': 'bpp',
    'REGENT_': 'regent', 
    'YSJ_': 'yorkstjohn',
    'NL_': 'netherlands',
    'UKVI_': 'ukvi',
    'NRS_': 'nursing'
  };

  // Check ai_scores keys
  if (progress?.ai_scores) {
    for (const key of Object.keys(progress.ai_scores)) {
      for (const [prefix, school] of Object.entries(schoolMap)) {
        if (key.startsWith(prefix)) return school;
      }
    }
  }

  // Check checklist_status keys (namespaced format: "school__course::item")
  if (progress?.checklist_status) {
    for (const key of Object.keys(progress.checklist_status)) {
      for (const [prefix, school] of Object.entries(schoolMap)) {
        if (key.toUpperCase().startsWith(prefix)) return school;
      }
      // Check namespaced format
      const nsMatch = key.match(/^(bpp|regent|yorkstjohn|netherlands|ukvi|nursing|general)__/i);
      if (nsMatch) return nsMatch[1].toLowerCase();
    }
  }

  // Check practice_responses keys
  if (progress?.practice_responses) {
    for (const key of Object.keys(progress.practice_responses)) {
      for (const [prefix, school] of Object.entries(schoolMap)) {
        if (key.startsWith(prefix)) return school;
      }
    }
  }

  return null;
}

// Save selected university to Supabase
async function saveUniversityToDB(uni) {
  const student = window.getCurrentStudent();
  if (!student?.id || !uni) return;
  try {
    await supabaseClient.from('student_progress')
      .update({ selected_university: uni, updated_at: new Date().toISOString() })
      .eq('user_id', student.id);
  } catch (err) {
    console.error('saveUniversityToDB error:', err);
  }
}

// Auto-save detected school to DB if missing
async function autoSaveDetectedSchool(progress) {
  const student = window.getCurrentStudent();
  if (!student?.id) return;
  // Only auto-detect if selected_university is null/empty/"Not Selected"
  const current = progress?.selected_university;
  if (current && current !== 'null' && current !== 'Not Selected' && current !== '') return;

  const detected = detectSchoolFromProgress(progress);
  if (detected) {
    try {
      await supabaseClient.from('student_progress')
        .update({ selected_university: detected, updated_at: new Date().toISOString() })
        .eq('user_id', student.id);
      console.log('Auto-detected and saved school:', detected);
    } catch (err) {
      console.error('autoSaveDetectedSchool error:', err);
    }
  }
}

// ===== GLOBAL FUNCTIONS =====
window.getCurrentStudent = () => {
  try { return JSON.parse(localStorage.getItem('student')); } catch { return null; }
};
window.getSelectedUniversity = () => localStorage.getItem('selected_university');

// ===== PROGRESS KEY HELPERS =====
// Returns a namespaced key like "bpp__mba-international" so each school+program
// stores its own independent data. Falls back to a school-only key.
window.getProgressNamespace = () => {
  const school = localStorage.getItem('last_school') || 'general';
  const course = localStorage.getItem('last_course') || '';
  return course ? `${school}__${course}` : school;
};

window.saveProgress = async (data) => {
  const student = window.getCurrentStudent();
  if (!student?.id) return { error: 'Not authenticated' };
  return await supabaseClient.from('student_progress')
    .update({ updated_at: new Date().toISOString(), ...data }).eq('user_id', student.id);
};

window.sendReadyEmail = async (responses, checklist, score, message = '') => {
  const student = window.getCurrentStudent();
  const university = window.getSelectedUniversity();
  if (!student) return { error: 'Not authenticated' };

  const allQuestions = Object.entries(responses);
  const totalQuestions = allQuestions.length;
  const passedQuestions = allQuestions.filter(([, a]) => a?.finalStatus === 1 || a?.score >= 7);
  const failedQuestions = allQuestions.filter(([, a]) => !(a?.finalStatus === 1 || a?.score >= 7));
  const percentScore = totalQuestions > 0 ? Math.round((passedQuestions.length / totalQuestions) * 100) : 0;

  let readinessLevel, readinessEmoji;
  if (percentScore >= 90) { readinessLevel = 'Ready for Interview'; readinessEmoji = '✅'; }
  else if (percentScore >= 70) { readinessLevel = 'Almost Ready'; readinessEmoji = '⚠️'; }
  else { readinessLevel = 'Not Ready'; readinessEmoji = '❌'; }

  const sep = '─────────────────────────────';
  const passedText = passedQuestions.length > 0
    ? passedQuestions.map(([qId, a], i) => {
        const label = (window.QUESTION_TEXT_MAP || {})[qId] || a.questionText || qId;
        const attemptNote = (a.attempts || 1) > 1 ? ` (passed on attempt ${a.attempts})` : '';
        return [`Q${i + 1}: ${label}`, `Score: ${a.score}/10${attemptNote}`, `Answer: ${(a.answer || 'No answer recorded').trim()}`, sep].join('\n');
      }).join('\n')
    : 'No questions passed yet.';

  const failedText = failedQuestions.length > 0
    ? failedQuestions.map(([qId, a]) => {
        const label = (window.QUESTION_TEXT_MAP || {})[qId] || a.questionText || qId;
        return `• ${label} -- Best score: ${a.score || 0}/10 after ${a.attempts || 1} attempt(s)`;
      }).join('\n')
    : 'All questions passed ✅';

  const attemptSummary = allQuestions.map(([qId, a], i) => {
    const label = (window.QUESTION_TEXT_MAP || {})[qId] || a.questionText || qId;
    const passed = a?.finalStatus === 1 || a?.score >= 7;
    const shortLabel = label.length > 55 ? label.substring(0, 52) + '...' : label;
    return `${passed ? '✅' : '❌'} Q${i + 1}: ${shortLabel}\n     Score: ${a.score || 0}/10 | Attempts: ${a.attempts || 1}`;
  }).join('\n\n');

  const checklistEntries = Object.entries(checklist);
  const doneItems = checklistEntries.filter(([, v]) => v === true);
  const pendingItems = checklistEntries.filter(([, v]) => v !== true);
  const checklistText = checklistEntries.length > 0
    ? [`Completed (${doneItems.length}/${checklistEntries.length}):`,
       ...doneItems.map(([item]) => `  ✅ ${item}`),
       pendingItems.length > 0 ? `\nNot completed (${pendingItems.length}):` : '',
       ...pendingItems.map(([item]) => `  ⬜ ${item}`)].filter(Boolean).join('\n')
    : 'No checklist items recorded.';

  const divider = '═══════════════════════════════════';
  const emailBody = [
    divider, 'STUDENT INTERVIEW READINESS REPORT', divider,
    `Name:        ${student.name}`, `Student ID:  ${student.student_id || 'N/A'}`,
    `Email:       ${student.email}`, `University:  ${university || 'Not selected'}`, '',
    'OVERALL RESULT', `${readinessEmoji} ${readinessLevel}`,
    `Score: ${passedQuestions.length}/${totalQuestions} questions passed (${percentScore}%)`, divider,
    '', 'PASSED ANSWERS', sep, passedText,
    '', 'QUESTIONS NOT YET PASSED', sep, failedText,
    '', 'FULL ATTEMPT SUMMARY', sep, attemptSummary || 'No attempts recorded.',
    divider, '', 'PREPARATION CHECKLIST', sep, checklistText, divider
  ].join('\n');

  try {
    // Send via Edge Function → Apps Script (beautiful HTML email to admin)
    const { data: { session } } = await supabaseClient.auth.getSession();
    const token = session?.access_token;
    const passedQArr = passedQuestions.map(([qId, a]) => ({
      q: (window.QUESTION_TEXT_MAP||{})[qId] || a.questionText || qId,
      score: a.score || 0,
      answer: (a.answer || '').substring(0, 300),
      attempts: a.attempts || 1
    }));
    const failedQArr = failedQuestions.map(([qId, a]) => ({
      q: (window.QUESTION_TEXT_MAP||{})[qId] || a.questionText || qId,
      score: a.score || 0,
      attempts: a.attempts || 1
    }));
    const chkArr = Object.entries(checklist);
    const result = await fetch('https://okshteetxmmphgjgvrwt.supabase.co/functions/v1/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (token || '') },
      body: JSON.stringify({
        type: 'ready_report',
        student_name: student.name,
        student_id: student.student_id || 'N/A',
        student_email: student.email,
        university: university || 'Not selected',
        course_name: localStorage.getItem('last_course') || '',
        passed_count: passedQuestions.length,
        total_count: totalQuestions,
        percent_score: percentScore,
        avg_score: score,
        readiness_level: `${readinessEmoji} ${readinessLevel}`,
        passed_questions: passedQArr,
        failed_questions: failedQArr,
        checklist_done: chkArr.filter(([,v])=>v===true).length,
        checklist_total: chkArr.length
      })
    });
    const resultData = await result.json()
  } catch (err) {
    console.error('Email send error:', err);
    return { error: err.message || 'Failed to send email' };
  }
};

// ===== CHECKLIST SAVE/LOAD -- student_checklists table =====
// One row per (user_id, school, course). Completely isolated across schools.
// Falls back gracefully if the user is not authenticated.

window.saveChecklistItem = async (itemId, checked, itemText) => {
  const student = window.getCurrentStudent();
  if (!student?.id) return;
  const school = localStorage.getItem('last_school') || 'general';
  const course = localStorage.getItem('last_course') || '';
  const key = (itemText && itemText.trim()) ? itemText.trim() : itemId;
  try {
    // Load current row for this school+course
    const { data: current } = await supabaseClient
      .from('student_checklists')
      .select('items')
      .eq('user_id', student.id)
      .eq('school', school)
      .eq('course', course)
      .maybeSingle();

    const updatedItems = { ...(current?.items || {}), [key]: checked };

    await supabaseClient
      .from('student_checklists')
      .upsert(
        { user_id: student.id, school, course, items: updatedItems, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,school,course' }
      );
  } catch (err) { console.error('saveChecklistItem error:', err); }
};

// Load checklist items for the current school+course only.
// Returns a plain object: { "item text": true/false, … }
window.loadChecklistForCurrentPage = async () => {
  const student = window.getCurrentStudent();
  if (!student?.id) {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session?.user) return {};
    } catch { return {}; }
  }
  const userId = student?.id || (await supabaseClient.auth.getSession())?.data?.session?.user?.id;
  if (!userId) return {};
  const school = localStorage.getItem('last_school') || 'general';
  const course = localStorage.getItem('last_course') || '';
  try {
    const { data, error } = await supabaseClient
      .from('student_checklists')
      .select('items')
      .eq('user_id', userId)
      .eq('school', school)
      .eq('course', course)
      .maybeSingle();
    if (error) { console.error('loadChecklistForCurrentPage error:', error.message); return {}; }
    return data?.items || {};
  } catch (err) { console.error('loadChecklistForCurrentPage error:', err); return {}; }
};

// Load ALL checklists for a user (used by dashboard/ready email).
// Returns array: [{ school, course, items }, …]
window.loadAllChecklists = async () => {
  const student = window.getCurrentStudent();
  if (!student?.id) return [];
  try {
    const { data, error } = await supabaseClient
      .from('student_checklists')
      .select('school, course, items, updated_at')
      .eq('user_id', student.id);
    if (error) { console.error('loadAllChecklists error:', error.message); return []; }
    return data || [];
  } catch (err) { console.error('loadAllChecklists error:', err); return []; }
};

// ===== RESET ALL PROGRESS (manual opt-out only -- never auto-called) =====
window.resetAllProgress = async () => {
  const student = window.getCurrentStudent();
  if (!student?.id) return { error: 'Not authenticated' };
  try {
    const { error } = await supabaseClient.from('student_progress')
      .update({
        ai_scores: {},
        practice_responses: {},
        checklist_status: {},
        selected_university: null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', student.id);
    if (error) return { error: error.message };
    localStorage.removeItem('last_course');
    localStorage.removeItem('last_school');
    localStorage.removeItem('selected_university');
    return { success: true };
  } catch (err) { return { error: err.message }; }
};

// ═══════════════════════════════════════════════════════════════════════
// SCHOOL / PROGRAM LOCK  one active session at a time
// Switching school OR program wipes the full record and notifies student.
// ═══════════════════════════════════════════════════════════════════════

const _SCHOOL_LABELS = {
  regent:'Regent College', bpp:'BPP', yorkstjohn:'York St John',
  ukvi:'UKVI', netherlands:'Netherlands', nursing:'BSc Nursing'
};
const _EDGE_FN_URL = 'https://okshteetxmmphgjgvrwt.supabase.co/functions/v1/send-email';

window.lockToSchool = async function(pageSchool, pageCourse) {
  pageCourse = pageCourse || null;
  const student = window.getCurrentStudent();
  if (!student) return;
  const activeSchool = student.selected_university;
  const activeCourse = student.selected_course || null;
  const schoolChanged = activeSchool && activeSchool !== 'Not Selected' && activeSchool !== pageSchool;
  const courseChanged = pageCourse && activeCourse && activeCourse !== pageCourse;
  if (!activeSchool || activeSchool === 'Not Selected') { await _setActiveSession(pageSchool, pageCourse, student); return; }
  if (!schoolChanged && !courseChanged) return;
  var fromLabel = (_SCHOOL_LABELS[activeSchool] || activeSchool) + (activeCourse ? ' (' + activeCourse + ')' : '');
  var toLabel   = (_SCHOOL_LABELS[pageSchool]   || pageSchool)   + (pageCourse   ? ' (' + pageCourse   + ')' : '');
  _showSwitchWarning(activeSchool, activeCourse || '', pageSchool, pageCourse || '', fromLabel, toLabel);
  _setReadyBtn(false);
};

window.onCourseSelected = async function(pageSchool, newCourse) {
  const student = window.getCurrentStudent();
  if (!student) return;
  const activeCourse = student.selected_course || null;
  if (activeCourse === newCourse) return;
  if (activeCourse) { await _executeSwitch(pageSchool, activeCourse, pageSchool, newCourse, student); }
  else { await _setActiveSession(pageSchool, newCourse, student); }
};

function _showSwitchWarning(fromSchool, fromCourse, toSchool, toCourse, fromLabel, toLabel) {
  // Remove any existing modal
  var existing = document.getElementById('wr-switch-modal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'wr-switch-modal';
  modal.style.cssText = [
    'position:fixed;inset:0;z-index:9999',
    'background:rgba(13,27,62,0.72)',
    'backdrop-filter:blur(6px)',
    'display:flex;align-items:center;justify-content:center',
    'padding:20px;box-sizing:border-box'
  ].join(';');

  modal.innerHTML = [
    '<div style="background:#fff;border-radius:24px;max-width:420px;width:100%;',
    'box-shadow:0 24px 64px rgba(13,27,62,0.3);overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">',

    // Red header strip
    '<div style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:24px 24px 20px">',
    '<div style="font-size:28px;margin-bottom:8px">&#9888;&#65039;</div>',
    '<div style="font-size:18px;font-weight:900;color:#fff;line-height:1.2">Hold on!</div>',
    '<div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px">Switching will permanently reset your record</div>',
    '</div>',

    // Body
    '<div style="padding:22px 24px">',

    // From → To
    '<div style="background:#f8fafc;border-radius:12px;padding:14px 16px;margin-bottom:16px">',
    '<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-bottom:8px">You are switching from</div>',
    '<div style="display:flex;align-items:center;gap:10px">',
    '<span style="background:#fee2e2;color:#991b1b;font-size:13px;font-weight:700;padding:5px 12px;border-radius:8px">' + fromLabel + '</span>',
    '<span style="color:#94a3b8;font-size:16px">&#8594;</span>',
    '<span style="background:#dbeafe;color:#1d4ed8;font-size:13px;font-weight:700;padding:5px 12px;border-radius:8px">' + toLabel + '</span>',
    '</div>',
    '</div>',

    // What gets cleared
    '<div style="margin-bottom:20px">',
    '<div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:8px">Everything below will be permanently deleted:</div>',
    '<div style="font-size:13px;color:#6b7280;line-height:2">',
    '&#10060; All practice responses &amp; AI scores<br>',
    '&#10060; Checklist progress<br>',
    '&#10060; Readiness submission',
    '</div>',
    '</div>',

    // Buttons
    '<div style="display:flex;flex-direction:column;gap:8px">',
    '<button id="wr-confirm-switch" style="width:100%;background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;border:none;',
    'padding:14px;border-radius:12px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;',
    'border-bottom:3px solid #991b1c">',
    'Yes, delete my record &amp; switch to ' + toLabel,
    '</button>',
    '<button id="wr-cancel-switch" style="width:100%;background:#f1f5f9;color:#374151;border:none;',
    'padding:14px;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">',
    'Cancel &mdash; stay on ' + fromLabel,
    '</button>',
    '</div>',

    '</div></div>'
  ].join('');

  document.body.appendChild(modal);

  document.getElementById('wr-confirm-switch').addEventListener('click', function() {
    _executeSwitch(fromSchool, fromCourse, toSchool, toCourse, null);
  });
  document.getElementById('wr-cancel-switch').addEventListener('click', function() {
    document.getElementById('wr-switch-modal').remove();
    history.back();
  });
  // Tap outside to cancel
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      modal.remove();
      history.back();
    }
  });
}

async function _executeSwitch(fromSchool, fromCourse, toSchool, toCourse, _student) {
  // Show loading state on the confirm button
  var confirmBtn = document.getElementById('wr-confirm-switch');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Switching…';
    confirmBtn.style.opacity = '0.7';
  }
  var cancelBtn = document.getElementById('wr-cancel-switch');
  if (cancelBtn) cancelBtn.disabled = true;

  const student = _student || window.getCurrentStudent();
  if (!student) return;

  await window.resetAllProgress();
  await supabaseClient.from('student_checklists').delete().eq('user_id', student.id);
  await _setActiveSession(toSchool, toCourse || null, student);
  await _insertSwitchNotification(student, fromSchool, fromCourse, toSchool, toCourse);

  var modal = document.getElementById('wr-switch-modal');
  if (modal) modal.remove();
  _setReadyBtn(true);

  var toLabel2 = (_SCHOOL_LABELS[toSchool] || toSchool) + (toCourse ? ' (' + toCourse + ')' : '');
  if (window.showToast) window.showToast('Switched to ' + toLabel2 + '. Your previous record has been cleared.', 'success');
  setTimeout(function() { window.location.reload(); }, 1200);
}

async function _insertSwitchNotification(student, fromSchool, fromCourse, toSchool, toCourse) {
  try {
    var fromLabel = (_SCHOOL_LABELS[fromSchool] || fromSchool) + (fromCourse ? ' - ' + fromCourse : '');
    var toLabel   = (_SCHOOL_LABELS[toSchool]   || toSchool)   + (toCourse   ? ' - ' + toCourse   : '');
    await supabaseClient.from('student_notifications').insert({
      title: 'Your session record was reset',
      message: 'You switched from ' + fromLabel + ' to ' + toLabel + '. Your previous practice responses, checklist progress, and AI scores have been permanently cleared. If this was a mistake, contact your counsellor.',
      type: 'warning',
      target: 'all',
      target_user_id: student.id,
      created_by: 'system'
    });
  } catch(e) { console.warn('Notification insert failed:', e); }
}

async function _setActiveSession(school, course, student) {
  var update = { selected_university: school, updated_at: new Date().toISOString() };
  if (course !== undefined) update.selected_course = course || null;
  await supabaseClient.from('student_progress').update(update).eq('user_id', student.id);
  student.selected_university = school;
  if (course !== undefined) student.selected_course = course || null;
  localStorage.setItem('student', JSON.stringify(student));
  localStorage.setItem('selected_university', school);
}

function _setReadyBtn(enabled) {
  var btn = document.getElementById('readyBtn');
  if (!btn) return;
  btn.disabled      = !enabled;
  btn.style.opacity = enabled ? '' : '0.5';
  btn.style.cursor  = enabled ? '' : 'not-allowed';
}


window.QUESTION_TEXT_MAP = {
  'UKVI_Q1':'Why have you chosen to study this programme in the UK?','UKVI_Q2':'Why did you choose this specific university?','UKVI_Q3':'What do you plan to do after your studies?','UKVI_Q4':'How will you fund your studies and living expenses?','UKVI_Q5':'Tell me about your academic background.','UKVI_Q6':'What is the name of your course and how long does it last?','UKVI_Q7':'Why do you want to study this subject at degree level?','UKVI_Q8':'What ties do you have to your home country?','UKVI_Q9':'Where will you live during your studies in the UK?','UKVI_Q10':'What are your key responsibilities as a student visa holder?','UKVI_Q11':'How many hours can you work per week during term time?','UKVI_Q12':'Have you ever been refused a visa before? If yes, explain.','UKVI_Q13':'What do you know about the Graduate Route visa?','UKVI_Q14':'How does this course fit with your previous work experience?','UKVI_Q15':'What specific modules interest you most and why?','UKVI_Q16':'Who is sponsoring your studies? What is their occupation?','UKVI_Q17':'What research did you do before choosing this university?','UKVI_Q18':'Why did you choose the UK over other countries like Canada or Australia?',
  'NL_Q1':'Why have you chosen to study in the Netherlands?','NL_Q2':'Why did you choose this specific Dutch university?','NL_Q3':'What are your plans after completing your studies?','NL_Q4':'How will you fund your tuition and living costs?','NL_Q5':'What is the language of instruction and your proficiency?','NL_Q6':'What is the exact name and duration of your course?','NL_Q7':'Do you have any family or connections in the Netherlands?','NL_Q8':'What ties do you have to your home country?','NL_Q9':'Where will you live during your studies? (City and postcode)','NL_Q10':'What do you know about the Orientation Year (Zoekjaar) visa?','NL_Q11':'How does this course connect to your future career goals?','NL_Q12':'What specific modules are you most excited about and why?','NL_Q13':'Have you ever applied for a Dutch visa before? If yes, what happened?','NL_Q14':'What is the total amount of funds required by IND for living costs?','NL_Q15':'What is your accommodation budget per month?','NL_Q16':'Why did you choose a research university (WO) over a university of applied sciences (HBO)?','NL_Q17':'What extracurricular activities or student life aspects attract you?','NL_Q18':'How will you contribute to Dutch society or your home country after graduation?',
  'NRS_SC0':'A patient is anxious before a procedure. How do you respond?',
  'NRS_SC1':'A patient is anxious before a procedure. How do you respond?',
  'NRS_SC2':'A patient shares confidential information about abuse. What do you do?',
  'NRS_SC3':'You see a colleague skip hand hygiene. How do you handle it?',
  'NRS_SC4':'A patient refuses care due to cultural beliefs. How do you proceed?',
  'NRS_SC5':'Tell me about yourself and why you chose nursing.',
  'NRS_SC6':'You have a background in law/business - why switch to nursing?',
  'NRS_SC7':'What does compassion in nursing mean to you? Give an example.',
  'NRS_SC8':'Why BPP University for your nursing degree?',
  'NRS_SC9':'Which module are you most looking forward to, and how will it help your career?',
  'NRS_SC10':'How do you feel about spending 50% of your time on clinical placements?',
  'NRS_SC11':'How will you balance academic work, placements, and self-care?',
  'NRS_SC12':'What do you know about the NMC Code?',
  'NRS_SC13':'How does the NHS structure affect a nurse's role?',
  'NRS_SC14':'What are current challenges in UK adult nursing?',
  'NRS_SC15':'How would you promote equality, diversity, and inclusion in practice?',
  'NRS_SC16':'How will you fund tuition and living costs in London?',
  'NRS_SC17':'Nursing placements may require early starts or travel across London. How will you manage this?',
  'NRS_SC18':'What will you do if your visa is delayed and you miss the course start?',
  'NRS_SC19':'Where do you see yourself 5 years after qualifying as a nurse?',
  'NRS_SC20':'How will you maintain your NMC registration after qualifying?',
  'BPP_Q1':'Why have you chosen to study at BPP University?','BPP_Q2':'What specific programme are you applying for and why?','BPP_Q3':'How does BPP\'s career-focused teaching approach benefit you?','BPP_Q4':'What modules in your course are you most interested in and why?','BPP_Q5':'Which BPP campus will you attend and what is its full address?','BPP_Q6':'What are your career goals after completing your studies?','BPP_Q7':'How will you fund your tuition fees and living costs?','BPP_Q8':'What is your expected salary range after graduation?','BPP_Q9':'Where will you live in the UK? (Area and postcode)','BPP_Q10':'What do you know about BPP\'s industry partnerships and employer links?','BPP_Q11':'How is your course assessed? (Assignments, exams, projects)','BPP_Q12':'What visa responsibilities do you have as a student?','BPP_Q13':'Have you ever been refused a UK visa before? If yes, explain.','BPP_Q14':'Why did you choose BPP over other universities you considered?','BPP_Q15':'What is the duration of your course and your expected start date?','BPP_Q16':'Who is sponsoring you and what is their annual income?','BPP_Q17':'What research did you do before applying to BPP?','BPP_Q18':'What will you do if your visa application is refused?',
  'REGENT_Q1':'Why have you chosen to study at Regent College London?','REGENT_Q2':'What is the exact name of your course and which university awards the degree?','REGENT_Q3':'Which modules interest you most and why?','REGENT_Q4':'How is your course assessed?','REGENT_Q5':'Compare your course at Regent with a similar programme at two other UK universities. Why did you choose Regent?','REGENT_Q6':'What skills do you expect to gain from this course and how will you use them?','REGENT_Q7':'Which campus will you study at and what is the full address including postcode?','REGENT_Q8':'What extra programmes does Regent offer beyond your academic course?','REGENT_Q9':'Why did you choose Regent over other colleges?','REGENT_Q10':'Which companies will you apply to after graduating and what job title will you target?','REGENT_Q11':'What salary range do you expect in your first role after graduation?','REGENT_Q12':'Do you plan to return to your home country after your studies? Why?','REGENT_Q13':'How much does it cost to live in London per month and how will you fund this?','REGENT_Q14':'How much is your total tuition fee and have you converted it to your local currency?','REGENT_Q15':'Who is funding your studies and how will you cover unexpected expenses?','REGENT_Q16':'How many hours can you work per week during term time and what are your key responsibilities?','REGENT_Q17':'Where will you be living in the UK and what is the postcode?','REGENT_Q18':'Why did you choose the UK instead of studying in another country?',
  'YSJ_Q1':'Why did you choose York St John University specifically?','YSJ_Q2':'What modules will you study and why do they interest you?','YSJ_Q3':'How does this course relate to your previous studies or work experience?','YSJ_Q4':'Did you apply to other universities? Why did you reject them?','YSJ_Q5':'Where will you stay in the UK and what are the costs?','YSJ_Q6':'How much is your tuition fee and how much have you paid?','YSJ_Q7':'Who is sponsoring you and what is their occupation/income?','YSJ_Q8':'What are your living costs and how will you fund them?','YSJ_Q9':'What are your career plans after graduation?','YSJ_Q10':'How will this course help you achieve your career goals?','YSJ_Q11':'What do you know about life in York or London?','YSJ_Q12':'What are your working rights and visa responsibilities?','YSJ_Q13':'What do you know about YSJ\'s rankings and reputation?','YSJ_Q14':'How is your course assessed?','YSJ_Q15':'What accommodation options have you researched?','YSJ_Q16':'How will you cover unexpected expenses?','YSJ_Q17':'Why study in York or London specifically?','YSJ_Q18':'What are the transport options from your accommodation?',
  'YSJ_ga1':'Why did you choose York St John University specifically?',
  'YSJ_p2':'What modules will you study and why do they interest you?',
  'YSJ_p3':'How does this course relate to your previous studies or work experience?',
  'YSJ_p4':'Did you apply to other universities? Why did you reject them?',
  'YSJ_p5':'Where will you stay in the UK and what are the costs?',
  'YSJ_p6':'How much is your tuition fee and how much have you paid?',
  'YSJ_p7':'Who is sponsoring you and what is their occupation/income?',
  'YSJ_p8':'What are your living costs and how will you fund them?',
  'YSJ_p9':'What are your career plans after graduation?',
  'YSJ_p10':'How will this course help you achieve your career goals?',
  'YSJ_p11':'What do you know about life in York/London?',
  'YSJ_p12':'What are your working rights and visa responsibilities?',
  'YSJ_p13':'What do you know about YSJ',
  'YSJ_p14':'How is your course assessed?',
  'YSJ_p15':'What accommodation options have you researched?',
  'YSJ_p16':'How will you cover unexpected expenses?',
  'YSJ_p17':'Why study in York/London specifically?',
  'YSJ_p18':'What are the transport options from your accommodation?',
  'YSJ_p19':'How did you first hear about York St John University and what research did you do?',
  'YSJ_p20':'Which nearby towns or cities did you consider for accommodation and how far is the commute?',
  'YSJ_p21':'If you plan to work in the UK after graduating, what visa would you need and how long does it last?',
  'YSJ_p22':'Can you explain any gaps in your education or employment history?'
};

// ===== SAVE AI RESPONSE =====
// KEY FIX: question IDs are already namespaced by school prefix (BPP_Q1, YSJ_p1 etc.)
// We store ALL schools' scores in the same ai_scores object -- they never collide
// because the keys are unique per school. Switching school/program just shows
// different keys in the dashboard.
window.saveAIResponse = async (questionId, answerText, score, feedback, questionText) => {
  const student = window.getCurrentStudent();
  if (!student?.id) return { error: 'Not authenticated' };
  if (questionText && typeof questionText === 'string') {
    window.QUESTION_TEXT_MAP = window.QUESTION_TEXT_MAP || {};
    window.QUESTION_TEXT_MAP[questionId] = questionText;
  }
  try {
    const { data: current, error: fetchErr } = await supabaseClient
      .from('student_progress').select('ai_scores, practice_responses, selected_university').eq('user_id', student.id).single();
    if (fetchErr) return { error: fetchErr.message };
    const existing = current?.ai_scores?.[questionId] || {};
    const attempts = (existing.attempts || 0) + 1;
    const passed = (score >= 7) ? 1 : (existing.finalStatus === 1 ? 1 : 0);
    const questionLabel = (window.QUESTION_TEXT_MAP || {})[questionId] || questionText || questionId;
    const scores = {
      ...(current?.ai_scores || {}),
      [questionId]: { score, finalStatus: passed, attempts, feedback, answer: answerText, questionText: questionLabel, date: new Date().toISOString() }
    };
    const responses = { ...(current?.practice_responses || {}), [questionId]: { answer: answerText, date: new Date().toISOString() } };

    // Auto-detect school from question ID if selected_university is missing
    const detectedSchool = detectSchoolFromProgress({ ai_scores: scores });
    const currentUni = current?.selected_university;
    const shouldUpdateUni = detectedSchool && (!currentUni || currentUni === 'null' || currentUni === 'Not Selected' || currentUni === '');

    const updateData = { 
      ai_scores: scores, 
      practice_responses: responses, 
      updated_at: new Date().toISOString() 
    };
    if (shouldUpdateUni) updateData.selected_university = detectedSchool;

    const { error: updateErr } = await supabaseClient.from('student_progress')
      .update(updateData).eq('user_id', student.id);
    if (updateErr) return { error: updateErr.message };
    return { success: true, passed, attempts };
  } catch (err) { return { error: err.message }; }
};

// ===== LOAD SAVED PROGRESS =====
// Loads ai_scores/practice_responses from student_progress and checklist from
// student_checklists (isolated per school+course). checklist_status on the returned
// object contains only the current school+course items so all callers stay compatible.
window.loadSavedProgress = async () => {
  let student = window.getCurrentStudent();
  if (!student?.id) {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session?.user) student = { id: session.user.id };
    } catch (err) { console.error('loadSavedProgress session error:', err); }
  }
  if (!student?.id) return null;
  try {
    const [progressResult, checklistItems] = await Promise.all([
      supabaseClient
        .from('student_progress')
        .select('ai_scores, practice_responses, selected_university, counselor, interview_date')
        .eq('user_id', student.id).single(),
      window.loadChecklistForCurrentPage()
    ]);
    if (progressResult.error) { console.error('loadSavedProgress error:', progressResult.error.message); return null; }
    const progress = progressResult.data;
    if (progress) await autoSaveDetectedSchool(progress);
    progress.checklist_status = checklistItems;
    return progress;
  } catch (err) { console.error('loadSavedProgress error:', err); return null; }
};

// ===== LOAD PROGRESS FOR CURRENT NAMESPACE =====
// Returns only the checklist items and ai_scores relevant to the current school+program.
// checklist_status keys are namespaced, so we filter by prefix.
// ai_scores keys start with school prefix (BPP_, REGENT_, YSJ_, etc.)
window.loadProgressForCurrentPage = async () => {
  const all = await window.loadSavedProgress();
  if (!all) return { checklist_status: {}, ai_scores: {} };

  const ns = window.getProgressNamespace(); // e.g. "bpp__mba-international"
  const school = (localStorage.getItem('last_school') || '').toUpperCase();

  // Filter checklist: only keys that start with this namespace
  const filteredChecklist = {};
  for (const [k, v] of Object.entries(all.checklist_status || {})) {
    if (k.startsWith(ns + '::')) {
      // Strip namespace prefix so the page logic sees clean keys
      filteredChecklist[k] = v;
    }
  }

  // Filter AI scores: keys that start with current school prefix
  // e.g. BPP_ for bpp, REGENT_ for regent, YSJ_ for yorkstjohn, etc.
  const schoolPrefixMap = {
    bpp: 'BPP_',
    regent: 'REGENT_',
    yorkstjohn: 'YSJ_',
    netherlands: 'NL_',
    ukvi: 'UKVI_',
    nursing: 'NRS_'
  };
  const currentSchool = localStorage.getItem('last_school') || '';
  const prefix = schoolPrefixMap[currentSchool] || '';
  const filteredScores = {};
  for (const [k, v] of Object.entries(all.ai_scores || {})) {
    if (!prefix || k.startsWith(prefix)) {
      filteredScores[k] = v;
    }
  }

  return {
    checklist_status: filteredChecklist,
    ai_scores: filteredScores,
    practice_responses: all.practice_responses || {},
    selected_university: all.selected_university,
    counselor: all.counselor,
    interview_date: all.interview_date
  };
};

// ===== INIT ALL =====
document.addEventListener('DOMContentLoaded', () => {
  checkSession();
  setupTabSwitching();
  setupGoogleSignIn();
  setupEmailSignup();
  setupEmailLogin();
  setupLogout();
  setupModalControls();
  setupUniversityTracking();
});

// ===================================================================
// REALTIME MODULE
// Three features:
//   1. watchMyProgress(cb)   — fires when admin updates YOUR row
//      (interview date, counselor, notes)
//   2. watchNotifications(cb) — fires on new notification or session
//   3. startPresence(page)   — heartbeat so admin sees you online
//   4. Admin only: watchAllPresence(cb), watchStudentActivity(cb)
// ===================================================================

let _presenceInterval = null;
let _realtimeChannels = [];

// Tear down all channels (call on logout / page unload)
window.realtimeDestroy = () => {
  _realtimeChannels.forEach(ch => { try { supabaseClient.removeChannel(ch); } catch(_){} });
  _realtimeChannels = [];
  if (_presenceInterval) { clearInterval(_presenceInterval); _presenceInterval = null; }
};

// ── 1. Watch own student_progress row for interview date / counselor changes ──
window.watchMyProgress = (callback) => {
  const student = window.getCurrentStudent();
  if (!student?.id) return;
  const ch = supabaseClient
    .channel('my-progress-' + student.id)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'student_progress',
      filter: 'user_id=eq.' + student.id
    }, payload => {
      console.log('[Realtime] progress update:', payload.new);
      callback(payload.new);
    })
    .subscribe();
  _realtimeChannels.push(ch);
  return ch;
};

// ── 2. Watch for new notifications and live sessions ──
window.watchNotifications = (callback) => {
  const ch = supabaseClient
    .channel('student-notifications-live')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'student_notifications'
    }, payload => {
      console.log('[Realtime] new notification:', payload.new);
      callback({ type: 'notification', data: payload.new });
    })
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'live_sessions'
    }, payload => {
      console.log('[Realtime] new live session:', payload.new);
      callback({ type: 'session', data: payload.new });
    })
    .subscribe();
  _realtimeChannels.push(ch);
  return ch;
};

// ── 3. Presence heartbeat — update last_seen + current_page every 30s ──
window.startPresence = async (page) => {
  const student = window.getCurrentStudent();
  if (!student?.id) return;
  const update = () => {
    supabaseClient.from('student_progress').update({
      last_seen: new Date().toISOString(),
      current_page: page || document.title || 'hub'
    }).eq('user_id', student.id).then(() => {});
  };
  update(); // immediate
  _presenceInterval = setInterval(update, 30000);
  window.addEventListener('beforeunload', window.realtimeDestroy);
};

// ── 4. ADMIN: watch all student presence (last_seen updates) ──
window.watchAllPresence = (callback) => {
  const ch = supabaseClient
    .channel('admin-presence-watch')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'student_progress'
    }, payload => {
      if (payload.new?.last_seen) callback(payload.new);
    })
    .subscribe();
  _realtimeChannels.push(ch);
  return ch;
};

// ── 5. ADMIN: watch new student questions live ──
window.watchStudentQuestions = (callback) => {
  const ch = supabaseClient
    .channel('admin-questions-live')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'student_questions'
    }, payload => {
      console.log('[Realtime] new question:', payload.new);
      callback(payload.new);
    })
    .subscribe();
  _realtimeChannels.push(ch);
  return ch;
};

// ── Helper: show a realtime toast banner on school pages ──
window.showRealtimeToast = (title, body, type = 'info', durationMs = 8000) => {
  const existing = document.getElementById('rt-toast');
  if (existing) existing.remove();
  const colors = {
    info: { bg: '#1e3a8a', icon: 'info' },
    success: { bg: '#16a34a', icon: 'check_circle' },
    warning: { bg: '#d97706', icon: 'warning' },
    session: { bg: '#7c3aed', icon: 'videocam' }
  };
  const c = colors[type] || colors.info;
  const el = document.createElement('div');
  el.id = 'rt-toast';
  el.style.cssText = `position:fixed;top:80px;left:50%;transform:translateX(-50%);
    background:${c.bg};color:white;padding:12px 20px;border-radius:12px;
    display:flex;align-items:flex-start;gap:12px;max-width:380px;width:calc(100% - 32px);
    box-shadow:0 8px 32px rgba(0,0,0,0.25);z-index:9999;
    animation:rtSlideIn 0.3s ease;font-family:inherit;`;
  el.innerHTML = `
    <span class="material-symbols-outlined" style="font-size:20px;flex-shrink:0;margin-top:1px">${c.icon}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:700;margin-bottom:2px">${title}</div>
      <div style="font-size:12px;opacity:0.85;line-height:1.4">${body}</div>
    </div>
    <button onclick="this.closest('#rt-toast').remove()" style="background:none;border:none;color:white;cursor:pointer;padding:0;font-size:18px;opacity:0.7;flex-shrink:0">✕</button>`;
  // Inject animation if not present
  if (!document.getElementById('rt-toast-style')) {
    const style = document.createElement('style');
    style.id = 'rt-toast-style';
    style.textContent = '@keyframes rtSlideIn{from{opacity:0;transform:translateX(-50%) translateY(-12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
    document.head.appendChild(style);
  }
  document.body.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.remove(); }, durationMs);
};
