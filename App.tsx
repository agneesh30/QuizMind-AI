
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { extractQuizData, extractQuizDataFromText } from './services/geminiService';
import { QuizData, UserAnswer, QuizState, Question } from './types';
import { Button } from './components/Button';
import { 
  FileUp, 
  BrainCircuit, 
  Trophy, 
  ChevronRight, 
  ChevronLeft,
  RotateCcw, 
  CheckCircle2, 
  XCircle,
  AlertCircle,
  Code2,
  Flag,
  Timer,
  Send,
  LayoutGrid
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const shuffleArray = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

export default function App() {
  const [state, setState] = useState<QuizState>('idle');
  const [inputMode, setInputMode] = useState<'file' | 'csv'>('file');
  const [csvContent, setCsvContent] = useState('');
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Timer logic
  useEffect(() => {
    let interval: any;
    if (state === 'playing') {
      interval = setInterval(() => {
        setTimerSeconds(s => s + 1);
      }, 1000);
    } else {
      setTimerSeconds(0);
    }
    return () => clearInterval(interval);
  }, [state]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setState('extracting');
    setError(null);
    try {
      const data = await extractQuizData(file);
      processExtractedData(data);
    } catch (err: any) {
      setError(err.message || "Failed to parse document.");
      setState('idle');
    }
  };

  const handleCsvSubmit = async () => {
    if (!csvContent.trim()) {
      setError("Please enter some CSV content.");
      return;
    }
    setState('extracting');
    setError(null);
    try {
      const data = await extractQuizDataFromText(csvContent);
      processExtractedData(data);
    } catch (err: any) {
      setError(err.message || "Failed to parse CSV content.");
      setState('idle');
    }
  };

  const processExtractedData = (data: QuizData) => {
    setQuizData(data);
    prepareQuiz(data.questions);
    setState('ready');
  };

  const prepareQuiz = (questions: Question[]) => {
    const newQuestions = shuffleArray(questions).map(q => ({
      ...q,
      options: shuffleArray(q.options)
    }));
    setShuffledQuestions(newQuestions);
    setCurrentIdx(0);
    setSelectedOptions({});
    setFlaggedIds(new Set());
    setUserAnswers([]);
  };

  const startQuiz = () => setState('playing');

  const handleOptionSelect = (option: string) => {
    const currentQ = shuffledQuestions[currentIdx];
    setSelectedOptions(prev => ({
      ...prev,
      [currentQ.id]: option
    }));
  };

  const toggleFlag = () => {
    const currentQ = shuffledQuestions[currentIdx];
    setFlaggedIds(prev => {
      const next = new Set(prev);
      if (next.has(currentQ.id)) next.delete(currentQ.id);
      else next.add(currentQ.id);
      return next;
    });
  };

  const handleSubmit = () => {
    const finalAnswers: UserAnswer[] = shuffledQuestions.map(q => {
      const selected = selectedOptions[q.id];
      return {
        questionId: q.id,
        selectedOption: selected || 'No Answer',
        isCorrect: selected === q.correctAnswer
      };
    });
    setUserAnswers(finalAnswers);
    setState('completed');
  };

  const reset = () => {
    setState('idle');
    setQuizData(null);
    setShuffledQuestions([]);
    setCsvContent('');
    setError(null);
  };

  const retry = () => {
    if (quizData) {
      prepareQuiz(quizData.questions);
      setState('playing');
    }
  };

  const isCurrentAnswered = useMemo(() => {
    if (!shuffledQuestions[currentIdx]) return false;
    return !!selectedOptions[shuffledQuestions[currentIdx].id];
  }, [selectedOptions, shuffledQuestions, currentIdx]);

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 relative">
      <header className="fixed top-0 left-0 right-0 p-6 flex justify-between items-center z-50 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto cursor-pointer" onClick={reset}>
          <BrainCircuit className="text-indigo-400 w-8 h-8" />
          <span className="text-xl font-bold gradient-text">QuizMind AI</span>
        </div>
        {state === 'playing' && (
          <div className="flex items-center gap-4 pointer-events-auto">
            <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-2xl backdrop-blur-md flex items-center gap-3">
              <Timer className="w-4 h-4 text-indigo-400" />
              <span className="font-mono text-lg font-bold text-white">{formatTime(timerSeconds)}</span>
            </div>
          </div>
        )}
      </header>

      <main className="w-full max-w-5xl mt-20">
        {state === 'idle' && (
          <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-3xl mx-auto">
            <div className="space-y-4">
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
                Master any <br/><span className="gradient-text">content.</span>
              </h1>
              <p className="text-slate-400 text-lg max-w-md mx-auto">
                Transform documents or raw CSV text into premium interactive quizzes with real-time tracking.
              </p>
            </div>

            <div className="flex justify-center mb-4">
              <div className="bg-white/5 p-1 rounded-2xl flex gap-1 border border-white/10 backdrop-blur-sm">
                <button 
                  onClick={() => setInputMode('file')}
                  className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${inputMode === 'file' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  <FileUp className="w-4 h-4" /> File Upload
                </button>
                <button 
                  onClick={() => setInputMode('csv')}
                  className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${inputMode === 'csv' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  <Code2 className="w-4 h-4" /> CSV Editor
                </button>
              </div>
            </div>

            <div className="relative group min-h-[400px]">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              
              {inputMode === 'file' ? (
                <label className="relative glass-card h-full w-full flex flex-col items-center justify-center gap-4 p-12 rounded-3xl cursor-pointer border-dashed border-2 border-white/10 hover:border-indigo-500/50 transition-all">
                  <FileUp className="w-12 h-12 text-indigo-400" />
                  <div className="space-y-1">
                    <p className="text-lg font-medium">Select a file to begin</p>
                    <p className="text-sm text-slate-500">PDF, CSV, or Text supported</p>
                  </div>
                  <input type="file" className="hidden" accept=".pdf,.csv,.doc,.docx,.txt" onChange={handleFileUpload} />
                </label>
              ) : (
                <div className="relative glass-card h-full w-full rounded-3xl overflow-hidden border border-white/10 flex flex-col">
                  <div className="flex items-center justify-between px-6 py-4 bg-white/5 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                      </div>
                      <span className="text-xs font-mono text-slate-500 ml-4 uppercase tracking-widest">csv_input.csv</span>
                    </div>
                  </div>
                  <textarea 
                    className="flex-1 bg-transparent p-6 font-mono text-sm text-indigo-300 outline-none resize-none placeholder:text-slate-700 min-h-[300px]"
                    placeholder="Question,Option A,Option B,Option C,Option D,Answer&#10;What is the capital of France?,Paris,London,Berlin,Madrid,Paris"
                    value={csvContent}
                    onChange={(e) => setCsvContent(e.target.value)}
                  />
                  <div className="p-4 bg-black/20 border-t border-white/5 flex justify-end">
                    <Button variant="primary" size="sm" className="gap-2" onClick={handleCsvSubmit}>
                      Generate Quiz <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center justify-center gap-2 text-red-400 bg-red-400/10 p-4 rounded-xl">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {state === 'extracting' && (
          <div className="text-center space-y-6 flex flex-col items-center justify-center min-h-[60vh]">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <BrainCircuit className="absolute inset-0 m-auto w-10 h-10 text-indigo-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold">Generating Quiz...</h3>
              <p className="text-slate-400">Our AI is parsing your content and crafting unique questions.</p>
            </div>
          </div>
        )}

        {state === 'ready' && quizData && (
          <div className="glass-card p-10 rounded-3xl space-y-8 text-center animate-in zoom-in-95 duration-500 shadow-2xl max-w-2xl mx-auto">
            <div className="inline-flex p-4 rounded-3xl bg-indigo-500/10 mb-2">
              <CheckCircle2 className="w-10 h-10 text-indigo-400" />
            </div>
            <div className="space-y-3">
              <h2 className="text-4xl font-bold tracking-tight">{quizData.title}</h2>
              <p className="text-slate-400 text-lg">We've prepared {quizData.questions.length} questions for you.</p>
            </div>
            <div className="flex gap-4">
              <Button variant="outline" className="flex-1" onClick={reset}>Start Over</Button>
              <Button variant="primary" className="flex-1 gap-2" onClick={startQuiz}>
                Begin Quiz <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {state === 'playing' && shuffledQuestions.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 animate-in fade-in duration-500">
            {/* Main Question Area */}
            <div className="space-y-6">
              <div className="glass-card p-10 rounded-3xl space-y-10 shadow-2xl relative overflow-hidden min-h-[500px] flex flex-col justify-between">
                <div className="space-y-8">
                  <div className="flex items-center justify-between border-b border-white/5 pb-6">
                    <span className="text-indigo-400 font-bold tracking-widest uppercase text-xs">Question {currentIdx + 1}</span>
                    <button 
                      onClick={toggleFlag}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${flaggedIds.has(shuffledQuestions[currentIdx].id) ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'}`}
                    >
                      <Flag className={`w-3.5 h-3.5 ${flaggedIds.has(shuffledQuestions[currentIdx].id) ? 'fill-orange-400' : ''}`} />
                      {flaggedIds.has(shuffledQuestions[currentIdx].id) ? 'REVIEW LATER' : 'FLAG QUESTION'}
                    </button>
                  </div>

                  <h3 className="text-3xl font-bold leading-tight">
                    {shuffledQuestions[currentIdx].question}
                  </h3>

                  <div className="grid gap-4">
                    {shuffledQuestions[currentIdx].options.map((option, i) => {
                      const isSelected = selectedOptions[shuffledQuestions[currentIdx].id] === option;
                      return (
                        <button
                          key={i}
                          onClick={() => handleOptionSelect(option)}
                          className={`group relative w-full text-left p-6 rounded-2xl border transition-all duration-300 active:scale-[0.99] ${isSelected ? 'bg-indigo-600/20 border-indigo-500 shadow-lg shadow-indigo-500/10' : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'}`}
                        >
                          <div className="flex items-center gap-5">
                            <div className={`flex-shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center text-sm font-bold transition-all duration-300 ${isSelected ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-white/5 border-white/10 text-slate-400 group-hover:text-white'}`}>
                              {String.fromCharCode(65 + i)}
                            </div>
                            <span className={`text-lg transition-colors ${isSelected ? 'text-white font-medium' : 'text-slate-200 group-hover:text-white'}`}>{option}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-10 border-t border-white/5">
                  <Button 
                    variant="ghost" 
                    className="gap-2" 
                    onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
                    disabled={currentIdx === 0}
                  >
                    <ChevronLeft className="w-5 h-5" /> Previous
                  </Button>
                  
                  {currentIdx === shuffledQuestions.length - 1 ? (
                    <Button 
                      variant="secondary" 
                      className="gap-2 px-10" 
                      onClick={handleSubmit}
                    >
                      Submit Quiz <Send className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button 
                      variant="primary" 
                      className="gap-2 px-10" 
                      onClick={() => setCurrentIdx(prev => Math.min(shuffledQuestions.length - 1, prev + 1))}
                    >
                      Next Question <ChevronRight className="w-5 h-5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar Palette */}
            <div className="space-y-6">
              <div className="glass-card p-6 rounded-3xl border border-white/10 h-fit sticky top-28">
                <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
                  <LayoutGrid className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm font-bold uppercase tracking-widest text-slate-300">Question Status</span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                  {shuffledQuestions.map((q, idx) => {
                    const isAnswered = !!selectedOptions[q.id];
                    const isFlagged = flaggedIds.has(q.id);
                    const isCurrent = currentIdx === idx;
                    
                    let statusClass = "bg-white/5 border-white/5 text-slate-600";
                    if (isAnswered) statusClass = "bg-indigo-500/20 border-indigo-500 text-indigo-400";
                    if (isFlagged) statusClass = "bg-orange-500/20 border-orange-500 text-orange-400";
                    if (isCurrent) statusClass = "bg-white border-white text-black ring-4 ring-white/10";

                    return (
                      <button
                        key={q.id}
                        onClick={() => setCurrentIdx(idx)}
                        className={`w-full aspect-square flex items-center justify-center rounded-xl border text-xs font-black transition-all hover:scale-110 active:scale-90 ${statusClass}`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-8 space-y-3 pt-6 border-t border-white/5">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-slate-500">Progress</span>
                    <span className="text-indigo-400">{Object.keys(selectedOptions).length} of {shuffledQuestions.length}</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 transition-all duration-700" 
                      style={{ width: `${(Object.keys(selectedOptions).length / shuffledQuestions.length) * 100}%` }}
                    />
                  </div>
                </div>

                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-6 opacity-70 hover:opacity-100" 
                  onClick={handleSubmit}
                >
                  Submit Final Answers
                </Button>
              </div>
            </div>
          </div>
        )}

        {state === 'completed' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-700 max-w-4xl mx-auto">
            <div className="glass-card p-12 rounded-[2.5rem] text-center space-y-12 overflow-hidden relative shadow-2xl">
              <div className="absolute top-0 left-0 w-full h-1 shimmer opacity-30"></div>
              
              <div className="space-y-4">
                <div className="inline-block relative">
                   <div className="absolute -inset-8 bg-indigo-500/20 blur-3xl rounded-full animate-pulse"></div>
                   <Trophy className="w-24 h-24 text-yellow-400 mx-auto relative z-10" />
                </div>
                <h2 className="text-6xl font-black tracking-tight mt-6">Assessment Summary</h2>
                <p className="text-slate-400 text-xl font-medium">Session duration: {formatTime(timerSeconds)}</p>
              </div>

              <div className="flex flex-col md:flex-row items-center justify-around gap-12">
                <div className="relative w-64 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Correct', value: userAnswers.filter(a => a.isCorrect).length },
                          { name: 'Incorrect', value: userAnswers.filter(a => !a.isCorrect).length }
                        ]}
                        innerRadius={80}
                        outerRadius={105}
                        paddingAngle={10}
                        dataKey="value"
                        stroke="none"
                      >
                        <Cell fill="#6366f1" />
                        <Cell fill="rgba(255,255,255,0.05)" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-5xl font-black">{Math.round((userAnswers.filter(a => a.isCorrect).length / shuffledQuestions.length) * 100)}%</span>
                    <span className="text-xs text-slate-500 uppercase font-black tracking-[0.3em] mt-2">Accuracy</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10 min-w-[160px]">
                    <p className="text-xs text-indigo-400 font-black mb-3 uppercase tracking-widest">Correct</p>
                    <p className="text-5xl font-black">{userAnswers.filter(a => a.isCorrect).length}</p>
                    <p className="text-xs text-slate-600 mt-2 font-bold uppercase">Points</p>
                  </div>
                  <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10 min-w-[160px]">
                    <p className="text-xs text-slate-500 font-black mb-3 uppercase tracking-widest">Questions</p>
                    <p className="text-5xl font-black text-white">{shuffledQuestions.length}</p>
                    <p className="text-xs text-slate-600 mt-2 font-bold uppercase">Total</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-8">
                <Button variant="outline" size="lg" className="flex-1 gap-3 rounded-2xl py-6" onClick={reset}>
                  <RotateCcw className="w-5 h-5" /> New Assessment
                </Button>
                <Button variant="primary" size="lg" className="flex-1 gap-3 rounded-2xl py-6" onClick={retry}>
                  <RotateCcw className="w-5 h-5" /> Retake Quiz
                </Button>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h4 className="text-3xl font-black tracking-tight">Answer Keys</h4>
                <div className="flex gap-6 text-xs font-black uppercase tracking-widest text-slate-500">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500"></div> Correct</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div> Wrong</div>
                </div>
              </div>
              <div className="space-y-4">
                {shuffledQuestions.map((q, idx) => {
                  const answer = userAnswers.find(a => a.questionId === q.id);
                  return (
                    <div key={q.id} className="glass-card p-8 rounded-[2rem] border-l-8 transition-all group relative overflow-hidden" style={{ borderLeftColor: answer?.isCorrect ? '#10b981' : '#ef4444' }}>
                      <div className="flex items-start gap-6">
                        <div className="text-2xl font-black text-slate-800 tabular-nums">{(idx + 1).toString().padStart(2, '0')}</div>
                        <div className="space-y-6 flex-1">
                          <p className="text-2xl font-bold text-white leading-relaxed">{q.question}</p>
                          <div className="grid md:grid-cols-2 gap-4">
                             <div className="bg-green-500/10 p-5 rounded-2xl border border-green-500/20">
                                <span className="text-green-500/50 block text-[10px] uppercase font-black mb-2 tracking-widest">Reference Answer</span>
                                <span className="text-green-400 font-bold text-lg">{q.correctAnswer}</span>
                             </div>
                             {!answer?.isCorrect && (
                               <div className="bg-red-500/10 p-5 rounded-2xl border border-red-500/20">
                                 <span className="text-red-400/50 block text-[10px] uppercase font-black mb-2 tracking-widest">Your Answer</span>
                                 <span className="text-red-400 font-bold text-lg">{answer?.selectedOption}</span>
                               </div>
                             )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-20 mb-8 text-slate-700 text-[10px] font-black tracking-[0.4em] uppercase">
        Next-Gen Knowledge Engine &bull; AI-Powered Orchestration
      </footer>
    </div>
  );
}
