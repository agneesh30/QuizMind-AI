
import React, { useState, useMemo, useEffect } from 'react';
import { extractQuizData, extractQuizDataFromText } from './services/geminiService';
import { QuizData, UserAnswer, QuizState, Question, QuizAttempt } from './types';
import { RAW_QUIZZES } from './rawContent';
import { Button } from './components/Button';
import { 
  FileUp, Trophy, ChevronLeft, Flag, LayoutGrid, 
  Trash2, History, Pause, Play,
  Cloud, Sun, Moon, ArrowLeft, Ban, BookOpen, 
  Cpu, Save, Database
} from 'lucide-react';

const HISTORY_KEY = 'cloudexam_history_v12'; 
const CACHE_KEY = 'cloudexam_ai_cache_v12';
const FLAGS_KEY = 'cloudexam_flags_v12';
const THEME_KEY = 'cloudexam_theme';

const shuffleArray = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return (saved as 'light' | 'dark') || 'dark';
  });
  
  const [state, setState] = useState<QuizState>('idle');
  const [navTab, setNavTab] = useState<'library' | 'mistakes' | 'flagged' | 'import'>('library');
  
  const [history, setHistory] = useState<Record<string, QuizAttempt[]>>({});
  const [parsedCache, setParsedCache] = useState<Record<string, QuizData>>({});
  const [globalFlaggedIds, setGlobalFlaggedIds] = useState<Set<string>>(new Set());
  
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [sessionFlags, setSessionFlags] = useState<Set<string>>(new Set());
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState<QuizAttempt | null>(null);
  const [csvContent, setCsvContent] = useState('');
  const [inputMode, setInputMode] = useState<'file' | 'csv'>('file');

  useEffect(() => {
    document.body.className = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Load persistence
  useEffect(() => {
    const savedHistory = localStorage.getItem(HISTORY_KEY);
    const savedCache = localStorage.getItem(CACHE_KEY);
    const savedFlags = localStorage.getItem(FLAGS_KEY);
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    if (savedCache) setParsedCache(JSON.parse(savedCache));
    if (savedFlags) setGlobalFlaggedIds(new Set(JSON.parse(savedFlags)));
  }, []);

  // Save parsed questions to cache
  useEffect(() => {
    if (Object.keys(parsedCache).length > 0) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(parsedCache));
    }
  }, [parsedCache]);

  // Save global flags
  useEffect(() => {
    localStorage.setItem(FLAGS_KEY, JSON.stringify(Array.from(globalFlaggedIds)));
  }, [globalFlaggedIds]);

  useEffect(() => {
    let interval: any;
    if (state === 'playing' && !isPaused) {
      interval = setInterval(() => setTimerSeconds(s => s + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [state, isPaused]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const handleSelectQuiz = async (id: string) => {
    setActiveQuizId(id);
    if (parsedCache[id]) {
      setState('history');
      return;
    }
    setState('extracting');
    try {
      const raw = RAW_QUIZZES[id];
      if (!raw) throw new Error("Set definition missing");
      const parsed = await extractQuizDataFromText(raw.csv);
      parsed.id = id; 
      setParsedCache(prev => ({ ...prev, [id]: parsed }));
      setState('history');
    } catch (err: any) {
      alert("AI Processing Failed: " + err.message);
      setState('idle');
    }
  };

  const prepareQuiz = (questions: Question[], customTitle?: string) => {
    const newQuestions = shuffleArray(questions).map(q => ({
      ...q,
      options: shuffleArray(q.options)
    }));
    setShuffledQuestions(newQuestions);
    setCurrentIdx(0);
    setSelectedOptions({});
    setSessionFlags(new Set());
    setUserAnswers([]);
    setTimerSeconds(0);
    setIsPaused(false);
    setState('playing');
  };

  const handleSubmit = (isEarly = false) => {
    if (isEarly) {
      const answered = Object.keys(selectedOptions).length;
      if (!confirm(`Submit now? Only ${answered}/${shuffledQuestions.length} nodes recorded.`)) return;
    }

    const finalAnswers: UserAnswer[] = shuffledQuestions.map(q => ({
      questionId: q.id,
      selectedOption: selectedOptions[q.id] || 'Not Answered',
      isCorrect: selectedOptions[q.id] === q.correctAnswer
    }));

    const attempt: QuizAttempt = {
      id: `att-${Date.now()}`,
      timestamp: Date.now(),
      score: finalAnswers.filter(a => a.isCorrect).length,
      totalQuestions: shuffledQuestions.length,
      timeSpent: timerSeconds,
      flaggedQuestionIds: Array.from(sessionFlags),
      answers: finalAnswers
    };

    if (activeQuizId) {
      const updatedHistory = { 
        ...history, 
        [activeQuizId]: [...(history[activeQuizId] || []), attempt] 
      };
      setHistory(updatedHistory);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
    }

    setUserAnswers(finalAnswers);
    setState('completed');
  };

  const toggleFlag = (id: string) => {
    setGlobalFlaggedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setSessionFlags(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getQuizData = (id: string) => parsedCache[id] || { id, title: RAW_QUIZZES[id]?.title || 'Set', questions: [] };

  const failedQuestionsGrouped = useMemo(() => {
    const groups: Record<string, Question[]> = {};
    Object.keys(history).forEach(qId => {
      const quiz = getQuizData(qId);
      const failedIds = new Set<string>();
      history[qId].forEach(att => {
        att.answers.forEach(ans => {
          if (!ans.isCorrect && ans.selectedOption !== 'Not Answered') failedIds.add(ans.questionId);
        });
      });
      const failedQObjects = quiz.questions.filter(q => failedIds.has(q.id));
      if (failedQObjects.length > 0) groups[qId] = failedQObjects;
    });
    return groups;
  }, [history, parsedCache]);

  const flaggedQuestions = useMemo(() => {
    const list: Question[] = [];
    Object.values(parsedCache).forEach(quiz => {
      quiz.questions.forEach(q => {
        if (globalFlaggedIds.has(q.id)) list.push(q);
      });
    });
    return list;
  }, [globalFlaggedIds, parsedCache]);

  return (
    <div className={`min-h-screen w-full flex flex-col items-center transition-colors duration-300 ${theme === 'dark' ? 'bg-[#1a1b1e] text-[#e8eaed]' : 'bg-[#f8f9fa] text-[#202124]'}`}>
      <header className={`fixed top-0 left-0 right-0 h-16 border-b flex justify-between items-center px-8 z-50 ${theme === 'dark' ? 'bg-[#25262b] border-[#373a40]' : 'bg-white border-[#dee2e6] shadow-sm'}`}>
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => setState('idle')}>
          <div className="bg-[#1a73e8] p-1.5 rounded-lg shadow-lg"><Cloud className="text-white w-5 h-5" /></div>
          <span className="text-xl font-black tracking-tighter uppercase">ACE <span className="text-[#1a73e8]">Console</span></span>
        </div>
        
        <div className="flex items-center gap-6">
          {state === 'playing' && (
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-4 border px-4 py-1.5 rounded-xl ${theme === 'dark' ? 'bg-[#1a1b1e] border-[#373a40]' : 'bg-[#f1f3f5] border-[#ced4da]'}`}>
                <span className="font-mono text-xl font-black tabular-nums">{Math.floor(timerSeconds/60).toString().padStart(2,'0')}:{(timerSeconds%60).toString().padStart(2,'0')}</span>
                <button onClick={() => setIsPaused(!isPaused)} className="text-[#1a73e8] hover:scale-110 transition-transform">{isPaused ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}</button>
              </div>
              <button onClick={() => confirm("Exit session?") && setState('idle')} className="bg-red-500 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600">Terminate</button>
            </div>
          )}
          <button onClick={toggleTheme} className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'bg-[#25262b] text-yellow-400 border border-[#373a40]' : 'bg-[#f1f3f5] text-[#495057]'}`}>
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>
      </header>

      <main className="w-full max-w-[90%] mt-24 mb-16 px-8">
        {state === 'idle' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-top-6 duration-700">
            <div className="space-y-2">
              <h1 className="text-6xl font-black tracking-tighter">Certification Hub</h1>
              <p className="opacity-50 text-xl font-medium">All sets parsed and cached for offline access. Click to initialize session.</p>
            </div>

            <nav className={`flex items-center gap-1 p-1 rounded-xl border w-fit ${theme === 'dark' ? 'bg-[#25262b] border-[#373a40]' : 'bg-white border-[#dee2e6] shadow-sm'}`}>
              <button onClick={() => setNavTab('library')} className={`px-6 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${navTab === 'library' ? 'bg-[#1a73e8] text-white shadow-lg' : 'opacity-50 hover:opacity-100'}`}><BookOpen size={14}/> Library</button>
              <button onClick={() => setNavTab('mistakes')} className={`px-6 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${navTab === 'mistakes' ? 'bg-[#d93025] text-white shadow-lg' : 'text-red-400 hover:bg-red-500/5'}`}><Ban size={14}/> Mistake Bank</button>
              <button onClick={() => setNavTab('flagged')} className={`px-6 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${navTab === 'flagged' ? 'bg-[#f9ab00] text-[#1a1b1e] shadow-lg' : 'text-[#f9ab00] hover:bg-yellow-500/5'}`}><Flag size={14}/> Flagged Items</button>
              <button onClick={() => setNavTab('import')} className={`px-6 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${navTab === 'import' ? 'bg-[#1a73e8] text-white shadow-lg' : 'opacity-50 hover:opacity-100'}`}><FileUp size={14}/> Import</button>
            </nav>

            {navTab === 'library' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {Object.keys(RAW_QUIZZES).map(id => {
                  const isCached = !!parsedCache[id];
                  return (
                    <div key={id} onClick={() => handleSelectQuiz(id)} className={`p-10 border rounded-[2.5rem] transition-all cursor-pointer group flex flex-col justify-between min-h-[280px] relative overflow-hidden ${theme === 'dark' ? 'bg-[#25262b] border-[#373a40] hover:border-[#1a73e8]' : 'bg-white border-[#dee2e6] hover:border-[#1a73e8] shadow-sm hover:shadow-xl'}`}>
                       {isCached && (
                         <div className="absolute top-4 right-4 flex items-center gap-2 bg-green-500/10 text-green-500 text-[9px] font-black uppercase px-3 py-1.5 rounded-full border border-green-500/20">
                           <Database size={10} /> Node Cached
                         </div>
                       )}
                       <div className="space-y-4">
                         <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-6 ${isCached ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'}`}><Cpu size={28}/></div>
                         <h4 className="text-2xl font-black leading-tight tracking-tight">{RAW_QUIZZES[id].title}</h4>
                         <p className="text-[11px] opacity-40 font-bold uppercase tracking-widest">{isCached ? `${parsedCache[id].questions.length} Questions` : 'AI Required'}</p>
                       </div>
                       <div className="mt-8 flex items-center justify-between text-[11px] font-black uppercase tracking-[0.2em] opacity-40 border-t pt-6 border-[#373a40]/10">
                        <span>{isCached ? 'Review & Start' : 'Analyze Logic'}</span>
                        <span className="text-[#1a73e8] group-hover:translate-x-1 transition-transform">Begin &rarr;</span>
                       </div>
                    </div>
                  );
                })}
              </div>
            )}

            {navTab === 'mistakes' && (
              <div className="space-y-10 animate-in slide-in-from-bottom-6 duration-500">
                {Object.keys(failedQuestionsGrouped).length === 0 ? (
                  <div className="text-center py-40 opacity-20"><History size={64} className="mx-auto mb-4"/><p className="font-bold uppercase tracking-[0.4em]">Zero failure records</p></div>
                ) : Object.keys(failedQuestionsGrouped).map(qId => (
                  <div key={qId} className={`p-12 border rounded-[3.5rem] ${theme === 'dark' ? 'bg-[#25262b] border-[#373a40]' : 'bg-white border-[#dee2e6] shadow-sm'}`}>
                    <div className="flex justify-between items-center mb-10 px-6">
                      <h3 className="text-2xl font-black">{getQuizData(qId).title}</h3>
                      <Button size="sm" className="bg-[#d93025] text-white text-[10px] uppercase font-black tracking-widest px-8 rounded-full shadow-lg shadow-red-500/20" onClick={() => prepareQuiz(failedQuestionsGrouped[qId])}>Practice These {failedQuestionsGrouped[qId].length} Mistakes</Button>
                    </div>
                    <div className="space-y-4">
                      {failedQuestionsGrouped[qId].map(q => (
                        <div key={q.id} className={`p-8 rounded-[2rem] border ${theme === 'dark' ? 'bg-black/20 border-[#373a40]' : 'bg-red-50/20 border-red-100'}`}>
                          <p className="font-medium text-lg leading-relaxed mb-6">{q.question}</p>
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] font-black uppercase text-green-500 tracking-widest">Correct Answer:</span>
                            <p className="font-bold text-sm opacity-80">{q.correctAnswer}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {navTab === 'flagged' && (
              <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-500">
                {flaggedQuestions.length === 0 ? (
                  <div className="text-center py-40 opacity-20"><Flag size={64} className="mx-auto mb-4"/><p className="font-bold uppercase tracking-[0.4em]">No logic markers found</p></div>
                ) : (
                  <div className="grid grid-cols-1 gap-6">
                    <div className="flex items-center justify-between px-10">
                      <h2 className="text-3xl font-black">Doubt Clearing Station</h2>
                      <Button className="bg-[#f9ab00] text-black text-xs font-black uppercase tracking-widest px-10 rounded-full" onClick={() => prepareQuiz(flaggedQuestions)}>Practice All Flagged</Button>
                    </div>
                    {flaggedQuestions.map(q => (
                      <div key={q.id} className={`p-10 border rounded-[3rem] ${theme === 'dark' ? 'bg-[#25262b] border-[#373a40]' : 'bg-white border-[#dee2e6]'}`}>
                        <div className="flex justify-between items-start mb-8">
                          <p className="text-xl font-medium leading-relaxed flex-1 pr-12">{q.question}</p>
                          <button onClick={() => toggleFlag(q.id)} className="text-[#f9ab00] hover:scale-110 transition-transform"><Flag size={28} fill="currentColor"/></button>
                        </div>
                        <div className="p-8 rounded-[1.5rem] bg-[#1a73e805] border border-[#1a73e810]">
                          <p className="text-[10px] font-black uppercase text-[#1a73e8] mb-4 tracking-widest">Target Resolution</p>
                          <p className="font-bold text-lg">{q.correctAnswer}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {navTab === 'import' && (
              <div className={`p-16 border rounded-[3rem] text-center ${theme === 'dark' ? 'bg-[#25262b] border-[#373a40]' : 'bg-white border-[#dee2e6] shadow-xl'}`}>
                <div className="max-w-xl mx-auto space-y-10">
                  <div className="flex justify-center gap-2 p-1.5 rounded-xl border w-fit mx-auto bg-black/5">
                    <button onClick={() => setInputMode('file')} className={`px-10 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-widest ${inputMode === 'file' ? 'bg-white text-black shadow-lg' : 'opacity-40'}`}>File Probe</button>
                    <button onClick={() => setInputMode('csv')} className={`px-10 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-widest ${inputMode === 'csv' ? 'bg-white text-black shadow-lg' : 'opacity-40'}`}>CSV Logic</button>
                  </div>

                  {inputMode === 'file' ? (
                    <label className="flex flex-col items-center gap-8 py-16 cursor-pointer border-2 border-dashed border-[#1a73e830] rounded-[2rem] hover:bg-[#1a73e805] transition-all group">
                      <FileUp size={56} className="text-[#1a73e8] group-hover:scale-110 transition-transform" />
                      <div><p className="text-2xl font-bold">Import Data Block</p><p className="text-sm opacity-40 mt-2">Gemini will structuralize and cache this set for you.</p></div>
                      <input type="file" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0]; if (!file) return;
                        setState('extracting');
                        try { const data = await extractQuizData(file); setParsedCache(p => ({...p, [data.id]: data})); setState('history'); setActiveQuizId(data.id); } catch (err: any) { alert(err.message); setState('idle'); }
                      }} />
                    </label>
                  ) : (
                    <div className="space-y-6">
                      <textarea className={`w-full border rounded-[1.5rem] p-8 font-mono text-sm h-[350px] outline-none transition-all focus:ring-4 focus:ring-blue-500/10 ${theme === 'dark' ? 'bg-[#1a1b1e] border-[#373a40]' : 'bg-[#f8f9fa] border-[#dee2e6]'}`} placeholder="Paste raw MCQ strings here..." value={csvContent} onChange={(e) => setCsvContent(e.target.value)}/>
                      <Button onClick={async () => {
                        if(!csvContent.trim()) return;
                        setState('extracting');
                        try { 
                          const data = await extractQuizDataFromText(csvContent); 
                          setParsedCache(p => ({...p, [data.id]: data})); setNavTab('library'); setState('history'); setActiveQuizId(data.id); setCsvContent(''); 
                        } catch (err: any) { alert(err.message); setState('idle'); }
                      }} className="w-full bg-[#1a73e8] text-white py-5 text-lg font-bold shadow-2xl shadow-blue-500/20">Ingest Data Stream</Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {state === 'extracting' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-12">
            <div className="relative">
              <div className="w-32 h-32 border-[8px] border-[#1a73e810] border-t-[#1a73e8] rounded-full animate-spin"></div>
              <Cpu size={48} className="absolute inset-0 m-auto text-[#1a73e8] animate-pulse" />
            </div>
            <div className="text-center space-y-4">
              <h3 className="text-3xl font-black tracking-tight uppercase">Building Logic Cache</h3>
              <p className="text-xs font-black uppercase tracking-[0.6em] opacity-40 animate-pulse">Initializing AI context nodes...</p>
            </div>
          </div>
        )}

        {state === 'history' && activeQuizId && (
          <div className="max-w-5xl w-full mx-auto space-y-12 animate-in slide-in-from-bottom-12 duration-700">
            <div className="flex items-center gap-6">
              <button onClick={() => setState('idle')} className="p-4 hover:bg-[#1a73e810] rounded-2xl text-[#1a73e8] transition-all"><ArrowLeft size={32}/></button>
              <h2 className="text-4xl font-black tracking-tighter">{getQuizData(activeQuizId).title}</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
               <div className={`p-12 border rounded-[3rem] ${theme === 'dark' ? 'bg-[#25262b] border-[#373a40]' : 'bg-white border-[#dee2e6] shadow-sm'}`}><p className="text-[11px] font-black opacity-30 uppercase mb-4 tracking-widest">Historical Logs</p><p className="text-6xl font-black">{(history[activeQuizId] || []).length}</p></div>
               <div className={`p-12 border rounded-[3rem] ${theme === 'dark' ? 'bg-[#25262b] border-[#373a40]' : 'bg-white border-[#dee2e6] shadow-sm'}`}><p className="text-[11px] font-black opacity-30 uppercase mb-4 tracking-widest">Question Index</p><p className="text-6xl font-black">{getQuizData(activeQuizId).questions.length}</p></div>
               <Button onClick={() => prepareQuiz(getQuizData(activeQuizId).questions)} className="bg-[#1a73e8] text-white text-3xl font-black py-12 rounded-[3rem] shadow-3xl shadow-blue-500/30">Start Exam</Button>
            </div>

            <div className={`border rounded-[3.5rem] overflow-hidden ${theme === 'dark' ? 'bg-[#25262b] border-[#373a40]' : 'bg-white border-[#dee2e6] shadow-lg'}`}>
              <div className="divide-y divide-[#373a40]/10">
                {(!history[activeQuizId] || history[activeQuizId].length === 0) ? (
                  <div className="p-20 text-center opacity-30 font-black uppercase tracking-[0.4em] text-xs">No execution history recorded.</div>
                ) : [...history[activeQuizId]].reverse().map((att, i) => (
                  <div key={att.id} onClick={() => { setSelectedAttempt(att); setState('review'); }} className="px-14 py-10 flex items-center justify-between hover:bg-[#1a73e805] cursor-pointer group transition-all">
                    <div className="flex items-center gap-12">
                      <div className="w-16 h-16 rounded-[1.5rem] bg-[#1a73e810] flex items-center justify-center text-[#1a73e8] font-black text-2xl">L{history[activeQuizId].length - i}</div>
                      <div><p className="text-2xl font-black">Session Log</p><p className="text-[11px] font-black opacity-40 uppercase mt-2 tracking-widest">{new Date(att.timestamp).toLocaleString()} &bull; {Math.floor(att.timeSpent/60)}m {att.timeSpent%60}s</p></div>
                    </div>
                    <p className={`text-4xl font-black ${att.score / att.totalQuestions >= 0.7 ? 'text-green-500' : 'text-red-500'}`}>{Math.round((att.score/att.totalQuestions)*100)}%</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {state === 'playing' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-12 w-full animate-in zoom-in-95 duration-500">
            <div className="space-y-10">
              <div className={`border rounded-[4rem] min-h-[600px] flex flex-col relative overflow-hidden transition-all duration-500 ${theme === 'dark' ? 'bg-[#25262b] border-[#373a40]' : 'bg-white border-[#dee2e6] shadow-2xl'}`}>
                {isPaused && (
                  <div className={`absolute inset-0 z-50 backdrop-blur-3xl flex flex-col items-center justify-center gap-12 ${theme === 'dark' ? 'bg-[#1a1b1e]/95' : 'bg-white/95'}`}>
                    <Pause size={120} className="text-[#f9ab00] drop-shadow-3xl animate-pulse"/><h4 className="text-6xl font-black tracking-tighter uppercase">Processor Paused</h4>
                    <Button onClick={() => setIsPaused(false)} className="bg-[#1a73e8] px-28 text-white py-7 text-2xl font-black rounded-[2rem] shadow-3xl shadow-blue-500/40 uppercase">Resume Flow</Button>
                  </div>
                )}
                <div className={`flex-1 p-16 space-y-16 ${isPaused ? 'opacity-0 scale-95 blur-xl' : 'opacity-100 scale-100 blur-0'} transition-all duration-700`}>
                  <div className="flex justify-between items-center border-b border-[#373a40]/10 pb-10">
                    <span className="text-[#1a73e8] font-black text-sm uppercase tracking-[0.5em]">Node {(currentIdx + 1)} / {shuffledQuestions.length}</span>
                    <div className="flex items-center gap-4">
                      <button onClick={() => handleSubmit(true)} className="flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-black bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-all uppercase tracking-widest"><Save size={14}/> Early Submit</button>
                      <button onClick={() => toggleFlag(shuffledQuestions[currentIdx].id)} className={`flex items-center gap-4 px-8 py-2.5 rounded-full text-xs font-black border transition-all ${globalFlaggedIds.has(shuffledQuestions[currentIdx].id) ? 'bg-[#f9ab00] text-[#1a1b1e] border-[#f9ab00] shadow-2xl' : 'border-[#373a40]/10 opacity-30 hover:opacity-100'}`}><Flag size={18} fill={globalFlaggedIds.has(shuffledQuestions[currentIdx].id) ? "currentColor" : "none"} /> Marker</button>
                    </div>
                  </div>
                  <h3 className="text-4xl font-medium leading-tight tracking-tight text-balance">{shuffledQuestions[currentIdx].question}</h3>
                  <div className="grid gap-6">
                    {shuffledQuestions[currentIdx].options.map((option, i) => {
                      const isSelected = selectedOptions[shuffledQuestions[currentIdx].id] === option;
                      return (
                        <div key={i} onClick={() => setSelectedOptions(p => ({ ...p, [shuffledQuestions[currentIdx].id]: option }))} className={`flex items-center gap-10 p-8 rounded-[2rem] border-2 transition-all group cursor-pointer ${isSelected ? 'border-[#1a73e8] bg-blue-500/5 ring-1 ring-[#1a73e8]' : 'border-slate-200 dark:border-slate-800/80 hover:border-blue-400/40 hover:bg-black/5'}`}>
                          <div className={`w-8 h-8 rounded-full border-[4px] flex items-center justify-center transition-all ${isSelected ? 'border-[#1a73e8] bg-[#1a73e8] scale-110' : 'border-slate-300 dark:border-slate-700'}`}>{isSelected && <div className="w-3 h-3 rounded-full bg-white shadow-2xl" />}</div>
                          <span className={`text-2xl transition-all ${isSelected ? 'text-[#1a73e8] font-black' : 'opacity-80 font-medium'}`}>{option}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className={`p-14 border-t flex justify-between items-center ${theme === 'dark' ? 'bg-[#1a1b1e] border-[#373a40]' : 'bg-[#f8f9fa] border-[#dee2e6]'}`}>
                  <button disabled={currentIdx === 0} onClick={() => setCurrentIdx(p => Math.max(0, p-1))} className="flex items-center gap-5 font-black text-xs uppercase tracking-[0.4em] disabled:opacity-5 transition-all"><ChevronLeft size={32}/> Previous</button>
                  <div className="flex gap-6">
                    {currentIdx === shuffledQuestions.length - 1 ? (
                      <button onClick={() => handleSubmit(false)} className="bg-[#1a73e8] text-white px-16 py-5 rounded-[1.5rem] font-black uppercase text-xs tracking-[0.4em] shadow-3xl shadow-blue-500/40">Finalize</button>
                    ) : (
                      <button onClick={() => setCurrentIdx(p => Math.min(shuffledQuestions.length-1, p+1))} className="bg-[#1a73e8] text-white px-16 py-5 rounded-[1.5rem] font-black uppercase text-xs tracking-[0.4em] shadow-xl">Forward &rarr;</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <aside className="space-y-10">
              <div className={`p-12 rounded-[3.5rem] border sticky top-28 ${theme === 'dark' ? 'bg-[#25262b] border-[#373a40]' : 'bg-white border-[#dee2e6] shadow-2xl'}`}>
                <h4 className="text-[12px] font-black uppercase tracking-[0.6em] opacity-30 mb-10 flex items-center gap-4"><LayoutGrid size={16}/> Question Map</h4>
                <div className="grid grid-cols-5 gap-4 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                  {shuffledQuestions.map((q, idx) => (
                    <button key={idx} onClick={() => setCurrentIdx(idx)} className={`w-full aspect-square rounded-2xl text-[11px] font-black transition-all flex items-center justify-center ${currentIdx === idx ? 'ring-4 ring-blue-500/40 bg-black text-white shadow-2xl' : globalFlaggedIds.has(q.id) ? 'bg-[#f9ab00] text-[#1a1b1e] shadow-lg shadow-yellow-500/30' : !!selectedOptions[q.id] ? 'bg-blue-500 text-white shadow-lg' : 'border-2 border-[#373a40]/10 opacity-30 hover:opacity-100'}`}>{idx + 1}</button>
                  ))}
                </div>
                <div className="mt-16 pt-12 border-t border-[#373a40]/10">
                  <button onClick={() => handleSubmit(true)} className="w-full bg-red-500/5 text-red-500 hover:bg-red-500/20 border border-red-500/10 py-6 rounded-3xl font-black text-[12px] uppercase tracking-[0.5em] transition-all">Submit Quiz Early</button>
                </div>
              </div>
            </aside>
          </div>
        )}

        {(state === 'completed' || state === 'review') && (
          <div className="w-full max-w-5xl mx-auto space-y-16 py-10 animate-in slide-in-from-bottom-12 duration-700">
            {state === 'completed' && (
              <div className={`p-20 rounded-[5rem] text-center space-y-16 border-t-[18px] border-t-[#1a73e8] ${theme === 'dark' ? 'bg-[#25262b] border-[#373a40]' : 'bg-white border-[#dee2e6] shadow-3xl'}`}>
                 <Trophy size={140} className="text-[#f9ab00] mx-auto filter drop-shadow-[0_25px_50px_rgba(249,171,0,0.5)] animate-bounce" />
                 <h2 className="text-7xl font-black tracking-tighter uppercase">Execution Score</h2>
                 <div className="flex justify-center gap-28 py-24 rounded-[4rem] bg-[#1a73e805] border border-[#1a73e810] shadow-inner">
                   <div><p className="text-sm font-black uppercase tracking-[0.4em] opacity-30 mb-6">Total Accuracy</p><p className="text-9xl font-black text-[#1a73e8] tracking-tighter tabular-nums">{Math.round((userAnswers.filter(a => a.isCorrect).length / shuffledQuestions.length) * 100)}%</p></div>
                   <div className="w-px bg-[#373a40]/10 self-stretch"></div>
                   <div><p className="text-sm font-black uppercase tracking-[0.4em] opacity-30 mb-6">Nodes Passed</p><p className="text-9xl font-black tracking-tighter tabular-nums">{userAnswers.filter(a => a.isCorrect).length} <span className="text-5xl opacity-5">/ {shuffledQuestions.length}</span></p></div>
                 </div>
                 <div className="flex gap-10">
                   <Button variant="outline" className="flex-1 py-8 text-sm font-black uppercase tracking-[0.4em] rounded-[2.5rem]" onClick={() => setState('idle')}>Return to Hub</Button>
                   {activeQuizId && <Button className="flex-1 bg-[#1a73e8] text-white py-8 text-sm font-black uppercase tracking-[0.4em] rounded-[2.5rem] shadow-3xl shadow-blue-500/40" onClick={() => setState('history')}>View All Attempts</Button>}
                 </div>
              </div>
            )}
            
            <div className="space-y-10">
              <h3 className="text-5xl font-black tracking-tighter px-8 border-l-[16px] border-[#1a73e8] ml-6">Structural Audit</h3>
              {(state === 'review' ? selectedAttempt?.answers : userAnswers)?.map((ans, idx) => {
                const quiz = getQuizData(activeQuizId!);
                const q = quiz.questions.find(sq => sq.id === ans.questionId);
                if (!q) return null;
                const isCorrect = ans.isCorrect;
                return (
                  <div key={q.id} className={`p-16 rounded-[4.5rem] border-l-[20px] transition-all group ${theme === 'dark' ? 'bg-[#25262b] border-[#373a40]' : 'bg-white border-[#dee2e6] shadow-sm hover:shadow-3xl'} ${isCorrect ? 'border-l-green-500' : 'border-l-red-500'}`}>
                    <div className="flex items-start gap-16">
                      <span className="font-black text-8xl tabular-nums opacity-5 group-hover:opacity-10 transition-opacity">{(idx + 1).toString().padStart(2, '0')}</span>
                      <div className="space-y-14 flex-1">
                        <div className="flex justify-between items-start">
                          <p className="text-3xl font-medium leading-tight tracking-tight text-balance flex-1 pr-12">{q.question}</p>
                          <button onClick={() => toggleFlag(q.id)} className={`transition-all ${globalFlaggedIds.has(q.id) ? 'text-[#f9ab00]' : 'opacity-20'}`}><Flag size={32} fill={globalFlaggedIds.has(q.id) ? "currentColor" : "none"}/></button>
                        </div>
                        <div className="grid md:grid-cols-2 gap-10">
                          <div className={`p-10 rounded-[2.5rem] border-2 ${theme === 'dark' ? 'bg-black/40 border-[#373a40]' : 'bg-green-50/50 border-green-100'}`}><p className="text-[#1a73e8] text-[11px] font-black uppercase tracking-[0.5em] mb-6">Target Logic</p><p className="font-bold text-2xl leading-snug">{q.correctAnswer}</p></div>
                          <div className={`p-10 rounded-[2.5rem] border-2 ${theme === 'dark' ? 'bg-black/40 border-[#373a40]' : (isCorrect ? 'bg-green-50/50 border-green-100' : 'bg-red-50/60 border-red-100 shadow-xl shadow-red-500/5')}`}><p className={`${isCorrect ? 'text-green-500' : 'text-red-500'} text-[11px] font-black uppercase tracking-[0.5em] mb-6`}>Candidate Entry</p><p className="font-bold text-2xl leading-snug">{ans.selectedOption}</p></div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {state === 'review' && <div className="text-center pb-40"><Button onClick={() => setState('history')} className="bg-[#1a73e8] text-white px-32 uppercase text-xs font-black py-8 tracking-[0.6em] shadow-3xl rounded-[3rem]">Back to History</Button></div>}
          </div>
        )}
      </main>

      <footer className="mt-auto py-20 opacity-20 text-[11px] font-black tracking-[1em] uppercase text-center border-t w-full border-[#373a40]/10">Ace Console &bull; v12.0 (Persistent Cache Active)</footer>
    </div>
  );
}
