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
        student_id: user.user_metadata?.student_id || 'STU-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
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
    student_id: profile.student_id,
    email: profile.email
  }));
  return profile;
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
  const responsesText = Object.entries(responses).map(([q, a]) => `• ${q}\n  → ${a?.answer || 'No answer'}`).join('\n\n');
  const checklistText = Object.entries(checklist).map(([item, done]) => `${done ? '✅' : '⬜'} ${item}`).join('\n');
  try {
    const result = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      student_name: student.name, student_id: student.student_id, student_email: student.email,
      university: university || 'Not selected', overall_score: score || 'Not yet scored',
      responses: responsesText || 'No practice responses yet', checklist_status: checklistText || 'No checklist items',
      message: message || 'Student clicked "I\'m Ready for Interview"'
    });
    return { success: true, result };
  } catch (err) {
    console.error('Email send error:', err);
    return { error: err.message || 'Failed to send email' };
  }
};

// ===== AUTO-SAVE HELPERS =====
window.saveChecklistItem = async (itemId, checked) => {
  const student = window.getCurrentStudent();
  if (!student?.id) return;
  try {
    const { data: current } = await supabaseClient.from('student_progress').select('checklist_status').eq('user_id', student.id).single();
    const updated = { ...(current?.checklist_status || {}), [itemId]: checked };
    await supabaseClient.from('student_progress').update({ checklist_status: updated, updated_at: new Date().toISOString() }).eq('user_id', student.id);
  } catch (err) { console.error('saveChecklistItem error:', err); }
};
window.saveAIResponse = async (questionId, answerText, score, feedback) => {
  const student = window.getCurrentStudent();
  if (!student?.id) return;
  try {
    const { data: current } = await supabaseClient.from('student_progress').select('ai_scores, practice_responses').eq('user_id', student.id).single();
    const scores = { ...(current?.ai_scores || {}), [questionId]: { score, feedback, date: new Date().toISOString() } };
    const responses = { ...(current?.practice_responses || {}), [questionId]: { answer: answerText, date: new Date().toISOString() } };
    await supabaseClient.from('student_progress').update({ ai_scores: scores, practice_responses: responses, updated_at: new Date().toISOString() }).eq('user_id', student.id);
  } catch (err) { console.error('saveAIResponse error:', err); }
};
window.loadSavedProgress = async () => {
  const student = window.getCurrentStudent();
  if (!student?.id) return null;
  try {
    const { data: progress } = await supabaseClient.from('student_progress').select('checklist_status, ai_scores, practice_responses, selected_university').eq('user_id', student.id).single();
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
