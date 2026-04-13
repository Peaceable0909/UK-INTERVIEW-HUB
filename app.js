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
    await checkCompulsoryProfile(session.user);
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
    email: profile.email,
    selected_university: profile.selected_university || '',
    selected_program: profile.selected_program || ''
  }));
  return profile;
}

// ===== COMPULSORY PROFILE CHECK =====
async function checkCompulsoryProfile(user) {
  const student = JSON.parse(localStorage.getItem('student'));
  const hasName = student && student.name && student.name.trim() !== '';
  const hasId = student && student.student_id && student.student_id.trim() !== '';
  
  if (hasName && hasId) return true;

  const modal = document.getElementById('studentIdModal');
  if (!modal) return true; // Not on index.html

  // Update modal for compulsory profile (Name + ID)
  const title = modal.querySelector('.modal-title');
  if (title) title.textContent = '📋 Complete Your Profile';
  const sub = modal.querySelector('.modal-sub');
  if (sub) sub.textContent = 'Full Name and Student ID are required to continue.';
  
  let nameGroup = document.getElementById('compulsoryNameGroup');
  if (!nameGroup) {
    nameGroup = document.createElement('div');
    nameGroup.id = 'compulsoryNameGroup';
    nameGroup.className = 'form-group';
    nameGroup.innerHTML = '<label>Full Name</label><input type="text" id="compulsoryNameInput" placeholder="John Doe"/>';
    modal.querySelector('.form-group').before(nameGroup);
  }
  
  const nameInput = document.getElementById('compulsoryNameInput');
  const idInput = document.getElementById('studentIdInput');
  const saveBtn = document.getElementById('saveStudentIdBtn');
  const errorDiv = document.getElementById('studentIdError');

  if (student.name) nameInput.value = student.name;
  if (student.student_id) idInput.value = student.student_id;

  modal.style.display = 'flex';
  
  return new Promise((resolve) => {
    saveBtn.onclick = async () => {
      const fullName = nameInput.value.trim();
      const studentId = idInput.value.trim();
      
      if (!fullName || !studentId) {
        errorDiv.textContent = 'Both Name and Student ID are required.';
        return;
      }
      
      const { error } = await supabaseClient
        .from('student_progress')
        .update({ full_name: fullName, student_id: studentId })
        .eq('user_id', user.id);
      
      if (error) {
        errorDiv.textContent = error.message;
        return;
      }
      
      const updatedStudent = { ...student, name: fullName, student_id: studentId };
      localStorage.setItem('student', JSON.stringify(updatedStudent));
      
      modal.style.display = 'none';
      if (window.updateUI) window.updateUI(updatedStudent);
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
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    if (authError) authError.textContent = '';
  });
  tabSignup.addEventListener('click', () => {
    signupForm.style.display = 'block';
    loginForm.style.display = 'none';
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
    if (authError) authError.textContent = '';
  });
}

// ===== GOOGLE SIGN-IN =====
function setupGoogleSignIn() {
  if (!googleSignInBtn) return;
  googleSignInBtn.addEventListener('click', async () => {
    if (authError) authError.textContent = '';
    googleSignInBtn.disabled = true;
    googleSignInBtn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border:2px solid #ccc;border-top-color:#002045;border-radius:50%;animation:spin 1s linear infinite;display:inline-block;"></span> Connecting...';
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
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Signing in...';
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data?.user) {
        const profile = await loadStudentProfile(data.user);
        await checkCompulsoryProfile(data.user);
        showAuthenticatedUI(data.user);
      }
    } catch (err) {
      if (authError) authError.textContent = err.message || 'Login failed.';
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  });
}

// ===== LOGOUT =====
function setupLogout() {
  const btns = document.querySelectorAll('#logoutBtn');
  btns.forEach(btn => {
    btn.addEventListener('click', async () => {
      await supabaseClient.auth.signOut();
      localStorage.removeItem('student');
      localStorage.removeItem('selected_university');
      localStorage.removeItem('last_course');
      window.location.href = 'index.html';
    });
  });
}

// ===== MODAL CONTROLS =====
function setupModalControls() {
  if (modalClose) {
    modalClose.addEventListener('click', () => {
      if (loginModal) loginModal.style.display = 'none';
    });
  }
}

// ===== UNIVERSITY TRACKING =====
function setupUniversityTracking() {
  document.querySelectorAll('.start-training').forEach(el => {
    el.addEventListener('click', async (e) => {
      const uni = el.getAttribute('data-university');
      if (uni) {
        localStorage.setItem('selected_university', uni);
        const student = window.getCurrentStudent();
        if (student?.id) {
          await supabaseClient.from('student_progress').update({ 
            selected_university: uni,
            updated_at: new Date().toISOString() 
          }).eq('user_id', student.id);
          // Sync local storage
          student.selected_university = uni;
          localStorage.setItem('student', JSON.stringify(student));
        }
      }
    });
  });
}

// ===== EXPORTS =====
window.getCurrentStudent = () => {
  const s = localStorage.getItem('student');
  return s ? JSON.parse(s) : null;
};

window.updateStudentProfile = async (updates) => {
  const student = window.getCurrentStudent();
  if (!student?.id) return { error: 'Not authenticated' };
  try {
    const { error } = await supabaseClient
      .from('student_progress')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('user_id', student.id);
    if (error) return { error: error.message };
    
    const updatedStudent = { ...student, ...updates };
    if (updates.full_name) updatedStudent.name = updates.full_name;
    localStorage.setItem('student', JSON.stringify(updatedStudent));
    return { success: true };
  } catch (err) { return { error: err.message }; }
};

window.getSelectedUniversity = () => localStorage.getItem('selected_university');

window.saveProgress = async (checklist, scores, responses) => {
  const student = window.getCurrentStudent();
  if (!student?.id) return;
  try {
    await supabaseClient.from('student_progress').update({
      checklist_status: checklist,
      ai_scores: scores,
      practice_responses: responses,
      updated_at: new Date().toISOString()
    }).eq('user_id', student.id);
  } catch (err) { console.error('saveProgress error:', err); }
};

window.sendReadyEmail = async (responses, checklist, avg, university) => {
  const student = window.getCurrentStudent();
  if (!student) return { error: 'Not authenticated' };

  const totalQuestions = Object.keys(responses).length;
  const passedQuestions = Object.values(responses).filter(r => r.score >= 7);
  const percentScore = totalQuestions ? Math.round((passedQuestions.length / totalQuestions) * 100) : 0;
  
  const readinessLevel = percentScore >= 90 ? 'INTERVIEW READY' : percentScore >= 70 ? 'ALMOST READY' : 'NEEDS PRACTICE';
  const readinessEmoji = percentScore >= 90 ? '✅' : percentScore >= 70 ? '⚠️' : '❌';

  const sep = '-----------------------------------';
  const passedText = Object.entries(responses)
    .filter(([_, data]) => data.score >= 7)
    .map(([id, data]) => `Q: ${data.questionText || id}\nA: ${data.answer}\nScore: ${data.score}/10\nFeedback: ${data.feedback}\n${sep}`)
    .join('\n\n');

  const failedText = Object.entries(responses)
    .filter(([_, data]) => data.score < 7)
    .map(([id, data]) => `Q: ${data.questionText || id}\nA: ${data.answer}\nScore: ${data.score}/10\nFeedback: ${data.feedback}\n${sep}`)
    .join('\n\n');

  const attemptSummary = Object.entries(responses)
    .map(([id, data]) => `${data.questionText || id}: ${data.score}/10 (${data.attempts || 1} attempts)`)
    .join('\n');

  const checklistText = Object.entries(checklist)
    .map(([item, done]) => `[${done ? 'X' : ' '}] ${item}`)
    .join('\n');

  const divider = '═══════════════════════════════════';
  const emailBody = [
    divider,
    `STUDENT INTERVIEW READINESS REPORT`,
    divider,
    `Name:        ${student.name}`,
    `Student ID:  ${student.student_id || 'N/A'}`,
    `Email:       ${student.email}`,
    `University:  ${university || student.selected_university || 'Not selected'}`,
    `Program:     ${student.selected_program || 'Not selected'}`,
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
      university: university || student.selected_university || 'Not selected',
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

window.saveChecklistItem = async (itemId, checked, itemText) => {
  const student = window.getCurrentStudent();
  if (!student?.id) return;
  const key = (itemText && itemText.trim()) ? itemText.trim() : itemId;
  try {
    const { data: current } = await supabaseClient.from('student_progress').select('checklist_status').eq('user_id', student.id).single();
    const updated = { ...(current?.checklist_status || {}), [key]: checked };
    await supabaseClient.from('student_progress').update({ checklist_status: updated, updated_at: new Date().toISOString() }).eq('user_id', student.id);
  } catch (err) { console.error('saveChecklistItem error:', err); }
};

window.resetAllProgress = async () => {
  const student = window.getCurrentStudent();
  if (!student?.id) return { error: 'Not authenticated' };
  try {
    const { error } = await supabaseClient
      .from('student_progress')
      .update({ 
        ai_scores: {}, 
        practice_responses: {}, 
        checklist_status: {}, 
        selected_university: null,
        selected_program: null,
        updated_at: new Date().toISOString() 
      })
      .eq('user_id', student.id);
    
    if (error) return { error: error.message };
    
    localStorage.removeItem('selected_university');
    localStorage.removeItem('last_course');
    student.selected_university = '';
    student.selected_program = '';
    localStorage.setItem('student', JSON.stringify(student));
    
    return { success: true };
  } catch (err) { return { error: err.message }; }
};

window.saveAIResponse = async (questionId, answerText, score, feedback, questionText) => {
  const student = window.getCurrentStudent();
  if (!student?.id) return { error: 'Not authenticated' };
  
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
    
    if (fetchErr) return { error: fetchErr.message };

    const existing = current?.ai_scores?.[questionId] || {};
    const attempts = (existing.attempts || 0) + 1;
    const passed = (score >= 7) ? 1 : (existing.finalStatus === 1 ? 1 : 0);
    const questionLabel = (window.QUESTION_TEXT_MAP || {})[questionId] || questionText || questionId;

    const scores = {
      ...(current?.ai_scores || {}),
      [questionId]: {
        score,
        finalStatus: passed,
        attempts,
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

    await supabaseClient
      .from('student_progress')
      .update({ ai_scores: scores, practice_responses: responses, updated_at: new Date().toISOString() })
      .eq('user_id', student.id);

    return { success: true, passed, attempts };
  } catch (err) {
    return { error: err.message };
  }
};

window.loadSavedProgress = async () => {
  let student = window.getCurrentStudent();
  if (!student?.id) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user) student = { id: session.user.id };
  }
  if (!student?.id) return null;
  try {
    const { data: progress, error } = await supabaseClient
      .from('student_progress')
      .select('*')
      .eq('user_id', student.id)
      .single();
    if (error) return null;
    
    // Sync local storage with latest profile data
    const currentLocal = window.getCurrentStudent();
    if (currentLocal) {
      currentLocal.selected_university = progress.selected_university || '';
      currentLocal.selected_program = progress.selected_program || '';
      currentLocal.name = progress.full_name || currentLocal.name;
      currentLocal.student_id = progress.student_id || currentLocal.student_id;
      localStorage.setItem('student', JSON.stringify(currentLocal));
    }
    
    return progress;
  } catch (err) { return null; }
};

window.trackProgram = async (programName) => {
  const student = window.getCurrentStudent();
  if (!student?.id) return;
  try {
    await supabaseClient.from('student_progress').update({
      selected_program: programName,
      updated_at: new Date().toISOString()
    }).eq('user_id', student.id);
    student.selected_program = programName;
    localStorage.setItem('student', JSON.stringify(student));
  } catch (err) { console.error('trackProgram error:', err); }
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
