// ═══════════════════════════════════════════════════════════════════
// VIDEO INTERVIEW — per-school configuration
//
// Adding a new school is additive only: add a new key below (or load a
// second file after this one — they merge onto the same object) with its
// own questions/timings, then link a page to it via
// window.initVideoInterview('<schoolKey>'). No engine or admin changes
// needed.
// ═══════════════════════════════════════════════════════════════════
window.VIDEO_INTERVIEW_CONFIG = {
  yorkstjohn: {
    label: 'York St John University',
    readingSeconds: 20,
    answerSeconds: 60,
    questions: [
      { id:'vq1',  category:'Your Background',     text:'Tell me about yourself, your academic and professional background.' },
      { id:'vq2',  category:'Your Programme',       text:'Tell me about your programme.' },
      { id:'vq3',  category:'Why This Programme',   text:'Why did you choose this programme?' },
      { id:'vq4',  category:'Programme Modules',    text:'List and explain your programme modules.' },
      { id:'vq5',  category:'Why This University',  text:'Why did you choose this university specifically?' },
      { id:'vq6',  category:'Other UK Universities', text:'Apart from this university, did you consider any other UK universities?' },
      { id:'vq7',  category:'Why the UK',            text:'Why did you choose to study in the United Kingdom?' },
      { id:'vq8',  category:'Other Countries',       text:'Apart from the UK, which other countries did you consider for your studies?' },
      { id:'vq9',  category:'Home Country vs UK',    text:'You could study this programme in your home country. Why did you choose the UK instead?' },
      { id:'vq10', category:'Career Plans',          text:'What are your career plans after completing this programme?' },
      { id:'vq11', category:'Finance & Funding',     text:'How will you fund your studies and living expenses in the UK?' },
      { id:'vq12', category:'Accommodation',         text:'Where will you live during your studies and how much will it cost?' }
    ]
  }
};
