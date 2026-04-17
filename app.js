// ===== CONFIG =====
const SUPABASE_URL = 'https://okshteetxmmphgjgvrwt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rc2h0ZWV0eG1tcGhnamd2cnd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MjgwNjgsImV4cCI6MjA5MTMwNDA2OH0.YN3vYBZ_3iESod6t8P2KIYfVkuazXitceMw17xtdgu8';
const EMAILJS_PUBLIC_KEY = 'WQ9ZIq9xkFVWQkFRM';
const EMAILJS_SERVICE_ID = 'service_v6wame2';
const EMAILJS_TEMPLATE_ID = 'template_6lh9ond';

// ===== INIT =====
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
emailjs.init(EMAILJS_PUBLIC_KEY);

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
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session?.user) {
    await loadStudentProfile(session.user);
    await checkStudentId(session.user);  // 👈 Prompt for Student ID if missing
    showAuthenticatedUI(session.user);
  } else {
    setTimeout(() => {
      if (loginModal) loginModal.style.display = 'flex';
    }, 1000);
  }
}

// ===== LOAD/SAVE STUDENT PROFILE =====
async function loadStudentProfile(user) {
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
    
    if (error) {
      console.error('Profile creation error:', error);
      return null;
    }
    profile = newProfile;
  }
  
  localStorage.setItem('student', JSON.stringify({
    id: profile.user_id,
    name: profile.full_name,
    student_id: profile.student_id || '',
    email: profile.email
  }));
  return profile;
}

// ===== CHECK & PROMPT FOR STUDENT ID (for Google users) =====
async function checkStudentId(user) {
  const student = JSON.parse(localStorage.getItem('student'));
  if (student && student.student_id && student.student_id !== '') {
    return true;
  }

  const modal = document.getElementById('studentIdModal');
  const input = document.getElementById('studentIdInput');
  const saveBtn = document.getElementById('saveStudentIdBtn');
  const errorDiv = document.getElementById('studentIdError');

  // Modal doesn't exist on sub-pages (regent, bpp, etc.) — skip silently
  if (!modal || !input || !saveBtn) return true;

  modal.style.display = 'flex';
  
  return new Promise((resolve) => {
    saveBtn.onclick = async () => {
      const studentId = input.value.trim();
      if (!studentId) {
        errorDiv.textContent = 'Please enter a valid Student ID.';
        return;
      }
      
      const { error } = await supabaseClient
        .from('student_progress')
        .update({ student_id: studentId })
        .eq('user_id', user.id);
      
      if (error) {
        errorDiv.textContent = error.message;
        return;
      }
      
      const updatedStudent = { ...student, student_id: studentId };
      localStorage.setItem('student', JSON.stringify(updatedStudent));
      
      modal.style.display = 'none';
      resolve(true);
    };
  });
}

// ===== SHOW AUTHENTICATED UI =====
function showAuthenticatedUI(user) {
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
      const initials = (student.name || 'S').split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);
      userAvatar.textContent = initials;
    }
  }, 1500);
}

// ===== TAB SWITCHING =====
function setupTabSwitching() {
  if (!tabLogin || !tabSignup || !loginForm || !signupForm) return;
  tabLogin.addEventListener('click', () => {
    loginForm.style.display = 'block';
    signupForm.style.display = 'none';
    tabLogin.style.background = 'var(--white)';
    tabLogin.style.color = 'var(--navy)';
    tabLogin.style.fontWeight = '600';
    tabLogin.style.boxShadow = 'var(--shadow-sm)';
    tabSignup.style.background = 'transparent';
    tabSignup.style.color = 'var(--gray-600)';
    tabSignup.style.fontWeight = '500';
    tabSignup.style.boxShadow = 'none';
    if (authError) authError.textContent = '';
  });
  tabSignup.addEventListener('click', () => {
    signupForm.style.display = 'block';
    loginForm.style.display = 'none';
    tabSignup.style.background = 'var(--white)';
    tabSignup.style.color = 'var(--navy)';
    tabSignup.style.fontWeight = '600';
    tabSignup.style.boxShadow = 'var(--shadow-sm)';
    tabLogin.style.background = 'transparent';
    tabLogin.style.color = 'var(--gray-600)';
    tabLogin.style.fontWeight = '500';
    tabLogin.style.boxShadow = 'none';
    if (authError) authError.textContent = '';
  });
}

// ===== GOOGLE SIGN-IN =====
function setupGoogleSignIn() {
  if (!googleSignInBtn) return;
  googleSignInBtn.addEventListener('click', async () => {
    if (authError) authError.textContent = '';
    googleSignInBtn.disabled = true;
    googleSignInBtn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border:2px solid var(--gray-300);border-top-color:var(--navy);border-radius:50%;animation:spin 1s linear infinite;display:inline-block;"></span> Connecting...';
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
      if (authError) authError.textContent = 'Please fill in all fields.';
      return;
    }
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Creating...';
    try {
      const { data: authData, error: authErrorObj } = await supabaseClient.auth.signUp({
        email, password,
        options: { data: { full_name: name, student_id } }
      });
      if (authErrorObj) {
        console.error('Signup failed:', authErrorObj);
        if (authError) authError.textContent = authErrorObj.message;
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
        return;
      }
      if (authData?.user) {
        const { error: dbError } = await supabaseClient
          .from('student_progress')
          .insert({ user_id: authData.user.id, full_name: name, student_id, email });
        if (dbError) {
          console.error('DB insert failed:', dbError);
          if (authError) authError.textContent = dbError.message;
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
          return;
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
          if (userAvatar) {
            userAvatar.textContent = name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
          }
        }, 1500);
      }
    } catch (err) {
      console.error('Unexpected signup error:', err);
      if (authError) authError.textContent = err.message || 'An unexpected error occurred.';
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
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
      if (authError) authError.textContent = 'Please enter email and password.';
      return;
    }
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      if (authError) authError.textContent = error.message;
      return;
    }
    const { data: profile } = await supabaseClient
      .from('student_progress')
      .select('*')
      .eq('user_id', data.user.id)
      .single();
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
        if (userAvatar) {
          userAvatar.textContent = profile.full_name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
        }
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
      if (localStorage.getItem('student') && uni) localStorage.setItem('selected_university', uni);
    });
  });
}

// ===== GLOBAL FUNCTIONS =====
window.getCurrentStudent = () => { try { return JSON.parse(localStorage.getItem('student')); } catch { return null; } };
window.getSelectedUniversity = () => localStorage.getItem('selected_university');
window.saveProgress = async (data) => {
  const student = window.getCurrentStudent();
  if (!student?.id) return { error: 'Not authenticated' };
  return await supabaseClient.from('student_progress').update({ updated_at: new Date().toISOString(), ...data }).eq('user_id', student.id);
};
window.sendReadyEmail = async (responses, checklist, score, message = '') => {
  const student = window.getCurrentStudent();
  const university = window.getSelectedUniversity();
  if (!student) return { error: 'Not authenticated' };

  // ===== SCORE & READINESS =====
  const allQuestions = Object.entries(responses);
  const totalQuestions = allQuestions.length;
  const passedQuestions = allQuestions.filter(([, a]) => a?.finalStatus === 1 || a?.score >= 7);
  const failedQuestions = allQuestions.filter(([, a]) => !(a?.finalStatus === 1 || a?.score >= 7));
  const percentScore = totalQuestions > 0 ? Math.round((passedQuestions.length / totalQuestions) * 100) : 0;

  let readinessLevel, readinessEmoji;
  if (percentScore >= 90)      { readinessLevel = 'Ready for Interview';  readinessEmoji = '✅'; }
  else if (percentScore >= 70) { readinessLevel = 'Almost Ready';         readinessEmoji = '⚠️'; }
  else                         { readinessLevel = 'Not Ready';            readinessEmoji = '❌'; }

  // ===== PASSED ANSWERS (clean, full text) =====
  const sep = '─────────────────────────────';
  const passedText = passedQuestions.length > 0
    ? passedQuestions.map(([qId, a], i) => {
        const label = (window.QUESTION_TEXT_MAP || {})[qId] || a.questionText || qId;
        const attemptNote = (a.attempts || 1) > 1 ? ` (passed on attempt ${a.attempts})` : '';
        return [
          `Q${i + 1}: ${label}`,
          `Score: ${a.score}/10${attemptNote}`,
          `Answer: ${(a.answer || 'No answer recorded').trim()}`,
          sep
        ].join('\n');
      }).join('\n')
    : 'No questions passed yet.';

  // ===== FAILED QUESTIONS (summary only) =====
  const failedText = failedQuestions.length > 0
    ? failedQuestions.map(([qId, a]) => {
        const label = (window.QUESTION_TEXT_MAP || {})[qId] || a.questionText || qId;
        return `• ${label} — Best score: ${a.score || 0}/10 after ${a.attempts || 1} attempt(s)`;
      }).join('\n')
    : 'All questions passed ✅';

  // ===== ATTEMPT SUMMARY TABLE =====
  const attemptSummary = allQuestions.map(([qId, a], i) => {
    const label = (window.QUESTION_TEXT_MAP || {})[qId] || a.questionText || qId;
    const passed = a?.finalStatus === 1 || a?.score >= 7;
    const shortLabel = label.length > 55 ? label.substring(0, 52) + '...' : label;
    return `${passed ? '✅' : '❌'} Q${i + 1}: ${shortLabel}\n     Score: ${a.score || 0}/10 | Attempts: ${a.attempts || 1}`;
  }).join('\n\n');

  // ===== CHECKLIST (text keys, ticked items first) =====
  const checklistEntries = Object.entries(checklist);
  const doneItems = checklistEntries.filter(([, v]) => v === true);
  const pendingItems = checklistEntries.filter(([, v]) => v !== true);
  const doneCount = doneItems.length;

  const checklistText = checklistEntries.length > 0
    ? [
        `Completed (${doneCount}/${checklistEntries.length}):`,
        ...doneItems.map(([item]) => `  ✅ ${item}`),
        pendingItems.length > 0 ? `\nNot completed (${pendingItems.length}):` : '',
        ...pendingItems.map(([item]) => `  ⬜ ${item}`)
      ].filter(Boolean).join('\n')
    : 'No checklist items recorded.';

  // ===== BUILD FULL EMAIL BODY =====
  const divider = '═══════════════════════════════════';
  const emailBody = [
    divider,
    `STUDENT INTERVIEW READINESS REPORT`,
    divider,
    `Name:        ${student.name}`,
    `Student ID:  ${student.student_id || 'N/A'}`,
    `Email:       ${student.email}`,
    `University:  ${university || 'Not selected'}`,
    '',
    `OVERALL RESULT`,
    `${readinessEmoji} ${readinessLevel}`,
    `Score: ${passedQuestions.length}/${totalQuestions} questions passed (${percentScore}%)`,
    divider,
    '',
    `PASSED ANSWERS`,
    sep,
    passedText,
    '',
    `QUESTIONS NOT YET PASSED`,
    sep,
    failedText,
    '',
    `FULL ATTEMPT SUMMARY`,
    sep,
    attemptSummary || 'No attempts recorded.',
    divider,
    '',
    `PREPARATION CHECKLIST`,
    sep,
    checklistText,
    divider,
  ].join('\n');

  try {
    const result = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      student_name: student.name,
      student_id: student.student_id || 'N/A',
      student_email: student.email,
      university: university || 'Not selected',
      overall_score: `${passedQuestions.length}/${totalQuestions} (${percentScore}%)`,
      readiness_level: `${readinessEmoji} ${readinessLevel}`,
      responses: passedText,
      failed_questions: failedText,
      attempt_summary: attemptSummary || 'No attempts recorded.',
      checklist_status: checklistText,
      message: emailBody
    });
    return { success: true, result, percentScore, readinessLevel };
  } catch (err) {
    console.error('Email send error:', err);
    return { error: err.message || 'Failed to send email' };
  }
};

// ===== AUTO-SAVE HELPERS =====
window.saveChecklistItem = async (itemId, checked, itemText) => {
  const student = window.getCurrentStudent();
  if (!student?.id) return;
  // Use itemText as the key if provided (human-readable), otherwise fall back to itemId
  const key = (itemText && itemText.trim()) ? itemText.trim() : itemId;
  try {
    const { data: current } = await supabaseClient.from('student_progress').select('checklist_status').eq('user_id', student.id).single();
    const updated = { ...(current?.checklist_status || {}), [key]: checked };
    await supabaseClient.from('student_progress').update({ checklist_status: updated, updated_at: new Date().toISOString() }).eq('user_id', student.id);
  } catch (err) { console.error('saveChecklistItem error:', err); }
};

// Reset all student progress (used when changing course)
window.resetAllProgress = async () => {
  const student = window.getCurrentStudent();
  if (!student?.id) return { error: 'Not authenticated' };
  try {
    const { error } = await supabaseClient
      .from('student_progress')
      .update({ ai_scores: {}, practice_responses: {}, checklist_status: {}, selected_university: null, updated_at: new Date().toISOString() })
      .eq('user_id', student.id);
    if (error) return { error: error.message };
    // Clear school tracking from localStorage too
    localStorage.removeItem('last_course');
    localStorage.removeItem('last_school');
    localStorage.removeItem('selected_university');
    return { success: true };
  } catch (err) { return { error: err.message }; }
};

// ✅ MODIFIED: store answer inside ai_scores as well for easier dashboard access
// QUESTION TEXT MAP — used by dashboard to show readable question titles
window.QUESTION_TEXT_MAP = {
  'UKVI_Q1': 'Why have you chosen to study this programme in the UK?',
  'UKVI_Q2': 'Why did you choose this specific university?',
  'UKVI_Q3': 'What do you plan to do after your studies?',
  'UKVI_Q4': 'How will you fund your studies and living expenses?',
  'UKVI_Q5': 'Tell me about your academic background.',
  'UKVI_Q6': 'What is the name of your course and how long does it last?',
  'UKVI_Q7': 'Why do you want to study this subject at degree level?',
  'UKVI_Q8': 'What ties do you have to your home country?',
  'UKVI_Q9': 'Where will you live during your studies in the UK?',
  'UKVI_Q10': 'What are your key responsibilities as a student visa holder?',
  'UKVI_Q11': 'How many hours can you work per week during term time?',
  'UKVI_Q12': 'Have you ever been refused a visa before? If yes, explain.',
  'UKVI_Q13': 'What do you know about the Graduate Route visa?',
  'UKVI_Q14': 'How does this course fit with your previous work experience?',
  'UKVI_Q15': 'What specific modules interest you most and why?',
  'UKVI_Q16': 'Who is sponsoring your studies? What is their occupation?',
  'UKVI_Q17': 'What research did you do before choosing this university?',
  'UKVI_Q18': 'Why did you choose the UK over other countries like Canada or Australia?',
  'NL_Q1': 'Why have you chosen to study in the Netherlands?',
  'NL_Q2': 'Why did you choose this specific Dutch university?',
  'NL_Q3': 'What are your plans after completing your studies?',
  'NL_Q4': 'How will you fund your tuition and living costs?',
  'NL_Q5': 'What is the language of instruction and your proficiency?',
  'NL_Q6': 'What is the exact name and duration of your course?',
  'NL_Q7': 'Do you have any family or connections in the Netherlands?',
  'NL_Q8': 'What ties do you have to your home country?',
  'NL_Q9': 'Where will you live during your studies? (City and postcode)',
  'NL_Q10': 'What do you know about the Orientation Year (Zoekjaar) visa?',
  'NL_Q11': 'How does this course connect to your future career goals?',
  'NL_Q12': 'What specific modules are you most excited about and why?',
  'NL_Q13': 'Have you ever applied for a Dutch visa before? If yes, what happened?',
  'NL_Q14': 'What is the total amount of funds required by IND for living costs?',
  'NL_Q15': 'What is your accommodation budget per month?',
  'NL_Q16': 'Why did you choose a research university (WO) over a university of applied sciences (HBO)?',
  'NL_Q17': 'What extracurricular activities or student life aspects attract you?',
  'NL_Q18': 'How will you contribute to Dutch society or your home country after graduation?',
  'BPP_Q1': 'Why have you chosen to study at BPP University?',
  'BPP_Q2': 'What specific programme are you applying for and why?',
  'BPP_Q3': 'How does BPP’s career‑focused teaching approach benefit you?',
  'BPP_Q4': 'What modules in your course are you most interested in and why?',
  'BPP_Q5': 'Which BPP campus will you attend and what is its full address?',
  'BPP_Q6': 'What are your career goals after completing your studies?',
  'BPP_Q7': 'How will you fund your tuition fees and living costs?',
  'BPP_Q8': 'What is your expected salary range after graduation?',
  'BPP_Q9': 'Where will you live in the UK? (Area and postcode)',
  'BPP_Q10': 'What do you know about BPP’s industry partnerships and employer links?',
  'BPP_Q11': 'How is your course assessed? (Assignments, exams, projects)',
  'BPP_Q12': 'What visa responsibilities do you have as a student?',
  'BPP_Q13': 'Have you ever been refused a UK visa before? If yes, explain.',
  'BPP_Q14': 'Why did you choose BPP over other universities you considered?',
  'BPP_Q15': 'What is the duration of your course and your expected start date?',
  'BPP_Q16': 'Who is sponsoring you and what is their annual income?',
  'BPP_Q17': 'What research did you do before applying to BPP?',
  'BPP_Q18': 'What will you do if your visa application is refused?',
  'REGENT_Q1': 'Why have you chosen to study at Regent College London?',
  'REGENT_Q2': 'What is the exact name of your course and which university awards the degree?',
  'REGENT_Q3': 'Which modules interest you most and why?',
  'REGENT_Q4': 'How is your course assessed?',
  'REGENT_Q5': 'Compare your course at Regent with a similar programme at two other UK universities. Why did you choose Regent?',
  'REGENT_Q6': 'What skills do you expect to gain from this course and how will you use them?',
  'REGENT_Q7': 'Which campus will you study at and what is the full address including postcode?',
  'REGENT_Q8': 'What extra programmes does Regent offer beyond your academic course? (e.g., TIC, laptop loan)',
  'REGENT_Q9': 'Why did you choose Regent over other colleges?',
  'REGENT_Q10': 'Which companies will you apply to after graduating and what job title will you target?',
  'REGENT_Q11': 'What salary range do you expect in your first role after graduation?',
  'REGENT_Q12': 'Do you plan to return to your home country after your studies? Why?',
  'REGENT_Q13': 'How much does it cost to live in London per month and how will you fund this?',
  'REGENT_Q14': 'How much is your total tuition fee and have you converted it to your local currency?',
  'REGENT_Q15': 'Who is funding your studies and how will you cover unexpected expenses?',
  'REGENT_Q16': 'How many hours can you work per week during term time and what are your key responsibilities?',
  'REGENT_Q17': 'Where will you be living in the UK and what is the postcode?',
  'REGENT_Q18': 'Why did you choose the UK instead of studying in another country?',
  'YSJ_Q1': 'Why did you choose York St John University specifically?',
  'YSJ_Q2': 'What modules will you study and why do they interest you?',
  'YSJ_Q3': 'How does this course relate to your previous studies or work experience?',
  'YSJ_Q4': 'Did you apply to other universities? Why did you reject them?',
  'YSJ_Q5': 'Where will you stay in the UK and what are the costs?',
  'YSJ_Q6': 'How much is your tuition fee and how much have you paid?',
  'YSJ_Q7': 'Who is sponsoring you and what is their occupation/income?',
  'YSJ_Q8': 'What are your living costs and how will you fund them?',
  'YSJ_Q9': 'What are your career plans after graduation?',
  'YSJ_Q10': 'How will this course help you achieve your career goals?',
  'YSJ_Q11': 'What do you know about life in York or London?',
  'YSJ_Q12': 'What are your working rights and visa responsibilities?',
  'YSJ_Q13': 'What do you know about YSJ’s rankings and reputation? (e.g., top 10 for student satisfaction)',
  'YSJ_Q14': 'How is your course assessed?',
  'YSJ_Q15': 'What accommodation options have you researched?',
  'YSJ_Q16': 'How will you cover unexpected expenses?',
  'YSJ_Q17': 'Why study in York or London specifically?',
  'YSJ_Q18': 'What are the transport options from your accommodation?'
};

window.saveAIResponse = async (questionId, answerText, score, feedback, questionText) => {
  const student = window.getCurrentStudent();
  if (!student?.id) {
    console.error('saveAIResponse: No student in localStorage.');
    return { error: 'Not authenticated' };
  }
  if (questionText && typeof questionText === 'string') {
    window.QUESTION_TEXT_MAP = window.QUESTION_TEXT_MAP || {};
    window.QUESTION_TEXT_MAP[questionId] = questionText;
  }
  try {
    const { data: current, error: fetchErr } = await supabaseClient
      .from('student_progress')
      .select('ai_scores, practice_responses')
      .eq('user_id', student.id)
      .single();
    if (fetchErr) {
      console.error('saveAIResponse fetch error:', fetchErr.message);
      return { error: fetchErr.message };
    }

    const existing = current?.ai_scores?.[questionId] || {};
    const attempts = (existing.attempts || 0) + 1;

    // pass = 1 if score >= 7 (on 0-10 scale), else 0
    // Once passed, keep as passed even on retry
    const passed = (score >= 7) ? 1 : (existing.finalStatus === 1 ? 1 : 0);

    const questionLabel = (window.QUESTION_TEXT_MAP || {})[questionId] || questionText || questionId;

    const scores = {
      ...(current?.ai_scores || {}),
      [questionId]: {
        score,                      // last score (0-10)
        finalStatus: passed,        // 0 or 1
        attempts,                   // total attempts
        feedback,
        answer: answerText,
        questionText: questionLabel,
        date: new Date().toISOString()
      }
    };

    const responses = {
      ...(current?.practice_responses || {}),
      [questionId]: { answer: answerText, date: new Date().toISOString() }
    };

    const { error: updateErr } = await supabaseClient
      .from('student_progress')
      .update({ ai_scores: scores, practice_responses: responses, updated_at: new Date().toISOString() })
      .eq('user_id', student.id);

    if (updateErr) {
      console.error('saveAIResponse update error:', updateErr.message, updateErr.code);
      return { error: updateErr.message };
    }
    console.log('✅ Saved:', questionId, '| Score:', score, '| Status:', passed ? 'PASS' : 'FAIL', '| Attempt:', attempts);
    return { success: true, passed, attempts };
  } catch (err) {
    console.error('saveAIResponse unexpected error:', err);
    return { error: err.message };
  }
};

window.loadSavedProgress = async () => {
  // Try localStorage first
  let student = window.getCurrentStudent();
  // If not in localStorage, fall back to live Supabase session (handles post-refresh state)
  if (!student?.id) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user) {
      student = { id: session.user.id };
    }
  }
  if (!student?.id) return null;
  try {
    const { data: progress, error } = await supabaseClient
      .from('student_progress')
      .select('checklist_status, ai_scores, practice_responses, selected_university, counselor')
      .eq('user_id', student.id)
      .single();
    if (error) { console.error('loadSavedProgress: Supabase error:', error.message); return null; }
    return progress;
  } catch (err) { console.error('loadSavedProgress error:', err); return null; }
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
