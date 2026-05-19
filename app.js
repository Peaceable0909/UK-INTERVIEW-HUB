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
      if (localStorage.getItem('student') && uni) localStorage.setItem('selected_university', uni);
    });
  });
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
        return `• ${label} — Best score: ${a.score || 0}/10 after ${a.attempts || 1} attempt(s)`;
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
    const result = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      student_name: student.name, student_id: student.student_id || 'N/A',
      student_email: student.email, university: university || 'Not selected',
      overall_score: `${passedQuestions.length}/${totalQuestions} (${percentScore}%)`,
      readiness_level: `${readinessEmoji} ${readinessLevel}`,
      responses: passedText, failed_questions: failedText,
      attempt_summary: attemptSummary || 'No attempts recorded.',
      checklist_status: checklistText, message: emailBody
    });
    return { success: true, result, percentScore, readinessLevel };
  } catch (err) {
    console.error('Email send error:', err);
    return { error: err.message || 'Failed to send email' };
  }
};

// ===== CHECKLIST SAVE =====
// KEY FIX: Each school+program gets its own checklist namespace in the DB.
// We store checklist_status as a flat object where keys are namespaced:
// "bpp__mba-international::Watch the full training video" = true
// This means switching school or program never overwrites another combo's ticks.
window.saveChecklistItem = async (itemId, checked, itemText) => {
  const student = window.getCurrentStudent();
  if (!student?.id) return;
  const ns = window.getProgressNamespace();
  const key = `${ns}::${(itemText && itemText.trim()) ? itemText.trim() : itemId}`;
  try {
    const { data: current } = await supabaseClient.from('student_progress')
      .select('checklist_status').eq('user_id', student.id).single();
    const updated = { ...(current?.checklist_status || {}), [key]: checked };
    await supabaseClient.from('student_progress')
      .update({ checklist_status: updated, updated_at: new Date().toISOString() })
      .eq('user_id', student.id);
  } catch (err) { console.error('saveChecklistItem error:', err); }
};

// ===== RESET ALL PROGRESS (manual opt-out only — never auto-called) =====
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

window.QUESTION_TEXT_MAP = {
  'UKVI_Q1':'Why have you chosen to study this programme in the UK?','UKVI_Q2':'Why did you choose this specific university?','UKVI_Q3':'What do you plan to do after your studies?','UKVI_Q4':'How will you fund your studies and living expenses?','UKVI_Q5':'Tell me about your academic background.','UKVI_Q6':'What is the name of your course and how long does it last?','UKVI_Q7':'Why do you want to study this subject at degree level?','UKVI_Q8':'What ties do you have to your home country?','UKVI_Q9':'Where will you live during your studies in the UK?','UKVI_Q10':'What are your key responsibilities as a student visa holder?','UKVI_Q11':'How many hours can you work per week during term time?','UKVI_Q12':'Have you ever been refused a visa before? If yes, explain.','UKVI_Q13':'What do you know about the Graduate Route visa?','UKVI_Q14':'How does this course fit with your previous work experience?','UKVI_Q15':'What specific modules interest you most and why?','UKVI_Q16':'Who is sponsoring your studies? What is their occupation?','UKVI_Q17':'What research did you do before choosing this university?','UKVI_Q18':'Why did you choose the UK over other countries like Canada or Australia?',
  'NL_Q1':'Why have you chosen to study in the Netherlands?','NL_Q2':'Why did you choose this specific Dutch university?','NL_Q3':'What are your plans after completing your studies?','NL_Q4':'How will you fund your tuition and living costs?','NL_Q5':'What is the language of instruction and your proficiency?','NL_Q6':'What is the exact name and duration of your course?','NL_Q7':'Do you have any family or connections in the Netherlands?','NL_Q8':'What ties do you have to your home country?','NL_Q9':'Where will you live during your studies? (City and postcode)','NL_Q10':'What do you know about the Orientation Year (Zoekjaar) visa?','NL_Q11':'How does this course connect to your future career goals?','NL_Q12':'What specific modules are you most excited about and why?','NL_Q13':'Have you ever applied for a Dutch visa before? If yes, what happened?','NL_Q14':'What is the total amount of funds required by IND for living costs?','NL_Q15':'What is your accommodation budget per month?','NL_Q16':'Why did you choose a research university (WO) over a university of applied sciences (HBO)?','NL_Q17':'What extracurricular activities or student life aspects attract you?','NL_Q18':'How will you contribute to Dutch society or your home country after graduation?',
  'BPP_Q1':'Why have you chosen to study at BPP University?','BPP_Q2':'What specific programme are you applying for and why?','BPP_Q3':'How does BPP\'s career-focused teaching approach benefit you?','BPP_Q4':'What modules in your course are you most interested in and why?','BPP_Q5':'Which BPP campus will you attend and what is its full address?','BPP_Q6':'What are your career goals after completing your studies?','BPP_Q7':'How will you fund your tuition fees and living costs?','BPP_Q8':'What is your expected salary range after graduation?','BPP_Q9':'Where will you live in the UK? (Area and postcode)','BPP_Q10':'What do you know about BPP\'s industry partnerships and employer links?','BPP_Q11':'How is your course assessed? (Assignments, exams, projects)','BPP_Q12':'What visa responsibilities do you have as a student?','BPP_Q13':'Have you ever been refused a UK visa before? If yes, explain.','BPP_Q14':'Why did you choose BPP over other universities you considered?','BPP_Q15':'What is the duration of your course and your expected start date?','BPP_Q16':'Who is sponsoring you and what is their annual income?','BPP_Q17':'What research did you do before applying to BPP?','BPP_Q18':'What will you do if your visa application is refused?',
  'REGENT_Q1':'Why have you chosen to study at Regent College London?','REGENT_Q2':'What is the exact name of your course and which university awards the degree?','REGENT_Q3':'Which modules interest you most and why?','REGENT_Q4':'How is your course assessed?','REGENT_Q5':'Compare your course at Regent with a similar programme at two other UK universities. Why did you choose Regent?','REGENT_Q6':'What skills do you expect to gain from this course and how will you use them?','REGENT_Q7':'Which campus will you study at and what is the full address including postcode?','REGENT_Q8':'What extra programmes does Regent offer beyond your academic course?','REGENT_Q9':'Why did you choose Regent over other colleges?','REGENT_Q10':'Which companies will you apply to after graduating and what job title will you target?','REGENT_Q11':'What salary range do you expect in your first role after graduation?','REGENT_Q12':'Do you plan to return to your home country after your studies? Why?','REGENT_Q13':'How much does it cost to live in London per month and how will you fund this?','REGENT_Q14':'How much is your total tuition fee and have you converted it to your local currency?','REGENT_Q15':'Who is funding your studies and how will you cover unexpected expenses?','REGENT_Q16':'How many hours can you work per week during term time and what are your key responsibilities?','REGENT_Q17':'Where will you be living in the UK and what is the postcode?','REGENT_Q18':'Why did you choose the UK instead of studying in another country?',
  'YSJ_Q1':'Why did you choose York St John University specifically?','YSJ_Q2':'What modules will you study and why do they interest you?','YSJ_Q3':'How does this course relate to your previous studies or work experience?','YSJ_Q4':'Did you apply to other universities? Why did you reject them?','YSJ_Q5':'Where will you stay in the UK and what are the costs?','YSJ_Q6':'How much is your tuition fee and how much have you paid?','YSJ_Q7':'Who is sponsoring you and what is their occupation/income?','YSJ_Q8':'What are your living costs and how will you fund them?','YSJ_Q9':'What are your career plans after graduation?','YSJ_Q10':'How will this course help you achieve your career goals?','YSJ_Q11':'What do you know about life in York or London?','YSJ_Q12':'What are your working rights and visa responsibilities?','YSJ_Q13':'What do you know about YSJ\'s rankings and reputation?','YSJ_Q14':'How is your course assessed?','YSJ_Q15':'What accommodation options have you researched?','YSJ_Q16':'How will you cover unexpected expenses?','YSJ_Q17':'Why study in York or London specifically?','YSJ_Q18':'What are the transport options from your accommodation?'
};

// ===== SAVE AI RESPONSE =====
// KEY FIX: question IDs are already namespaced by school prefix (BPP_Q1, YSJ_p1 etc.)
// We store ALL schools' scores in the same ai_scores object — they never collide
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
      .from('student_progress').select('ai_scores, practice_responses').eq('user_id', student.id).single();
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
    const { error: updateErr } = await supabaseClient.from('student_progress')
      .update({ ai_scores: scores, practice_responses: responses, updated_at: new Date().toISOString() }).eq('user_id', student.id);
    if (updateErr) return { error: updateErr.message };
    return { success: true, passed, attempts };
  } catch (err) { return { error: err.message }; }
};

// ===== LOAD SAVED PROGRESS =====
// KEY FIX: loads ALL progress (all schools/programs) — callers filter by namespace
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
    const { data: progress, error } = await supabaseClient
      .from('student_progress')
      .select('checklist_status, ai_scores, practice_responses, selected_university, counselor, interview_date')
      .eq('user_id', student.id).single();
    if (error) { console.error('loadSavedProgress error:', error.message); return null; }
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
