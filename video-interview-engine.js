// ═══════════════════════════════════════════════════════════════════
// VIDEO INTERVIEW ENGINE — school-agnostic, config-driven
//
// Call window.initVideoInterview('<schoolKey>') on DOMContentLoaded from a
// thin per-school HTML page. All behaviour (questions, reading/answer
// timing) comes from window.VIDEO_INTERVIEW_CONFIG[schoolKey] — this file
// has no school-specific content in it.
//
// Each question is one shot: once an answer uploads successfully, this
// engine never re-records over it on its own. The only way a question
// becomes re-recordable is an admin deleting that answer's video (see
// admin.html's video tab), which resets that one row to 'pending' and
// flips the session back to in_progress — the student's next visit then
// resumes at exactly that question and skips everything already done.
//
// DOM contract this engine expects the host page to provide (see
// yorkstjohn-video-interview.html for the reference implementation):
//
//   Screens — elements with class "vi-screen" and one of these ids,
//   shown one at a time: vi-gate, vi-intro, vi-device-camera,
//   vi-device-audio, vi-countdown, vi-interview, vi-answered,
//   vi-reconnect, vi-upload-trouble, vi-finishing, vi-complete, vi-failed
//
//   Global (outside any screen, visible whenever the camera matters):
//     viCamWrap, viCam (<video>), viCamStatus, viMicStatus, viMsg,
//     viWaveform (container the engine fills with N bar elements)
//   Intro:      viStartBtn, viResumeBanner, viResumeText, viQTotal
//   Device (camera): viCamNextBtn, viCamRetryBtn
//   Device (audio):  viMicNextBtn, viMicRetryBtn
//   Countdown:  viCountdownNum
//   Interview:  viQIndex, viQCat, viQText, viPhaseLabel, viTimerNum,
//               viTimerRing (an SVG <circle>, radius read from its own
//               `r` attribute), viRecDot, viDoneBtn (shown only while
//               recording — lets the student stop early instead of
//               waiting out the full answer timer), viProgressList
//               (filled and kept in sync by the engine)
//   Answered:   viAnsweredBtn, viAnsweredBtnText — a manual gate shown
//               after each recording stops (early via Done, or by
//               timing out); the next question only appears once the
//               student clicks this, it is never automatic.
//   Reconnect:  viReconnectBtn
//   Upload trouble: viUploadTroubleBtn (a systemic-failure circuit breaker —
//               distinct from Reconnect, which is for camera/mic hardware
//               loss. This fires after consecutive upload failures, so the
//               student finds out mid-interview instead of after silently
//               losing the rest of it.)
//   Finishing:  viFinishStatus
//   Complete:   viCompleteText, viSummaryName, viSummaryAppId,
//               viSummaryProgramme, viSummaryDate, viSummaryStatus
//   Failed:     viFailedList
// ═══════════════════════════════════════════════════════════════════

window.initVideoInterview = async function initVideoInterview(schoolKey) {
  const $ = (id) => document.getElementById(id);
  const CFG = (window.VIDEO_INTERVIEW_CONFIG || {})[schoolKey];
  const SCREENS = ['gate','intro','device-camera','device-audio','countdown','interview','answered','reconnect','upload-trouble','finishing','complete','failed'];
  const MAX_CONSECUTIVE_UPLOAD_FAILURES = 2;
  const WAVEFORM_BARS = 24;

  function show(id) {
    SCREENS.forEach((s) => { const el = $('vi-' + s); if (el) el.classList.toggle('on', s === id); });
    const camWrap = $('viCamWrap');
    const camVisible = id === 'device-camera' || id === 'device-audio' || id === 'interview' || id === 'answered' || id === 'reconnect';
    if (camWrap) camWrap.style.display = camVisible ? 'block' : 'none';
  }
  function setText(id, text) { const el = $(id); if (el) el.textContent = text; }
  function setRing(id, pct) {
    const el = $(id); if (!el) return;
    const r = parseFloat(el.getAttribute('r')) || 45;
    const c = 2 * Math.PI * r;
    el.style.strokeDasharray = String(c);
    el.style.strokeDashoffset = String(c - (c * Math.max(0, Math.min(100, pct))) / 100);
  }
  function fmtTime(total) { const m = Math.floor(total / 60), s = total % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function setRecDot(on) { const el = $('viRecDot'); if (el) el.classList.toggle('on', !!on); }
  function setStatus(id, state) {
    const el = $(id); if (!el) return;
    el.dataset.state = state;
    el.textContent = state === 'ready' ? 'Ready' : state === 'checking' ? 'Checking…' : 'Not detected';
  }
  function showMsg(text) { const el = $('viMsg'); if (el) { el.textContent = text; el.style.display = 'block'; } }
  function clearMsg() { const el = $('viMsg'); if (el) { el.textContent = ''; el.style.display = 'none'; } }
  function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  if (!CFG) { console.error('[video-interview] No config for school:', schoolKey); show('gate'); return; }

  if (window.sessionReady) { await Promise.race([window.sessionReady, new Promise((r) => setTimeout(r, 5000))]); }
  let student = window.getCurrentStudent && window.getCurrentStudent();
  if (!student || !student.id) {
    try {
      const { data: { user } } = await window.supabaseClient.auth.getUser();
      if (user) student = { id: user.id };
    } catch (e) { /* not signed in */ }
  }
  if (!student || !student.id) { show('gate'); return; }

  const db = window.supabaseClient;
  let stream = null, session = null, qIndex = 0;
  let mediaRecorder = null, chunks = [], recTimerInt = null, readTimerInt = null;
  let audioCtx = null, analyser = null, meterRAF = null;
  let camTrackEnded = false;
  let consecutiveUploadFailures = 0, circuitBroken = false;
  const pendingUploads = {};
  const uploadedIndices = new Set();

  const mimeType = pickMimeType();
  function pickMimeType() {
    const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    for (const c of candidates) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c)) return c;
    }
    return '';
  }
  function extFor(mt) { return mt.indexOf('mp4') !== -1 ? 'mp4' : 'webm'; }

  // The next question still missing an uploaded answer, scanning forward
  // from `from`. Normally that's just `from` itself — but after an admin
  // deletes one answer out of an otherwise-complete interview, this is
  // what lets the student redo exactly that gap and nothing else.
  function nextIncompleteIndex(from) {
    for (let i = from; i < CFG.questions.length; i++) { if (!uploadedIndices.has(i)) return i; }
    return CFG.questions.length;
  }

  // ── Resume support ────────────────────────────────────────────────
  async function findInProgressSession() {
    const { data, error } = await db.from('video_interview_sessions')
      .select('*').eq('user_id', student.id).eq('school', schoolKey).eq('status', 'in_progress').maybeSingle();
    if (error) { console.error('[video-interview] resume check failed', error); return null; }
    return data;
  }
  async function loadAnswers(sessionId) {
    const { data, error } = await db.from('video_interview_answers')
      .select('*').eq('session_id', sessionId).order('question_index');
    if (error) { console.error('[video-interview] load answers failed', error); return []; }
    return data || [];
  }

  // ── Progress list (student-visible checklist of all questions) ───
  function renderProgressList() {
    const list = $('viProgressList');
    if (!list) return;
    list.innerHTML = CFG.questions.map((q, i) =>
      '<div class="prog-row" id="prog-' + i + '" data-status="pending">' +
        '<div class="prog-num">' + (i + 1) + '</div>' +
        '<div class="prog-label">' + escapeHtml(q.text) + '</div>' +
        '<div class="prog-status"><span class="prog-badge">Pending</span><span class="prog-time"></span></div>' +
      '</div>'
    ).join('');
  }
  function setProgressStatus(i, status, timeLabel) {
    const row = $('prog-' + i); if (!row) return;
    row.dataset.status = status;
    const badge = row.querySelector('.prog-badge');
    const timeEl = row.querySelector('.prog-time');
    if (badge) badge.textContent = status === 'completed' ? 'Completed' : status === 'in_progress' ? 'In Progress' : 'Pending';
    if (timeEl) timeEl.textContent = timeLabel || '';
  }

  // ── Device check ─────────────────────────────────────────────────
  async function runDeviceCheck() {
    clearMsg();
    const camNextBtn = $('viCamNextBtn'), micNextBtn = $('viMicNextBtn');
    if (camNextBtn) camNextBtn.disabled = true;
    if (micNextBtn) micNextBtn.disabled = true;
    setStatus('viCamStatus', 'checking');
    setStatus('viMicStatus', 'checking');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('viCamStatus', 'error'); setStatus('viMicStatus', 'error');
      showMsg('Your browser does not support camera/microphone access. Please use a recent version of Chrome, Edge, Firefox, or Safari.');
      return false;
    }

    try {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true
      });
    } catch (err) {
      if (err && err.name === 'OverconstrainedError') {
        showMsg('Your camera does not support the requested settings — retrying with defaults…');
        try { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); }
        catch (err2) { handleDeviceError(err2); return false; }
      } else {
        handleDeviceError(err);
        return false;
      }
    }

    const cam = $('viCam');
    if (cam) { cam.srcObject = stream; cam.muted = true; try { await cam.play(); } catch (e) { /* autoplay quirks */ } }

    const vTrack = stream.getVideoTracks()[0];
    const aTrack = stream.getAudioTracks()[0];
    camTrackEnded = false;
    if (vTrack) { setStatus('viCamStatus', 'ready'); vTrack.onended = onTrackEnded; }
    else setStatus('viCamStatus', 'error');
    if (aTrack) { setStatus('viMicStatus', 'ready'); aTrack.onended = onTrackEnded; startMeter(stream); }
    else setStatus('viMicStatus', 'error');

    if (!window.MediaRecorder) {
      showMsg('Your browser does not support recording video. Please use a recent version of Chrome, Edge, Firefox, or Safari.');
      return false;
    }
    if (!mimeType) {
      showMsg('Your browser cannot record video in a supported format. Please update your browser, or try Chrome.');
      return false;
    }
    if (camNextBtn) camNextBtn.disabled = !vTrack;
    if (micNextBtn) micNextBtn.disabled = !aTrack;
    return !!(vTrack && aTrack);
  }

  function handleDeviceError(err) {
    setStatus('viCamStatus', 'error'); setStatus('viMicStatus', 'error');
    const name = err && err.name;
    let text;
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      text = 'Camera/microphone access was blocked. Click the camera icon in your browser’s address bar, allow access, then retry.';
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      text = 'No camera or microphone was found. Please connect one and retry.';
    } else if (name === 'NotReadableError' || name === 'TrackStartError') {
      text = 'Your camera or microphone is being used by another app (e.g. Zoom or Teams). Close it and retry.';
    } else {
      text = 'Could not access your camera/microphone' + (err && err.message ? ' (' + err.message + ')' : '') + '. Please retry.';
    }
    showMsg(text);
  }

  function startMeter(s) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = audioCtx.createMediaStreamSource(s);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const wrap = $('viWaveform');
      let bars = null;
      if (wrap) {
        wrap.innerHTML = '';
        bars = [];
        for (let i = 0; i < WAVEFORM_BARS; i++) {
          const b = document.createElement('div');
          b.className = 'wf-bar';
          wrap.appendChild(b);
          bars.push(b);
        }
      }
      const step = Math.floor(data.length / WAVEFORM_BARS) || 1;
      (function loop() {
        analyser.getByteFrequencyData(data);
        if (bars) {
          for (let i = 0; i < WAVEFORM_BARS; i++) {
            const v = data[i * step] || 0;
            bars[i].style.height = Math.max(6, Math.round((v / 255) * 100)) + '%';
          }
        }
        meterRAF = requestAnimationFrame(loop);
      })();
    } catch (e) { console.warn('[video-interview] waveform failed', e); }
  }
  function stopMeter() {
    if (meterRAF) cancelAnimationFrame(meterRAF);
    if (audioCtx) { try { audioCtx.close(); } catch (e) { /* noop */ } audioCtx = null; }
  }

  function onTrackEnded() {
    if (camTrackEnded) return;
    camTrackEnded = true;
    clearInterval(readTimerInt); clearInterval(recTimerInt);
    if (mediaRecorder && mediaRecorder.state === 'recording') { try { mediaRecorder.stop(); } catch (e) { /* noop */ } }
    stopMeter();
    show('reconnect');
  }

  // ── Intro / resume ───────────────────────────────────────────────
  async function initIntro() {
    show('intro');
    setText('viQTotal', String(CFG.questions.length));
    renderProgressList();
    const existing = await findInProgressSession();
    if (existing) {
      session = existing;
      const loaded = await loadAnswers(existing.id);
      loaded.forEach((a) => { if (a.upload_status === 'uploaded') uploadedIndices.add(a.question_index); });
      qIndex = nextIncompleteIndex(0);
      uploadedIndices.forEach((i) => setProgressStatus(i, 'completed', fmtTime(CFG.answerSeconds)));
      const banner = $('viResumeBanner'), text = $('viResumeText');
      if (banner && text) {
        text.textContent = 'You have an interview in progress — question ' + (qIndex + 1) + ' of ' + existing.question_count + '.';
        banner.style.display = 'flex';
      }
    }
  }

  async function beginFlow() {
    const startBtn = $('viStartBtn');
    if (startBtn) startBtn.disabled = true;
    show('device-camera');
    await runDeviceCheck();
    if (startBtn) startBtn.disabled = false;
  }

  function runCountdown() {
    let i = 3;
    setText('viCountdownNum', String(i));
    setTimeout(function tick() {
      i--;
      if (i > 0) { setText('viCountdownNum', String(i)); setTimeout(tick, 1000); }
      else startInterviewLoop();
    }, 1000);
  }

  async function startInterviewLoop() {
    show('interview');
    if (!session) {
      const ins = await db.from('video_interview_sessions').insert({
        user_id: student.id, school: schoolKey, status: 'in_progress',
        question_count: CFG.questions.length, reading_seconds: CFG.readingSeconds, answer_seconds: CFG.answerSeconds
      }).select().single();
      if (ins.error) {
        // Most likely the one-active-session unique index — another tab/reload
        // already created one. Load it instead of failing outright.
        const existing = await findInProgressSession();
        if (existing) {
          session = existing;
          const loaded = await loadAnswers(existing.id);
          loaded.forEach((a) => { if (a.upload_status === 'uploaded') uploadedIndices.add(a.question_index); });
          qIndex = nextIncompleteIndex(0);
        } else { show('device-camera'); showMsg('Could not start your interview: ' + ins.error.message); return; }
      } else {
        session = ins.data;
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    askQuestion(qIndex);
  }

  function onBeforeUnload(e) { e.preventDefault(); e.returnValue = ''; }

  // ── Question loop ────────────────────────────────────────────────
  // Each question is reading → recording → a manual "Continue" gate. The
  // engine never auto-advances past a just-recorded answer — the student
  // decides when they're ready for the next one.
  function askQuestion(i) {
    if (circuitBroken) return;
    if (i >= CFG.questions.length) { finishInterview(); return; }
    qIndex = i;
    show('interview');
    setProgressStatus(i, 'in_progress');
    const q = CFG.questions[i];
    setText('viQIndex', 'Question ' + (i + 1) + ' of ' + CFG.questions.length);
    setText('viQCat', q.category || '');
    setText('viQText', q.text);
    setText('viPhaseLabel', 'Reading Time');
    setText('viTimerCaption', 'Take a moment to read and understand the question. You will have ' + CFG.readingSeconds + ' seconds.');
    setRecDot(false);
    runReadingPhase(CFG.readingSeconds, function () { runAnswerPhase(q); });
  }

  function runReadingPhase(seconds, done) {
    let remaining = seconds;
    setText('viTimerNum', String(remaining));
    setRing('viTimerRing', 100);
    clearInterval(readTimerInt);
    readTimerInt = setInterval(function () {
      if (circuitBroken) { clearInterval(readTimerInt); return; }
      remaining--;
      setText('viTimerNum', String(Math.max(remaining, 0)));
      setRing('viTimerRing', Math.max(0, Math.round((remaining / seconds) * 100)));
      if (remaining <= 0) { clearInterval(readTimerInt); done(); }
    }, 1000);
  }

  function runAnswerPhase(q) {
    setText('viPhaseLabel', 'Recording');
    setText('viTimerCaption', 'Speak clearly and naturally. Click Done early if you finish before time runs out.');
    setRecDot(true);
    const doneBtn = $('viDoneBtn'); if (doneBtn) doneBtn.style.display = 'inline-flex';
    chunks = [];
    let recSeconds = 0;
    const total = CFG.answerSeconds;
    setText('viTimerNum', fmtTime(total));
    setRing('viTimerRing', 100);

    try {
      mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch (e) {
      console.error('[video-interview] MediaRecorder init failed', e);
      setRecDot(false);
      if (doneBtn) doneBtn.style.display = 'none';
      markAnswerRow(q, qIndex, { upload_status: 'failed', error_message: 'Recording failed to start: ' + e.message }).catch(function () {});
      setTimeout(function () { askQuestion(qIndex + 1); }, 1200);
      return;
    }
    mediaRecorder.ondataavailable = function (e) { if (e.data && e.data.size > 0) chunks.push(e.data); };
    mediaRecorder.onstop = function () {
      setRecDot(false);
      if (doneBtn) doneBtn.style.display = 'none';
      const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
      uploadAnswer(q, qIndex, blob, recSeconds);
      if (!circuitBroken) showAnsweredScreen();
    };
    mediaRecorder.start(1000);

    recTimerInt = setInterval(function () {
      if (circuitBroken) { clearInterval(recTimerInt); return; }
      recSeconds++;
      const remaining = total - recSeconds;
      setText('viTimerNum', fmtTime(Math.max(remaining, 0)));
      setRing('viTimerRing', Math.max(0, Math.round((remaining / total) * 100)));
      if (remaining <= 0) {
        clearInterval(recTimerInt);
        if (mediaRecorder.state === 'recording') mediaRecorder.stop();
      }
    }, 1000);
  }

  // ── Manual continue gate (shown after every recording stops) ──────
  function showAnsweredScreen() {
    const nextIdx = nextIncompleteIndex(qIndex + 1);
    setText('viAnsweredBtnText', nextIdx >= CFG.questions.length ? 'Finish Interview' : 'Continue to Next Question');
    show('answered');
  }

  // ── Upload (kicked off immediately, doesn't block on the student) ──
  function uploadAnswer(q, index, blob, durationSeconds) {
    const ext = extFor(mimeType || 'video/webm');
    const path = student.id + '/' + session.id + '/' + index + '.' + ext;

    const p = markAnswerRow(q, index, { upload_status: 'uploading', duration_seconds: durationSeconds })
      .then(function () {
        return db.storage.from('interview-videos').upload(path, blob, { upsert: true, contentType: mimeType || 'video/webm' });
      })
      .then(function (res) {
        if (res.error) throw res.error;
        return markAnswerRow(q, index, {
          storage_path: path, mime_type: mimeType || 'video/webm', file_size_bytes: blob.size,
          duration_seconds: durationSeconds, recorded_at: new Date().toISOString(),
          upload_status: 'uploaded', error_message: null
        });
      })
      .then(function () { consecutiveUploadFailures = 0; uploadedIndices.add(index); })
      .catch(function (err) {
        console.error('[video-interview] upload failed for question', index, err);
        consecutiveUploadFailures++;
        markAnswerRow(q, index, { upload_status: 'failed', error_message: String((err && err.message) || err) }).catch(function () {});
        // A single failed upload is treated as a network blip — the final
        // screen catches it. Repeated CONSECUTIVE failures mean something
        // systemic is wrong (expired session, broken bucket, offline), so we
        // stop the interview and surface it immediately instead.
        if (consecutiveUploadFailures >= MAX_CONSECUTIVE_UPLOAD_FAILURES) haltForUploadTrouble();
      });
    pendingUploads[index] = p;
  }

  function haltForUploadTrouble() {
    if (circuitBroken) return;
    circuitBroken = true;
    clearInterval(readTimerInt); clearInterval(recTimerInt);
    if (mediaRecorder && mediaRecorder.state === 'recording') { try { mediaRecorder.stop(); } catch (e) { /* noop */ } }
    setRecDot(false);
    show('upload-trouble');
  }

  async function markAnswerRow(q, index, fields) {
    const row = Object.assign({
      session_id: session.id, user_id: student.id, question_index: index,
      question_id: q.id, question_text: q.text, question_category: q.category || null,
      updated_at: new Date().toISOString()
    }, fields);
    const { error } = await db.from('video_interview_answers').upsert(row, { onConflict: 'session_id,question_index' });
    if (error) { console.error('[video-interview] markAnswerRow failed', error); throw error; }
  }

  // ── Finish ───────────────────────────────────────────────────────
  async function finishInterview() {
    show('finishing');
    window.removeEventListener('beforeunload', onBeforeUnload);
    setText('viFinishStatus', 'Saving your answers…');
    await Promise.all(Object.values(pendingUploads));

    // Re-verify against the database — the source of truth — not just
    // in-memory upload state, before ever showing "Interview Complete".
    const finalAnswers = await loadAnswers(session.id);
    const failed = finalAnswers.filter((a) => a.upload_status !== 'uploaded');
    if (failed.length) { renderFailed(failed); show('failed'); return; }

    await db.from('video_interview_sessions')
      .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', session.id);

    if (stream) stream.getTracks().forEach((t) => t.stop());
    stopMeter();
    setText('viCompleteText', 'Your recorded interview has been saved successfully. Our admissions team will now review it — you’ll get an email as soon as that’s done.');
    populateSummary();
    show('complete');
    sendSubmissionEmail(); // fire-and-forget — the screen above already reflects success either way
  }

  // Only ever called after every answer is confirmed 'uploaded' and the
  // session is marked 'completed' — never on a failed/partial submission.
  function sendSubmissionEmail() {
    db.auth.getSession().then(function (r) {
      const token = r.data && r.data.session && r.data.session.access_token;
      return fetch('https://okshteetxmmphgjgvrwt.supabase.co/functions/v1/send-email', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
        body: JSON.stringify({ type: 'video_interview_submitted', user_id: student.id, student_name: student.name || 'Student' })
      });
    }).catch(function (e) { console.warn('[video-interview] submission email failed to send', e); });
  }

  function populateSummary() {
    const cid = localStorage.getItem('last_course');
    const courses = window.COURSES || (window.YSJ_DATA && window.YSJ_DATA.COURSES);
    const programme = (courses && cid && courses[cid] && courses[cid].name) || '—';
    setText('viSummaryName', student.name || 'Student');
    setText('viSummaryAppId', student.student_id || '—');
    setText('viSummaryProgramme', programme);
    setText('viSummaryDate', new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
    setText('viSummaryStatus', 'Awaiting Review');
  }

  function renderFailed(failed) {
    const list = $('viFailedList');
    if (!list) return;
    list.innerHTML = failed.map((a) =>
      '<div class="vi-failed-row"><span>Question ' + (a.question_index + 1) + ': ' + escapeHtml(a.question_text) + '</span>' +
      '<button type="button" class="vi-btn-retry" data-idx="' + a.question_index + '">Retry</button></div>'
    ).join('');
    list.querySelectorAll('.vi-btn-retry').forEach((btn) => {
      btn.addEventListener('click', function () { retryQuestion(parseInt(btn.dataset.idx, 10)); });
    });
  }

  function retryQuestion(index) {
    if (!stream || !stream.active) { show('reconnect'); qIndex = index; return; }
    qIndex = index;
    askQuestion(index);
  }

  // ── Wire up ──────────────────────────────────────────────────────
  const startBtn = $('viStartBtn'); if (startBtn) startBtn.addEventListener('click', beginFlow);
  const camRetryBtn = $('viCamRetryBtn'); if (camRetryBtn) camRetryBtn.addEventListener('click', runDeviceCheck);
  const micRetryBtn = $('viMicRetryBtn'); if (micRetryBtn) micRetryBtn.addEventListener('click', runDeviceCheck);
  const camNextBtn = $('viCamNextBtn'); if (camNextBtn) camNextBtn.addEventListener('click', function () { show('device-audio'); });
  const micNextBtn = $('viMicNextBtn'); if (micNextBtn) micNextBtn.addEventListener('click', function () { show('countdown'); runCountdown(); });
  const doneBtn = $('viDoneBtn'); if (doneBtn) doneBtn.addEventListener('click', function () {
    clearInterval(recTimerInt);
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
  });
  const answeredBtn = $('viAnsweredBtn'); if (answeredBtn) answeredBtn.addEventListener('click', function () {
    setProgressStatus(qIndex, 'completed', fmtTime(CFG.answerSeconds));
    askQuestion(nextIncompleteIndex(qIndex + 1));
  });
  const reconnectBtn = $('viReconnectBtn'); if (reconnectBtn) reconnectBtn.addEventListener('click', async function () {
    const ok = await runDeviceCheck();
    if (ok) askQuestion(qIndex);
  });
  const uploadTroubleBtn = $('viUploadTroubleBtn'); if (uploadTroubleBtn) uploadTroubleBtn.addEventListener('click', function () {
    consecutiveUploadFailures = 0;
    circuitBroken = false;
    retryQuestion(qIndex);
  });

  try {
    await initIntro();
  } catch (e) {
    console.error('[video-interview] init failed', e);
    show('device-camera');
    showMsg('Something went wrong loading the interview: ' + e.message);
  }
};
